var sinon = require('sinon'),
	fs = require('fs'),
	Db = require('mongodb').Db,
	MongoClient = require('mongodb').MongoClient,
	Server = require('mongodb').Server,
	_ = require('lodash'),
	config = (require('../config'))[process.env.profile || 'dev'],
	app = require('../src/index.js')(config),
	async = require('async'),
	mongoose = require('mongoose');


function deleteFile(path) {
	try {
		fs.unlinkSync(path);
	} catch (e) {

	}
}


function clearCollection(name, fn) {
	deleteFile('./src/entities/{0}.json'.replace('{0}', name));
	delete mongoose.connection.models[name];
	delete mongoose.modelSchemas[name];
	delete mongoose.models[name];
	mongoose.connection.db.dropCollection(name.toLowerCase() + 's', function(er) {
		fn();
	});
}

describe('Process spec', function() {
	beforeEach(function() {
		var self = this;
		this.processes = {};

		this.opts = {
			save: function(fn) {
				fn(null);
			},
			_id: '{id}',
			title: '{title}',
			description: '{description}',
			steps: [{
				_id: '{step id}'
			}]
		};
	});

	it('can be several steps in a process but there must be atleast one step.', function(done) {
		this.opts.steps.length = 0;
		var fixture = this;
		assert.throws(function() {
			new app.Process(fixture.opts);
		}, Error, 'Process must contain atleast one step');
		done();
	});

	it('Processess are created with a unique id,title,description and steps', function(done) {
		var processObj = new app.Process(this.opts),
			fixture = this;
		assert.isNotNull(processObj);
		assert.equal(processObj._id, this.opts._id);
		assert.equal(processObj.title, this.opts.title);
		assert.equal(processObj.description, this.opts.description);
		assert.deepEqual(processObj.steps, this.opts.steps);

		assert.throws(function() {
			delete fixture.opts.title;
			var p = new app.Process(fixture.opts);
		}, Error, 'Process must have a title');
		done();
	});

	it('process with more than one step requires a store', function(done) {
		var fixture = this;
		this.opts.steps.push({});
		assert.throws(function() {
			new app.Process(fixture.opts);
		}, 'Process with more than one step requires a store');
		done();
	});

	it('can describe its required steps', function(done) {
		//  new app.Process({_id:'fake'})
		var step1 = {
				_id: 'wonderful step'
			},
			step2 = 'awesome step',
			fixture = this;
		this.opts.steps[0].describe = sinon.spy(function(fn) {
			fn(null, step1);
		});
		this.opts.steps.push({
			describe: sinon.spy(function(fn) {
				fn(null, step2);
			})
		});
		//because it has more than one step.
		this.opts.store = {};
		var processObj = new app.Process(this.opts);
		processObj.describe(function(er, description) {
			assert.isNull(er);
			assert.isDefined(description);
			assert.equal(fixture.opts.steps[0].describe.callCount, 1);
			assert.equal(fixture.opts.steps[1].describe.callCount, 1);
			assert.equal(description._id, fixture.opts._id);
			assert.equal(description.title, fixture.opts.title);
			assert.equal(description.description, fixture.opts.description);
			assert.isNotNull(description.steps);
			assert.equal(description.steps[0], step1);
			assert.equal(description.steps[1], step2);
			done();
		});
	});

});

describe('Step spec', function() {
	beforeEach(function() {
		//var fakeForm = sinon.spy(app, 'Form');
		//form.proto
		this.opts = {
			_id: 'fake',
			save: function(fn) {
				fn();
			},
			stepType: app.constants.STEPTYPE.CLIENT,
			entityRepo: {},
			form: {
				describe: function() {

				}
			},
			processors: [{
				_id: 'fake'
			}],
			postprocessors: []
		};
	});

	it('must have an id and type', function(done) {
		var fixture = this;
		assert.throws(function() {
			delete fixture.opts._id;
			var step = new app.Step(fixture.opts);
			step.run();
		}, Error, 'opts._id is null or undefined');
		assert.throws(function() {
			delete fixture.opts.stepType;
			fixture.opts._id = 'fake';
			new app.Step(fixture.opts);
		}, Error, 'opts.type is null or undefined or not a valid type');
		done();
	});

	it('can have a chain of processors but the chain must have atleast one', function(done) {
		var fixture = this;
		assert.throws(function() {
			fixture.opts.processors.length = 0;
			new app.Step(fixture.opts);
		}, Error, 'opts.processors must have atleast one processor');

		done();
	});
	it('can either be offline (not requiring user input) or Online (user input required)', function(done) {
		var fixture = this;
		assert.throws(function() {
			fixture.opts.stepType = 'faketype';
			new app.Step(fixture.opts);
		}, Error, 'opts.type is null or undefined or not a valid type');
		done();
	});

	it('online steps require a form', function(done) {
		var fixture = this;
		assert.throws(function() {
			delete fixture.opts.form;
			new app.Step(fixture.opts);
		}, Error, 'Client Step must have a form');
		done();
	});


	it('can have a chain of postprocessors', function(done) {
		var fixture = this;
		fixture.opts.postprocessors.push({
			_id: 'fakepostprocessor'
		});
		var step = new app.Step(fixture.opts);
		assert.deepEqual(step.postprocessors, fixture.opts.postprocessors);
		done();
	});

	it('client step can describe its form and processors', function(done) {
		var formDescription = {
				form: 'this is a form'
			},
			processorDescription = 'this is a processor',
			postprocessorDescription = 'this is a postprocessors description',
			fixture = this;
		this.opts.form = {
			describe: sinon.spy(function(fn) {
				fn(null, formDescription);
			})
		};
		this.opts.processors.forEach(function(p) {
			p.describe = sinon.spy(function(fn) {
				fn(null, processorDescription);
			});
		});
		this.opts.postprocessors.push({
			describe: sinon.spy(function(fn) {
				fn(null, postprocessorDescription);
			})
		});

		var step = new app.Step(this.opts);
		step.describe(function(er, description) {
			assert.isNull(er);
			assert.isDefined(description);
			assert.equal(description.form, formDescription);
			assert.deepEqual(description.postprocessors, [postprocessorDescription]);
			assert.deepEqual(description.processors, [processorDescription]);
			assert.equal(fixture.opts.processors[0].describe.callCount, 1);
			assert.equal(fixture.opts.postprocessors[0].describe.callCount, 1);
			done();
		});
	});


});

describe('Form spec', function() {
	beforeEach(function() {
		this.elements = [{
			name: 'firstName',
			label: 'First Name',
			type: 'Text',
			args: {},
			description: 'User\'s First Name',
			asyncValidators: [],
			validators: [],
			describe: function(fn) {
				fn(null, this);
			}
		}];
	});

	it('must contain atleast one element', function(done) {
		this.elements.length = 0;
		assert.throws(function() {
			new app.Form({
				elements: this.elements
			});
		}, Error, 'Form does not contain any elements');
		done();
	});



	it('can describe elements and properties', function(done) {
		var form = new app.Form({
				elements: this.elements
			}),
			fixtures = this;
		form.describe(function(er, description) {
			assert.isNull(er);
			assert.isDefined(description);
			assert.deepEqual(description, {
				elements: fixtures.elements
			});
			done();
		});
	});

});


describe('Processor spec', function() {
	var Sandbox = require('Sandboxed-module');
	beforeEach(function() {
		var fixtures = this;
		var save = function(fn) {
			fn();
		};
		this.message1 = 'fake ran!!!';
		this.message2 = 'faker also ran!!!';
		this.locals = {
			async: require('async'),
			context: {
				processors: [
					new app.Processor({
						_id: 'fake',
						title: 'Returns a message',
						save: save,
						code: 'callback(null,\'{0}\')'.replace('{0}', fixtures.message1)
					}),
					new app.Processor({
						_id: 'faker',
						title: 'Returns a message',
						save: save,
						code: 'callback(null,\'{0} \' + result);'.replace('{0}', fixtures.message2)
					})
				]
			}
		};
	});
	it('processors are uniquely identifiable and contain code to run', function(done) {
		assert.throws(function() {
			new app.Processor({
				_id: 'fake',
				code: 'console.log(\'great!!\')'
			});
		}, Error, 'Processor must have a title');
		assert.throws(function() {
			new app.Processor({
				_id: 'fake',
				code: 'console.log(\'great!!\')',
				title: 'Creates a new User'
			});
		}, Error, 'Processor needs save service for persistence');
		assert.throws(function() {
			new app.Processor({
				_id: 'fake',
				title: 'Creates a new User'
			});
		}, Error, 'Processor must include code to run');
		done();
	});

	it('can timeout processor after configured period', function() {
		this.locals.context.processors[0].code = ' \'did nothing\'; ';
		var sandbox = Sandbox.require('../src/processor-sandbox', {
			locals: this.locals
		});
		sandbox.getResult(function(er, result) {
			assert.isUndefined(result);
			assert.isNotNull(er);
			assert.equal(er, 'ETIMEDOUT');
		});
	});

	it('can skip a processor', function(done) {
		this.locals.context.processors[0].code = 'this.skip[\'faker\']=true; ' + this.locals.context.processors[0].code;
		var sandbox = Sandbox.require('../src/processor-sandbox', {
				locals: this.locals
			}),
			fixtures = this;
		sandbox.getResult(function(er, result) {
			assert.isDefined(result);
			assert.isNotNull(result);
			assert.isNull(er);
			assert.equal(result.indexOf(fixtures.message1) !== -1, true);
			assert.equal(result.indexOf(fixtures.message2) == -1, true);
			done();
		});
	});

	it('can run multple processors', function(done) {
		var sandbox = Sandbox.require('../src/processor-sandbox', {
				locals: this.locals
			}),
			fixtures = this;
		sandbox.getResult(function(er, result) {
			assert.isDefined(result);
			assert.isNotNull(result);
			assert.isNull(er);
			assert.equal(result.indexOf(fixtures.message1) !== -1, true);
			assert.equal(result.indexOf(fixtures.message2) !== -1, true);
			done();
		});
	});


});

describe('Entity spec', function() {
	beforeEach(function() {
		this.modelName = 'User';
		this.modelPath = './src/entities/{0}.json'.replace('{0}', this.modelName);
		this.model = {
			firstName: {
				type: 'String',
				required: true
			},
			lastName: {
				type: 'String'
			},
			age: {
				type: 'Number'
			},
			buddy: {
				type: 'ObjectId',
				ref: this.modelName
			}
		};
		this.instance = {
			firstName: 'Chidi',
			lastName: 'Onuekwusi',
			age: 28
		};
	});

	afterEach(function(done) {
		clearCollection(this.modelName, done);
	});



	function readFile(path) {
		return JSON.parse(fs.readFileSync(path));
	}

	it('entity configurations can be created', function(done) {
		var repo = new app.EntityRepo(this.opts),
			fixtures = this,
			spy = sinon.spy(function(er, r) {
				assert.isUndefined(er);
				assert.deepEqual(readFile(fixtures.modelPath), fixtures.model);
				assert.isDefined(repo.refs[fixtures.modelName]);
				assert.equal(repo.refs[fixtures.modelName].length, 1);
				done();
			});
		repo.createConfig(this.modelName, this.model, spy);
	});

	it('entity configurations can be retrieved', function(done) {
		var repo = new app.EntityRepo(),
			fixtures = this;
		repo.createConfig(this.modelName, this.model, function() {
			repo.getConfig(fixtures.modelName, function(er, model) {
				assert.isNull(er);
				assert.deepEqual(readFile(fixtures.modelPath), model);
				done();
			});
		});
	});

	it('can create entity instances', function(done) {
		var repo = new app.EntityRepo(),
			fixture = this;
		repo.createConfig(this.modelName, this.model, function() {
			repo.createEntity(fixture.modelName, fixture.instance, function(er) {
				assert.isNull(er);
				mongoose.model(fixture.modelName).findOne({
					firstName: fixture.instance.firstName
				}, function(er, found) {
					assert.isNull(er);
					assert.isDefined(found);
					assert.isNotNull(found);
					assert.equal(found.firstName, fixture.instance.firstName);
					done();
				});


			});
		});
	});

	it('can query existing instances', function(done) {
		var repo = new app.EntityRepo(),
			fixture = this;
		repo.createConfig(this.modelName, this.model, function() {
			repo.createEntity(fixture.modelName, fixture.instance, function(er, chidi) {
				assert.isNull(er);
				repo.createEntity(fixture.modelName, {
					firstName: 'Uche',
					lastName: 'My Nigga',
					age: 26,
					buddy: chidi._id
				}, function(er) {
					assert.isNull(er);
					repo.queryEntity(fixture.modelName, {
						firstName: 'Uche'
					}, {
						full: true
					}, function(er, result) {
						assert.isNull(er);
						assert.isNotNull(result);
						assert.equal(result.length, 1);
						assert.isNotNull(result[0].buddy);
						assert.deepEqual(result[0].buddy, chidi.toJSON());
						done();
					});
				});

			});
		});
	});

	it('can modify existing schema', function(done) {
		var repo = new app.EntityRepo(),
			fixtures = this;
		//create new config
		repo.createConfig(this.modelName, this.model, function(er) {
			assert.isUndefined(er);
			fixtures.model.address = {
				type: 'String',
				required: true
			};
			//update it
			repo.updateConfig(fixtures.modelName, fixtures.model, function(er) {
				assert.isUndefined(er);
				//retrieve it
				repo.getConfig(fixtures.modelName, function(er, model) {
					assert.isNull(er);
					assert.deepEqual(readFile(fixtures.modelPath), model);
					repo.createEntity(fixtures.modelName, fixtures.instance, function(er) {
						assert.isNotNull(er);
						assert.equal(er.name, 'ValidationError');
						done();
					});

				});
			});
		});
	});

	it('can modify/save entity instances and schemas', function(done) {
		var repo = new app.EntityRepo(),
			fixture = this;
		repo.createConfig(this.modelName, this.model, function() {
			repo.createEntity(fixture.modelName, fixture.instance, function(er) {
				assert.isNull(er);
				repo.queryEntity(fixture.modelName, {
					firstName: fixture.instance.firstName
				}, {
					full: true
				}, function(er, instance) {
					assert.isNotNull(instance);
					assert.isDefined(instance);
					assert.equal(instance.length, 1);
					instance[0].firstName = 'Uche';
					var id = instance[0]._id;
					repo.updateEntity(fixture.modelName, instance[0], function(er) {
						assert.isNull(er);
						repo.queryEntity(fixture.modelName, {
							firstName: 'Uche'
						}, function(er, insts) {
							assert.isNull(er);
							assert.deepEqual(insts[0]._id, id);
							assert.equal(insts[0].firstName, 'Uche');
							var inst = insts[0];
							//modify schema
							fixture.model.address = {
								type: 'String',
								required: true
							};
							repo.updateConfig(fixture.modelName, fixture.model, function(er) {
								assert.isUndefined(er);
								var address = 'No 9 mercy eneli street';
								inst.address = address;

								repo.updateEntity(fixture.modelName, inst, function(er) {
									assert.isNull(er);
									repo.queryEntity(fixture.modelName, {
										_id: inst._id
									}, function(er, lastChecks) {

										assert.isNull(er);
										assert.equal(lastChecks[0].address, address);
										repo.createEntity(fixture.modelName, {
											firstName: 'Dongo',
											age: 99,
											address: 'Surulere'
										}, function(er) {
											assert.isNull(er);
											repo.queryEntity(fixture.modelName, {
												firstName: 'Dongo'
											}, function(er, dongoClan) {
												assert.isNull(er);
												assert.equal(dongoClan[0].address, 'Surulere');
												done();
											});
										});

									});
								});

							});


						});
					});
				});

			});
		});
	});

});



describe('Integration', function() {

	describe('Process integration', function() {


		before(function() {
			this.entityRepo = new app.EntityRepo({});
			this.entityRepo.createSchemas = sinon.spy(this.entityRepo.createSchemas);
			this.engine = new app.Engine({
				entitiesRepository: this.entityRepo
			});
		});
		beforeEach(function() {

			this.processInstance = {
				title: 'Special Task',
				description: 'Students are mandated to complete it',
				steps: []
			};
			this.stepInstance = {
				entityRepo: {},
				stepType: app.constants.STEPTYPE.CLIENT,
				processors: [{
					code: "console.log(\'\tRunning Task in sand-box,processed the special task\'); callback(null);",
					title: 'Process special task',

				}, {
					code: "console.log(\'\tEmailed result of special task\'); callback(null,{});",
					title: 'Email result',
				}],
				form: {
					elements: [{
						elementType: 'INPUT',
						label: 'Please Enter First Name',
						name: 'firstName',
						args: {
							disabled: true
						},
						asyncValidators: [{
							title: 'must be ibo',
							code: 'console.log(\'kedu\'); callback(null,true)'
						}],
						//save: this.elementSaveService,
						description: 'This input is used to collect students first name',
						validators: []
					}]
				}
			};
		});
		afterEach(function(done) {
			var tasks = [];
			Object.keys(app.systemEntities).forEach(function(e) {
				e = app.systemEntities[e];
				var name = e != app.systemEntities.process ? (e.toLowerCase() + 's') : e.toLowerCase() + 'es';
				//console.log('deleting collection ..' + name);
				var collection = mongoose.connection.db.collection(name);
				tasks.push(collection.deleteMany.bind(collection, {}));
			});
			async.waterfall(tasks, function(er) {
				assert.isNull(er);
				done();
			});
		});
		after(function(done) {

			var tasks = [],
				self = this;
			Object.keys(app.systemEntities).forEach(function(key) {
				tasks.push(clearCollection.bind(self, app.systemEntities[key]));
			});
			async.parallel(tasks, done);
			deleteFile('./src/entities/{0}.json'.replace('{0}', 'User'));
		});

		it('a process must be uniquely identifiable system-wide (must have a retrievable id)', function(done) {
			var fixture = this,
				rProc;
			fixture.engine.init(function(er) {
				assert.isUndefined(er);
				assert.equal(fixture.entityRepo.createSchemas.callCount > 0, true);
				async.waterfall([
					function(callback) {
						fixture.engine.saveStep(fixture.stepInstance, callback);
					},
					function(step, callback) {

						fixture.processInstance.steps.push(step._id);
						fixture.engine.saveProcess(fixture.processInstance, callback);
					},
					function(proc, callback) {
						assert.isNotNull(proc);
						rProc = proc;
						fixture.engine.queryProcess({
							_id: proc._id
						}, callback);
					}
				], function(er, result) {

					assert.isNull(er);
					assert.isDefined(result);
					assert.equal(result.length, 1);
					assert.deepEqual(result[0]._id, rProc._id);
					done();
				});
			});

		});

		it('a process can describe itself', function(done) {
			var fixture = this;
			fixture.processInstance.steps.push(fixture.stepInstance);
			fixture.engine.saveProcess(fixture.processInstance, {
				retrieve: true
			}, function(er, proc) {
				assert.isNull(er);
				assert.isTrue(proc instanceof app.Process);
				proc.describe(function(er, x) {
					assert.equal(x.title, fixture.processInstance.title);
					assert.equal(x.description, fixture.processInstance.description);
					assert.equal(x.steps.length, 1);
					assert.isDefined(x.steps[0].processors);
					assert.equal(x.steps[0].processors.length, 2);
					assert.isDefined(x.steps[0].form);
					assert.isDefined(x.steps[0].form.elements);
					assert.equal(x.steps[0].form.elements.length, 1);
					assert.equal(x.steps[0].form.elements[0].name, fixture.stepInstance.form.elements[0].name);
					done();
				});

			});
		});

		it('a process can run its processors', function(done) {
			var fixture = this,
				runningProcess;

			fixture.processInstance.steps.push(fixture.stepInstance);
			var diffStep = _.cloneDeep(fixture.stepInstance);
			diffStep.processors[0].code = 'console.log(\'\tExecuted first processor in second step\'); callback(null);';
			diffStep.processors[1].code = 'console.log(\'\tExecuted second processor in second step\'); callback(null,{message:\'wonderful\'});';
			fixture.processInstance.steps.push(diffStep);
			async.waterfall([
				fixture.engine.saveProcess.bind(fixture.engine, fixture.processInstance, {
					retrieve: true
				}),
				function(proc, callback) {
					assert.isTrue(proc instanceof app.Process);
					runningProcess = proc;
					proc.run({}, callback);
				},
				function(result, callback) {
					assert.isDefined(result);
					assert.equal(result.status, app.constants.PROCESSSTATUS.RUNNING);
					runningProcess.run(result, callback);
				}
			], function(er, result) {
				assert.isNull(er);
				assert.isDefined(result);
				assert.equal(result.status, app.constants.PROCESSSTATUS.COMPLETED);
				assert.deepEqual(result.message, {
					message: 'wonderful'
				});
				done();
			});
		});

		it('can retrieve 1000 processes in less than 2 secs', function(done) {
			var fixture = this,
				copies = [];
			this.timeout(4000);
			fixture.processInstance.steps.push(fixture.stepInstance);
			for (var i = 0; i < 1000; i++) {
				copies.push(fixture.engine.saveProcess.bind(fixture.engine, _.cloneDeep(fixture.processInstance)));
			}
			async.waterfall([
				fixture.engine.init.bind(fixture.engine),
				async.parallel.bind(async, copies)
			], function(er, result) {
				assert.isNull(er);
				var start = new Date().getTime(),
					end;
				fixture.engine.query(app.systemEntities.process, {}, {
					full: true
				}, function(er, processes) {
					end = new Date().getTime();
					assert.isNull(er);
					assert.isTrue((end - start) <= 2000);
					done();
				});
			});

		});

		it('can edit an exiting process/step/asyncValidator/processor/element', function(done) {
			var fixture = this,
				title = 'New title',
				elementName = 'NewName',
				code = 'console.log(\'Changed the processor\'); callback(null,{});';

			fixture.processInstance.steps.push(fixture.stepInstance);
			async.waterfall([
				fixture.engine.init.bind(fixture.engine),
				fixture.engine.saveProcess.bind(fixture.engine, fixture.processInstance, {
					retrieve: true
				}),
				function(proc, callback) {
					proc.steps[0].processors[0].code = code;
					proc.steps[0].form.elements[0].name = elementName;
					proc.title = title;
					proc.steps[0].form.elements[0].asyncValidators[0].code = code;
					proc.save(callback);
				},
				function(proc, callback) {

					fixture.engine.queryProcess(proc._id, {
						one: true
					}, callback);
				}
			], function(er, proc) {
				assert.equal(proc.title, title);
				assert.equal(proc.steps[0].form.elements[0].name, elementName);
				assert.equal(proc.steps[0].processors[0].code, code);
				assert.equal(proc.steps[0].form.elements[0].asyncValidators[0].code, code);
				assert.isNull(er);
				done();
			});


		});
		it('engine can run standalone processor', function(done) {
			var fixture = this;
			fixture.engine.saveProcessor({
				title: 'Test Sample',
				code: 'console.log(\'\tentityRepo is defined \'+(typeof this.entityRepo.get)); console.log(\'\tran standalone processor!!!!\'); callback(null,{test:true});'
			}, {
				retrieve: true
			}, function(er, proc) {
				fixture.engine.runProcessor(proc, function(er) {
					assert.isNull(er);
					done();
				});
			});
		});
		it('processor can create an entity', function(done) {
			var fixture = this;
			fixture.stepInstance.processors[0].code = 'console.log(\'\tCreating new user...\'); this.entityRepo.create(\'User\',{firstName:\'Chidi\'},function(er,r){if(!er)console.log(\'\tuser created\'); callback(er);});';
			fixture.processInstance.steps.push(fixture.stepInstance);
			async.waterfall([
				fixture.engine.createEntityConfiguration.bind(fixture.engine, 'User', {
					firstName: {
						type: 'String',
						required: true
					}
				}),
				fixture.engine.saveProcess.bind(fixture.engine, fixture.processInstance, {
					retrieve: true
				}),
				function(proc, callback) {
					proc.run({}, callback);
				},
				function(result, callback) {
					assert.isNotNull(result);
					fixture.engine.query('User', {
						firstName: 'Chidi'
					}, callback);
				}
			], function(er, result) {
				assert.isNull(er);
				assert.isNotNull(result);
				assert.equal(result[0].firstName, 'Chidi');
				done();
			});
		});
	});

});