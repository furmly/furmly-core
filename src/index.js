var assert = require('assert'),
	config = (require('../config'))[process.env.profile || 'dev'],
	async = require('async'),
	SandBox = require('sandboxed-module'),
	ObjectID = require("mongodb").ObjectID,
	util = require('util'),
	_ = require('lodash'),
	constants = createConstants(),
	vm = require('vm'),
	fs = require('fs'),
	generator = require('mongoose-gen'),
	glob = require('glob'),
	path = require('path'),
	mongoose = require('mongoose');

mongoose.Promise = global.Promise;

mongoose.connect(config.data.url);

/**
 * Returns Array of Strings
 * @param  {String} folderPath
 * @param  {Function} callback
 * @return {String}
 */
var getDirectories = function(src, callback) {
	glob(src + '/**/*', callback);
};

/**
 * Returns a function that checks if a property is defined
 * @param  {String} propertyName
 * @return {Function}
 */
var isNotDefined = function(prop) {
	return function(item) {
		return typeof item == "object" && typeof item[prop] == 'undefined';
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
			if (typeof array[i] == 'string') {
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
			if (this.hasOwnProperty(i) && this[i] == val)
				return true;
		}
		return false;
	};

	return {
		PROCESSSTATUS: new Constant('COMPLETED', 'RUNNING'),
		STEPSTATUS: new Constant('COMPLETED', 'RUNNING'),
		PROCESSORTYPE: new Constant('SERVER', 'CLIENT'),
		STEPTYPE: new Constant('OFFLINE', 'CLIENT'),
		ELEMENT_SELECT_SOURCETYPE: new Constant('PROCESSOR', 'FORM'),
		VALIDATORTYPE: new Constant('REQUIRED', 'MAXLENGTH', 'MINLENGTH', 'REGEX'),
		INPUTTYPE: new Constant(['TEXT', 'text'], ['NUMBER', 'number'], ['DATE', 'date']),
		ELEMENTTYPE: new Constant("INPUT", "SCRIPT", "DESIGNER", "SELECTSET", "LABEL", "TITLE", "LARGEINPUT", "COMMAND", "SECTION", "TABS", "SELECT", "LIST", "IMAGE")
	};
}
/**
 * Function used for creating element objects
 * @param  {String} name        Scope name of element
 * @param  {String} label       Placeholder text
 * @param  {String} description Description of elements purpose
 * @param  {Sting} type        Type of element
 * @param  {Array} asyncVals   Array of async validators required by element
 * @param  {Array} validators  Array of clientside validators to be applied on element on the client
 * @param  {Object} args        Specific Args of element required by the element type
 * @return {Object}             Object representing an element
 */
var createElement = function(name, label, description, type, args, validators, asyncVals) {
	return {
		elementType: type,
		label: label,
		name: name,
		args: args,
		asyncValidators: asyncVals || [],
		description: description,
		validators: validators || []
	};
};

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
	step: '_0Step',
	processor: '_0Processor',
	process: '_0Process',
	asyncValidator: '_0AsyncValidator',
	element: '_0Element'
};

var elementTypeListProcessorTitle = 'Element Type List',
	processorsListProcessorTitle = 'List Processors',
	inputTypeListTitle = 'List Input Types';
createProcessProcessTitle = 'Create Process';
/**
 * Generic type processor. (returns selectable list populated by mapping items _id and displayLabel)
 * @type {Object}
 */
var genericSelectProcessor = {
	title: 'Generic Entity Processor',
	code: 'console.log(this); var custom=JSON.parse(this.args.customArgs); this.entityRepo.get(custom.model,{},function(er,x){ if(er) return callback(er); callback(null,x.map(function(z){ return { displayLabel:z[custom.propertyName], _id:z._id}; })); })'
};
/**
 * Processor that returns list of processors.
 * @type {Object}
 */
var processorListProcessor = {
	title: processorsListProcessorTitle,
	code: 'this.entityRepo.get(\'{0}\',{},function(er,x){ if(er) return callback(er); callback(null,x.map(function(z){ return {_id:z._id,displayLabel:z.title}})); });'.replace('{0}', systemEntities.processor)
};

/**
 * Default Element Type processor (returns selectable list)
 * @type {Object}
 */
var elementTypeListProcessor = {
	title: elementTypeListProcessorTitle,
	code: 'var list=[{0}]; callback(null,list.map(function(x){return {_id:x,displayLabel:x}; })); '.replace('{0}', _.map(Object.keys(constants.ELEMENTTYPE), function(x) {
		return '\'' + x + '\'';
	}).join(','))
};

var inputElementTypeListProcessor = {
	title: elementTypeListProcessorTitle,
	code: 'var list=[{0}]; callback(null,list.map(function(x){return {_id:x,displayLabel:x}; })); '.replace('{0}', _.map(Object.keys(constants.INPUTTYPE), function(x) {
		return '\'' + x.toLowerCase() + '\'';
	}).join(','))
};


/**
 * Returns process definition for creating processes
 * @param  {Object} elementTypeProcessorId      id of element list processor
 * @param  {Object} inputElementTypeProcessorId id of processor list processor
 * @return {Object}                             process definition object.
 */

function getProcessDefinition(inputElementTypeProcessorId, elementTypeProcessorId) {
	function tag(obj, t) {
		return {
			dynamo_ref: t,
			template: obj
		};
	}
	var elementTag = '$elementTemplate$';
	return {
		title: 'Create Process',
		description: 'This process is used by system administrators to create new processes.',
		steps: [{
			stepType: constants.STEPTYPE.CLIENT,
			processors: [{
				code: "console.log(\'\tsaved new process successfully\'); console.log(this.args); callback(null);",
				title: 'Create process',
			}],
			form: {
				elements: [{
					elementType: constants.ELEMENTTYPE.DESIGNER,
					label: 'Manage a Process',
					name: 'process',
					args: {
						main: {
							name: 'process',
							elements: [
								createElement('title', 'Title of Process', 'This is what will be visible to users', constants.ELEMENTTYPE.INPUT, {
									type: constants.INPUTTYPE.TEXT
								}),
								createElement('description', 'Description of Process', 'This description what will be visible to users.', constants.ELEMENTTYPE.INPUT, {
									type: constants.INPUTTYPE.LARGEINPUT
								})
							],
							relationships: {
								hasMany: {
									step: {
										path: 'steps',
										hasSelect: false
									}
								}
							}

						},
						elements: {

							step: {
								elements: [
									createElement('description', '',
										'A step is a single form in a process. Processes can have any number of steps.',
										constants.ELEMENTTYPE.LABEL),
									createElement('stepType', 'Type of Step', 'Type of Step.',
										constants.ELEMENTTYPE.INPUT, {
											disabled: true,
											default: constants.STEPTYPE.CLIENT
										})
								],
								relationships: {
									has: {
										form: 'form'
									},
									hasMany: {
										processor: 'processors'
									}
								}
							},
							form: {
								hasPreview: true,
								elements: [
									createElement('description', '',
										'A form contains elements that are displayed to the user when a step is requested',
										constants.ELEMENTTYPE.LABEL)
								],
								relationships: {
									hasMany: {
										element: 'elements'
									}
								}
							},
							processor: {
								elements: [
									createElement('title', 'Title',
										'Title',
										constants.ELEMENTTYPE.INPUT),
									createElement('code', 'This code runs when a client makes a request to the processor endpoint.',
										'Title',
										constants.ELEMENTTYPE.SCRIPT)
								]
							},
							validator: {
								elements: [
									createElement('validatorType', 'Type of Validator', '',
										constants.ELEMENTTYPE.SELECTSET, {
											path: 'args',
											items: [{
												id: constants.VALIDATORTYPE.REQUIRED,
												displayLabel: 'Required',
												elements: []
											}, {
												id: constants.VALIDATORTYPE.MAXLENGTH,
												displayLabel: 'Maximum Number of Characters',
												elements: [
													createElement('max', 'Max', '', constants.ELEMENTTYPE.INPUT, {
														type: constants.INPUTTYPE.NUMBER
													})
												]
											}, {
												id: constants.VALIDATORTYPE.MINLENGTH,
												displayLabel: 'Minimum Number of Characters',
												elements: [
													createElement('min', 'Minimum', '', constants.ELEMENTTYPE.INPUT, {
														type: constants.INPUTTYPE.NUMBER
													})
												]
											}]
										})
								]
							},
							asyncValidator: {
								elements: [
									createElement('title', 'Title',
										'Title',
										constants.ELEMENTTYPE.INPUT),
									createElement('code', 'This code runs when a client makes a request to the processor endpoint.',
										'Title',
										constants.ELEMENTTYPE.SCRIPT)
								]
							},
							element: {
								elements: tag([
									createElement('elementType', 'Element type',
										'The type of element',
										constants.ELEMENTTYPE.SELECTSET, {
											path: 'args',
											items: [{
												id: constants.ELEMENTTYPE.INPUT,
												displayLabel: 'Input',
												elements: [
													createElement('type', 'Type of Input',
														'The user interface uses this value to determine what type of input',
														constants.ELEMENTTYPE.SELECT, {
															type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
															value: inputElementTypeProcessorId
														})
												]
											}, {
												id: constants.ELEMENTTYPE.SELECT,
												displayLabel: 'Select',
												elements: [
													createElement('type', 'Type of Select',
														'The user interface uses this value to determine the available types',
														constants.ELEMENTTYPE.SELECTSET, {
															items: [{
																id: constants.ELEMENT_SELECT_SOURCETYPE.FORM,
																displayLabel: 'Another Element in the form.',
																elements: [
																	createElement('value', 'Name of Element',
																		'This the name of the element that represents the source',
																		constants.ELEMENTTYPE.INPUT),
																	createElement('path', 'Property to bind to.',
																		'Property of the element that contains list to bind to.',
																		constants.ELEMENTTYPE.INPUT)
																]
															}, {
																id: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																displayLabel: 'Processor',
																elements: [
																	createElement('value', 'Value', '', constants.ELEMENTTYPE.SELECT, {
																		type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																		value: elementTypeProcessorId
																	})
																]
															}],

														})
												]
											}, {
												id: constants.ELEMENTTYPE.SELECTSET,
												displayLabel: 'Option Groups',
												elements: [
													createElement('path', 'Optional path', 'Processors will use this path to refer to items contained here',
														constants.ELEMENTTYPE.INPUT, {
															type: constants.INPUTTYPE.TEXT
														}),
													createElement('items', 'Options', 'Options under groups.',
														constants.ELEMENTTYPE.LIST, {
															itemTemplate: [
																createElement('id', 'Result of Selection',
																	'This is what is sent back to the processor as the value of this field',
																	constants.ELEMENTTYPE.INPUT),
																createElement('displayLabel', 'Label displayed to user', '',
																	constants.ELEMENTTYPE.INPUT),
																createElement('elements', 'Properties to add', '', constants.ELEMENTTYPE.LIST, {
																	itemTemplate: {
																		template_ref: elementTag
																	}
																})

															]
														})
												]
											}, {
												id: constants.ELEMENTTYPE.LIST,
												displayLabel: 'List',
												elements: [
													createElement('itemTemplate', 'Template', 'Template used to create and edit items in this list',
														constants.ELEMENTTYPE.LIST, {
															itemTemplate: {
																template_ref: elementTag
															}
														}),
													createElement('options', 'Options', 'Specific options that affects the lists behavior',
														constants.ELEMENTTYPE.SELECTSET, {
															path: 'behavior',
															items: [{
																id: 'TAG',
																displayLabel: 'Tag Template',
																elements: [createElement('dynamo_ref', 'Tag', '', constants.ELEMENTTYPE.INPUT, {
																	type: constants.INPUTTYPE.TEXT
																})]
															}, {
																id: 'REF',
																displayLabel: 'Reference a Tag',
																elements: [
																	createElement('description', '', 'The item template with the referenced tag will override the configured template if found.',
																		constants.ELEMENTTYPE.LABEL),
																	createElement('template_ref', 'Referenced Tag', '', constants.ELEMENTTYPE.INPUT, {
																		type: constants.INPUTTYPE.TEXT
																	})
																]
															}]
														})
												]
											}, {
												id: constants.ELEMENTTYPE.SECTION,
												displayLabel: 'Section',
												elements: [createElement('elements', 'Elements in the section', 'Elements in the section',
													constants.ELEMENTTYPE.LIST, {
														itemTemplate: {
															template_ref: elementTag
														}
													})]
											}]
										}),
									createElement('name', 'Name',
										'This is the name processors use when sending requests',
										constants.ELEMENTTYPE.INPUT),
									createElement('label', 'Label',
										'This is the item used to display placeholder text for elements',
										constants.ELEMENTTYPE.INPUT),
									createElement('description', 'Description',
										'Explanation of elements purpose',
										constants.ELEMENTTYPE.INPUT)
								], elementTag),
								relationships: {
									hasMany: {
										validator: 'validators',
										asyncValidator: 'asyncValidators'
									}
								}
							}
						}
					},
					asyncValidators: [],
					description: 'Used to design/edit processes',
					validators: []
				}]
			}
		}]

	};
}



/**
 * this represents a dynamo step. Steps could be either require userinput or not.
 * @param {Any} opts Object representation of a step or string of _id
 */
function DynamoStep(opts) {
	var self = this;
	if (!opts.processors || !opts.processors.length)
		throw new Error('opts.processors must have atleast one processor');


	if (!opts.stepType || !constants.STEPTYPE.in(opts.stepType))
		throw new Error('opts.type is null or undefined or not a valid type');

	if (!opts.save)
		throw new Error('Step needs save service for persistence');

	this._id = opts._id;
	this.stepType = opts.stepType;
	this._save = opts.save;
	var postprocessors = opts.postprocessors || [];
	var _state = getState.call(this, opts);


	Object.defineProperties(this, {
		'processors': {
			enumerable: false,
			get: function() {
				return opts.processors;
			}
		},
		'state': {
			enumerable: false,
			get: function() {
				return _state;
			}
		},
		'postprocessors': {
			enumerable: false,
			get: function() {
				return postprocessors;
			}
		},
		'form': {
			enumerable: false,
			get: function() {
				return opts.form;
			}
		}
	});
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
				message: 'process has started'
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
		if (!opts.form)
			throw new Error('Client Step must have a form');

		if (!opts.entityRepo)
			throw new Error('opts.entityRepo is required for this type of processor');


		assert.equal(typeof opts.form.describe == 'function', true);

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
			var self = this;
			//

			var serverProcessors = parent.processors, // _.filter(parent.processors, ['processorType', constants.PROCESSORTYPE.SERVER]),
				_context = prepareContext({
					processors: serverProcessors,
					args: context,
					postprocessors: parent.postprocessors //(parent.postprocessors && _.find(parent.postprocessors, q) ? _.filter(parent.postprocessors, q) : null)
				});

			var handle = SandBox.require('./processor-sandbox', {
				locals: {
					context: _context,
					constants: constants,
					entityRepo: this.entityRepo,
					async: async,
				}
			});
			handle.getResult(function(er, result) {
				if (er) return fn(er);

				return parent.status = constants.STEPSTATUS.COMPLETED, fn(null, result);
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
	async.waterfall([
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
			var processorIds = _.map(ids.processors, '_id'); // _.filter(self.processors, typeOf('string')).concat(_.map(ids.processors, '_id'));
			var postprocessorIds = _.map(ids.postprocessors, '_id'); //_.filter(self.postprocessors, typeOf('string')).concat(_.map(ids.postprocessors, '_id'));
			//
			self.state.save(function(er, state) {
				self._save(_.assign({
					_id: self._id,
					processors: processorIds,
					postprocessors: postprocessorIds,
					stepType: self.stepType
				}, state || {}), callback);
			});

		}
	], fn);

};
/**
 * Enforce Class invariant
 */
DynamoStep.prototype.validate = function() {
	if (!this._id)
		throw new Error('opts._id is null or undefined');
};

DynamoStep.prototype.describe = function(fn) {
	this.validate();
	var self = this,
		step = _.pickBy(self, notAFunction),
		_processors = [],
		_postprocessors = [],
		sent = false,
		collected = 0,
		total = self.processors.length + (self.postprocessors ? self.postprocessors.length : 0),
		collect = function(dest) {
			return function(er, p) {
				if (er) {
					return sent = true, fn(er);
				}
				if (!sent) {
					collected++;
					dest.push(p);
					if (collected == total && !sent) {
						return step.processors = _processors,
							step.postprocessors = _postprocessors,
							sent = true, fn(null, step);
					}
				}

			};
		},
		i = 0;
	self.state.describe(function(er, res) {
		if (er) return fn(er);


		// 
		_.assign(step, res);

		for (i = 0; i < self.processors.length; i++) {
			self.processors[i].describe(collect(_processors));
		}

		if (self.postprocessors && self.postprocessors.length)
			for (i = 0; i < self.postprocessors.length; i++)
				self.postprocessors[i].describe(collect(_postprocessors));
	});

};

DynamoStep.prototype.run = function(context, fn) {
	this.validate();
	this.state.run(context, fn);
};


/**
 * Inner class used for running processors that are not part of a steps chain of processors
 * @param {Object} opts Class constructor options , including entityRepo and processors.
 */
function DynamoSandbox(opts) {
	var args;
	if (!opts || !(opts instanceof DynamoProcessor) && (!opts.processors || !opts.processors.length))
		throw new Error('A sandbox needs atleast one processor to run');

	if (!opts.entityRepo && (opts instanceof DynamoProcessor) && (args = Array.prototype.slice.call(arguments)).length == 1)
		throw new Error('EntityRepo is required by all processors');

	var processors = opts instanceof DynamoProcessor ? [opts] : opts,
		entityRepo = opts instanceof DynamoProcessor ? args[1] : opts.entityRepo;

	this.run = function(fn) {
		var handle = SandBox.require('./processor-sandbox.js', {
			locals: {
				context: {
					processors: processors,
					postprocessors: [],
					processorsTimeout: 60000
				},
				constants: constants,
				entityRepo: entityRepo,
				async: async,
			}
		});
		handle.getResult(fn);
	};
}

/**
 * this is a class constructor for a dynamo process.
 * @param {Any} opts constructor parameters
 */
function DynamoProcess(opts) {
	var self = this;
	if (!opts)
		throw new Error('Process arg missing');

	if (!opts.steps || !opts.steps.length)
		throw new Error('Process must contain atleast one step');

	if (!opts.title)
		throw new Error('Process must have a title');

	if (!opts.store && opts.steps.length > 1)
		throw new Error('Process with more than one step requires a store');

	if (!opts.save)
		throw new Error('Process needs save service for persistence');

	var currentStep = null;
	this._id = opts._id;
	this.description = opts.description;
	this.title = opts.title;
	this._save = opts.save;
	Object.defineProperties(self, {
		'steps': {
			enumerable: false,
			get: function() {
				return opts.steps;
			}
		},
		'currentStep': {
			enumerable: false,
			get: function() {
				return currentStep;
			}
		},
		'store': {
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
DynamoProcess.prototype.validate = function() {
	if (!this._id)
		throw new Error('Process must have an id');
};

/**
 * Thisi function chooses and runs the current step
 * @param  {Any}   context contains the details of the request in question.
 * @param  {Function} fn      callback
 * @return {Any}           result passed from processor chain.
 */
DynamoProcess.prototype.run = function(context, fn) {
	var self = this;
	this.validate();

	function processStep(args) {

		var step = self.steps[self.currentStepIndex || 0];
		assert.equal(step instanceof DynamoStep, true);
		step.run(context, function(er, message) {
			if (er) return fn(er);

			self.currentStepIndex = self.steps.indexOf(step) + 1;

			var result = _.assign({
				message: message,
				status: constants.PROCESSSTATUS.COMPLETED
			}, args || {});

			if (self.steps.length > self.currentStepIndex) {
				//
				result.status = constants.PROCESSSTATUS.RUNNING;
				self.store.update(args.instanceId || context.instanceId, self.currentStepIndex, function(er) {
					fn(er, result);
				});
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
		this.store.get((context.instanceId || ''), function(er, currentStep) {
			if (er) return fn(er);

			if (currentStep) {

				self.currentStepIndex = currentStep.value;
				processStep.call(self, {
					instanceId: context.instanceId
				});
			} else {
				self.store.keep(self.currentStepIndex || 0, function(er, data) {
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
	unsaved.forEach(function(pending) {
		function s(callback) {
			pending.save(function(er, result) {
				callback(er, result);
			});
		}
		tasks.push(s);
	});
	async.waterfall([
		async.parallel.bind(async, tasks),
		function(ids, callback) {
			//ids will contain the newly saved ids
			var mergedIds = _.map(ids, '_id');
			self._save({
				title: self.title,
				description: self.description,
				steps: mergedIds
			}, callback);
		}
	], fn);
};

/**
 * Creates a description of the process a client can consume
 * @param  {Function} fn callback
 * @return {Object}      object representing the process.
 */
DynamoProcess.prototype.describe = function(fn) {
	this.validate();
	var self = this,
		proc = _.pickBy(self, notAFunction),
		_allSteps = [];

	function collect(er, s) {
		if (er) return fn(er);
		_allSteps.push(s);

		if (self.steps.length == _allSteps.length) {
			proc.steps = _allSteps;
			return fn(null, proc);
		}
	}
	self.steps.forEach(function(s) {
		s.describe(collect);
	});
	proc.steps = _allSteps;
	return proc;
};


/**
 * The Engine represents the boundary between the problem domain and the outside world.
 * @param {Object} opts Constructor arguments
 */
function DynamoEngine(opts) {
	var self = this;
	if (!opts)
		throw new Error('opts must be valid');

	if (!opts.entitiesRepository)
		throw new Error('opts.entitiesRepository must be valid');

	this.entitiesRepository = opts.entitiesRepository;


}

/**
 * Initializes the system
 * @param  {Function} fn callback
 * @return {Any}      nothing
 */
DynamoEngine.prototype.init = function(fn) {
	var self = this,
		_processors;
	//create all system required configs if they dont exist.
	async.waterfall([
		this.entitiesRepository.init.bind(this.entitiesRepository),
		this.queryProcessor.bind(this, {
			title: {
				$in: [elementTypeListProcessorTitle, processorsListProcessorTitle, inputTypeListTitle]
			}
		}),
		function(processors, callback) {
			if (!processors || !processors.length) {
				async.waterfall([
					self.saveProcessor.bind(self, processorListProcessor),
					function(p, c) {
						self.saveProcessor(inputElementTypeListProcessor, function(er, proc) {
							if (er) return callback(er);
							callback(null, {
								processorList: p._id,
								elementList: proc._id
							});
						});
					},

				], callback);
				return;
			}
			callback(null, processors);
		},
		function(processors, callback) {
			_processors = processors;
			callback();
		},
		this.queryProcess.bind(this, {
			title: createProcessProcessTitle
		}, {
			one: true
		}),
		function(exists, callback) {

			if (!exists) {
				//it does not exist
				var default_process = getProcessDefinition(_processors.elementList, _processors.processorList);

				self.saveProcess(default_process, {
					retrieve: true,
					full: true
				}, callback);
				return;
			}
			callback();
		}
	], function(er, result) {


		if (er) return fn(er);
		fn();
	});
};

DynamoEngine.prototype.runProcessor = function(processor, fn) {
	var sandbox = new DynamoSandbox(processor, this.entitiesRepository.processorEntityRepo);
	sandbox.run(fn);
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
	DynamoEngine.prototype['query' + cap] = function(filter, options, fn) {
		if (Array.prototype.slice.call(arguments).length == 2) {
			fn = options;
			options = null;
		}
		this.entitiesRepository.queryEntity(entName, filter, options, fn);
	};
	DynamoEngine.prototype['save' + cap] = function(data, options, fn) {
		var self = this;
		if (Array.prototype.slice.call(arguments).length == 2) {
			fn = options;
			options = null;
		}
		if (this.entitiesRepository.transformers[entName]) {
			var model = this.entitiesRepository.transformers[entName](data, function(er, model) {
				if (er) return fn(er);
				model.save(function(er, item) {
					if (er) return fn(er);
					if (options && options.retrieve) {
						self.entitiesRepository.queryEntity(entName, item, function(e, x) {
							fn(e, x[0]);
						});
						return;
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
});

//-------------------------------------------------------------------------


/**
 * Class representing DynamoElement
 * @param {Any} opts Constructor options
 */
function DynamoElement(opts) {

	if (!opts)
		throw new Error('opts cannot be null');

	if (!opts.name)
		throw new Error('element name must be valid');

	if (!opts.elementType)
		throw new Error('element type must be valid');

	if (!opts.save)
		throw new Error('element must have persistence service');

	this._id = opts._id;
	this._save = opts.save;
	this.name = opts.name;
	this.elementType = opts.elementType;
	this.label = opts.label;
	this.description = opts.description;
	this.args = opts.args;
	this.asyncValidators = opts.asyncValidators || [];
	this.validators = opts.validators || [];
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
		asyncValidators: _.map(this.asyncValidators, '_id')
	});
};
/**
 * saves using persistence service.
 * @param  {Function} fn callback
 * @return {Object}      saved object.
 */
DynamoElement.prototype.save = function(fn) {
	var self = this;
	async.parallel(_.map(this.asyncValidators, function(x) {
		return x.save.bind(x);
	}), function(er, asyncValidators) {
		if (er) return fn(er);
		self._save({
			_id: self._id,
			name: self.name,
			label: self.label,
			elementType: self.elementType,
			args: self.args,
			description: self.description,
			validators: self.validators,
			asyncValidators: _.map(asyncValidators, '_id')
		}, fn);
	});

};



/**
 * Form used by Client based Steps
 * @param {Any} opts Contructor arguments
 */
function DynamoForm(opts) {
	if (!opts || !opts.elements || !opts.elements.length)
		throw new Error('Form does not contain any elements');


	this.elements = opts.elements;
}

/**
 * Creates a description of a form a client can consume
 * @param  {Function} fn callback
 * @return {Object}      object representing the form.
 */
DynamoForm.prototype.describe = function(fn) {
	async.parallel(_.map(this.elements, function(e) {
		return e.describe.bind(e);
	}), function(er, result) {
		if (er) return fn(er);
		fn(null, {
			elements: result
		});
	});
};
/**
 * saves the form using the persistence service.
 * @param  {Function} fn callback
 * @return {Any}      saved object.
 */
DynamoForm.prototype.save = function(fn) {
	async.parallel(_.map(this.elements, function(x) {
		return x.save.bind(x);
	}), function(er, elements) {
		if (er) return fn(er);
		fn(null, {
			elements: _.map(elements, '_id')
		});
	});
};

/**
 * Class Constuctor for a DynamoProcessor
 * @param {Any} opts Constructor arguments
 */
function DynamoProcessor(opts) {

	if (!opts.code)
		throw new Error('Processor must include code to run');

	if (!opts.title)
		throw new Error('Processor must have a title');

	if (!opts.save)
		throw new Error('Processor needs save service for persistence');


	var self = this;
	this._id = opts._id;
	this.code = opts.code;
	this.title = opts.title;
	this._save = opts.save;
	/**
	 *  User customisable code ran in sandbox.
	 * @param  {Any}   result  passed in result for previous processor.
	 * @param  {Function} callback callback function.
	 * @return {Any}            result of process.
	 */
	this.process = function(result, callback) {

		if (typeof result == 'function') {
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
			console.log(e);
			callback(e);
		}

	};
}
/**
 * Class invariant function
 * @return {Void} nothing
 */
DynamoProcessor.prototype.validate = function() {
	if (!this._id)
		throw new Error('Processor requires a valid _id');
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

	this._save({
		_id: this._id,
		code: this.code,
		title: this.title
	}, fn);
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


/**
 * This class contains the persistence logic for entities.
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
	this.entityExt = opts.ext || '.json';
	this.entityFolder = opts.folder || './src/entities/';
	this.delimiter = opts.delimiter || /('|")\$\{(\w+)\}+('|")/i;
	this._systemEntities = _.map(systemEntities, function(x) {
		return x;
	});
	this.store = opts.store || (function() {
		var collection = mongoose.connection.db.collection('_temp_store_');

		function createIndex(fn) {
			collection.createIndex({
				createdOn: 1
			}, {
				expireAfterSeconds: opts.storeTTL || 60
			}, fn);
		}
		return {
			get: function(id, fn) {
				collection.findOne({
					_id: id
				}, fn);
			},
			update: function(id, info, fn) {
				collection.update({
					_id: id
				}, {
					value: info,
					createdOn: new Date()
				}, fn);
			},
			remove: function(id, fn) {
				collection.deleteOne({
					_id: id
				}, fn);
			},
			keep: function(info, fn) {
				createIndex(function() {
					collection.insertOne({
						value: info,
						createdOn: new Date()
					}, fn);
				});
			}
		};

	}());
	this.processorEntityRepo = {
		get: self.queryEntity.bind(self),
		update: self.updateEntity.bind(self),
		create: self.createEntity.bind(self)
	};

	this.transformers[systemEntities.process] = function(item, fn) {

		if (!(item instanceof DynamoProcess)) {
			var tasks = [];
			if (typeof item == "string" || item instanceof ObjectID) {
				tasks.push(self.queryEntity.bind(self, systemEntities.process, {
					_id: item
				}, {
					full: true,
					one: true
				}));
			} else {
				tasks.push(function(callback) {
					if (!item.steps) {
						return callback(new Error('Processor must include atleast on step'));
					}
					if (!item.save)
						item.save = self.getSaveService(systemEntities.process);
					if (item.steps.length > 1) {
						item.store = self.store;
					}
					var itasks = [];
					//
					item.steps.forEach(function(step) {
						itasks.push(self.transformers[systemEntities.step].bind(self, step));
					});
					async.parallel(itasks, function(er, steps) {
						if (er) return callback(er);

						item.steps = steps;
						callback(null, new DynamoProcess(item));
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
				self.queryEntity(systemEntities.step, {
					_id: item
				}, {
					full: true,
					one: true
				}, fn);
			} else {
				//console.trace('here!!');
				if (!item.save)
					item.save = self.getSaveService(systemEntities.step);

				if (item.stepType == constants.STEPTYPE.CLIENT) {
					item.entityRepo = self.processorEntityRepo;
					tasks.push(function(callback) {
						self.transformers.form(item.form, function(er, form) {
							if (er) callback(er);
							item.form = form;
							return callback();
						});
					});
				}
				if (item.postprocessors) {
					item.postprocessors.forEach(function(proc) {
						postprocessorTasks.push(self.transformers[systemEntities.processor].bind(self, proc));
					});
					tasks.push(function(callback) {
						async.parallel(postprocessorTasks, function(er, postprocessors) {
							if (er) return callback(er);
							item.postprocessors = postprocessors;
							callback();
						});
					});
				}
				item.processors.forEach(function(proc) {
					processorTasks.push(self.transformers[systemEntities.processor].bind(self, proc));
				});
				tasks.push(function(callback) {
					async.parallel(processorTasks, function(er, processors) {
						if (er) return callback(er);
						item.processors = processors;
						callback();
					});
				});

				async.parallel(tasks, function(er) {
					if (er) return fn(er);


					return fn(null, new DynamoStep(item));
				});
			}
			return;
		}
		return fn(null, item);
	};
	this.transformers[systemEntities.asyncValidator] = function(item, fn) {


		if (!(item instanceof DynamoAsyncValidator)) {

			if (typeof item == "string" || item instanceof ObjectID) {
				return self.queryEntity(systemEntities.asyncValidator, {
					_id: item
				}, {
					full: true,
					one: true
				}, fn);

			}

			if (!item.save)
				item.save = self.getSaveService(systemEntities.asyncValidator);

			return fn(null, new DynamoAsyncValidator(item));
		}
		return fn(null, item);
	};
	this.transformers[systemEntities.processor] = function(item, fn) {

		if (!(item instanceof DynamoProcessor)) {

			if (typeof item == "string" || item instanceof ObjectID) {
				//
				return self.queryEntity(systemEntities.processor, {
					_id: item
				}, {
					full: true,
					one: true
				}, fn);
			}

			if (!item.save)
				item.save = self.getSaveService(systemEntities.processor);

			return fn(null, new DynamoProcessor(item));
		}
		return fn(null, item);
	};
	this.transformers[systemEntities.element] = function(item, fn) {
		if (!(item instanceof DynamoElement)) {

			if (typeof item == "string" || item instanceof ObjectID) {
				return self.queryEntity(systemEntities.element, {
					_id: item
				}, {
					full: true,
					one: true
				}, fn);
			}


			if (!item.save)
				item.save = self.getSaveService(systemEntities.element);



			async.parallel(_.map(item.asyncValidators, function(x) {

				return self.transformers[systemEntities.asyncValidator].bind(self, x);
			}), function(er, asyncValidators) {
				if (er) return fn(er);
				item.asyncValidators = asyncValidators;
				return fn(null, new DynamoElement(item));
			});
			return;
		}
		return fn(null, item);
	};
	this.transformers.form = function(item, fn) {
		if (!(item instanceof DynamoForm)) {
			async.parallel(_.map(item.elements, function(element) {
				return self.transformers[systemEntities.element].bind(self.transformers, element);
			}), function(er, elements) {
				if (er) return fn(er);
				item.elements = elements;
				return fn(null, new DynamoForm(item));
			});
			return;
		}
		return fn(null, form);
	};

}

EntityRepo.prototype.init = function(callback) {
	var self = this;

	async.parallel([
		fs.writeFile.bind(this, self.getPath(systemEntities.process), '{"title":{"type":"String","required":true},"description":{"type":"String","required":true},"steps":[{"type":"ObjectId","ref":"' + systemEntities.step + '"}]}'),
		fs.writeFile.bind(this, self.getPath(systemEntities.step), '{"processors":[{"type":"ObjectId","ref":"' + systemEntities.processor + '"}],"postprocessors":[{"type":"ObjectId","ref":"' + systemEntities.processor + '"}],"stepType":{"type":"String","required":true},"form":{"elements":[{"type":"ObjectId","ref":"' + systemEntities.element + '"}]}}'),
		fs.writeFile.bind(this, self.getPath(systemEntities.processor), '{"code":{"type":"String","required":true},"title":{"type":"String", "required":true}}'),
		fs.writeFile.bind(this, self.getPath(systemEntities.asyncValidator), '{"code":{"type":"String","required":true},"title":{"type":"String", "required":true}}'),
		fs.writeFile.bind(this, self.getPath(systemEntities.element), '{"name":{"type":"String","required":true},"label":{"type":"String","required":true},"description":{"type":"String"},"elementType":{"type":"String","enum":[' + (_.map(Object.keys(constants.ELEMENTTYPE), function(x) {
			return '"' + x + '"';
		}).join(',')) + ']},"asyncValidators":[{"type":"ObjectId","ref":"' + systemEntities.asyncValidator + '"}],"validators":[{"validatorType":{"type":"String","enum":[' + (_.map(Object.keys(constants.VALIDATORTYPE), function(x) {
			return '"' + x + '"';
		}).join(',')) + '],"required":true},"args":{"type":"Mixed"}}],"args":{"type":"Mixed"}}')
	], function(er) {
		if (er) return callback(er);
		self.createSchemas(callback);
	});
};

//service injected into domain objects for persistence.
EntityRepo.prototype.getSaveService = function(entName) {
	var self = this;
	return function(info, fn) {

		function transformResult(er, result) {
			if (er) return fn(er);
			if (!result._id)
				console.log(arguments);
			fn(null, {
				_id: result._id
			});
		}

		if (!info._id)
			self.createEntity(entName, info, transformResult);
		else
			self.updateEntity(entName, info, transformResult);
	};
};
//used to create schema document.
EntityRepo.prototype.createConfig = function(name, config, fn) {
	if (this._systemEntities.indexOf(this.name) !== -1)
		throw new Error('Cannot Create Entity with that name.');
	var self = this;

	fs.writeFile(this.getPath(name), JSON.stringify(config), 'utf8', function(er) {
		if (er) return fn(er);
		self.createSchemas(fn);
	});
};

EntityRepo.prototype.getPath = function(name) {
	return this.entityFolder + name + this.entityExt;
};
//returns a schema document.
EntityRepo.prototype.getConfig = function(name, fn) {
	fs.readFile(this.getPath(name), {
		encoding: 'utf8'
	}, function(er, data) {
		try {
			data = JSON.parse(data);
		} catch (e) {
			return fn(new Error('Failed to parse config file'));
		}
		fn(er, data);
	});
};

EntityRepo.prototype.getAllConfiguration = function(fn) {
	var self = this;
	getDirectories(this.entityFolder, function(er, ents) {
		var tasks = [];
		ents.forEach(function(file) {
			if (file.indexOf(self.del) === -1)
				task.push(self.getConfig.bind(self, name));
		});
		async.parallel(tasks, fn);
	});
};

EntityRepo.prototype.updateConfig = function(name, config, fn) {
	if (this._systemEntities.indexOf(this.name) !== -1)
		throw new Error('Cannot Create Entity with that name.');
	var self = this;
	fs.truncate(this.getPath(name), function() {
		self.createConfig(name, config, fn);
	});
};

EntityRepo.prototype.queryEntity = function(name, filter, options, fn) {
	var self = this,
		circularDepth = options && options.circularDepth ? options.circularDepth : 1,
		referenceCount = {},
		keys;
	if (Array.prototype.slice.call(arguments).length == 3) {
		fn = options;
		options = null;
	}
	//console.trace('query entity!!!');

	function populate(arr, result, parent) {
		arr.forEach(function(item) {

			if (parent && new RegExp(item.path + '$').test(parent)) {
				referenceCount[item.model] = referenceCount[item.model] ? referenceCount[item.model] + 1 : 1;
			}

			result.push((parent ? parent + '.' : '') + item.path);
			if (self.refs[item.model] && (referenceCount[item.model] || 0) < circularDepth) {
				populate(self.refs[item.model], result, result[result.length - 1]);
			}
		});
		return result;
	}

	function transformResult(er, result) {
		//
		if (er) return fn(er);
		if (self.transformers[name]) {
			async.parallel(_.map(result, function(x) {
				return self.transformers[name].bind(self.transformers, x);
			}), function(er, transformed) {
				if (er) return fn(er);
				if (options && options.one && transformed)
					transformed = transformed.length ? transformed[0] : null;

				fn(null, transformed);
			});
			return;
		}

		fn(null, result);
	}

	var query = this.models[name].find(filter);
	if ((options && options.full) && this.refs[name] && this.refs[name].length !== 0) {
		var populateString = populate(self.refs[name], []);
		populateString.forEach(function(string) {
			if ((string.match(/\./ig) || []).length >= 1) {
				var cur = '',
					temp = '',
					m = {},
					iterator = function(x, index, arr) {
						cur += x;
						temp += x;
						if (index < (arr.length - 1)) {
							if (populateString.indexOf(temp) !== -1)
								cur += '|';
							else {
								cur += '.';
							}
							temp += '.';
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
				string.split('.').forEach(iterator);
				_.reduce(cur.split('|'), reducer, m);
				query.populate(m);
				return;
			}

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
	}

	query.lean().exec(transformResult);
};

EntityRepo.prototype.updateEntity = function(name, data, fn) {
	var self = this;
	if (this._changeDetection[name]) {

		this.models[name].findOne({
			_id: data._id
		}, function(er, e) {
			if (er) return fn(er);
			var merged = _.assign(e, data);
			self._changeDetection[name].forEach(function(field) {
				merged.set(field, data[field]);
			});
			merged.save(fn);
		});
	} else {
		//
		//
		//
		this.models[name].update({
			_id: data._id
		}, data, function(er, stat) {
			if (er) return fn(er);
			fn(null, {
				_id: data._id
			});
		});
	}

};

EntityRepo.prototype.createEntity = function(name, data, fn) {
	var item = new(this.models[name])(data);
	item.save(fn);
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

			var existing = self.models[this.prop] || mongoose.model(this.prop);
			var newSchema = JSON.parse(this.item);
			var diff = _.omitBy(newSchema, function(v, k) {
				return _.isEqual(self.schemas[that.prop][k], v);
			});
			var change = Object.keys(diff);
			if (diff && change.length) {
				existing.schema.add(generator.convert(diff));
				self.models[this.prop] = existing;
				self.schemas[this.prop] = newSchema;
				self._changeDetection[this.prop] = change;
				self.refs[that.prop] = getRefs(newSchema);

			}
		} catch (e) {
			if (e.name == 'MissingSchemaError') {
				self.schemas[that.prop] = JSON.parse(that.item);
				self.refs[that.prop] = getRefs(self.schemas[that.prop]);
				var schema = new mongoose.Schema(generator.convert(self.schemas[that.prop]));
				self.models[that.prop] = mongoose.model(that.prop, schema);

			} else
				return callback(e);
		}

		callback();
	}

	function getRefs(file, key) {
		var props = Object.keys(file),
			refs = [];
		if (!key) key = '';
		props.forEach(function(prop) {
			if (prop == 'ref') {
				refs.push({
					model: file.ref,
					path: key.substring(0, key.length - 1)
				});
				return;
			}

			if (typeof file[prop] == 'object') {
				var obj = file[prop];
				if (obj instanceof Array) {
					if (typeof obj[0] == 'object')
						obj = obj[0];
					else
						return;
				}
				refs = refs.concat(getRefs(obj, key + prop + '.'));
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
				generator.setValidator(that.name, self.validators[that.name] = createRunContext(v.code));

			return callback();
		});
	}

	function throwError(er) {
		throw new Error(er);
	}

	function parseEntities(files, fn) {
		var tasks = [function(callback) {
			return callback(null);
		}];

		for (var prop in files) {
			if (files.hasOwnProperty(prop)) {
				var item = parse(files[prop], files);

				var validate_exp = /"validate"\\s*\:\\s*"(\w+)"/ig;
				var match = validate_exp.exec(item);
				while (match) {
					tasks.push(registerValidator.bind({
						name: match[1]
					}));
					match = validate_exp.exec(item);
				}

				// Generate the Schema object.
				tasks.push(assignModel.bind({
					item: item,
					prop: prop
				}));

				self[prop] = item;
				//this more or less caches the expansion 
				files[prop] = item;
			}
		}
		async.waterfall(tasks, fn);
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
	async.waterfall([function(callback) {
			getDirectories(self.entityFolder, function(er, response) {
				if (er) {
					return callback(er);
				}
				var allFiles = {};

				response.forEach(function(filePath) {
					var data = fs.readFileSync(filePath, {
						encoding: 'utf8'
					});
					allFiles[path.basename(filePath, '.json')] = data;
				});
				callback(null, allFiles);

			});
		},
		parseEntities
	], fn || function() {});

};

module.exports = {
	Engine: DynamoEngine,
	Form: DynamoForm,
	Process: DynamoProcess,
	Step: DynamoStep,
	Processor: DynamoProcessor,
	constants: constants,
	systemEntities: systemEntities,
	EntityRepo: EntityRepo,
	Element: DynamoElement
};