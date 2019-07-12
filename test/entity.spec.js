describe("Entity spec", function() {
  let repo;
  beforeEach(function(done) {
    this.timeout(10000);
    this.modelName = "User";
    this.modelPath = "./src/entities/{0}.json".replace("{0}", this.modelName);
    this.model = {
      firstName: {
        type: "String",
        required: true
      },
      lastName: {
        type: "String"
      },
      age: {
        type: "Number"
      },
      buddy: {
        type: "ObjectId",
        ref: this.modelName
      }
    };
    this.extraModelName = "Colleague";
    this.extraModel = {
      firstName: {
        type: "String"
      },
      colleague: {
        schema: this.modelName
      }
    };
    this.instance = {
      firstName: "Chidi",
      lastName: "Onuekwusi",
      age: 28
    };
    repo = new app.EntityRepo({ config });
    repo.init(done);
  });

  afterEach(function(done) {
    clearCollection(this.modelName, er => {
      if (er) throw er;

      clearCollection(this.extraModelName, er => {
        if (er) return done(er);
        _debug("collection cleared" + this.extraModelName);
        wipeMongoSchemas(done);
      });
      _debug("collection cleared" + this.modelName);
    });
  });

  it("entity configurations can be created", function(done) {
    var fixtures = this,
      spy = sinon.spy(function(er, r) {
        assert.isNull(er);
        assert.isDefined(repo.refs[fixtures.modelName]);
        assert.equal(repo.refs[fixtures.modelName].length, 1);
        done();
      });
    repo.createConfig(this.modelName, this.model, spy);
  });

  it("entity configurations can be retrieved", function(done) {
    var fixtures = this;
    repo.createConfig(this.modelName, this.model, function() {
      repo.getConfig(fixtures.modelName, function(er, model) {
        assert.isNull(er);
        assert.deepEqual(fixtures.model, model);
        done();
      });
    });
  });
  it("can embed schemas", function(done) {
    repo.createConfig(this.modelName, this.model, er => {
      //
      assert.isNull(er);
      _debug("created user schema");
      repo.createConfig(this.extraModelName, this.extraModel, er => {
        assert.isNull(er);
        _debug("created extra model");
        repo.getConfig(this.extraModelName, (er, model) => {
          assert.isNull(er);
          done();
        });
      });
    });
  });

  it("can create entity instances", function(done) {
    var fixture = this;
    repo.createConfig(this.modelName, this.model, function() {
      repo.createEntity(fixture.modelName, fixture.instance, function(er) {
        assert.isNull(er);
        mongoose.model(fixture.modelName).findOne(
          {
            firstName: fixture.instance.firstName
          },
          function(er, found) {
            assert.isNull(er);
            assert.isDefined(found);
            assert.isNotNull(found);
            assert.equal(found.firstName, fixture.instance.firstName);
            done();
          }
        );
      });
    });
  });

  it("can count entity instances", function(done) {
    var fixture = this;
    repo.createConfig(this.modelName, this.model, function() {
      repo.createEntity(fixture.modelName, fixture.instance, function(er) {
        assert.isNull(er);
        repo.countEntity(fixture.modelName, {}, function(er, count) {
          assert.isNull(er);
          assert.equal(count, 1);
          done();
        });
      });
    });
  });

  it("can query existing instances", function(done) {
    var fixture = this;
    repo.createConfig(this.modelName, this.model, function() {
      repo.createEntity(fixture.modelName, fixture.instance, function(
        er,
        chidi
      ) {
        assert.isNull(er);
        repo.createEntity(
          fixture.modelName,
          {
            firstName: "Uche",
            lastName: "My Nigga",
            age: 26,
            buddy: chidi._id
          },
          function(er) {
            assert.isNull(er);
            repo.queryEntity(
              fixture.modelName,
              {
                firstName: "Uche"
              },
              {
                full: true
              },
              function(er, result) {
                assert.isNull(er);
                assert.isNotNull(result);
                assert.equal(result.length, 1);
                assert.isNotNull(result[0].buddy);
                assert.deepEqual(result[0].buddy, chidi.toJSON());
                done();
              }
            );
          }
        );
      });
    });
  });

  it("can modify existing schema", function(done) {
    var fixtures = this;
    //create new config
    repo.createConfig(this.modelName, this.model, function(er) {
      assert.isNull(er);
      fixtures.model.address = {
        type: "String",
        required: true
      };
      //update it

      repo.updateConfig(fixtures.modelName, fixtures.model, function(er) {
        assert.isNull(er);
        //retrieve it
        repo.getConfig(fixtures.modelName, function(er, model) {
          assert.isNull(er);
          assert.deepEqual(fixtures.model, model);
          repo.createEntity(fixtures.modelName, fixtures.instance, function(
            er
          ) {
            assert.isNotNull(er);
            assert.equal(er.name, "ValidationError");
            done();
          });
        });
      });
    });
  });

  it("can modify/save entity instances and schemas", function(done) {
    var fixture = this;
    repo.createConfig(this.modelName, this.model, function() {
      repo.createEntity(fixture.modelName, fixture.instance, function(er) {
        assert.isNull(er);
        repo.queryEntity(
          fixture.modelName,
          {
            firstName: fixture.instance.firstName
          },
          {
            full: true
          },
          function(er, instance) {
            assert.isNotNull(instance);
            assert.isDefined(instance);
            assert.equal(instance.length, 1);
            instance[0].firstName = "Uche";
            var id = instance[0]._id;
            repo.updateEntity(fixture.modelName, instance[0], function(er) {
              assert.isNull(er);

              repo.queryEntity(
                fixture.modelName,
                {
                  firstName: "Uche"
                },
                function(er, insts) {
                  assert.isNull(er);
                  assert.deepEqual(insts[0]._id, id);
                  assert.equal(insts[0].firstName, "Uche");
                  var inst = insts[0];
                  //modify schema
                  fixture.model.address = {
                    type: "String",
                    required: true
                  };
                  repo.updateConfig(fixture.modelName, fixture.model, function(
                    er
                  ) {
                    assert.isNull(er);
                    var address = "No 9 mercy eneli street";
                    inst.address = address;

                    repo.updateEntity(fixture.modelName, inst, function(er) {
                      assert.isNull(er);
                      repo.queryEntity(
                        fixture.modelName,
                        {
                          _id: inst._id
                        },
                        function(er, lastChecks) {
                          assert.isNull(er);
                          assert.equal(lastChecks[0].address, address);
                          repo.createEntity(
                            fixture.modelName,
                            {
                              firstName: "Dongo",
                              age: 99,
                              address: "Surulere"
                            },
                            function(er) {
                              assert.isNull(er);
                              repo.queryEntity(
                                fixture.modelName,
                                {
                                  firstName: "Dongo"
                                },
                                function(er, dongoClan) {
                                  assert.isNull(er);
                                  assert.equal(
                                    dongoClan[0].address,
                                    "Surulere"
                                  );
                                  repo.queryEntity(
                                    fixture.modelName,
                                    {},
                                    function(er, items) {
                                      assert.equal(items.length, 2);
                                      done();
                                    }
                                  );
                                }
                              );
                            }
                          );
                        }
                      );
                    });
                  });
                }
              );
            });
          }
        );
      });
    });
  });
});
