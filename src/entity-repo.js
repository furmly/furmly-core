const constants = require("./constants"),
  assert = require("assert"),
  systemEntities = constants.systemEntities,
  async = require("async"),
  misc = require("./misc"),
  _ = require("lodash"),
  debug = require("debug")("entity-repo"),
  generator = require("mongoose-gen"),
  ObjectID = require("mongodb").ObjectID,
  FurmlyProcess = require("./process"),
  FurmlyStep = require("./step"),
  FurmlyProcessor = require("./processor"),
  ElementFactory = require("./element-factory"),
  SimpleEntityStore = require("./entity-store"),
  FurmlyElement = require("./element"),
  FurmlyForm = require("./form"),
  FurmlyLib = require("./lib"),
  CodeGenerator = require("./code-gen"),
  ProcessorContext = require("./processor-context"),
  parser = require("./parser"),
  FurmlyAsyncValidator = require("./async-validator"),
  mongoose = require("mongoose"),
  FurmlySandbox = require("./sandbox");

mongoose.Promise = global.Promise;
const _elementFactory = new ElementFactory();

//initialize the sandbox.
const initSandbox = function() {
  const params = {
    entityRepo: this.getProcessorContext(),
    extensions: this.extensions
  };
  this.sandbox = new FurmlySandbox(params);
};

// This function is used to extract values from libs.
const extractValueFromLib = function() {
  if (this.args.params) {
    this.debug(this.args.params);
    let [uid, ...params] = this.args.params.split("|");
    uid = uid && uid.replace("$", "");
    if (typeof this.libs[uid] == "undefined") {
      callback(new Error("Undefined lib reference"));
    } else {
      if (Function.prototype.isPrototypeOf(this.libs[uid])) {
        this.libs[uid].apply(this, params.concat(callback));
      } else
        callback(
          null,
          params.reduce((item, x) => {
            if (item[x]) return item[x];
            return item;
          }, this.libs[uid])
        );
    }
  } else callback();
}.getFunctionBody();

/**
 * This class contains the persistence logic for all entities.
 * @class
 *
 * @memberOf module:Furmly
 * @param {Object} opts Class constructor parameters , includes ext,folder,delimiter,store...etc
 */
function EntityRepo(opts) {
  var self = this;
  opts = opts || {};
  this.models = {};
  this.schemas = {};
  this.validators = {};
  this.transformers = {};
  this.refs = {};
  this._changeDetection = {};
  this.entityExt = opts.ext || ".json";
  this.entityFolder = opts.folder || "./src/entities/";
  this.delimiter = opts.delimiter || /('|")\$\{(\w+)\}+('|")/i;
  this.codeGenerator = new CodeGenerator(opts.config.codeGenerator, parser);
  this._systemEntities = _.map(systemEntities, function(x) {
    return x;
  });
  this.store = opts.store || (() => new SimpleEntityStore(opts.storeTTL));

  this.config = opts.config;
  const isIDOnly = function(item) {
    return (
      typeof item == "string" ||
      ObjectID.prototype.isPrototypeOf(item) ||
      (item && Object.keys(item).length == 1 && item._id)
    );
  };
  const getIDOnly = function(item) {
    return (
      ((typeof item == "string" || ObjectID.prototype.isPrototypeOf(item)) &&
        item) ||
      item._id
    );
  };

  this.getLibValue = this.getLibValue.bind(this);
  this.runInSandbox = this.runInSandbox.bind(this);
  this.runProcessor = this.runProcessor.bind(this);
  Object.defineProperty(this, "processorEntityRepo", {
    enumerable: false,
    value: new ProcessorContext(this)
  });

  this.transformers[systemEntities.process] = function(item, fn) {
    if (!(item instanceof FurmlyProcess)) {
      var tasks = [];
      if (isIDOnly(item)) {
        tasks.push(
          self.queryEntity.bind(
            self,
            systemEntities.process,
            {
              _id: getIDOnly(item)
            },
            {
              full: true,
              one: true
            }
          )
        );
      } else {
        debug(`constructing a process ${item._id}`);
        tasks.push(function(callback) {
          if (!item.steps) {
            return callback(new Error("Process must include atleast one step"));
          }
          if (!item.save)
            item.save = self.getSaveService(systemEntities.process);
          if (item.steps.length > 1) {
            item.store = self.store;
          }
          //add entityRepo to process to allow fetch processor have an entityRepo while executing.
          //execute.
          if (item.fetchProcessor) {
            item.runInSandbox = self.runInSandbox;
          }
          var itasks = [];
          item.steps.forEach(function(step) {
            itasks.push(
              self.transformers[systemEntities.step].bind(self, step)
            );
          });
          async.parallel(itasks, function(er, steps) {
            if (er) return callback(er);

            item.steps = steps;
            let _process;
            if (item.fetchProcessor) {
              self.transformers[systemEntities.processor](
                item.fetchProcessor,
                function(er, fp) {
                  if (er) return callback(er);
                  item.fetchProcessor = fp;
                  try {
                    _process = new FurmlyProcess(item);
                  } catch (e) {
                    return callback(e);
                  }
                  callback(null, _process);
                }
              );
              return;
            }
            try {
              _process = new FurmlyProcess(item);
            } catch (e) {
              return callback(e);
            }
            callback(null, _process);
          });
        });
      }
      return async.waterfall(tasks, fn);
    }
    return fn(null, item);
  };

  this.transformers[systemEntities.step] = function(item, fn) {
    if (!(item instanceof FurmlyStep)) {
      var tasks = [],
        processorTasks = [],
        postprocessorTasks = [];
      if (isIDOnly(item)) {
        self.queryEntity(
          systemEntities.step,
          {
            _id: getIDOnly(item)
          },
          {
            full: true,
            one: true
          },
          fn
        );
      } else {
        if (!item.save) item.save = self.getSaveService(systemEntities.step);

        if (item.stepType == constants.STEPTYPE.CLIENT) {
          item.runInSandbox = self.runInSandbox;
          tasks.push(function(callback) {
            self.transformers.form(item.form, function(er, form) {
              if (er) return callback(er);
              item.form = form;
              return callback();
            });
          });
        }
        if (item.postprocessors) {
          item.postprocessors.forEach(function(proc) {
            postprocessorTasks.push(
              self.transformers[systemEntities.processor].bind(self, proc)
            );
          });
          tasks.push(function(callback) {
            async.parallel(postprocessorTasks, function(er, postprocessors) {
              if (er) return callback(er);
              item.postprocessors = postprocessors;
              callback();
            });
          });
        }
        (item.processors || []).forEach(function(proc) {
          processorTasks.push(
            self.transformers[systemEntities.processor].bind(self, proc)
          );
        });
        if (processorTasks.length)
          tasks.push(function(callback) {
            async.parallel(processorTasks, function(er, processors) {
              if (er) return callback(er);
              item.processors = processors;
              callback();
            });
          });

        async.parallel(tasks, function(er) {
          if (er) return fn(er);
          let _step;
          try {
            _step = new FurmlyStep(
              Object.assign(item, { config: self.config })
            );
          } catch (e) {
            return fn(e);
          }
          return fn(null, _step);
        });
      }
      return;
    }
    return fn(null, item);
  };
  this.transformers[systemEntities.asyncValidator] = function(item, fn) {
    basicTransformer(
      item,
      FurmlyAsyncValidator,
      systemEntities.asyncValidator,
      fn
    );
  };
  this.transformers[systemEntities.processor] = function(item, fn) {
    item.codeGenerator = self.codeGenerator;
    basicTransformer(item, FurmlyProcessor, systemEntities.processor, fn);
  };
  this.transformers.element = function(item, fn) {
    if (!(item instanceof FurmlyElement)) {
      if (isIDOnly(item)) {
        return self.queryEntity(
          systemEntities.element,
          {
            _id: getIDOnly(item)
          },
          {
            full: true,
            one: true
          },
          fn
        );
      }

      if (!item.getLibValue) item.getLibValue = self.getLibValue;
      if (!item.runProcessor) item.runProcessor = self.runProcessor;
      if (!item.save) item.save = self.getSaveService(systemEntities.element);

      async.parallel(
        _.map(item.asyncValidators, function(x) {
          return self.transformers[systemEntities.asyncValidator].bind(self, x);
        }),
        function(er, asyncValidators) {
          if (er) return fn(er);
          item.asyncValidators = asyncValidators;
          let _element;
          try {
            _element = _elementFactory.get(item);
          } catch (e) {
            return fn(e);
          }
          return fn(null, _element);
        }
      );
      return;
    }
    return fn(null, item);
  };
  this.transformers.form = function(item, fn) {
    if (!(item instanceof FurmlyForm)) {
      if (!item)
        return (
          debug("step does not have a form"),
          fn(new Error("Step requires a form"))
        );
      async.parallel(
        _.map(item.elements, function(element) {
          return self.transformers.element.bind(self.transformers, element);
        }),
        function(er, elements) {
          if (er) return fn(er);
          item.elements = elements;
          let _form;
          try {
            _form = new FurmlyForm(item);
          } catch (e) {
            return fn(e);
          }
          return fn(null, _form);
        }
      );
      return;
    }
    return fn(null, item);
  };
  this.transformers[systemEntities.lib] = function(item, fn) {
    item.codeGenerator = self.codeGenerator;
    basicTransformer(item, FurmlyLib, systemEntities.lib, fn);
  };

  function basicTransformer(item, clazz, entName, fn) {
    if (!(item instanceof clazz)) {
      if (isIDOnly(item)) {
        return self.queryEntity(
          entName,
          {
            _id: getIDOnly(item)
          },
          {
            full: true,
            one: true
          },
          fn
        );
      }

      if (!item.save) item.save = self.getSaveService(entName);
      let i;

      try {
        i = new clazz(item);
      } catch (e) {
        return fn(e);
      }
      return fn(null, i);
    }

    return fn(null, item);
  }
}

/**
 * This function sets the extensions to processor context (services provided by Server etc.)
 * @param {Object} manager infrastructure
 */
EntityRepo.prototype.extendProcessorContext = function(extensions) {
  const oldEx = this.extensions;
  this.extensions = extensions;
  this.resetSandbox = oldEx !== extensions && this.sandbox;
};

/**
 * Used by elements/validators when describing themselves to resolve library values.
 * @param  {String}   params library key
 * @param  {Function} fn     Callback function.
 * @return {Void}          [description]
 */
EntityRepo.prototype.getLibValue = function(params, fn) {
  this.runInSandbox(
    {
      processors: [
        new FurmlyProcessor({
          title: "dynamic processor",
          code: extractValueFromLib,
          _id: "dynamic",
          _references: [params.split("|")[0].replace("$", "")],
          save: () => {}
        })
      ],
      includeExtensions: true,
      context: { params }
    },
    fn
  );
};

EntityRepo.prototype.runInSandbox = function(
  { processors, postProcessors = [], context = {}, includeExtensions = false },
  fn
) {
  if (!this.sandbox || this.resetSandbox) {
    initSandbox.call(this);
  }
  this.sandbox.run(
    { processors, postProcessors, includeExtensions, context },
    fn
  );
};

EntityRepo.prototype.runProcessor = function(processor, context, fn) {
  if (!processor)
    throw new Error("Either processor _id or uid must be supplied");
  let query;
  if (this.isValidID(processor)) {
    query = { _id: processor };
  } else {
    query = { uid: processor };
  }
  this.queryEntity(systemEntities.processor, query, (er, processors) => {
    if (er) return fn(er);
    this.runInSandbox({ processors, includeExtensions: true, context }, fn);
  });
};

/**
 * Function used to initialize components
 * @param  {Function} callback Callback called when initialization is completed
 * @return {Void}            No return type
 */
EntityRepo.prototype.init = function(callback) {
  const connectTimer = misc.timer();
  generator.setDefault("requiresIdentity", function(value) {
    return true;
  });
  const _init = () => {
    debug(`${connectTimer()} secs to connect to the db`);
    const initTimer = misc.timer();
    if (typeof this.store === "function") {
      this.store = this.store();
    }

    let self = this;
    let entities = require("./default-entities");

    //horrible design.
    //if mongoose changes their interface this will break.
    this.$schemas = mongoose.connection.db.collection("schemas");
    this.$_schema_Schema = {
      name: "Schema",
      schema: {
        name: { type: "String" },
        schema: { type: "Mixed" }
      }
    };
    const updateSchemaTimer = misc.timer();

    this.$schemas.bulkWrite(
      entities.reduce((acc, x) => {
        acc.push({
          updateOne: {
            filter: { name: x.name },
            update: { $set: x },
            upsert: true
          }
        });
        return acc;
      }, []),
      function(er) {
        if (er) return callback(er);
        debug(`${updateSchemaTimer()} seconds to update schemas`);
        const createSchemasTimer = misc.timer();
        self.createSchemas((...args) => {
          debug(`${initTimer()} seconds to complete init`);
          debug(`${createSchemasTimer()} seconds to create schemas`);
          callback.apply(null, args);
        });
      }
    );
  };
  mongoose
    .connect(this.config.data.furmly_url, {
      useNewUrlParser: true,
      useCreateIndex: true
    })
    .then(_init)
    .catch(e => {
      if (e && e.message !== "Trying to open unclosed connection.")
        return callback();

      return _init(e);
    });
};

EntityRepo.prototype.getProcessorContext = function() {
  return this.processorEntityRepo;
};

//service injected into domain objects for persistence.
/**
 * Service used by entities to save themselves.
 * @param  {String} entName Entity Name
 * @return {Function}  Object representing save service.
 */
EntityRepo.prototype.getSaveService = function(entName) {
  var self = this;
  /**
   * Save serice function tailored to entName
   * @param  {Object}   info
   * @param  {Function} fn   Callback
   *
   */
  return function(info, fn) {
    function transformResult(er, result) {
      if (er) return fn(er);
      assert.strictEqual(
        Boolean(result._id),
        true,
        "Saved entity must return an _id"
      );
      fn(null, {
        _id: result._id
      });
    }

    if (!info._id) {
      debug(
        `${entName} entity does not have an id , creating new ...\n ${JSON.stringify(
          info
        )} `
      );
      self.createEntity(entName, info, transformResult);
    } else {
      debug(`${entName} entity has an id , updating ${JSON.stringify(info)}`);
      self.updateEntity(entName, info, transformResult);
    }
  };
};

/**
 * Creates an Entity Schema.
 * @param  {some}   name   Config Name
 * @param  {Object}   config Object schema
 * @param  {Function} fn     Callback
 *
 */
EntityRepo.prototype.createConfig = function(name, config, fn) {
  if (this._systemEntities.indexOf(name) !== -1)
    throw new Error("Cannot Create Entity with that name.");
  Object.assign(config, {
    created: { type: "Date" },
    updated: { type: "Date" }
  });
  this.$schemas.insertOne({ name, schema: config, updated: new Date() }, er => {
    if (er) return fn(er);

    this.createSchemas(er => {
      return fn((er && er) || null);
    });
  });
};

EntityRepo.prototype.getPath = function(name) {
  return this.entityFolder + name + this.entityExt;
};
/**
 * Get Schema Configuration
 * @param  {String}   name Name of Collection/Table
 * @param  {Function} fn   Callback
 *
 */
EntityRepo.prototype.getConfig = function(name, fn) {
  if (!name) return fn(new Error("name must be defined"));

  this.$schemas.findOne({ name }, (er, schema) => {
    if (er) return fn(er);
    if (!schema) return fn(new Error("Cannot find that schema " + name));

    return fn(null, schema.schema);
  });
};
/**
 * Get Schema Configuration Names
 * @param {Boolean} includeSchema - include the actual schema
 * @param {Boolean} includeInternalSchema - include internal schemas
 * @param {Object} query - filter
 * @param {Object} options - options passed with query
 * @param  {Function} fn Callback
 *
 */
EntityRepo.prototype.getConfigNames = function(
  includeSchema,
  includeInternalSchema,
  query,
  options,
  fn
) {
  let argsLength = Array.prototype.slice.call(arguments).length,
    fields = { name: 1 };
  if (argsLength == 1) {
    fn = includeSchema;
    includeSchema = false;
  }
  if (argsLength == 2) {
    fn = includeInternalSchema;
    includeInternalSchema = false;
  }
  if (argsLength == 3) {
    fn = query;
    query = null;
  }
  if (argsLength == 4) {
    fn = options;
    options = null;
  }
  if (!!includeSchema) {
    fields.schema = 1;
  }
  debug("options:");
  debug(options);
  debug("query:");
  debug(query);
  this.$schemas
    .find(
      query || {},
      Object.assign(options || {}, {
        fields
      })
    )
    .toArray((er, schemas) => {
      if (er) return fn(er);

      if (includeInternalSchema) {
        schemas.push(this.$_schema_Schema);
      }

      return fn(null, (!includeSchema && schemas.map(x => x.name)) || schemas);
    });
};
EntityRepo.prototype.isValidID = function(id) {
  return mongoose.Types.ObjectId.isValid(id);
};
EntityRepo.prototype.getAllConfiguration = function(fn) {
  this.$schemas.find({}, { schema: 1 }).toArray((er, schemas) => {
    if (er) return fn(er);

    return fn(null, schemas.map(x => x.schema));
  });
};
/**
 * Used to count schema using a query.
 * @param {Object} query - search criteria.
 * @param {Function} fn - Callback function
 */
EntityRepo.prototype.countConfig = function(query = {}, fn) {
  this.$schemas.countDocuments(query, fn);
};

/**
 * Used to create an entity id from a string
 * @param {string} id - entity id string
 * @returns {Object}
 */
EntityRepo.prototype.createId = function(string) {
  return ObjectID(string);
};

/**
 * Used to update schemas.
 * @param {String} name - name of schema to update.
 * @param {Object} schema - Schema config.
 * @param {Function} fn - Callback function
 */
EntityRepo.prototype.updateConfig = function(name, config, fn) {
  if (!name) return fn(new Error("name must be defined"));

  if (this._systemEntities.indexOf(name) !== -1)
    throw new Error("Cannot Update Entity with that name.");

  Object.assign(config, {
    created: { type: "Date" },
    updated: { type: "Date" }
  });
  this.$schemas.findOneAndUpdate(
    { name },
    { $set: { schema: config, updated: new Date() } },
    er => {
      if (er) return fn(er);

      this.createSchemas(er => {
        return fn((er && er) || null);
      });
    }
  );
};

/**
 * Find entity  of type {name} using {filter}
 * @param  {String}   name    Name of Collection/Table
 * @param  {Object}   filter  Query filter
 * @param  {Object}   options sorting,populating extra values etc [optional]
 * @param  {Function} fn      Callback
 *
 */
EntityRepo.prototype.queryEntity = function(name, filter, options, fn) {
  var self = this,
    circularDepth =
      options && options.circularDepth ? options.circularDepth : 1,
    referenceCount = {};
  if (Array.prototype.slice.call(arguments).length == 3) {
    fn = options;
    options = null;
  }

  if (typeof fn !== "function")
    throw new Error(
      `fn passed to queryEntity is not a function ${JSON.stringify(
        arguments,
        null,
        " "
      )}`
    );

  function populate(arr, result, parent) {
    arr.forEach(function(item) {
      if (parent && new RegExp(item.path + "$").test(parent)) {
        referenceCount[item.model] = referenceCount[item.model]
          ? referenceCount[item.model] + 1
          : 1;
      }

      result.push((parent ? parent + "." : "") + item.path);
      if (
        self.refs[item.model] &&
        (referenceCount[item.model] || 0) < circularDepth
      ) {
        populate(self.refs[item.model], result, result[result.length - 1]);
      }
    });
    return result;
  }

  function transformResult(er, result) {
    if (er) return fn(er);
    if (self.transformers[name] && (!options || !options.noTransformaton)) {
      async.parallel(
        _.map(result, function(x) {
          return self.transformers[name].bind(self.transformers, x);
        }),
        function(er, transformed) {
          if (!fn) {
            debug("no callback");
          }
          if (er) return fn(er);
          if (options && options.one && transformed)
            transformed = transformed.length ? transformed[0] : null;

          if (options && !options.one && !transformed.length) {
            debug(name);
          }
          fn(null, transformed);
        }
      );
      return;
    }
    if (!fn) {
      debug("no callback");
    }
    fn(
      null,
      options && options.one ? (result.length ? result[0] : null) : result
    );
  }

  if (!this.models[name]) {
    debug(`cannot find any model by that name ${name}`);
    return setImmediate(fn, new Error("Model does not exist"));
  }
  var query = this.models[name].find(filter);
  if (
    options &&
    options.full &&
    this.refs[name] &&
    this.refs[name].length !== 0
  ) {
    debug(`entity being queried : ${name}`);
    var populateString = populate(self.refs[name], []);
    populateString.forEach(function(string) {
      if ((string.match(/\./gi) || []).length >= 1) {
        var cur = "",
          temp = "",
          m = {},
          iterator = function(x, index, arr) {
            cur += x;
            temp += x;
            if (index < arr.length - 1) {
              if (populateString.indexOf(temp) !== -1) cur += "|";
              else {
                cur += ".";
              }
              temp += ".";
            }
          },
          reducer = function(sum, c) {
            if (!sum.path) {
              sum.path = c;
              return sum;
            }
            sum.populate = {
              path: c
            };
            return sum.populate;
          };
        string.split(".").forEach(iterator);
        _.reduce(cur.split("|"), reducer, m);
        debug(m);
        query.populate(m);
        return;
      }
      debug(string);
      query.populate(string);
    });
  }
  if (options) {
    if (options.sort) {
      query = query.sort(options.sort);
    }
    if (options.limit) {
      query.limit(options.limit);
    }
    if (options.fields) {
      query.select(options.fields);
    }
    if (options.skip) {
      query.skip(options.skip);
    }
  }

  query.lean().exec(transformResult);
};
/**
 * Update an entity
 * @param  {String}   name Name of the collection/table entity is located in
 * @param  {Object}   data Update data
 * @param  {Function} fn   Callback
 *
 */
EntityRepo.prototype.updateEntity = function(name, data, fn) {
  var self = this;
  if (!this.models[name]) {
    return setImmediate(fn, new Error("Model does not exist"));
  }
  Object.assign(data, { updated: new Date() });

  let isArray,
    multi =
      (isArray = Array.prototype.isPrototypeOf(data._id)) ||
      (typeof data._id == "undefined" && data.$query && data.$update),
    getData = () => {
      return (multi && isArray) || !multi ? data : data.$update;
    },
    getQuery = () => {
      return !multi
        ? {
            _id: data._id
          }
        : (isArray && { _id: { $in: data._id } }) || data.$query;
    };
  if (this._changeDetection[name]) {
    this.models[name].find(getQuery(), function(er, v) {
      if (er) return fn(er);
      if (!v.length) return fn(new Error("That entity does not exist"));

      v.forEach(e => {
        var merged = _.assign(e, getData());
        debug(merged);
        self._changeDetection[name].forEach(function(field) {
          merged.set(field, getData()[field]);
        });
        merged.save(fn);
      });
    });
  } else {
    this.models[name].updateOne(getQuery(), getData(), { multi }, function(
      er,
      stat
    ) {
      if (er) return fn(er);
      if (stat <= 0) return fn(new Error("that entity does not exist"));
      fn(null, {
        _id: data._id
      });
    });
  }
};

/**
 * @param {String} entName  - Storage name of entity eg _0Processor
 * @param {String} key - Simple name for system entity eg processor
 * @param {Object} data - System entity to save
 * @param {Object} options - options
 * @param {Func} fn - Callback function
 */
EntityRepo.prototype.saveSystemEntity = function(
  entName,
  key,
  data,
  options,
  fn
) {
  if (Array.prototype.slice.call(arguments).length == 4) {
    fn = options;
    options = null;
  }
  if (this.transformers[entName]) {
    this.transformers[entName](data, (er, model) => {
      if (er) return fn(er);
      model.save((er, item) => {
        if (er) return fn(er);
        if (options && options.retrieve) {
          this.queryEntity(entName, { _id: item._id }, function(e, x) {
            fn(e, x && x[0]);
          });
          return;
        }
        if (typeof fn !== "function") {
          debug(fn);
          debug("fn is not a function");
          debug(data);
          debug(options);
        }
        fn(er, item);
      });
    });
    return;
  }

  if (!data._id) this.createEntity(systemEntities[key], data, fn);
  else this.updateEntity(systemEntities[key], data, fn);
};
/**
 * Create an entity
 * @param  {String}   name Name of the collection/table entity is located in
 * @param  {Object}   data Update data
 * @param  {function} fn   Callback
 *
 */
EntityRepo.prototype.createEntity = function(name, data, fn) {
  if (!this.models[name]) {
    return setImmediate(fn, new Error("Model does not exist"));
  }
  let now = new Date();
  var item = new this.models[name](
    Object.assign(data, { created: now, updated: now })
  );
  item.save(fn);
};
/**
 * Function that runs aggregation query on persistance object.
 * @param  {String}    name Name of collection/table to run aggregation on
 * @param  {...Object} rest Other Args including aggregation query and callback
 *
 */
EntityRepo.prototype.aggregateEntity = function(name, ...rest) {
  let model = this.models[name];
  //look for any prop with $objectID and transform it an object id.
  //its ok cause the filter object is never too large.
  misc.runThroughObj(
    [
      (key, data, result, parent, parentKey, index) => {
        if (key == "$objectID") {
          let id = ObjectID(data[key]);
          if (!index) parent[parentKey] = id;
          else parent[parentKey][index] = id;
        }
      }
    ],
    rest[0]
  );
  debug(JSON.stringify(rest[0], null, " "));
  return model.aggregate.apply(model, rest);
};
/**
 * Count number of entities that match the filter supplied
 * @param  {String}   name   Name of Collection/Table
 * @param  {Object}   filter Query
 * @param  {Function} fn     Callback
 *
 */
EntityRepo.prototype.countEntity = function(name, filter, fn) {
  if (!this.models[name]) {
    return setImmediate(fn, new Error("Model does not exist"));
  }
  debug(`filter:${JSON.stringify(filter, null, " ")}`);
  this.models[name].countDocuments(filter, fn);
};
/**
 * Normalizes mongoose collection names to actual mongodb  collection names
 * @param  {String} name Name of Collection/Table
 * @return {String}      Correct collection name.
 */
EntityRepo.prototype.getCollectionName = function(name) {
  return (this.models[name] && this.models[name].collection.name) || null;
};
/**
 * Delete an entity with the supplied id
 * @param  {String}   name Name of Collection/Table
 * @param  {String}   id   Id of object to delete
 * @param  {Function} fn   Callback
 *
 */
EntityRepo.prototype.deleteEntity = function(name, id, fn) {
  if (!this.models[name]) {
    return setImmediate(fn, new Error("Model does not exist"));
  }
  let query = { _id: id };
  if (Array.prototype.isPrototypeOf(id)) {
    query = { _id: { $in: id } };
  }
  if (
    !Array.prototype.isPrototypeOf(id) &&
    typeof id == "object" &&
    !ObjectID.prototype.isPrototypeOf(id)
  ) {
    if (!Object.keys(id).length)
      return setImmediate(fn, new Error(`That would delete all ${name}`));
    query = id;
  }

  this.models[name].remove(query, fn);
};
/**
 * Create all the system schemas
 * @param  {Function} fn callback
 * @return {void}
 */
EntityRepo.prototype.createSchemas = function(fn) {
  var self = this;
  let fetchSchemaTimer = misc.timer();
  function containsSchema(string) {
    let exp = /"schema"\s*\:\s*"(\w+)"/gi,
      match,
      result = [];
    while ((match = exp.exec(JSON.stringify(string)))) {
      result.push(match[1]);
    }
    let r =
      !!result.length &&
      result.reduce((sum, x) => {
        return (sum[x] = 1), sum;
      }, {});

    debug(r);
    return r;
  }
  function assignModel(callback) {
    var that = this;
    const assignModelTime = misc.timer();
    try {
      var existing = self.models[this.prop] || mongoose.model(this.prop);
      var newSchema = this.item;
      var diffTimer = misc.timer();
      var diff = _.omitBy(newSchema, function(v, k) {
        return _.isEqual(self.schemas[that.prop][k], v);
      });
      debug(`${diffTimer()} seconds to calculate the difference in schema`);
      //check if any keys have been deleted
      var deletedTimer = misc.timer();
      var couldBeDeleted = _.omitBy(self.schemas[that.prop], function(v, k) {
        return _.isEqual(newSchema[k], v);
      });
      debug(
        `${deletedTimer()} seconds to calculated if keys need to be deleted`
      );

      var indexes = removeCompoundIndexes(diff);
      var change = Object.keys(diff);
      removeCompoundIndexes(couldBeDeleted);
      Object.keys(couldBeDeleted).forEach(k => {
        if (!diff[k]) existing.schema.remove(k);
      });
      if (diff && change.length) {
        existing.schema.add(generator.convert(diff, mongoose));
        removeCompoundIndexes(newSchema);
        self.models[this.prop] = existing;
        self.schemas[this.prop] = newSchema;
        self._changeDetection[this.prop] = change;
        self.refs[that.prop] = getRefs(newSchema);
      }
      if (indexes.length) {
        debug(`model has indexes:${indexes}`);
        setupCompoundIndexes(
          self.models[this.prop].schema,
          indexes,
          self.models[this.prop]
        );
      }
    } catch (e) {
      if (e.name == "MissingSchemaError") {
        var _schema = that.item;
        var indexes = removeCompoundIndexes(_schema);
        self.schemas[that.prop] = _schema;
        self.refs[that.prop] = getRefs(self.schemas[that.prop]);
        var schema = new mongoose.Schema(
          generator.convert(self.schemas[that.prop], mongoose),
          { autoIndex: false }
        );
        self.models[that.prop] = mongoose.model(that.prop, schema);
        if (indexes.length) {
          setupCompoundIndexes(schema, indexes, self.models[that.prop]);
        }
      } else {
        debug(`${assignModelTime()} seconds to assign model`);
        return callback(e);
      }
    }
    debug(`assigned model ${this.prop}`);
    debug(`${assignModelTime()} seconds to assign model`);
    callback();
  }
  function setupCompoundIndexes(schema, indexes, model) {
    debug("setting up compound_index");
    debug(indexes);
    indexes.forEach(x => {
      schema.index(
        x.reduce((s, v) => {
          return (s[v] = 1), s;
        }, {}),
        { unique: true, sparse: true }
      );
    });
    model.ensureIndexes(function(err) {
      if (err) {
        debug("An error occurred while trying to ensure indexes");
        debug(err);
      }
    });
  }
  function removeCompoundIndexes(schema) {
    let indexes = [];
    if (schema.compound_index) {
      indexes = schema.compound_index;
      delete schema.compound_index;
    }
    return indexes;
  }
  function getRefs(file, key) {
    var props = Object.keys(file),
      refs = [];
    if (!key) key = "";
    props.forEach(function(prop) {
      if (prop == "ref" || prop == "refPath") {
        refs.push({
          model: file.ref,
          path: key.substring(0, key.length - 1)
        });
        return;
      }

      if (typeof file[prop] == "object") {
        var obj = file[prop];
        if (obj instanceof Array) {
          if (typeof obj[0] == "object") obj = obj[0];
          else return;
        }
        if (obj.schema && self.schemas[obj.schema]) {
          obj = Object.assign({}, self.schemas[obj.schema], obj.extend || {});
        }
        refs = refs.concat(getRefs(obj, key + prop + "."));
        return;
      }
    });

    return refs;
  }

  function registerValidator(callback) {
    if (self.config.validators) {
      if (!self.config.validators[this.name]) {
        debug(`Unknown validator ${this.name}`);
        return setImmediate(callback);
      }
      this.validators[this.name] = self.config.validators;
      generator.setValidator(this.name, this.validators[this.name]);
    }
    setImmediate(callback);
  }
  const validate_exp = /"validate"\s*\:\s*"(\w+)"/gi;
  function parseEntities(files, fn) {
    const parseTimer = misc.timer();
    var tasks = [
        function(callback) {
          return callback(null);
        }
      ],
      deffered = [],
      assigned = {};

    for (let prop in files) {
      if (files.hasOwnProperty(prop)) {
        let item = parse(files[prop], files);

        var match = validate_exp.exec(item);
        while (match) {
          tasks.push(
            registerValidator.bind({
              name: match[1]
            })
          );
          match = validate_exp.exec(item);
        }

        // Generate the Schema object.
        tasks.push(
          async.timeout(_fn => {
            let dependencies;
            let _continue = function(callback, prop, er) {
              if (er) return callback(er);
              assigned[prop] = 1;

              //find out if some models have met their conditions required to resolve
              if (deffered.length) {
                let resolve = [],
                  tobeRemoved = [];
                deffered.forEach((x, index) => {
                  if (_.isMatch(assigned, x)) {
                    tobeRemoved.push(x);
                    resolve.push(cb => {
                      assignModel.call(
                        {
                          item: x.description,
                          prop: x.name
                        },
                        _continue.bind(this, cb, x.name)
                      );
                    });
                  }
                });
                if (resolve.length) {
                  //remove all the deferred guys about to be executed.
                  tobeRemoved.forEach(x => {
                    deffered.splice(deffered.indexOf(x), 1);
                  });
                  return async.parallel(resolve, (er, items) => {
                    return (er && callback(er)) || callback();
                  });
                }
              }
              callback();
            };
            if (
              (dependencies = containsSchema(item)) &&
              !debug(dependencies) &&
              !_.isMatch(assigned, dependencies)
            ) {
              Object.defineProperties(dependencies, {
                name: {
                  enumerable: false,
                  get: function() {
                    return prop;
                  }
                },
                description: {
                  enumerable: false,
                  get: function() {
                    return item;
                  }
                }
              });
              return deffered.push(dependencies), setImmediate(_fn);
            }
            assignModel.call(
              {
                item: item,
                prop: prop
              },
              _continue.bind(this, _fn, prop)
            );
          }, 1500)
        );

        // self[prop] = item;
        //this more or less caches the expansion
        files[prop] = item;
      }
    }
    async.parallel(tasks, function(er, result) {
      debug(`${parseTimer()} seconds to parse entities`);
      debug(self.refs);

      (!!er && fn(er)) || fn();
    });
  }

  function parse(file, allFiles) {
    var del = self.delimiter;
    var result = file;
    var match = del.exec(file);
    while (match) {
      result.replace(match[0], parse(allFiles[match[2]]));
      match = del.exec(file);
    }
    return result;
  }
  async.waterfall(
    [
      callback => {
        this.$schemas.find({}).toArray((er, schemas) => {
          if (er) return callback(er);
          debug(`${fetchSchemaTimer()} seconds to fetch schema...`);
          return callback(
            null,
            schemas.reduce((sum, x) => {
              return (
                (sum[x.name] = Object(x.schema, {
                  created: { type: "Date" },
                  updated: { type: "Date" }
                })),
                sum
              );
            }, {})
          );
        });
      },
      parseEntities
    ],
    fn || function() {}
  );
};

module.exports = EntityRepo;
