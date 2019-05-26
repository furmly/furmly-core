const assert = require("assert"),
  debug = require("debug")("process"),
  misc = require("./misc"),
  async = require("async"),
  _ = require("lodash"),
  FurmlyStep = require("./step"),
  constants = require("./constants");
/**
 * this is a class constructor for a furmly process.
 * @constructor
 * @memberOf module:Furmly
 * @param {Any} opts constructor parameters
 */
function FurmlyProcess(opts) {
  var self = this;
  if (!opts) throw new Error("Process arg missing");

  if (!opts.steps || !opts.steps.length)
    throw new Error("Process must contain atleast one step");

  if (!opts.title) throw new Error("Process must have a title");

  if (!opts.store && opts.steps.length > 1)
    throw new Error("Process with more than one step requires a store");

  if (!opts.save) throw new Error("Process needs save service for persistence");

  if (opts.fetchProcessor && !opts.runInSandbox)
    throw new Error("Fetch Processor needs the runInSandbox to function");

  this._id = opts._id;
  this.description = opts.description;
  this.title = opts.title;
  this.version = opts.version;
  this.requiresIdentity = opts.requiresIdentity;
  this.disableBackwardNavigation = opts.disableBackwardNavigation;
  this._save = opts.save;
  if (opts.uid) this.uid = opts.uid;
  Object.defineProperties(self, {
    steps: {
      enumerable: false,
      get: function() {
        return opts.steps;
      }
    },
    config: {
      enumerable: false,
      get: function() {
        if (typeof opts.config == "string")
          opts.config = JSON.parse(opts.config);

        return opts.config;
      }
    },
    fetchProcessor: {
      enumerable: false,
      get: function() {
        return opts.fetchProcessor;
      }
    },
    runInSandbox: {
      enumerable: false,
      get: function() {
        return opts.runInSandbox;
      }
    },
    store: {
      enumerable: false,
      get: function() {
        return opts.store;
      }
    }
  });
}

/**
 * Enforce class invariant
 *
 */
FurmlyProcess.prototype.validate = function(fn) {
  if (!this._id) fn(new Error("Process must have an id"));
};

/**
 * This function chooses and runs the current step
 * @param  {Any}   context contains the details of the request in question.
 * @param  {Function} fn      callback
 * @return {Any}           result passed from processor chain.
 */
FurmlyProcess.prototype.run = function(context, fn) {
  var self = this,
    that = self;
  this.validate(fn);

  //adjust context
  if (context)
    if (context.$form) {
      context = Object.assign(context.$form, context.$processParams || {});
    } else {
      let contextParamExp = /^\$/;
      Object.keys(context).reduce((sum, x) => {
        if (contextParamExp.test(x)) {
          let value = context[x];
          Object.defineProperties(sum, {
            [x]: { enumerable: false, get: () => value }
          });
        }

        return sum;
      }, context);
    }

  function processStep(args) {
    var index = self.currentStepIndex || 0,
      step = self.steps[index],
      nextStep = self.steps[index + 1];
    assert.equal(step instanceof FurmlyStep, true);
    let _continue = () => {
      Object.defineProperties(context, {
        $process: {
          enumerable: false,
          get: function() {
            debug("fetching process context for running processor...");
            debug(that);
            return that;
          }
        }
      });
      step.run(context, function(er, message) {
        if (er) return fn(er);

        self.currentStepIndex = index + 1;

        var result = _.assign(
          {
            message: message,
            status: constants.PROCESSSTATUS.COMPLETED
          },
          (args && { $instanceId: args.instanceId }) || {}
        );

        if (self.steps.length > self.currentStepIndex) {
          result.status = constants.PROCESSSTATUS.RUNNING;
          if (context.$uiOnDemand) {
            let stepDescription = context.$nextStep;
            //debug(stepDescription);
            result.$nextStep = JSON.parse(JSON.stringify(stepDescription));
          }
          self.store.update(
            args.instanceId || context.$instanceId,
            self.currentStepIndex,
            function(er) {
              fn(er, result);
            }
          );
          return;
        }

        if (context.$instanceId) {
          self.store.remove(context.$instanceId, function(er) {
            if (er) return fn(er);
            fn(null, result);
          });
          return;
        }

        fn(null, result);
      });
    };
    if (context.$uiOnDemand && nextStep) {
      return nextStep.describe((er, description) => {
        if (er) return fn(er);
        if (!description)
          return fn(new Error("System could not describe the next step"));
        Object.defineProperties(context, {
          $nextStep: {
            enumerable: false,
            get: function() {
              return description;
            },
            set: function(value) {
              description = value;
            }
          }
        });
        //context.$nextStep = description;
        _continue();
      });
    }
    _continue();
  }
  if (this.steps.length > 1) {
    this.store.get(context.$instanceId || "", function(er, currentStep) {
      if (er) return fn(er);

      if (context.$instanceId && !currentStep) {
        return fn(
          new Error(
            "We are sorry but we no longer have the previous information you submitted. Please restart the process..."
          )
        );
      }

      if (currentStep) {
        self.currentStepIndex = currentStep.value;
        //if backward navigation is allowed , get the current step passed to be processed and make sure
        //current step passed by client is less than what has been stored.
        if (
          !self.disableBackwardNavigation &&
          typeof context.$currentStep == "number" &&
          context.$currentStep < currentStep.value
        )
          self.currentStepIndex = context.$currentStep;

        processStep.call(self, {
          instanceId: context.$instanceId
        });
      } else {
        self.store.keep(self.currentStepIndex || 0, function(er, data) {
          if (er) return fn(er);
          return processStep.call(self, {
            instanceId: data.insertedId
          });
        });
      }
    });

    return;
  }
  processStep();
};

/**
 * saves the process/children using persistence service.
 * @param  {Function} fn callback
 * @return {Any}      saved object.
 */
FurmlyProcess.prototype.save = function(fn) {
  var self = this;
  var unsaved = _.filter(this.steps, _.isObject);
  var tasks = [];
  unsaved.forEach(pending => {
    tasks.push(pending.save.bind(pending));
  });

  async.waterfall(
    [
      async.parallel.bind(async, tasks),
      (ids, callback) => {
        //ids will contain the newly saved ids
        var mergedIds = _.map(ids, "_id");
        callback(null, {
          _id: self._id,
          title: self.title,
          description: self.description,
          uid: self.uid,
          steps: mergedIds,
          config: self.config,
          requiresIdentity: self.requiresIdentity,
          disableBackwardNavigation: self.disableBackwardNavigation
        });
      },
      (model, callback) => {
        if (self.fetchProcessor && _.isObject(self.fetchProcessor)) {
          self.fetchProcessor.save(function(er, obj) {
            if (er) return fn(er);
            model.fetchProcessor = obj._id;
            callback(null, model);
          });
          return;
        }
        callback(null, model);
      },
      self._save
    ],
    fn
  );
};

/**
 * Creates a description of the process a client can consume
 * @param  {Function} fn callback
 * @return {Object}      object representing the process.
 */
FurmlyProcess.prototype.describe = function(context, fn) {
  if (Array.prototype.slice.call(arguments).length == 1) {
    fn = context;
    context = null;
  }

  this.validate(fn);
  var self = this,
    that = this,
    proc = Object.assign({}, _.pickBy(self, misc.notAFunction)),
    _allSteps = [];

  function collect(index, er, s) {
    if (er) return fn(er);
    Object.defineProperties(s, {
      index: {
        enumerable: false,
        get: function() {
          return index;
        }
      }
    });
    _allSteps.push(s);

    if (
      self.steps.length == _allSteps.length ||
      (context && context.$uiOnDemand === "true")
    ) {
      proc.steps = _allSteps.sort((a, b) => a.index - b.index);
      //fetch data if context and fetch processor are defined.

      if (self.fetchProcessor && context) {
        Object.defineProperties(context, {
          $description: {
            enumerable: false,
            get: function() {
              return proc;
            }
          },
          $process: {
            enumerable: false,
            get: function() {
              return that;
            }
          }
        });

        self.runInSandbox(
          { processors: [self.fetchProcessor], context },
          function(er, result, modifiedProcess) {
            if (er)
              return (
                debug("An error occurred while running fetch processor"), fn(er)
              );

            return fn(null, modifiedProcess || proc, result);
          }
        );
        return;
      }
      return fn(null, proc);
    }
  }
  if (!context || context.$uiOnDemand !== "true")
    return self.steps.forEach((s, index) => {
      s.describe(collect.bind(this, index));
    });

  self.steps[0].describe(collect.bind(this, 0));
};

module.exports = FurmlyProcess;
