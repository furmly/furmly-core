Object.prototype.isIn = function(val) {
	for (var i in this) {
		if (this.hasOwnProperty(i) && this[i] == val)
			return true;
	}
	return false;
};

var assert = require('assert'),
	config = require('config')[process.env.profile || 'dev'],
	async = require('async'),
	SandBox = require('sandboxed-module'),
	util = require('util'),
	_ = require('lodash'),
	constants = {
		PROCESSSTATUS: {
			COMPLETED: 'completed',
			RUNNING: 'running'
		},
		PROCESSORTYPE: {
			SERVER: 'SERVER',
			CLIENT: 'CLIENT'
		},
		STEPTYPE: {
			OFFLINE: 'OFFLINE',
			CLIENT: "CLIENT"
		}
	};

/*********
 *   DynamoStep Class:- this represents a dynamo step. Steps could be either require userinput or not.
 *
 ***********/
function DynamoStep(opts) {
	var self = this;
	this.id = opts.id;
	if (!opts.processors || !opts.processors.length)
		throw new Error('opts.processors must be valid');

	if (!opts.id)
		throw new Error('opts.valid is null or undefined');

	if (!opts.type || !constants.STEPTYPE.isIn(opts.type))
		throw new Error('opts.type is null or undefined');

	var processors = opts.processors,
		type = opts.type,
		postprocessors = opts.postprocessors,
		form = opts.form,
		_state = getState.call(this);

	Object.defineProperties(this, {
		'type': {
			enumerable: false,
			get: function() {
				return type;
			}
		},
		'processors': {
			enumerable: false,
			get: function() {
				return processors;
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
				return form;
			}
		}
	});

	function Offline(parent) {
		this.run = function(context, fn) {
			//start offline process...
			//tell the caller that process has began
			fn(null, {
				message: 'process has started'
			});
		};
		this.describe = function(fn) {
			fn();
		};
	}

	function getState() {
		switch (type) {
			case constants.STEPTYPE.OFFLINE:
				return new Offline(this);
			default:
				return new Client(this);
		}
	}

	function Client(parent) {
		if (!parent.form)
			throw new Error('Client must have a form');

		assert.equal(parent.form instanceof DynamoForm, true);

		function prepareContext(opts) {
			var _context = opts.args ? _.cloneDeep(opts.args) : {};
			_context.postprocessors = _.cloneDeep(opts.postprocessors);
			_context.processors = _.cloneDeep(opts.processors);
			return _context;
		}


		//this calls all the processors of the step.
		this.run = function(context, fn) {
			var serverProcessors = _.filter(self.processors, ['type', constants.PROCESSORTYPE.SERVER]),
				_context = prepareContext({
					processors: serverProcessors,
					args: context,
					postprocessors: (self.postprocessors && _.find(self.postprocessors, q) ? _.filter(self.postprocessors, q) : null)
				}),
				handle = SandBox.require('./processor-sandbox', {
					locals: {
						context: _context,
						constants: constants,
						async: async
					}
				});
			handle.getResult(function(er, result) {
				if (er) return fn(er);
				return self.status = constants.STEPSTATUS.COMPLETED, fn(null, result);
			});
		};

		this.describe = function(fn) {
			parent.form.describe(fn);
		};
	}



}

DynamoStep.prototype.describe = function(fn) {
	var self = this,
		step = _.clone(self),
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
	state.describe(function(er, res) {
		if (er) return fn(er);

		_.assign(step, res);

		for (i = 0; i < processors.length; i++) {
			processors[i].describe(collect(_processors));
		}

		if (postprocessors && postprocessors.length)
			for (i = 0; i < postprocessors.length; i++)
				postprocessors[i].describe(collect(_postprocessors));
	});

};

DynamoStep.prototype.run = function(context, fn) {
	this.state.run(context, fn);
};



/*********
 *   DynamProcess Class:- this represents a dynamo process.
 *
 ***********/
function DynamoProcess(opts) {
	var self = this;
	if (!opts || !opts.steps || !opts.steps.length)
		throw new Error('Process must contain atleast one step');

	if (!opts.id)
		throw new Error('Process must have an id');

	var currentStep = null;
	this.id = opts.id;
	this.description = opts.description;
	this.store = opts.store;
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

DynamoProcess.prototype.processCurrentStep = function(context, fn) {
	var self = this;

	function processStep(args) {
		var step = self.steps[self.currentStepIndex || 0];
		assert.equal(step instanceof DynamoStep, true);
		step.run(context, function(er, message) {
			if (er) return fn(er);

			self.currentStepIndex = self.steps.indexOf(step) + 1;
			fn(null, _.assign(self.steps.length <= self.currentStepIndex ?
				(self.status = constants.PROCESSSTATUS.RUNNING, {
					status: self.status,
					message: message
				}) : (self.status = constants.PROCESSSTATUS.COMPLETED, {
					status: self.status,
					message: message
				}), args || {}));
		});
	}
	if (this.steps.length > 1) {
		this.store.get(constants.PROCESSNAMESPACE + (context.instanceId || ''), function(er, currentStep) {
			if (er) return fn(er);

			if (currentStep) {
				self.currentStepIndex = currentStep;
				processStep.call({
					instanceId: context.instanceId
				});
			} else
				instanceId = uuid();
			self.store.keep(constants.PROCESSNAMESPACE + instanceId, currentStepIndex, function(er, instanceId) {
				if (er) return fn(er);
				return processStep({
					instanceId: instanceId
				});
			});
		});



		return;
	}

	processStep();


};


DynamoProcess.prototype.describe = function(fn) {
	var self = this,
		proc = _.clone(self),
		_allSteps = [];

	function collect(er, s) {
		if (er) return fn(er);
		_allSteps.push(s);

		if (steps.length == _allSteps.length) {
			proc.steps = _allSteps;
			return fn(null, proc);
		}
	}
	steps.forEach(function(s) {
		s.describe(collect);
	});
	proc.steps = _allSteps;
	return proc;
};


/*********
 *   DynamoEngine Class:- this represents a dynamo engine. Engine represents the boundary between the problem domain and the outside world.
 *
 ***********/
function DynamoEngine(opts) {
	var self = this;
	if (!opts || !opts.processRepository || !opts.stepsRepository || !opts.entitiesRepoistory)
		throw new Error('opts must be valid');

	if (!opts.processRepository)
		throw new Error('opts.processRepository must be valid');

	if (!opts.stepsRepository)
		throw new Error('opts.stepsRepository must be valid');

	if (!opts.entitiesRepoistory)
		throw new Error('opts.entitiesRepoistory must be valid');

	if (!opts.processorsRepository)
		throw new Error('opts.processorsRepository must be valid');

	this.processRepository = opts.processRepository;
	this.stepsRepository = opts.stepsRepository;
	this.entitiesRepository = opts.entitiesRepository;
	this.processorsRepository = opts.processorsRepository;

}

DynamoEngine.prototype.runProcess = function(id, context, fn) {
	this.processRepository.get(id, function(er, dProcess) {
		assert.equal(dProcess instanceof DynamoProcess, true);
		if (er) return fn(er);

		return dProcess.processCurrentStep(context, fn);
	});
};

// DynamoEngine.prototype.createProcess = function(id, title, description, steps, fn) {
// 	var self = this;
// 	if (this.processRepository.get(id, function(er, r) {
// 			if (er) return fn(er);
// 			if (r) return fn('A process with that ID already exists');
// 			self.processRepository.create(id, title, description, steps, fn);
// 		}));
// };


/************
 *   DynamoForm Class:- this represents a dynamo engine. Engine represents the boundary between the problem domain and the outside world.
 *
 ***********/
function DynamoForm(elements) {
	if (!elements || !elements.length)
		throw new Error('Form does not contain any elements');

	this.elements = elements;
}
DynamoForm.prototype.describe = function(fn) {
	fn(null, _.map(this.elements, function(e) {
		return {
			name: e.name,
			label: e.label,
			type: e.type,
			args: e.args,
			description: e.description,
			validators: e.validators
		};
	}));
};


/*********
 *   DynamoProcessor Class:- this represents a dynamo engine. Engine represents the boundary between the problem domain and the outside world.
 *
 ***********/

function DynamoProcessor(opts) {
	if (!opts.id)
		throw new Error('Processesor must have a unique identifier');
	var self = this;
	this.id = id;
	this.code = opts.code;
	this.process = function(callback) {
		/* jshint ignore:start */
		if (this.SANDBOX_CONTEXT)
			eval(self.code);
		/* jshint ignore:end */
	};
}

function DynamoAsyncValidator(opts) {
	var self = this;
	DynamoProcessor.call(this, opts);
	var _process = this.process;
	//convert result to boolean value.
	this.process = function(fn) {
		_process.call(this, function(er, result) {
			fn(er, {
				valid: !!result
			});
		});
	};

}


module.exports = {
	Engine: DynamoEngine,
	Step: DynamoStep,
	Processor: DynamoProcessor
};