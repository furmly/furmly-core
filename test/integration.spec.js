/*jshint esversion:6 */

describe("Integration tests", function() {
  describe("to confirm moving parts work together", function() {
    let flag = false,
      procCreated;
    before(function() {
      this.entityRepo = new app.EntityRepo({ config });
      this.entityRepo.createSchemas = sinon.spy(this.entityRepo.createSchemas);
      this.engine = new app.Engine({
        entitiesRepository: this.entityRepo
      });
      this.engine.on("default-process-created", function(proc) {
        flag = true;
        procCreated = proc;
      });
    });
    beforeEach(function(done) {
      this.timeout(200000);
      _debug("before each hook running");
      this.processInstance = {
        title: "Special Task",
        description: "Students are mandated to complete it",
        steps: []
      };
      this.stepInstance = {
        entityRepo: {},
        stepType: app.constants.STEPTYPE.CLIENT,
        processors: [
          {
            code:
              "this.debug('\tRunning Task in sand-box,processed the special task'); callback(null);",
            title: "Process special task"
          },
          {
            code:
              "this.debug('\tEmailed result of special task'); callback(null,{});",
            title: "Email result"
          }
        ],
        form: {
          elements: [
            {
              elementType: "INPUT",
              label: "Please Enter First Name",
              name: "firstName",
              args: {
                disabled: true
              },
              asyncValidators: [
                {
                  title: "must be ibo",
                  code: "this.debug('kedu'); callback(null,true)"
                }
              ],
              description: "This input is used to collect students first name",
              validators: []
            }
          ]
        }
      };
      wipeMongoSchemas(() => {
        this.engine.init(done);
      });
    });
    afterEach(function(done) {
      this.timeout(20000);
      var tasks = [];
      Object.keys(app.systemEntities).forEach(function(e) {
        e = app.systemEntities[e];
        var name =
          e != app.systemEntities.process
            ? e.toLowerCase() + "s"
            : e.toLowerCase() + "es";

        var collection = mongoose.connection.db.collection(name);
        tasks.push(collection.deleteMany.bind(collection, {}));
      });
      _async.waterfall(tasks, function(er) {
        _debug(er);
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
      _async.parallel(tasks, done);
      deleteFile("./src/entities/{0}.json".replace("{0}", "User"));
    });

    it("a process must be uniquely identifiable system-wide (must have a retrievable id)", function(done) {
      var fixture = this,
        rProc;
      assert.equal(fixture.entityRepo.createSchemas.callCount > 0, true);
      _async.waterfall(
        [
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
            fixture.engine.queryProcess(
              {
                _id: proc._id
              },
              callback
            );
          }
        ],
        function(er, result) {
          assert.isNull(er);
          assert.isDefined(result);
          assert.equal(result.length, 1);
          assert.deepEqual(result[0]._id, rProc._id);
          done();
        }
      );
    });

    it("a process can describe itself", function(done) {
      var fixture = this;
      fixture.processInstance.steps.push(fixture.stepInstance);
      _debug(fixture.processInstance);
      fixture.engine.saveProcess(
        fixture.processInstance,
        {
          retrieve: true
        },
        function(er, proc) {
          assert.isNull(er);
          assert.isTrue(proc instanceof app.Process);
          proc.describe(function(er, x) {
            assert.isNotObject(er);
            assert.equal(x.title, fixture.processInstance.title);
            assert.equal(x.description, fixture.processInstance.description);
            assert.equal(x.steps.length, 1);
            assert.isDefined(x.steps[0].form);
            assert.isDefined(x.steps[0].form.elements);
            assert.equal(x.steps[0].form.elements.length, 1);
            assert.equal(
              x.steps[0].form.elements[0].name,
              fixture.stepInstance.form.elements[0].name
            );
            done();
          });
        }
      );
    });

    it("a process can run its processors", function(done) {
      var fixture = this,
        runningProcess;
      this.timeout(10000);
      fixture.processInstance.steps.push(fixture.stepInstance);
      var diffStep = _.cloneDeep(fixture.stepInstance);
      diffStep.processors[0].code =
        "this.debug('\tExecuted first processor in second step'); callback(null);";
      diffStep.processors[1].code =
        "this.debug('\tExecuted second processor in second step'); callback(null,{message:'wonderful'});";
      fixture.processInstance.steps.push(diffStep);
      _async.waterfall(
        [
          fixture.engine.saveProcess.bind(
            fixture.engine,
            fixture.processInstance,
            {
              retrieve: true
            }
          ),
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
        ],
        function(er, result) {
          _debug(er);
          assert.isNull(er);
          assert.isDefined(result);
          assert.equal(result.status, app.constants.PROCESSSTATUS.COMPLETED);
          assert.deepEqual(result.message, {
            message: "wonderful"
          });
          done();
        }
      );
    });

    it("can edit an exiting process/step/asyncValidator/processor/element", function(done) {
      var fixture = this,
        title = "New title",
        elementName = "NewName",
        code = "this.debug('Changed the processor'); callback(null,{});";

      fixture.processInstance.steps.push(fixture.stepInstance);
      _async.waterfall(
        [
          fixture.engine.saveProcess.bind(
            fixture.engine,
            fixture.processInstance,
            {
              retrieve: true
            }
          ),
          function(proc, callback) {
            proc.steps[0].processors[0].code = code;
            proc.steps[0].form.elements[0].name = elementName;
            proc.title = title;
            proc.steps[0].form.elements[0].asyncValidators[0].code = code;
            proc.save(callback);
          },
          function(proc, callback) {
            fixture.engine.queryProcess(
              proc._id,
              {
                one: true
              },
              callback
            );
          }
        ],
        function(er, proc) {
          assert.equal(proc.title, title);
          assert.equal(proc.steps[0].form.elements[0].name, elementName);
          assert.equal(proc.steps[0].processors[0].code, code);
          assert.equal(
            proc.steps[0].form.elements[0].asyncValidators[0].code,
            code
          );
          assert.isNull(er);
          done();
        }
      );
    });

    it("process can call fetchProcessor", function(done) {
      var fixture = this,
        d = '{"indomie":"Hungry man size"}';
      fixture.processInstance.steps.push(fixture.stepInstance);
      fixture.processInstance.fetchProcessor = {
        title: "Fetch Noodles",
        code:
          'this.debug("\tfetching noodles "+this.args.message); callback(null,' +
          d +
          ");"
      };
      fixture.engine.saveProcess(
        fixture.processInstance,
        {
          retrieve: true
        },
        function(er, proc) {
          assert.isObject(proc);
          assert.isNull(er);
          proc.describe(
            {
              message: "shap shap"
            },
            function(er, description, data) {
              _debug(er);
              assert.isNull(er);
              assert.isNotNull(description);
              assert.deepEqual(data, JSON.parse(d));
              done();
            }
          );
        }
      );
    });

    it("engine can run standalone processor", function(done) {
      var fixture = this;
      fixture.engine.saveProcessor(
        {
          title: "Test Sample",
          code:
            " this.debug('\tentityRepo is defined '+(typeof this.entityRepo.get)); this.debug('\tran standalone processor!!!!'); callback(null,{test:true});"
        },
        {
          retrieve: true
        },
        function(er, proc) {
          fixture.engine.runProcessor({}, proc, function(er) {
            assert.isNull(er);
            done();
          });
        }
      );
    });

    it("processors can run optimizations on code", function(done) {
      this.timeout(8000);
      let repo = new app.EntityRepo({
        config: Object.assign({}, config, {
          codeGenerator: {
            defaultOptimizations: [
              "Try-catch-all-async-functions",
              "Count-all-lib-references"
            ]
          }
        })
      });
      let engine = new app.Engine({ entitiesRepository: repo });
      engine.init(function(er) {
        assert.isUndefined(er);

        engine.saveProcessor(
          {
            code:
              "const doSomething = (fn) =>{ console.log('nothing is happening here'); fn(null,'does nothing'); }; doSomething(callback);",
            title: "fake processor"
          },
          {
            retrieve: true
          },
          (er, processor) => {
            assert.isNull(er);
            assert.isNotNull(processor._code);
            assert.isTrue(/try/.test(processor._code));
            done();
          }
        );
      });
    });

    it("processor sandbox context loads libs", function(done) {
      var fixture = this;
      fixture.engine.saveLib(
        {
          code: "exports=function(x){return x * x;}",
          uid: "multiply"
        },
        function(er) {
          assert.isNull(er);
          fixture.engine.saveProcessor(
            {
              title: "Test Sample",
              code: "callback(null,this.libs.multiply(2));"
            },
            {
              retrieve: true
            },
            function(er, proc) {
              _debug(proc);
              fixture.engine.runProcessor({}, proc, function(er, ans) {
                assert.isNull(er);
                assert.equal(ans, 4);
                done();
              });
            }
          );
        }
      );
    });

    it("processors can load libs dynamically", function(done) {
      var fixture = this;

      _async.forEachOf(
        [
          {
            code:
              "exports=function(x,y){ var result=0; for(var i=0;i<y;i++) result=this.libs.add(x,result);  return result;}",
            uid: "multiply"
          },
          { code: "exports=function(x,y){return x+y }", uid: "add" }
        ],
        fixture.engine.saveLib.bind(fixture.engine),
        er => {
          assert.isNull(er);
          fixture.engine.saveProcessor(
            {
              title: "Test Sample",
              code:
                "(" +
                function() {
                  this.libs.loadLib.call(this, "multiply", er => {
                    if (er) return callback(er);
                    return callback(null, this.libs.multiply.call(this, 3, 2));
                  });
                } +
                ").call(this)"
            },
            {
              retrieve: true
            },
            function(er, proc) {
              _debug(proc);
              fixture.engine.runProcessor({}, proc, function(er, ans) {
                assert.isNull(er);
                assert.equal(ans, 6);
                done();
              });
            }
          );
        }
      );
    });

    it("init fires default-process event", function(done) {
      assert.isTrue(flag);
      assert.isObject(procCreated);
      done();
    });

    it("process can be saved and retrieved", function(done) {
      var fixture = this;
      fixture.engine.saveProcess(
        JSON.parse(fs.readFileSync("./test/fixtures/test.json")),
        {
          retrieve: true
        },
        function(er, proc) {
          assert.isNull(er);
          assert.isObject(proc);
          done();
        }
      );
    });
    it("cannot run a view step", function(done) {
      var fixture = this;
      fixture.stepInstance.processors.length = 0;
      fixture.stepInstance.mode = app.constants.STEPMODE.VIEW;
      fixture.processInstance.steps.push(fixture.stepInstance);
      fixture.engine.saveProcess(
        fixture.processInstance,
        {
          retrieve: true
        },
        function(er, proc) {
          assert.isNull(er);
          proc.run({}, function(er) {
            assert.isNotNull(er);
            done();
          });
        }
      );
    });

    it("can auto generate process for managing an entity while generating schema", function(done) {
      this.timeout(4000);
      var fixture = this,
        id = "fake_id",
        server = {
          defaultRole: "admin",
          saveClaim: sinon.spy(function() {
            var args = Array.prototype.slice.call(arguments);

            args[0]._id = id;
            args[args.length - 1](null, args[0]);
          }),
          addClaimToRole: sinon.spy(function() {
            var args = Array.prototype.slice.call(arguments);
            assert.equal(args[2]._id, id);
            args[args.length - 1](null);
          }),
          saveMenu: sinon.spy(function() {
            var args = Array.prototype.slice.call(arguments);
            assert.equal(args[0].claims[0], id);
            args[args.length - 1](null);
          }),
          webClient: {
            clientId: "ThefakeOne"
          },
          constants: {
            CLAIMS: {
              PROCESS: "http://test.com",
              PROCESSOR: "http://test.com"
            }
          }
        },
        testFixture = {
          name: {
            type: "String"
          },
          age: {
            type: "Number"
          },
          phoneNumbers: [
            {
              tel: {
                type: "Number"
              }
            }
          ],
          something: {
            name: {
              type: "String"
            },
            numberThing: {
              type: "Number"
            },
            listThing: [
              {
                name: {
                  type: "String"
                }
              }
            ]
          },
          booleanThing: {
            type: "Boolean"
          },
          link: {
            type: "ObjectId",
            ref: "Something"
          }
        };
      fixture.engine.extendProcessorContext({
        infrastructure: { server }
      });

      fixture.engine.saveProcessor(
        {
          title: "testProc",
          uid: "testProc",
          code: `this.libs.createCRUDProcess.call(this,
						this.args.name,
						this.args.displayProperty,
						this.args.group,
						this.args.category,${JSON.stringify(testFixture)}, callback);`
        },
        {
          retrieve: true
        },
        function(er, proc) {
          assert.isNull(er);
          _debug("crud calling proc");
          _debug(proc);

          fixture.engine.createEntityConfiguration(
            "Something",
            testFixture,
            er => {
              assert.isNull(er);
              fixture.engine.runProcessor(
                {
                  name: "Customer",
                  displayProperty: "name",
                  group: "Customer Management",
                  category: "MAINMENU"
                },
                proc,
                function(er, result) {
                  assert.isNull(er);
                  assert.equal(server.saveClaim.callCount, 4);
                  assert.equal(server.addClaimToRole.callCount, 4);
                  assert.equal(server.saveMenu.callCount, 1);

                  fixture.engine.queryProcess({}, function(er, processes) {
                    processes[processes.length - 1].describe(function(er, res) {
                      assert.equal(
                        res.steps[0].form.elements[0].args.extra.editTemplate
                          .length,
                        8
                      );
                      done();
                    });
                  });
                }
              );
            }
          );
        }
      );
    });

    it("processor can create an entity", function(done) {
      var fixture = this;
      fixture.stepInstance.processors[0].code =
        "this.debug('\tCreating new user...'); this.entityRepo.create('User',{firstName:'Chidi'},(er,r)=>{if(!er)this.debug('\tuser created'); callback(er);});";
      fixture.processInstance.steps.push(fixture.stepInstance);
      _async.waterfall(
        [
          fixture.engine.createEntityConfiguration.bind(
            fixture.engine,
            "User",
            {
              firstName: {
                type: "String",
                required: true
              }
            }
          ),
          fixture.engine.saveProcess.bind(
            fixture.engine,
            fixture.processInstance,
            {
              retrieve: true
            }
          ),
          function(proc, callback) {
            proc.run({}, callback);
          },
          function(result, callback) {
            assert.isNotNull(result);
            fixture.engine.query(
              "User",
              {
                firstName: "Chidi"
              },
              callback
            );
          }
        ],
        function(er, result) {
          assert.isNull(er);
          assert.isNotNull(result);
          assert.equal(result[0].firstName, "Chidi");
          done();
        }
      );
    });

    it("a process can have dynamic values in its form elements", function(done) {
      var fixture = this,
        label = "Something light",
        description = "Yes thats right , something light",
        max = 450,
        error = "you should reconsider";
      fixture.processInstance.steps.push(fixture.stepInstance);
      fixture.stepInstance.form.elements[0].label = "$test_lib|label";
      fixture.stepInstance.form.elements[0].description =
        "$test_lib|description";
      fixture.stepInstance.form.elements[0].validators = [
        {
          validatorType: "REGEX",
          error: "$test_lib|regex_message",
          args: { exp: "\\d+" }
        },
        {
          validatorType: "MAXLENGTH",
          args: { max: "$test_lib|max" }
        }
      ];
      fixture.engine.saveProcess(
        fixture.processInstance,
        {
          retrieve: true
        },
        function(er, proc) {
          assert.isNull(er);
          fixture.engine.saveLib(
            {
              uid: "test_lib",
              code: `exports={label:'${label}',description:'${description}',regex_message:'${error}',max:${max}};`
            },
            er => {
              assert.isNull(er);
              proc.describe(function(er, x) {
                assert.isNull(er);
                assert.equal(x.steps[0].form.elements[0].label, label);
                assert.equal(
                  x.steps[0].form.elements[0].description,
                  description
                );
                _debug(JSON.stringify(x, null, " "));
                done();
              });
            }
          );
        }
      );
    });

    describe("production", function() {
      before(function() {
        this.entityRepo = new app.LocalEntityRepo({
          config: { ...config, init: true }
        });
        this.engine = new app.Engine({
          entitiesRepository: this.entityRepo
        });
      });
      beforeEach(function(done) {
        this.timeout(10000);
        wipeMongoSchemas(() => {
          this.engine.init(er => {
            assert.isUndefined(er);
            done();
          });
        });
      });
      after(function() {
        deleteDir("./src/_processors");
        deleteDir("./src/_libs");
      });

      it("entity repo can run a processor", function(done) {
        this.timeout(100000);
        this.engine.queryProcessor(
          { uid: "LIST_ELEMENT_TYPES" },
          { one: true },
          (er, proc) => {
            assert.isNull(er);
            assert.isNotNull(proc);
            this.engine.runProcessor({}, proc, (er, result) => {
              assert.isNull(er);
              assert.isNotNull(result);
              console.log(result);
              done();
            });
          }
        );
      });

      it("cannot save new processors", function(done) {
        const server = {
          defaultRole: "admin",
          checkPassword: (a, b, c, d, fn) => {
            fn(null, true);
          },
          saveClaim: sinon.spy(function() {
            var args = Array.prototype.slice.call(arguments);

            args[0]._id = id;
            args[args.length - 1](null, args[0]);
          }),
          addClaimToRole: sinon.spy(function() {
            var args = Array.prototype.slice.call(arguments);
            assert.equal(args[2]._id, id);
            args[args.length - 1](null);
          }),
          saveMenu: sinon.spy(function() {
            var args = Array.prototype.slice.call(arguments);
            assert.equal(args[0].claims[0], id);
            args[args.length - 1](null);
          }),
          webClient: {
            clientId: "ThefakeOne"
          },
          constants: {
            CLAIMS: {
              PROCESS: "http://test.com",
              PROCESSOR: "http://test.com"
            }
          }
        };
        this.engine.extendProcessorContext({ infrastructure: { server } });
        this.engine.queryProcessor(
          { uid: "CREATE_PROCESSOR" },
          { one: true },
          (er, proc) => {
            assert.isNull(er);
            assert.isNotNull(proc);
            this.engine.runProcessor(
              {
                entity: {
                  title: "Test Sample",
                  code:
                    " this.debug('\tentityRepo is defined '+(typeof this.entityRepo.get)); this.debug('\tran standalone processor!!!!'); callback(null,{test:true});"
                },
                $password: "password",
                $user: {
                  username: "dev",
                  client: {}
                },
                $authorized: true
              },
              proc,
              (er, result) => {
                assert.isUndefined(result);
                assert.isNotNull(er);
                assert.isTrue(
                  er.message === "Cannot save new processor in production"
                );
                done();
              }
            );
          }
        );
      });
    });
  });
});
