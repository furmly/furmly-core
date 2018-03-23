const constants = require("./constants"),
	fs = require("fs"),
	debug = require("debug")("sandbox"),
	async = require("async"),
	systemEntities = constants.systemEntities,
	misc = require("./misc"),
	path = require("path"),
	uuid = require("uuid"),
	assert = require("assert"),
	_ = require("lodash"),
	sandboxCode = fs.readFileSync(
		__dirname + path.sep + "processor-sandbox.js"
	),
	{ NodeVM } = require("vm2");
/**
	 * This represents a dynamo step. Steps could  require user input or not.
	 * @constructor
	 * @memberOf module:Dynamo
	 * @param {Any} opts Object representation of a step or string with _id
	 */
function DynamoStep(opts) {
	var self = this;
	this._id = opts._id;
	this.stepType = opts.stepType;
	this._save = opts.save;
	this.mode = opts.mode;
	this.description = opts.description;
	var postprocessors = opts.postprocessors || [];
	var _state = getState.call(this, opts);

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

		if (!opts.entityRepo)
			throw new Error(
				"opts.entityRepo is required for this type of processor"
			);

		assert.equal(typeof opts.form.describe == "function", true);

		this.form = opts.form;
		this.entityRepo = opts.entityRepo;
		/**
             * prepare for context for processors.
             * @param  {Object} opts object containing configuration,processors,postprocessors etc.
             * @return {Object}      configured context.
             */
		function prepareContext(opts) {
			var _context = {};
			_context.args = opts.args;
			_context.postprocessors = _.cloneDeep(opts.postprocessors);
			_context.processors = _.cloneDeep(opts.processors);
			_context.postprocessorsTimeout = parent.config.postprocessors.ttl;
			_context.processorsTimeout = parent.config.processors.ttl;
			return _context;
		}

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
			debug(
				`running client step  ${misc.toObjectString(
					this
				)} , with context ${misc.toObjectString(context)}`
			);
			var self = this;
			if (parent.mode == constants.STEPMODE.VIEW)
				return fn(new Error("Cannot process a view step"));

			var serverProcessors = parent.processors,
				_context = prepareContext({
					processors: serverProcessors,
					args: context,
					postprocessors: parent.postprocessors
				});

			var vm = new NodeVM({
				require: false,
				requireExternal: false,
				sandbox: {
					context: Object.assign(_context, {
						systemEntities,
						constants,
						entityRepo: this.entityRepo,
						async,
						debug,
						uuid
					})
				}
			});
			var handle = vm.run(sandboxCode);
			handle.getResult(function(er, result) {
				if (er) return fn(er);

				return (
					(parent.status = constants.STEPSTATUS.COMPLETED),
					fn(null, result)
				);
			});
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
DynamoStep.prototype.save = function(fn) {
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
		postTasks = [],
		elements = [];
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
				var processorIds = _.map(ids.processors, "_id"); // _.filter(self.processors, typeOf('string')).concat(_.map(ids.processors, '_id'));
				var postprocessorIds = _.map(ids.postprocessors, "_id"); //_.filter(self.postprocessors, typeOf('string')).concat(_.map(ids.postprocessors, '_id'));
				//
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
DynamoStep.prototype.validate = function(shouldBePersisted) {
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

DynamoStep.prototype.describe = function(fn) {
	this.validate(true);
	var self = this,
		step = _.pickBy(self, misc.notAFunction);
	self.state.describe(function(er, res) {
		if (er) return fn(er);

		_.assign(step, res);

		fn(null, step);
	});
};

DynamoStep.prototype.run = function(context, fn) {
	this.validate(true);
	this.state.run(context, fn);
};

module.exports = DynamoStep;
