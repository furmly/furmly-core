const constants = require("./constants"),
  systemEntities = constants.systemEntities,
  misc = require("./misc"),
  async = require("async"),
  debug = require("debug")("engine"),
  util = require("util"),
  _ = require("lodash"),
  EventEmitter = require("events"),
  defaultProcessors = require("./default-processors")(
    constants,
    systemEntities
  ),
  defaultLibs = require("./default-libs")(constants),
  defaultProcesses = require("./default-processes")(constants, systemEntities);
/**
 * The Engine represents the boundary between the problem domain and the outside world.
 * @constructor
 * @memberOf module:Furmly
 * @param {Object} opts Constructor arguments
 */
function FurmlyEngine(opts) {
  debug("constructing furmly engine...");
  if (!opts) throw new Error("opts must be valid");

  if (!opts.entitiesRepository)
    throw new Error("opts.entitiesRepository must be valid");

  this.entitiesRepository = opts.entitiesRepository;
}

util.inherits(FurmlyEngine, EventEmitter);

/**
 * Initializes the system
 * @param  {Function} fn callback
 * @return {Any}      nothing
 */
FurmlyEngine.prototype.init = function(fn) {
  var self = this,
    _processors,
    dProcessors = Object.keys(defaultProcessors),
    dLibs = Object.keys(defaultLibs),
    dProcesses = Object.keys(defaultProcesses);

  //create all system required configs if they dont exist.

  async.waterfall(
    [
      this.entitiesRepository.init.bind(this.entitiesRepository),
      this.queryProcessor.bind(this, {
        uid: {
          $in: dProcessors
        }
      }),
      (processors, callback) => {
        const uidsIn = [];
        const uidsNotIn = _.differenceWith(dProcessors, processors, function(
          uid,
          obj
        ) {
          let result = uid == obj.uid;
          if (result) {
            var _proc = Object.assign({ _id: obj._id }, defaultProcessors[uid]);
            uidsIn.push(_proc);
          }
          return result;
        });
        const tasks = [];
        for (var i = 0; i < uidsNotIn.length; i++)
          tasks.push(
            self.saveProcessor.bind(self, defaultProcessors[uidsNotIn[i]], {
              retrieve: true
            })
          );

        for (var i = 0; i < uidsIn.length; i++)
          tasks.push(
            self.saveProcessor.bind(self, uidsIn[i], {
              retrieve: true
            })
          );

        async.parallel(tasks, function(er, ps) {
          if (er) return callback(er);

          ps.forEach(x => {
            if (
              !uidsIn.filter(v => v._id.toString() == x._id.toString()).length
            )
              self.emit("default-processor-created", _.cloneDeep(x));
          });
          callback(null, ps);
        });
        return;
      },
      (processors, callback) => {
        _processors = processors;
        callback();
      },
      this.queryLib.bind(this, {
        uid: {
          $in: dLibs
        }
      }),
      (libs, callback) => {
        const uidsIn = [];
        const uidsNotIn = _.differenceWith(dLibs, libs, function(uid, obj) {
          const result = uid == obj.uid;
          if (result) {
            const _lib = Object.assign({ _id: obj._id }, defaultLibs[uid]);
            uidsIn.push(_lib);
          }
          return result;
        });
        const tasks = [];

        for (var i = 0; i < uidsNotIn.length; i++)
          tasks.push(
            self.saveLib.bind(self, defaultLibs[uidsNotIn[i]], {
              retrieve: true
            })
          );

        for (var i = 0; i < uidsIn.length; i++)
          tasks.push(
            self.saveLib.bind(self, uidsIn[i], {
              retrieve: true
            })
          );

        async.parallel(tasks, function(er, ps) {
          if (er) return callback(er);
          callback();
        });
        return;
      },
      this.queryProcess.bind(this, {
        uid: {
          $in: dProcesses
        }
      }),
      (exists, callback) => {
        if (!exists.length || dProcesses.length !== exists.length) {
          const tasks = [];
          const cb = (data, callback) => {
            self.saveProcess(
              data,
              {
                retrieve: true,
                full: true
              },
              function(er, proc) {
                if (er) return fn(er);
                self.emit("default-process-created", _.cloneDeep(proc));
                callback(null, proc);
              }
            );
          };

          const args = _processors.reduce((x, a) => {
            x[a.uid] = a._id;
            return x;
          }, {});
          const doesntExist = _.differenceWith(
            dProcesses,
            exists,
            (uid, obj) => {
              return uid == obj.uid;
            }
          );

          for (var i = 0; i < doesntExist.length; i++)
            tasks.push(cb.bind(self, defaultProcesses[doesntExist[i]](args)));

          async.parallel(tasks, callback);
        } else return callback();
      }
    ],
    er => {
      if (er) return fn(er);
      fn();
    }
  );
};

FurmlyEngine.prototype.isValidID = function(id) {
  return this.entitiesRepository.isValidID(id);
};
FurmlyEngine.prototype.extendProcessorContext = function(extensions) {
  this.entitiesRepository.extendProcessorContext(extensions);
};

FurmlyEngine.prototype.runProcessor = function(context, processor, fn) {
  this.entitiesRepository.runInSandbox(
    { processors: [processor], context, includeExtensions: true },
    fn
  );
};

/**
 * Creates an Entity Schema configuration
 * @param  {String}   name   Name of Schema Config
 * @param  {String}   config Configuration
 * @param  {Function} fn     callback
 * @return {Any}           nothing
 */
FurmlyEngine.prototype.createEntityConfiguration = function(name, config, fn) {
  this.entitiesRepository.createConfig(name, config, fn);
};

/**
 * Updates an existing Entity Schema configuration
 * @param  {String}   name   Name of Schema Config
 * @param  {String}   config Configuration
 * @param  {Function} fn     callback
 * @return {Any}             nothing
 */
FurmlyEngine.prototype.updateEntityConfiguration = function(name, config, fn) {
  this.entitiesRepository.updateConfig(name, config, fn);
};

/**
 * Returns all the names of the entities in the system
 * @param  {Function} fn Callback
 * @return {Array}      List of entity name
 */
FurmlyEngine.prototype.allEntityConfigurations = function(...args) {
  this.entitiesRepository.getConfigNames.apply(this.entitiesRepository, args);
};

FurmlyEngine.prototype.countConfigurations = function(...args) {
  this.entitiesRepository.countConfig.apply(this.entitiesRepository, args);
};
/**
 * Updates an instance of an Entity Schema
 * @param  {String}   name   Name of Schema Config
 * @param  {String}   data instance
 * @param  {Function} fn     callback
 * @return {Object}          updated instance
 */
FurmlyEngine.prototype.updateEntityInstance = function(name, data, fn) {
  this.entitiesRepository.updateEntity(name, data, fn);
};

/**
 * Creates an instance of an Entity Schema
 * @param  {String}   name Name of Schema Config
 * @param  {Object}   data object containing info to save
 * @param  {Function} fn   callback
 * @return {Object}        created instance.
 */
FurmlyEngine.prototype.createEntityInstance = function(name, data, fn) {
  this.entitiesRepository.createEntity(name, data, fn);
};

/**
 * Queries for instance(s) of supplied Entity
 * @param  {String}   name    Name of Schema Config
 * @param  {Object}   filter  Object filter for schema eg .._id=value
 * @param  {Object}   options Options for changing behavior of the function , options include full,one..etc
 * @param  {Function} fn      callback
 * @return {Any}              either an array of entity instances or a single instance
 */
FurmlyEngine.prototype.query = function(name, filter, options, fn) {
  if (Array.prototype.slice.call(arguments).length == 3) {
    fn = options;
    options = null;
  }
  this.entitiesRepository.queryEntity(name, filter, options, fn);
};

FurmlyEngine.prototype.count = function(name, filter, fn) {
  return this.entitiesRepository.countEntity(name, filter, fn);
  // body...
};

FurmlyEngine.prototype.createId = function(...args) {
  return this.entitiesRepository.createId.apply(null, args);
};

Object.keys(systemEntities).forEach(function(key) {
  var cap = misc.capitalizeText(key);
  var entName = systemEntities[key];
  FurmlyEngine.prototype["query" + cap] = function(filter, options, fn) {
    if (Array.prototype.slice.call(arguments).length == 2) {
      fn = options;
      options = null;
    }
    this.entitiesRepository.queryEntity(entName, filter, options, fn);
  };
  FurmlyEngine.prototype["save" + cap] = function(...args) {
    args.unshift(entName, key);
    this.entitiesRepository.saveSystemEntity.apply(
      this.entitiesRepository,
      args
    );
  };

  FurmlyEngine.prototype[`delete${cap}`] = function(id, fn) {
    if (!id) {
      return setImmediate(fn, new Error("cannot delete item without an id"));
    }
    this.entitiesRepository.deleteEntity(systemEntities[key], id, fn);
  };
});

module.exports = FurmlyEngine;
