const assert = require("assert"),
	debug = require("debug")("process"),
	DynamoSandbox = require("./sandbox"),
	DynamoStep = require("./step"),
	constants = require("./constants");
/**
	 * this is a class constructor for a dynamo process.
	 * @constructor
	 * @memberOf module:Dynamo
	 * @param {Any} opts constructor parameters
	 */
function DynamoProcess(opts) {
	var self = this;
	if (!opts) throw new Error("Process arg missing");

	if (!opts.steps || !opts.steps.length)
		throw new Error("Process must contain atleast one step");

	if (!opts.title) throw new Error("Process must have a title");

	if (!opts.store && opts.steps.length > 1)
		throw new Error("Process with more than one step requires a store");

	if (!opts.save)
		throw new Error("Process needs save service for persistence");

	if (opts.fetchProcessor && !opts.entityRepo)
		throw new Error("Fetch Processor needs the entityRepo to function");

	var currentStep = null;
	this._id = opts._id;
	this.description = opts.description;
	this.title = opts.title;
	this.version = opts.version;
	this.requiresIdentity = opts.requiresIdentity;
	this.fetchProcessor = opts.fetchProcessor;
	this._save = opts.save;
	if (opts.uid) this.uid = opts.uid;
	Object.defineProperties(self, {
		steps: {
			enumerable: false,
			get: function() {
				return opts.steps;
			}
		},
		currentStep: {
			enumerable: false,
			get: function() {
				return currentStep;
			}
		},
		entityRepo: {
			enumerable: false,
			get: function() {
				return opts.entityRepo;
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
DynamoProcess.prototype.validate = function(fn) {
	if (!this._id) fn(new Error("Process must have an id"));
};

/**
	 * Utility function for updating a process properties. Primarily used during initialization
	 * @param  {Object} data Object or Type of DynamoProcess
	 * @return {Void}      Nothing.
	 */
DynamoProcess.prototype.updateProps = function(opts) {
	if (opts.steps) {
		let steps = opts.steps;
		delete opts.steps;

		steps.forEach((x, index) => {
			if (this.steps.length < index)
				this.steps[index].updateProps(steps[index]);
			else this.steps.push(steps[index]);
		});
	}
	Object.assign(this, opts);
};
/**
	 * This function chooses and runs the current step
	 * @param  {Any}   context contains the details of the request in question.
	 * @param  {Function} fn      callback
	 * @return {Any}           result passed from processor chain.
	 */
DynamoProcess.prototype.run = function(context, fn) {
	var self = this;
	this.validate(fn);

	function processStep(args) {
		debugger;
		var index = self.currentStepIndex || 0,
			step = self.steps[index],
			nextStep = self.steps[index + 1];
		assert.equal(step instanceof DynamoStep, true);
		let _continue = () => {
			step.run(context, function(er, message) {
				if (er) return fn(er);

				self.currentStepIndex =
					index +
					//self.steps.indexOf(step)
					1;

				var result = _.assign(
					{
						message: message,
						status: constants.PROCESSSTATUS.COMPLETED
					},
					args || {}
				);

				if (self.steps.length > self.currentStepIndex) {
					result.status = constants.PROCESSSTATUS.RUNNING;
					if (context.$uiOnDemand) {
						result.$nextStep = JSON.parse(
							JSON.stringify(context.$nextStep)
						);
					}
					self.store.update(
						args.instanceId || context.instanceId,
						self.currentStepIndex,
						function(er) {
							fn(er, result);
						}
					);
					return;
				}

				if (context.instanceId) {
					self.store.remove(context.instanceId, function(er) {
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
					return fn(
						new Error("System could not describe the next step")
					);
				context.$nextStep = description;
				_continue();
			});
		}
		_continue();
	}
	if (this.steps.length > 1) {
		this.store.get(context.instanceId || "", function(er, currentStep) {
			if (er) return fn(er);

			if (context.instanceId && !currentStep) {
				return fn(
					new Error(
						"We are sorry but we no longer have the previous information you' submitted. Please restart the process..."
					)
				);
			}

			if (currentStep) {
				self.currentStepIndex = currentStep.value;
				processStep.call(self, {
					instanceId: context.instanceId
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
DynamoProcess.prototype.save = function(fn) {
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
				var fetchProcessorId = null;
				var mergedIds = _.map(ids, "_id");
				callback(null, {
					_id: self._id,
					title: self.title,
					description: self.description,
					uid: self.uid,
					steps: mergedIds
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
DynamoProcess.prototype.describe = function(context, fn) {
	if (Array.prototype.slice.call(arguments).length == 1) {
		fn = context;
		context = null;
	}

	this.validate(fn);
	var self = this,
		proc = _.pickBy(self, notAFunction),
		_allSteps = [];
	delete proc.fetchProcessor;

	function collect(er, s) {
		if (er) return fn(er);
		_allSteps.push(s);

		if (
			self.steps.length == _allSteps.length ||
			(context && context.$uiOnDemand === "true")
		) {
			proc.steps = _allSteps;
			//fetch data if context and fetch processor are defined.

			if (self.fetchProcessor && context) {
				context.$description = proc;
				new DynamoSandbox(
					self.fetchProcessor,
					self.entityRepo
				).run(context, function(er, result, modifiedProcess) {
					if (er)
						return (
							debug(
								"An error occurred while running fetch processor"
							),
							fn(er)
						);

					return fn(null, modifiedProcess || proc, result);
				});
				return;
			}
			return fn(null, proc);
		}
	}
	if (!context || context.$uiOnDemand !== "true")
		return self.steps.forEach(function(s) {
			s.describe(collect);
		});

	self.steps[0].describe(collect);
};

module.exports = DynamoProcess;
