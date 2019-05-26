const constants = require("./constants"),
  debug = require("debug")("sandbox"),
  async = require("async"),
  misc = require("./misc"),
  assert = require("assert"),
  _ = require("lodash");

/**
 * This represents a furmly step. Steps could  require user input or not.
 * @constructor
 * @memberOf module:Furmly
 * @param {Any} opts Object representation of a step or string with _id
 */
function FurmlyStep(opts) {
  this._id = opts._id;
  this.stepType = opts.stepType;
  this._save = opts.save;
  this.mode = opts.mode;
  this.description = opts.description;
  this.commandLabel = opts.commandLabel;
  let postprocessors = opts.postprocessors || [];
  let _state = getState.call(this, opts);
  Object.defineProperties(this, {
    processors: {
      enumerable: false,
      get: function() {
        return opts.processors;
      }
    },
    state: {
      enumerable: false,
      get: function() {
        return _state;
      }
    },
    postprocessors: {
      enumerable: false,
      get: function() {
        return postprocessors;
      }
    },
    form: {
      enumerable: false,
      get: function() {
        return opts.form;
      }
    },
    config: {
      enumerable: false,
      get: function() {
        return opts.config;
      }
    }
  });
  //call class invariant
  this.validate();
  /**
   * Offline State
   * @param {Step} parent State Owner
   * @param {Any} opts   Setup options passed to parent
   */
  function Offline(parent, opts) {
    this.run = function(context, fn) {
      //start offline process...
      //tell the caller that process has began
      fn(null, {
        message: "process has started"
      });
    };
    this.save = function(fn) {
      fn({});
    };
    this.describe = function(fn) {
      fn({});
    };
  }

  /**
   * Returns Step State
   * @param  {Any} opts options passed to parent
   * @return {State}      Object State
   */
  function getState(opts) {
    switch (opts.stepType) {
      case constants.STEPTYPE.OFFLINE:
        return new Offline(this, opts);
      default:
        return new Client(this, opts);
    }
  }
  /**
   * Client State
   * @constructor
   * @param {Step} parent State Owner
   * @param {Any} opts   Setup options passed to parent
   */
  function Client(parent, opts) {
    if (!opts.form) throw new Error("Client Step must have a form");

    if (!opts.runInSandbox)
      throw new Error(
        "opts.runInSandbox is required for this type of processor"
      );

    assert.equal(typeof opts.form.describe == "function", true);

    this.form = opts.form;
    this.runInSandbox = opts.runInSandbox;

    /**
     * Called by Step when it is being saved.
     * @param  {Function} fn callback
     * @return {Object}      form object.
     */
    this.save = function(fn) {
      this.form.save(function(er, form) {
        if (er) return fn(er);
        fn(null, {
          form: form
        });
      });
    };

    /**
     * this calls all the processors of the step.
     * @param  {Object}   context Context
     * @param  {Function} fn      Callback
     * @return {Object}           Result of processor.
     */
    this.run = function(context, fn) {
      debug(`running client step with context ${misc.toObjectString(context)}`);
      if (parent.mode == constants.STEPMODE.VIEW)
        return fn(new Error("Cannot process a view step"));

      const processors = _.cloneDeep(parent.processors);
      const postProcessors = _.cloneDeep(parent.postprocessors);
      this.runInSandbox(
        {
          processors,
          postProcessors,
          context,
          includeExtensions: true,
          etc: {
            postprocessorsTimeout: parent.config.postprocessors.ttl,
            processorsTimeout: parent.config.processors.ttl
          }
        },
        function(er, result) {
          if (er) return fn(er);

          return (
            (parent.status = constants.STEPSTATUS.COMPLETED), fn(null, result)
          );
        }
      );
    };

    this.describe = function(fn) {
      this.form.describe(function(er, form) {
        if (er) return fn(er);
        fn(null, {
          form: form
        });
      });
    };
  }
}

/**
 * Persists step to storage
 * @param  {Function} fn callback
 * @return {Object}      saved object
 */
FurmlyStep.prototype.save = function(fn) {
  var self = this;
  try {
    this.validate();
  } catch (e) {
    return setImmediate(fn, e);
  }
  var unsavedProcessors = _.filter(this.processors, _.isObject);
  var unsavedPostProcessors = _.filter(this.postprocessors, _.isObject);
  var tasks = [],
    saveFn = function(list) {
      return function(pending) {
        function s(callback) {
          pending.save(function(er, result) {
            callback(er, result);
          });
        }
        list.push(s);
      };
    },
    postTasks = [];
  unsavedProcessors.forEach(saveFn(tasks));
  unsavedPostProcessors.forEach(saveFn(postTasks));
  async.waterfall(
    [
      async.parallel.bind(async, tasks),
      function(ids, callback) {
        async.parallel(postTasks, function(er, items) {
          callback(er, {
            processors: ids,
            postprocessors: items
          });
        });
      },
      function(ids, callback) {
        //ids will contain the newly saved ids
        var processorIds = _.map(ids.processors, "_id");
        var postprocessorIds = _.map(ids.postprocessors, "_id");

        self.state.save(function(er, state) {
          if (er) return callback(er);
          self._save(
            _.assign(
              {
                _id: self._id,
                processors: processorIds,
                postprocessors: postprocessorIds,
                stepType: self.stepType,
                description: self.description,
                commandLabel: self.commandLabel,
                mode: self.mode
              },
              state || {}
            ),
            callback
          );
        });
      }
    ],
    fn
  );
};

/**
 * Class invariant
 */
FurmlyStep.prototype.validate = function(shouldBePersisted) {
  if (shouldBePersisted && !this._id)
    throw new Error("opts._id is null or undefined");

  if (
    (!this.processors || !this.processors.length) &&
    this.mode !== constants.STEPMODE.VIEW
  )
    throw new Error("Steps must have atleast one processor");

  if (!this.stepType || !constants.STEPTYPE.in(this.stepType))
    throw new Error("Step type is null or undefined or not a valid type");
  if (!this._save) throw new Error("Step needs save service for persistence");
};

FurmlyStep.prototype.describe = function(fn) {
  this.validate(true);
  var self = this,
    step = _.pickBy(self, misc.notAFunction);
  self.state.describe(function(er, res) {
    if (er) return fn(er);

    _.assign(step, res);

    fn(null, step);
  });
};

FurmlyStep.prototype.run = function(context, fn) {
  this.validate(true);
  this.state.run(context, fn);
};

module.exports = FurmlyStep;
