const constants = require("./constants"),
	systemEntities = constants.systemEntities,
	misc = require("./misc"),
	async = require("async"),
	debug = require("debug")("engine"),
	util = require("util"),
	DynamoSandbox = require("./sandbox"),
	_ = require("lodash"),
	EventEmitter = require("events"),
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
	 * The Engine represents the boundary between the problem domain and the outside world.
	 * @constructor
	 * @memberOf module:Dynamo
	 * @param {Object} opts Constructor arguments
	 */
function DynamoEngine(opts) {
	var self = this;
	if (!opts) throw new Error("opts must be valid");

	if (!opts.entitiesRepository)
		throw new Error("opts.entitiesRepository must be valid");

	this.entitiesRepository = opts.entitiesRepository;

	//there should be a better way to do this but , it works for now so moving on...
	//
	this.entitiesRepository.processorEntityRepo.getStep = DynamoEngine.prototype.queryStep.bind(
		this
	);
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
				if (
					true
					// !processors ||
					// processors.length !== dProcessors.length
				) {
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
				}
				callback(null, processors);
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
	return this.entitiesRepository.isValidID(id);
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
DynamoEngine.prototype.createEntityConfiguration = function(name, config, fn) {
	this.entitiesRepository.createConfig(name, config, fn);
};

/**
	 * Updates an existing Entity Schema configuration 
	 * @param  {String}   name   Name of Schema Config
	 * @param  {String}   config Configuration
	 * @param  {Function} fn     callback
	 * @return {Any}             nothing
	 */
DynamoEngine.prototype.updateEntityConfiguration = function(name, config, fn) {
	this.entitiesRepository.updateConfig(name, config, fn);
};

/**
 * Returns all the names of the entities in the system
 * @param  {Function} fn Callback
 * @return {Array}      List of entity name
 */
DynamoEngine.prototype.allEntityConfigurations = function(fn) {
	this.entitiesRepository.getConfigNames(fn);
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
	var cap = misc.capitalizeText(key);
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
					if (typeof fn !== "function") {
						console.log(fn);
						console.log("fn is not a function");
						console.log(data);
						console.log(options);
					}
					fn(er, item);
				});
			});
			return;
		}

		if (!data._id)
			this.entitiesRepository.createEntity(systemEntities[key], data, fn);
		else
			this.entitiesRepository.updateEntity(systemEntities[key], data, fn);
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

module.exports = DynamoEngine;
