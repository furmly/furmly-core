var assert = require("assert"),
	EventEmitter = require("events"),
	async = require("async"),
	_debug = require("debug"),
	debug = _debug("dynamo"),
	ObjectID = require("mongodb").ObjectID,
	util = require("util"),
	loki = require("lokijs"),
	lfsa = require(__dirname +
		"/../node_modules/lokijs/src/loki-fs-structured-adapter"),
	_ = require("lodash"),
	vm = require("vm"),
	path = require("path"),
	fs = require("fs"),
	generator = require("mongoose-gen"),
	glob = require("glob"),
	path = require("path"),
	uuid = require("uuid/v4"),
	sandboxCode = fs.readFileSync(
		__dirname + path.sep + "processor-sandbox.js"
	),
	mongoose = require("mongoose"),
	lokiAdapter = new lfsa();

mongoose.Promise = global.Promise;
const { NodeVM } = require("vm2");

function init(config) {
	var constants = createConstants();
	mongoose.Promise = global.Promise;
	generator.setDefault("requiresIdentity", function(value) {
		return true;
	});
	mongoose.connect(config.data.dynamo_url);

	/**
	 * Returns Array of Strings
	 * @param  {String} folderPath
	 * @param  {Function} callback
	 * @return {String}
	 */
	var getDirectories = function(src, callback) {
		glob(src + "/**/*", callback);
	};
	var toObjectString = function(obj) {
		return JSON.stringify(obj, null, " ");
	};
	function runThroughObj(conditions, data, result = {}, parent = null) {
		if (data)
			Object.keys(data).forEach(key => {
				let send = false;
				for (var v = 0; v < conditions.length; v++) {
					if (conditions[v](key, data, result, parent)) return result;
				}
				if (Array.prototype.isPrototypeOf(data[key]))
					return data[key].forEach(function(element) {
						runThroughObj(conditions, element, result, data);
					});
				if (data[key] && typeof data[key] == "object")
					return runThroughObj(conditions, data[key], result, data);
			});
		return result;
	}
	/**
	 * Returns a function that checks if a property is defined
	 * @param  {String} propertyName
	 * @return {Function}
	 */
	var isNotDefined = function(prop) {
		return function(item) {
			return typeof item == "object" && typeof item[prop] == "undefined";
		};
	};

	/**
	 * Returns a function that checks the type of the supplied argument
	 * @param  {String} value
	 * @return {Function}
	 */
	var typeOf = function(value) {
		return function(item) {
			return typeof item == value;
		};
	};

	/**
	 * Returns a function that returns the first child of an array result.
	 * @param  {Function} fn
	 * @return {Object}
	 */
	var getOne = function(fn) {
		return function(er, result) {
			if (result && result.length) {
				result = result[0];
			}
			return fn(er, result);
		};
	};

	var notAFunction = function(x) {
		return typeof x !== "function";
	};

	function createConstants() {
		function Constant() {
			var array = Array.prototype.slice.call(arguments);
			for (var i = 0; i < array.length; i++) {
				if (typeof array[i] == "string") {
					this[array[i]] = array[i];
					continue;
				}
				if (array[i].length == 1) {
					this[array[i][0]] = array[i][0];
					continue;
				}
				this[array[i][0]] = array[i][1];
			}
		}
		Constant.prototype.in = function(val) {
			for (var i in this) {
				if (this.hasOwnProperty(i) && this[i] == val) return true;
			}
			return false;
		};

		return {
			PROCESSSTATUS: new Constant("COMPLETED", "RUNNING"),
			STEPSTATUS: new Constant("COMPLETED", "RUNNING"),
			PROCESSORTYPE: new Constant("SERVER", "CLIENT"),
			GRIDMODE: new Constant("DEFAULT", "CRUD", "EDITONLY", "CREATEONLY"),
			GRIDCOMMANDTYPE: new Constant("PROCESSOR", "NAV"),
			STEPMODE: new Constant("VIEW", "PROCESS"),
			STEPTYPE: new Constant("OFFLINE", "CLIENT"),
			ELEMENT_SELECT_SOURCETYPE: new Constant("PROCESSOR", "FORM"),
			VALIDATORTYPE: new Constant(
				"REQUIRED",
				"MAXLENGTH",
				"MINLENGTH",
				"REGEX"
			),
			INPUTTYPE: new Constant(
				["TEXT", "text"],
				["NUMBER", "number"],
				["DATE", "date"],
				["CHECKBOX", "checkbox"],
				["PASSWORD", "password"]
			),
			NAVIGATIONTYPE: new Constant("CLIENT", "DYNAMO"),
			IMAGETYPE: new Constant("REL", "DATA", "URL"),
			UIDS: {
				LIB: new Constant(
					["CONVERT_FILTER", "convertFilter"],
					["CREATE_ID", "createId"],
					["CHECK_USER_PASSWORD_AND_PRIVILEDGE", "isAuthorized"],
					["CONVERT_SCHEMA_TO_ELEMENTS", "ElementsConverter"],
					["CREATE_CRUD_PROCESS", "createCRUDProcess"],
					["CREATE_ELEMENT", "createElement"],
					["CONVERT_TO_SELECTABLE_LIST", "convertToSelectableList"],
					["CONVERT_AND_SAVE_FILE", "convertFileAndSave"]
				),
				PROCESSOR: new Constant(
					"GET_DOMAINS",
					"FETCH_SCHEMA",
					"CREATE_SCHEMA",
					"UPDATE_SCHEMA",
					"LIST_ENTITY_SCHEMAS",
					"LIST_ENTITY_TYPES",
					"LIST_ENTITY_GENERIC",
					"LIST_ASYNC_VALIDATORS",
					"LIST_PROCESSES",
					"LIST_LIBS",
					"LIST_PROCESSORS",
					"LIST_INPUT_TYPES",
					"LIST_ELEMENT_TYPES",
					"FETCH_PROCESS",
					"CREATE_PROCESS",
					"CREATE_LIB",
					"CREATE_PROCESSOR",
					"CREATE_ENTITY",
					"UPDATE_ENTITY",
					"FETCH_ENTITY",
					"MENU_FILTER"
				),
				PROCESS: new Constant(
					"MANAGE_ENTITY_SCHEMA",
					"CREATE_PROCESS",
					"MANAGE_PROCESS",
					"MANAGE_PROCESSOR",
					"MANAGE_LIBS"
				)
			},
			ENTITYTYPE: new Constant(
				["STRING", "String"],
				["NUMBER", "Number"],
				["DATE", "Date"],
				["BOOLEAN", "Boolean"],
				["OBJECT", "Object"],
				["REFERENCE", "ObjectId"],
				["ARRAY", "Array"]
			),
			ELEMENTTYPE: new Constant(
				"INPUT",
				"SCRIPT",
				"DESIGNER",
				"HIDDEN",
				"GRID",
				"NAV",
				"FILEUPLOAD",
				"DOWNLOAD",
				"SELECTSET",
				"LABEL",
				"LARGEINPUT",
				"COMMAND",
				"SECTION",
				"TABS",
				"SELECT",
				"LIST",
				"IMAGE",
				"ACTIONVIEW",
				"HTMLVIEW",
				"WEBVIEW",
				"MESSENGER",
				"PARTIAL"
			)
		};
	}

	/**
	 * Capitalizes Text
	 * @param  {String} txt
	 * @return {String}
	 */
	function capitalizeText(txt) {
		return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : txt;
	}

	/**
	 * Contants for default entities
	 * @type {Object}
	 */
	var systemEntities = {
			step: "_0Step",
			processor: "_0Processor",
			process: "_0Process",
			asyncValidator: "_0AsyncValidator",
			lib: "_0Lib"
		},
		defaultProcessors = require("./default-processors")(
			constants,
			systemEntities
		),
		defaultLibs = require("./default-libs")(constants),
		defaultProcesses = require("./default-processes")(
			constants,
			systemEntities
		);

	/**
	 * this represents a dynamo step. Steps could  require user input or not.
	 * @param {Any} opts Object representation of a step or string with _id
	 */
	function DynamoStep(opts) {
		var self = this;
		this._id = opts._id;
		this.stepType = opts.stepType;
		this._save = opts.save;
		this.mode = opts.mode;
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

			function prepareContext(opts) {
				var _context = {};
				_context.args = opts.args;
				_context.postprocessors = _.cloneDeep(opts.postprocessors);
				_context.processors = _.cloneDeep(opts.processors);
				_context.postprocessorsTimeout = config.postprocessors.ttl;
				_context.processorsTimeout = config.processors.ttl;
				return _context;
			}

			this.save = function(fn) {
				this.form.save(function(er, form) {
					if (er) return fn(er);
					fn(null, {
						form: form
					});
				});
			};

			//this calls all the processors of the step.
			this.run = function(context, fn) {
				debug(
					`running client step  ${toObjectString(
						this
					)} , with context ${toObjectString(context)}`
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
						context: _context,
						systemEntities: systemEntities,
						constants: constants,
						entityRepo: this.entityRepo,
						async: async,
						debug: debug,
						uuid: uuid
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
			throw new Error(
				"Step type is null or undefined or not a valid type"
			);
		if (!this._save)
			throw new Error("Step needs save service for persistence");
	};

	DynamoStep.prototype.describe = function(fn) {
		this.validate(true);
		var self = this,
			step = _.pickBy(self, notAFunction);
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

	/**
	 * Loads these reusable classes during every processor run.
	 * @param {Object} opts data for the lib
	 */
	function DynamoLib(opts) {
		if (!opts) throw new Error("missing opts to Dynamo Lib");

		if (!opts.uid || /\s+/.exec(opts.uid))
			throw new Error("a valid key is required by dynamo lib");

		if (!opts.code) throw new Error("code is required by dynamo lib");

		this._id = opts._id;
		this.code = opts.code;
		this.uid = opts.uid;
		this._save = opts.save;
	}
	/**
	 * This loads its code into the holder object.
	 * @param  {Object} holder Placeholder for returned function
	 * @return {Object}        holder object
	 */
	DynamoLib.prototype.load = function(holder) {
		var self = this;
		if (holder[this.key])
			throw new Error("key  " + this.key + " already exists");

		return (function() {
			let exports = {};
			/* jshint ignore:start */
			//added extra check to ensure this code never runs in engine context.
			eval(self.code);
			/* jshint ignore:end */
			return (holder[self.uid] = exports), holder;
		})();
	};

	DynamoLib.prototype.save = function(fn) {
		this._save(this, fn);
	};

	/**
	 * Inner class used for running processors that are not part of a steps chain of processors
	 * @param {Object} opts Class constructor options , including entityRepo and processors.
	 */
	function DynamoSandbox(opts) {
		var args;
		if (
			!opts ||
			(!(opts instanceof DynamoProcessor) &&
				(!opts.processors || !opts.processors.length))
		)
			throw new Error("A sandbox needs atleast one processor to run");

		if (
			!opts.entityRepo &&
			opts instanceof DynamoProcessor &&
			(args = Array.prototype.slice.call(arguments)).length == 1
		)
			throw new Error("EntityRepo is required by all processors");

		var processors = opts instanceof DynamoProcessor ? [opts] : opts,
			entityRepo =
				opts instanceof DynamoProcessor ? args[1] : opts.entityRepo;

		this.run = function(context, fn) {
			let vm = new NodeVM({
				require: false,
				requireExternal: false,
				sandbox: {
					context: {
						args: context,
						processors: processors,
						postprocessors: [],
						processorsTimeout: 60000
					},
					systemEntities: systemEntities,
					constants: constants,
					entityRepo: entityRepo,
					async: async,
					debug: debug,
					uuid: uuid
				}
			});
			let handle = vm.run(sandboxCode);
			handle.getResult(fn);
		};
	}

	/**
	 * this is a class constructor for a dynamo process.
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
			var step = self.steps[self.currentStepIndex || 0];
			assert.equal(step instanceof DynamoStep, true);
			step.run(context, function(er, message) {
				if (er) return fn(er);

				self.currentStepIndex = self.steps.indexOf(step) + 1;

				var result = _.assign(
					{
						message: message,
						status: constants.PROCESSSTATUS.COMPLETED
					},
					args || {}
				);

				if (self.steps.length > self.currentStepIndex) {
					result.status = constants.PROCESSSTATUS.RUNNING;
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
		}
		if (this.steps.length > 1) {
			this.store.get(context.instanceId || "", function(er, currentStep) {
				if (er) return fn(er);

				if (currentStep) {
					self.currentStepIndex = currentStep.value;
					processStep.call(self, {
						instanceId: context.instanceId
					});
				} else {
					self.store.keep(self.currentStepIndex || 0, function(
						er,
						data
					) {
						if (er) return fn(er);
						return processStep({
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
					if (
						self.fetchProcessor &&
						_.isObject(self.fetchProcessor)
					) {
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
		// proc.fetchProcessor
		// 	? proc.fetchProcessor._id
		// 	: null;

		function collect(er, s) {
			if (er) return fn(er);
			_allSteps.push(s);

			if (self.steps.length == _allSteps.length) {
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
		self.steps.forEach(function(s) {
			s.describe(collect);
		});
	};

	/**
	 * The Engine represents the boundary between the problem domain and the outside world.
	 * @param {Object} opts Constructor arguments
	 */
	function DynamoEngine(opts) {
		var self = this;
		if (!opts) throw new Error("opts must be valid");

		if (!opts.entitiesRepository)
			throw new Error("opts.entitiesRepository must be valid");

		this.entitiesRepository = opts.entitiesRepository;

		//there should be a better way to do this but , it works for now so moving on...
		this.entitiesRepository.processorEntityRepo.saveProcess = DynamoEngine.prototype.saveProcess.bind(
			this
		);
		this.entitiesRepository.processorEntityRepo.getProcess = DynamoEngine.prototype.queryProcess.bind(
			this
		);
		this.entitiesRepository.processorEntityRepo.getLib = DynamoEngine.prototype.queryLib.bind(
			this
		);
		this.entitiesRepository.processorEntityRepo.saveLib = DynamoEngine.prototype.saveLib.bind(
			this
		);
		this.entitiesRepository.processorEntityRepo.saveAsyncValidator = DynamoEngine.prototype.saveAsyncValidator.bind(
			this
		);
		this.entitiesRepository.processorEntityRepo.getAsyncValidator = DynamoEngine.prototype.queryAsyncValidator.bind(
			this
		);
		this.entitiesRepository.processorEntityRepo.saveProcessor = DynamoEngine.prototype.saveProcessor.bind(
			this
		);
		this.entitiesRepository.processorEntityRepo.getProcessor = DynamoEngine.prototype.queryProcessor.bind(
			this
		);
	}

	util.inherits(DynamoEngine, EventEmitter);

	/**
	 * Initializes the system
	 * @param  {Function} fn callback
	 * @return {Any}      nothing
	 */
	DynamoEngine.prototype.init = function(fn) {
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
					var uidsIn = [],
						uidsNotIn = _.differenceWith(
							dProcessors,
							processors,
							function(uid, obj) {
								let result = uid == obj.uid;
								if (result) {
									var _proc = Object.assign(
										{ _id: obj._id },
										defaultProcessors[uid]
									);
									uidsIn.push(_proc);
								}
								return result;
							}
						),
						tasks = [];
					for (var i = 0; i < uidsNotIn.length; i++)
						tasks.push(
							self.saveProcessor.bind(
								self,
								defaultProcessors[uidsNotIn[i]],
								{
									retrieve: true
								}
							)
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
								!uidsIn.filter(
									v => v._id.toString() == x._id.toString()
								).length
							)
								self.emit(
									"default-processor-created",
									_.cloneDeep(x)
								);
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
					if (
						true
						// !libs || libs.length !== dLibs.length
					) {
						var uidsIn = [],
							uidsNotIn = _.differenceWith(dLibs, libs, function(
								uid,
								obj
							) {
								var result = uid == obj.uid;
								if (result) {
									var _lib = Object.assign(
										{ _id: obj._id },
										defaultLibs[uid]
									);
									uidsIn.push(_lib);
								}
								return result;
							}),
							tasks = [];

						for (var i = 0; i < uidsNotIn.length; i++)
							tasks.push(
								self.saveLib.bind(
									self,
									defaultLibs[uidsNotIn[i]],
									{
										retrieve: true
									}
								)
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
					}
					callback();
				},
				this.queryProcess.bind(this, {
					uid: {
						$in: dProcesses
					}
				}),
				(exists, callback) => {
					//debug(exists);
					//debug(defaultProcesses);
					if (!exists.length || dProcesses.length !== exists.length) {
						let tasks = [],
							cb = (data, callback) => {
								self.saveProcess(
									data,
									{
										retrieve: true,
										full: true
									},
									function(er, proc) {
										if (er) return fn(er);
										self.emit(
											"default-process-created",
											_.cloneDeep(proc)
										);
										callback(null, proc);
									}
								);
							},
							args = _processors.reduce((x, a) => {
								x[a.uid] = a._id;
								return x;
							}, {}),
							doesntExist = _.differenceWith(
								dProcesses,
								exists,
								(uid, obj) => {
									return uid == obj.uid;
								}
							);

						for (var i = 0; i < doesntExist.length; i++)
							tasks.push(
								cb.bind(
									self,
									defaultProcesses[doesntExist[i]](args)
								)
							);

						async.parallel(tasks, callback);
					} else return callback();
				}
			],
			(er, result) => {
				if (er) return fn(er);

				fn();
			}
		);
	};

	DynamoEngine.prototype.isValidID = function(id) {
		return mongoose.Types.ObjectId.isValid(id);
	};
	DynamoEngine.prototype.setInfrastructure = function(manager) {
		this.entitiesRepository.setInfrastructure(manager);
	};

	DynamoEngine.prototype.runProcessor = function(context, processor, fn) {
		var sandbox = new DynamoSandbox(
			processor,
			this.entitiesRepository.processorEntityRepo
		);
		sandbox.run(context, fn);
	};

	/**
	 * Creates an Entity Schema configuration 
	 * @param  {String}   name   Name of Schema Config
	 * @param  {String}   config Configuration
	 * @param  {Function} fn     callback
	 * @return {Any}           nothing
	 */
	DynamoEngine.prototype.createEntityConfiguration = function(
		name,
		config,
		fn
	) {
		this.entitiesRepository.createConfig(name, config, fn);
	};

	/**
	 * Updates an existing Entity Schema configuration 
	 * @param  {String}   name   Name of Schema Config
	 * @param  {String}   config Configuration
	 * @param  {Function} fn     callback
	 * @return {Any}             nothing
	 */
	DynamoEngine.prototype.updateEntityConfiguration = function(
		name,
		config,
		fn
	) {
		this.entitiesRepository.updateConfig(name, config, fn);
	};

	/**
	 * Updates an instance of an Entity Schema  
	 * @param  {String}   name   Name of Schema Config
	 * @param  {String}   data instance
	 * @param  {Function} fn     callback
	 * @return {Object}          updated instance
	 */
	DynamoEngine.prototype.updateEntityInstance = function(name, data, fn) {
		this.entitiesRepository.updateEntity(name, data, fn);
	};

	/**
	 * Creates an instance of an Entity Schema
	 * @param  {String}   name Name of Schema Config
	 * @param  {Object}   data object containing info to save
	 * @param  {Function} fn   callback
	 * @return {Object}        created instance.
	 */
	DynamoEngine.prototype.createEntityInstance = function(name, data, fn) {
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
	DynamoEngine.prototype.query = function(name, filter, options, fn) {
		if (Array.prototype.slice.call(arguments).length == 3) {
			fn = options;
			options = null;
		}
		this.entitiesRepository.queryEntity(name, filter, options, fn);
	};

	//---------------------------------------------------------------------------

	Object.keys(systemEntities).forEach(function(key) {
		var cap = capitalizeText(key);
		var entName = systemEntities[key];
		DynamoEngine.prototype["query" + cap] = function(filter, options, fn) {
			if (Array.prototype.slice.call(arguments).length == 2) {
				fn = options;
				options = null;
			}
			this.entitiesRepository.queryEntity(entName, filter, options, fn);
		};
		DynamoEngine.prototype["save" + cap] = function(data, options, fn) {
			var self = this;

			if (Array.prototype.slice.call(arguments).length == 2) {
				fn = options;
				options = null;
			}
			if (this.entitiesRepository.transformers[entName]) {
				var model = this.entitiesRepository.transformers[
					entName
				](data, function(er, model) {
					if (er) return fn(er);
					model.save(function(er, item) {
						if (er) return fn(er);
						if (options && options.retrieve) {
							self.entitiesRepository.queryEntity(
								entName,
								item,
								function(e, x) {
									fn(e, x && x[0]);
								}
							);
							return;
						}
						fn(er, item);
					});
				});
				return;
			}

			if (!data._id)
				this.entitiesRepository.createEntity(
					systemEntities[key],
					data,
					fn
				);
			else
				this.entitiesRepository.updateEntity(
					systemEntities[key],
					data,
					fn
				);
		};

		DynamoEngine.prototype[`delete${cap}`] = function(id, fn) {
			if (!id) {
				return setImmediate(
					fn,
					new Error("cannot delete item without an id")
				);
			}
			this.entitiesRepository.deleteEntity(systemEntities[key], id, fn);
		};
	});

	//-------------------------------------------------------------------------

	/**
	 * Class representing DynamoElement
	 * @param {Any} opts Constructor options
	 */
	function DynamoElement(opts) {
		if (!opts) throw new Error("opts cannot be null");

		if (!opts.name) throw new Error("element name must be valid");

		if (!opts.elementType) throw new Error("element type must be valid");

		if (!opts.save)
			throw new Error("element must have persistence service");

		this._id = opts._id;
		this._save = opts.save;
		this.name = opts.name;
		this.elementType = opts.elementType;
		this.label = opts.label;
		this.description = opts.description;
		this.args = opts.args;
		this.asyncValidators = opts.asyncValidators || [];
		this.validators = opts.validators || [];
		this.uid = opts.uid;
		this.order = opts.order;
		this.component_uid = opts.component_uid || uuid();
	}
	/**
	 * Creates a description of an element  a client can consume
	 * @param  {Function} fn callback
	 * @return {Object}      object representing the element.
	 */
	DynamoElement.prototype.describe = function(fn) {
		fn(null, {
			name: this.name,
			label: this.label,
			elementType: this.elementType,
			args: this.args,
			description: this.description,
			validators: this.validators,
			uid: this.uid,
			order: this.order,
			component_uid: this.component_uid,
			asyncValidators: _.map(this.asyncValidators, "_id")
		});
	};
	DynamoElement.prototype.updateArgsComponentUID = function() {
		if (this.args) {
			runThroughObj(
				[
					(key, data) => {
						if (key == "elementType" && !data[key].component_uid) {
							data.component_uid = uuid();
						}
					}
				],
				this.args
			);
		}
	};
	/**
	 * uses save service to save/update any async validators.
	 * @param  {Function} fn callback
	 * @return {Object}      saved object.
	 */
	DynamoElement.prototype.save = function(fn) {
		var self = this;

		this.updateArgsComponentUID();

		async.parallel(
			_.map(this.asyncValidators, function(x) {
				return x.save.bind(x);
			}),
			function(er, asyncValidators) {
				if (er) return fn(er);

				fn(null, {
					_id: self._id,
					name: self.name,
					label: self.label,
					elementType: self.elementType,
					args: self.args,
					description: self.description,
					validators: self.validators,
					component_uid: self.component_uid,
					uid: self.uid,
					order: self.order,
					asyncValidators: _.map(asyncValidators, "_id")
				});
			}
		);
	};

	/**
	 * Form used by Client based Steps
	 * @param {Any} opts Contructor arguments
	 */
	function DynamoForm(opts) {
		if (!opts || !opts.elements || !opts.elements.length)
			throw new Error("Form does not contain any elements");

		this.elements = opts.elements;
	}

	/**
	 * Creates a description of a form a client can consume
	 * @param  {Function} fn callback
	 * @return {Object}      object representing the form.
	 */
	DynamoForm.prototype.describe = function(fn) {
		async.parallel(
			_.map(this.elements, function(e) {
				return e.describe.bind(e);
			}),
			function(er, result) {
				if (er) return fn(er);
				fn(null, {
					elements: result
				});
			}
		);
	};
	/**
	 * saves the form using the persistence service.
	 * @param  {Function} fn callback
	 * @return {Any}      saved object.
	 */
	DynamoForm.prototype.save = function(fn) {
		async.parallel(
			_.map(this.elements, function(x) {
				return x.save.bind(x);
			}),
			function(er, elements) {
				if (er) return fn(er);
				fn(null, {
					elements: elements //_.map(elements, '_id')
				});
			}
		);
	};

	/**
	 * Class Constuctor for a DynamoProcessor
	 * @param {Any} opts Constructor arguments
	 */
	function DynamoProcessor(opts) {
		if (!opts.code) {
			debug(opts);
			throw new Error("Processor must include code to run");
		}

		if (!opts.title) {
			debug(opts);
			throw new Error("Processor must have a title");
		}

		if (!opts.save) {
			debug(opts);
			throw new Error("Processor needs save service for persistence");
		}

		var self = this;
		this._id = opts._id;
		this.code = opts.code;
		this.title = opts.title;
		this._save = opts.save;
		this.uid = opts.uid;
		this.requiresIdentity = opts.requiresIdentity;

		/**
		 *  User customisable code ran in sandbox.
		 * @param  {Any}   result  passed in result for previous processor.
		 * @param  {Function} callback callback function.
		 * @return {Any}            result of process.
		 */
		this.process = function(result, callback) {
			if (typeof result == "function") {
				callback = result;
				result = null;
			}
			try {
				self.validate();
				/* jshint ignore:start */
				if (this.SANDBOX_CONTEXT)
					//added extra check to ensure this code never runs in engine context.
					eval(self.code);
				/* jshint ignore:end */
			} catch (e) {
				// statements
				console.log(
					"error caught by processor , description: \n" + e.message
				);
				callback(e);
			}
		};
	}
	/**
	 * Class invariant function
	 * @return {Void} nothing
	 */
	DynamoProcessor.prototype.validate = function() {
		if (!this._id) throw new Error("Processor requires a valid _id");
	};

	/**
	 * Creates a description of the processor a client can consume
	 * @param  {Function} fn callback
	 * @return {Object}      object representing the processor.
	 */
	DynamoProcessor.prototype.describe = function(fn) {
		fn(null, {
			title: this.title,
			_id: this._id
		});
	};

	/**
	 * Persists this object using passed in persistence service
	 * @param  {Function} fn calllback
	 * @return {Any}      saved object
	 */
	DynamoProcessor.prototype.save = function(fn) {
		var model = {
			_id: this._id,
			code: this.code,
			title: this.title
		};
		if (this.uid) {
			model.uid = this.uid;
		}

		this._save(model, fn);
	};

	/**
	 * Inherits from processor. Runs user editable code for validation. It is used to validate elements before submission.
	 * @param {Object} opts [description]
	 */
	function DynamoAsyncValidator(opts) {
		var self = this;
		DynamoProcessor.call(this, opts);

		var _process = this.process;
		//convert result to boolean value.
		/**
		 * Runs user editable code and returns a boolean.
		 * @param  {Any}   result result of previous processor in chain
		 * @param  {Function} fn     callback
		 * @return {Any}          result of processing sent to client
		 */
		this.process = function(result, fn) {
			_process.call(this, result, function(er, result) {
				fn(er, {
					valid: !!result
				});
			});
		};
	}
	util.inherits(DynamoAsyncValidator, DynamoProcessor);

	function LokiMongooseAdapterFactory(opts, onInit) {
		let _adapter = new LokiMongooseAdapter(opts, onInit);
		let _constructor = function(data) {
			this.save = function(fn) {
				_adapter.save(data, fn);
			};
		};
		Object.assign(_constructor, _adapter, _adapter.__proto__);

		return _constructor;
	}
	function LokiMongooseAdapter(
		{ db, collectionName, aggregator, config } = {}
	) {
		if (!collectionName) throw new Error("Collection Name cannot be null");
		if (!db) throw new Error("DB cannot be null");

		this.db = db;
		this.collection = this.db.getCollection(collectionName);
		debug(this.collection);
		if (!this.collection) {
			debug("creating collection");
			this.collection = this.db.addCollection(this.collectionName, {
				unique: ["_id"]
			});
		}

		debug(
			`number of items in collection ${collectionName} is ${this.collection
				.chain()
				.find({})
				.data().length}`
		);

		this.update = (query, data, fn) => {
			let item = this.collection.findOne(query);
			if (!item)
				return setImmediate(
					fn,
					new Error("Item does not exist " + JSON.stringify(query))
				);
			let update = Object.assign(item, data);
			this.collection.update(update);
			return setImmediate(fn, null, { modifiedCount: 1 });
		};
		this.count = (query, fn) => {
			let result = this.collection.find(query);
			return setImmediate(fn, null, result.length);
		};
		this.find = (query, ...rest) => {
			debug(query);
			toLoki(query);
			debug("---loki---");
			debug(query);
			debug("x-----------x");
			if (rest.length) {
				let fn = rest[rest.length - 1];
				try {
					setImmediate(fn, null, this.collection.find(query));
				} catch (e) {
					setImmediate(fn, e);
				}
				return;
			}
			function toLoki(query) {
				runThroughObj(
					[
						(key, data) => {
							if (
								RegExp.prototype.isPrototypeOf(data[key]) &&
								key !== "$regex"
							) {
								data[key] = { $regex: data[key] };
							}
						}
					],
					query
				);
			}
			return new function(context) {
				const proxy = () => this;
				let chain = context.collection.chain().find(query);
				this.exec = fn => {
					let data = chain.data().slice();
					if (!this._populate || !data.length)
						return setImmediate(fn, null, data);

					let loaded = {},
						refs = context.aggregator.refs,
						result = [],
						arrange = function(
							name,
							popObj,
							result = [],
							fullPath = ""
						) {
							let i = refs[name].filter(
								x => x.path == popObj.path
							);
							if (i.length) {
								//arrange to fetch items from the aggregator.
								let link = i[0];
								//make sure this link is loaded
								result.push((d, cb) => {
									//check if link is loaded and load link if otherwise.
									let pathKey = `${fullPath}${popObj.path}`;
									if (!loaded[pathKey])
										//load
										return load(
											link.model,
											d,
											fullPath
												? `${fullPath}.${popObj.path}`
												: popObj.path,
											cb
										);

									return setImmediate(cb);
								});
								if (popObj.populate && popObj.populate.path) {
									arrange(
										link.model,
										popObj.populate,
										result,
										fullPath
											? `${fullPath}.${popObj.path}`
											: popObj.path
									);
								}
							}
						},
						load = function(model, item, path, cb) {
							let paths = path.split("."),
								curr = item,
								currPath = "";
							for (var i = 0; i < paths.length; i++) {
								let old = curr;
								if (Array.prototype.isPrototypeOf(curr)) {
									curr = curr.map(x => x[paths[i]]);
								} else {
									curr = curr[paths[i]];
								}

								if (i == paths.length - 1) {
									if (Array.prototype.isPrototypeOf(curr)) {
										if (
											curr.length &&
											Array.prototype.isPrototypeOf(
												curr[0]
											)
										) {
											let tasks = [];
											curr.forEach(x => {
												tasks.push(cb => {
													let _q = x.map(
														v =>
															typeof v == "object"
																? v._id
																: v
													);
													if (!_q.length) return cb();
													let result = context.aggregator.models[
														model
													].find({
														_id: {
															$in: _q
														}
													});
													x.length = 0;
													result.exec((er, r) => {
														if (er) return cb(er);
														if (r && r.length) {
															x.length = 0;
															for (
																var i =
																	r.length -
																	1;
																i >= 0;
																i--
															) {
																x[i] = r[i];
															}
															loaded[path] = r;
														}

														return cb();
													});
												});
											});
											return async.parallel(tasks, er =>
												cb(er)
											);
										}
										let _q = curr.map(
											x =>
												typeof x === "object"
													? x._id
													: x
										);
										if (!_q.length) return cb();
										let result = context.aggregator.models[
											model
										].find({
											_id: {
												$in: _q
											}
										});
										curr.length = 0;
										result.exec((er, r) => {
											if (er) return cb(er);
											loaded[path] = r;
											for (
												var i = r.length - 1;
												i >= 0;
												i--
											) {
												curr[i] = r[i];
											}
											return cb();
										});
									} else {
										let _q =
											typeof curr == "object"
												? curr._id
												: curr;

										if (!_q) return cb();
										let _item = context.aggregator.models[
											model
										].find(
											{
												_id: _q
											},
											(er, r) => {
												if (er) return cb(er);
												old[paths[i]] = loaded[path] =
													(r.length && r[0]) || null;
												return cb();
											}
										);
									}
								}
							}

							//return setImmediate(cb);
						};

					if (this._populate)
						this._populate.forEach(pop => {
							if (typeof pop === "string") {
								arrange(context.name, { path: pop }, result);
							}
							if (typeof pop === "object") {
								arrange(context.name, pop, result);
							}
						});
					let tasks = [callback => setImmediate(callback)];
					data.forEach(x => {
						result.forEach((_fn, index) => {
							tasks.push(_fn.bind(this, x));
						});
					});
					async.waterfall(tasks, er => {
						if (er) return setImmediate(fn, er);
						return setImmediate(fn, null, data);
					});
				};
				this.lean = proxy;
				this.sort = obj => {
					if (typeof obj === "string")
						chain = chain.simplesort([obj, false]);
					let keys = Object.keys(obj);
					if (!keys.length) return this;

					chain = chain.compoundsort(keys.map(x => [x, !!obj[x]]));
					return this;
				};
				this.select = obj => {
					chain.map(x => {
						let mapped = {};
						selected.forEach(s => {
							if (obj[s]) mapped[s] = x[s];
						});
						return mapped;
					});
					return this;
				};
				this.limit = count => {
					chain = chain.limit(count);
					return this;
				};
				this.populate = args => {
					//debug(`populate:${args}`);
					if (!context.aggregator)
						throw new Error("populate requires an aggregator");

					if (!this._populate) {
						this._populate = [];
					}
					this._populate.push(args);
				};
			}(this);
		};

		this.save = (data, fn) => {
			if (data._id) {
				return this.update({ _id: data._id }, data, fn);
			}
			data._id = mongoose.Types.ObjectId().toString();
			this.collection.insert(data);
			return setImmediate(fn, null, { _id: data._id });
		};

		Object.defineProperties(this, {
			name: {
				get: function() {
					return collectionName;
				}
			},
			aggregator: {
				get: function() {
					return aggregator;
				}
			}
		});
	}

	/**
	 * This class contains the persistence logic for entities.
	 * @param {Object} opts Class constructor parameters , includes ext,folder,delimiter,store...etc
	 */
	function EntityRepo(opts) {
		function blockSystemEntities() {
			let args = Array.prototype.slice.call(arguments);
			if (this._systemEntities.indexOf(args[1]) !== -1)
				return args[args.length - 1](
					new Error(`Access Violation '${args[1]}' ${args[0]}`)
				);

			args[0].apply(this, args.slice(1));
		}
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
		this.systemEntityFolder = opts.sysFolder || "./src/system-entities/";
		this.delimiter = opts.delimiter || /('|")\$\{(\w+)\}+('|")/i;
		this._systemEntities = _.map(systemEntities, function(x) {
			return x;
		});
		this.store =
			opts.store ||
			(function() {
				var collection = mongoose.connection.db.collection(
					"_temp_store_"
				);

				function createIndex(fn) {
					collection.createIndex(
						{
							createdOn: 1
						},
						{
							expireAfterSeconds: opts.storeTTL || 60
						},
						fn
					);
				}
				return {
					get: function(id, fn) {
						collection.findOne(
							{
								_id: id ? ObjectID(id) : id
							},
							fn
						);
					},
					update: function(id, info, extra, fn) {
						if (Array.prototype.slice.call(arguments).length == 3) {
							fn = extra;
							extra = null;
						}
						collection.update(
							{
								_id: id ? ObjectID(id) : id
							},
							{
								value: info,
								extra: extra,
								createdOn: new Date()
							},
							fn
						);
					},
					remove: function(id, fn) {
						collection.deleteOne(
							{
								_id: id ? ObjectID(id) : id
							},
							fn
						);
					},
					keep: function(info, extra, fn) {
						if (Array.prototype.slice.call(arguments).length == 2) {
							fn = extra;
							extra = null;
						}
						createIndex(function() {
							collection.insertOne(
								{
									value: info,
									extra: extra,
									createdOn: new Date()
								},
								fn
							);
						});
					}
				};
			})();

		this.processorEntityRepo = {
			get: blockSystemEntities.bind(self, self.queryEntity),
			count: self.countEntity.bind(this),
			update: blockSystemEntities.bind(self, self.updateEntity),
			delete: blockSystemEntities.bind(self, self.deleteEntity),
			create: blockSystemEntities.bind(self, self.createEntity),
			createSchema: self.createConfig.bind(self),
			updateSchema: self.updateConfig.bind(self),
			getSchema: self.getConfig.bind(self),
			getSchemas: self.getConfigNames.bind(self),
			infrastructure: function() {
				return self.infrastructure;
			},
			store: self.store,
			aggregate: blockSystemEntities.bind(self, self.aggregateEntity)
		};

		this.transformers[systemEntities.process] = function(item, fn) {
			if (!(item instanceof DynamoProcess)) {
				var tasks = [];
				if (typeof item == "string" || item instanceof ObjectID) {
					tasks.push(
						self.queryEntity.bind(
							self,
							systemEntities.process,
							{
								_id: item
							},
							{
								full: true,
								one: true
							}
						)
					);
				} else {
					tasks.push(function(callback) {
						if (!item.steps) {
							return callback(
								new Error(
									"Process must include atleast one step"
								)
							);
						}
						if (!item.save)
							item.save = self.getSaveService(
								systemEntities.process
							);
						if (item.steps.length > 1) {
							item.store = self.store;
						}
						if (item.fetchProcessor) {
							item.entityRepo = self.processorEntityRepo;
						}
						var itasks = [];
						item.steps.forEach(function(step) {
							itasks.push(
								self.transformers[systemEntities.step].bind(
									self,
									step
								)
							);
						});
						async.parallel(itasks, function(er, steps) {
							if (er) return callback(er);

							item.steps = steps;
							let _process;
							if (item.fetchProcessor) {
								self.transformers[
									systemEntities.processor
								](item.fetchProcessor, function(er, fp) {
									if (er) return callback(er);
									item.fetchProcessor = fp;
									try {
										_process = new DynamoProcess(item);
									} catch (e) {
										return callback(e);
									}
									callback(null, _process);
								});
								return;
							}
							try {
								_process = new DynamoProcess(item);
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
			if (!(item instanceof DynamoStep)) {
				var tasks = [],
					processorTasks = [],
					postprocessorTasks = [];
				if (typeof item == "string" || item instanceof ObjectID) {
					self.queryEntity(
						systemEntities.step,
						{
							_id: item
						},
						{
							full: true,
							one: true
						},
						fn
					);
				} else {
					if (!item.save)
						item.save = self.getSaveService(systemEntities.step);

					if (item.stepType == constants.STEPTYPE.CLIENT) {
						item.entityRepo = self.processorEntityRepo;
						tasks.push(function(callback) {
							self.transformers.form(item.form, function(
								er,
								form
							) {
								if (er) return callback(er);
								item.form = form;
								return callback();
							});
						});
					}
					if (item.postprocessors) {
						item.postprocessors.forEach(function(proc) {
							postprocessorTasks.push(
								self.transformers[
									systemEntities.processor
								].bind(self, proc)
							);
						});
						tasks.push(function(callback) {
							async.parallel(postprocessorTasks, function(
								er,
								postprocessors
							) {
								if (er) return callback(er);
								item.postprocessors = postprocessors;
								callback();
							});
						});
					}
					(item.processors || []).forEach(function(proc) {
						processorTasks.push(
							self.transformers[systemEntities.processor].bind(
								self,
								proc
							)
						);
					});
					if (processorTasks.length)
						tasks.push(function(callback) {
							async.parallel(processorTasks, function(
								er,
								processors
							) {
								if (er) return callback(er);
								item.processors = processors;
								callback();
							});
						});

					async.parallel(tasks, function(er) {
						if (er) return fn(er);
						let _step;
						try {
							_step = new DynamoStep(item);
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
				DynamoAsyncValidator,
				systemEntities.asyncValidator,
				fn
			);
		};
		this.transformers[systemEntities.processor] = function(item, fn) {
			basicTransformer(
				item,
				DynamoProcessor,
				systemEntities.processor,
				fn
			);
		};
		this.transformers[systemEntities.element] = function(item, fn) {
			if (!(item instanceof DynamoElement)) {
				if (typeof item == "string" || item instanceof ObjectID) {
					return self.queryEntity(
						systemEntities.element,
						{
							_id: item
						},
						{
							full: true,
							one: true
						},
						fn
					);
				}

				if (!item.save)
					item.save = self.getSaveService(systemEntities.element);

				async.parallel(
					_.map(item.asyncValidators, function(x) {
						return self.transformers[
							systemEntities.asyncValidator
						].bind(self, x);
					}),
					function(er, asyncValidators) {
						if (er) return fn(er);
						item.asyncValidators = asyncValidators;
						let _element;
						try {
							_element = new DynamoElement(item);
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
			if (!(item instanceof DynamoForm)) {
				if (!item)
					return (
						debug("step does not have a form"),
						fn(new Error("Step requires a form"))
					);
				async.parallel(
					_.map(item.elements, function(element) {
						return self.transformers[systemEntities.element].bind(
							self.transformers,
							element
						);
					}),
					function(er, elements) {
						if (er) return fn(er);
						item.elements = elements;
						let _form;
						try {
							_form = new DynamoForm(item);
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
			basicTransformer(item, DynamoLib, systemEntities.lib, fn);
		};

		function basicTransformer(item, clazz, entName, fn) {
			if (!(item instanceof clazz)) {
				if (typeof item == "string" || item instanceof ObjectID) {
					//
					return self.queryEntity(
						entName,
						{
							_id: item
						},
						{
							full: true,
							one: true
						},
						fn
					);
				}

				if (!item.save) item.save = self.getSaveService(entName);

				let i = new clazz(item);
				return fn(null, i);
			}

			return fn(null, item);
		}
	}

	function mkdir(path) {
		try {
			if (!fs.existsSync(path)) {
				debug(`creating directory: ${path}`);
				fs.mkdirSync(path);
			}
		} catch (e) {
			debug(e);
		}
	}

	EntityRepo.prototype.setInfrastructure = function(manager) {
		this.infrastructure = manager;
	};

	EntityRepo.prototype.init = function(callback) {
		if (!this.entityFolder)
			return callback(new Error("entityFolder cannot be blank"));

		if (!this.systemEntityFolder)
			return callback(new Error("systemFolder cannot be blank"));

		mkdir(this.systemEntityFolder);
		mkdir(this.entityFolder);
		this.refs[systemEntities.process] = [
			{ model: systemEntities.processor, path: "fetchProcessor" },
			{ model: systemEntities.step, path: "steps" }
		];
		this.refs[systemEntities.step] = [
			{ model: systemEntities.processor, path: "processors" },
			{ model: systemEntities.processor, path: "postprocessors" },
			{
				model: systemEntities.asyncValidator,
				path: "form.elements.asyncValidators"
			}
		];
		let ents = Object.keys(systemEntities),
			init = 0,
			db = new loki(
				path.normalize(`${this.systemEntityFolder}/Dynamo.db`),
				Object.assign(
					{},
					{
						adapter: lokiAdapter,
						autoload: true,
						autoloadCallback: () => {
							ents.forEach(e => {
								this.models[
									systemEntities[e]
								] = LokiMongooseAdapterFactory({
									collectionName: systemEntities[e],
									db,
									aggregator: this
								});
							});
							this.createSchemas(callback);
						},
						autosave: true,
						autosaveInterval: 5000
					},
					config || {}
				)
			);
	};

	//service injected into domain objects for persistence.
	EntityRepo.prototype.getSaveService = function(entName) {
		var self = this;
		return function(info, fn) {
			function transformResult(er, result) {
				if (er) return fn(er);
				if (!result._id) console.log(arguments);
				fn(null, {
					_id: result._id
				});
			}

			if (!info._id) {
				self.createEntity(entName, info, transformResult);
			} else self.updateEntity(entName, info, transformResult);
		};
	};
	//used to create schema document.
	EntityRepo.prototype.createConfig = function(name, config, fn) {
		if (this._systemEntities.indexOf(this.name) !== -1)
			throw new Error("Cannot Create Entity with that name.");
		var self = this;

		fs.writeFile(
			this.getPath(name),
			JSON.stringify(config),
			"utf8",
			function(er) {
				if (er) return fn(er);
				self.createSchemas(fn);
			}
		);
	};

	EntityRepo.prototype.getPath = function(name) {
		return this.entityFolder + name + this.entityExt;
	};
	//returns a schema document.
	EntityRepo.prototype.getConfig = function(name, fn) {
		if (!name) return fn(new Error("name must be defined"));
		fs.readFile(
			this.getPath(name),
			{
				encoding: "utf8"
			},
			function(er, data) {
				try {
					data = JSON.parse(data);
				} catch (e) {
					return fn(new Error("Failed to parse config file"));
				}
				fn(er, data);
			}
		);
	};
	EntityRepo.prototype.getConfigNames = function(fn) {
		fn(
			null,
			Object.keys(this.models).filter(
				function(x) {
					return this._systemEntities.indexOf(x) == -1;
				}.bind(this)
			)
		);
	};
	EntityRepo.prototype.getAllConfiguration = function(fn) {
		var self = this;
		getDirectories(this.entityFolder, function(er, ents) {
			var tasks = [];
			ents.forEach(function(file) {
				if (file.indexOf(self.del) === -1) {
					tasks.push(
						self.getConfig.bind(
							self,
							path.basename(file, path.extname(file))
						)
					);
				}
			});
			async.parallel(tasks, fn);
		});
	};

	EntityRepo.prototype.updateConfig = function(name, config, fn) {
		if (!name) return fn(new Error("name must be defined"));
		if (this._systemEntities.indexOf(this.name) !== -1)
			throw new Error("Cannot Create Entity with that name.");
		var self = this;

		fs.truncate(this.getPath(name), function() {
			self.createConfig(name, config, fn);
		});
	};

	EntityRepo.prototype.queryEntity = function(name, filter, options, fn) {
		var self = this,
			circularDepth =
				options && options.circularDepth ? options.circularDepth : 1,
			referenceCount = {},
			keys;
		if (Array.prototype.slice.call(arguments).length == 3) {
			fn = options;
			options = null;
		}

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
					populate(
						self.refs[item.model],
						result,
						result[result.length - 1]
					);
				}
			});
			return result;
		}

		function transformResult(er, result) {
			if (er) return fn(er);
			if (
				self.transformers[name] &&
				(!options || !options.noTransformaton)
			) {
				async.parallel(
					_.map(result, function(x) {
						return self.transformers[name].bind(
							self.transformers,
							x
						);
					}),
					function(er, transformed) {
						if (er) return fn(er);
						if (options && options.one && transformed)
							transformed = transformed.length
								? transformed[0]
								: null;

						fn(null, transformed);
					}
				);
				return;
			}

			fn(
				null,
				options && options.one
					? result.length ? result[0] : null
					: result
			);
		}

		if (!this.models[name]) {
			return setImmediate(fn, new Error("Model does not exist:" + name));
		}
		//debug(this.models[name]);
		var query = this.models[name].find(filter);
		if (
			options &&
			options.full &&
			this.refs[name] &&
			this.refs[name].length !== 0
		) {
			//debug(self.refs[name]);
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
								if (populateString.indexOf(temp) !== -1)
									cur += "|";
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
					//debug(m);
					query.populate(m);
					return;
				}
				//debug(string);
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
		}

		query.lean().exec(transformResult);
	};

	EntityRepo.prototype.updateEntity = function(name, data, fn) {
		var self = this;
		if (!this.models[name]) {
			return setImmediate(fn, new Error("Model does not exist"));
		}
		if (this._changeDetection[name]) {
			this.models[name].findOne(
				{
					_id: data._id
				},
				function(er, e) {
					if (er) return fn(er);
					if (!e) return fn(new Error("that entity does not exist"));
					var merged = _.assign(e, data);
					debug(merged);
					self._changeDetection[name].forEach(function(field) {
						merged.set(field, data[field]);
					});
					merged.save(fn);
				}
			);
		} else {
			this.models[name].update(
				{
					_id: data._id
				},
				data,
				function(er, stat) {
					if (er) return fn(er);
					if (stat <= 0)
						return fn(new Error("that entity does not exist"));
					fn(null, {
						_id: data._id
					});
				}
			);
		}
	};

	EntityRepo.prototype.createEntity = function(name, data, fn) {
		if (!this.models[name]) {
			return setImmediate(fn, new Error("Model does not exist:" + name));
		}
		debug(data);
		var item = new this.models[name](data);
		item.save(fn);
	};
	EntityRepo.prototype.aggregateEntity = function(name, ...rest) {
		let model = this.models[name];
		return model.aggregate.apply(model, rest);
	};
	EntityRepo.prototype.countEntity = function(name, filter, fn) {
		if (!this.models[name]) {
			return setImmediate(fn, new Error("Model does not exist"));
		}
		this.models[name].count(filter, fn);
	};
	EntityRepo.prototype.deleteEntity = function(name, id, fn) {
		if (!this.models[name]) {
			return setImmediate(fn, new Error("Model does not exist"));
		}
		let query = { _id: id };
		if (Array.prototype.isPrototypeOf(id)) {
			query = { _id: { $in: id } };
		}
		if (!Array.prototype.isPrototypeOf(id) && typeof id == "object") {
			if (!Object.keys(id).length)
				return setImmediate(
					fn,
					new Error(`That would delete all ${name}`)
				);
			query = id;
		}

		this.models[name].remove(query, fn);
	};
	EntityRepo.prototype.createSchemas = function(fn) {
		var self = this;

		function createRunContext(code) {
			return function(value) {
				var sandbox = {
					value: value
				};
				var script = new vm.Script(code);
				var context = new vm.createContext(sandbox);
				script.runInNewContext(context);
				return !!sandbox.result;
			};
		}

		function assignModel(callback) {
			var that = this;
			try {
				var existing =
					self.models[this.prop] || mongoose.model(this.prop);
				var newSchema = JSON.parse(this.item);
				var diff = _.omitBy(newSchema, function(v, k) {
					return _.isEqual(self.schemas[that.prop][k], v);
				});

				var indexes = removeCompoundIndexes(diff);
				var change = Object.keys(diff);
				if (diff && change.length) {
					existing.schema.add(generator.convert(diff));
					removeCompoundIndexes(newSchema);
					self.models[this.prop] = existing;
					self.schemas[this.prop] = newSchema;
					self._changeDetection[this.prop] = change;
					self.refs[that.prop] = getRefs(newSchema);
				}
				debug(indexes);
				if (indexes.length)
					setupCompoundIndexes(
						self.models[this.prop].schema,
						indexes
					);
			} catch (e) {
				if (e.name == "MissingSchemaError") {
					var _schema = JSON.parse(that.item);
					var indexes = removeCompoundIndexes(_schema);
					self.schemas[that.prop] = _schema;
					self.refs[that.prop] = getRefs(self.schemas[that.prop]);
					var schema = new mongoose.Schema(
						generator.convert(self.schemas[that.prop]),
						{ autoIndex: false }
					);
					self.models[that.prop] = mongoose.model(that.prop, schema);
					if (indexes.length) {
						setupCompoundIndexes(schema, indexes);
					}
				} else return callback(e);
			}

			callback();
		}
		function setupCompoundIndexes(schema, indexes) {
			indexes.forEach(x => {
				schema.index(
					x.reduce((s, v) => {
						return (s[v] = 1), s;
					}, {}),
					{ unique: true, sparse: true }
				);
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
					refs = refs.concat(getRefs(obj, key + prop + "."));
					return;
				}
			});

			return refs;
		}

		function registerValidator(result, callback) {
			var that = this;
			self.getValidator(this.name, function(er, v) {
				if (er) return callback(er);
				if (!self.validators[that.name])
					generator.setValidator(
						that.name,
						(self.validators[that.name] = createRunContext(v.code))
					);

				return callback();
			});
		}

		function throwError(er) {
			throw new Error(er);
		}

		function parseEntities(files, fn) {
			var tasks = [
				function(callback) {
					return callback(null);
				}
			];

			for (var prop in files) {
				if (files.hasOwnProperty(prop)) {
					var item = parse(files[prop], files);

					var validate_exp = /"validate"\\s*\:\\s*"(\w+)"/gi;
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
						assignModel.bind({
							item: item,
							prop: prop
						})
					);

					self[prop] = item;
					//this more or less caches the expansion
					files[prop] = item;
				}
			}
			async.waterfall(tasks, function(er, result) {
				debug(self.refs);
				fn(er);
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
				function(callback) {
					getDirectories(self.entityFolder, function(er, response) {
						if (er) {
							return callback(er);
						}
						var allFiles = {};

						response.forEach(function(filePath) {
							var data = fs.readFileSync(filePath, {
								encoding: "utf8"
							});
							allFiles[path.basename(filePath, ".json")] = data;
						});
						callback(null, allFiles);
					});
				},
				parseEntities
			],
			fn || function() {}
		);
	};
	return {
		Engine: DynamoEngine,
		Form: DynamoForm,
		Process: DynamoProcess,
		Lib: DynamoLib,
		Step: DynamoStep,
		Processor: DynamoProcessor,
		constants: constants,
		systemEntities: systemEntities,
		EntityRepo: EntityRepo,
		Element: DynamoElement,
		LokiMongooseAdapter: LokiMongooseAdapterFactory
	};
}

module.exports = init;
