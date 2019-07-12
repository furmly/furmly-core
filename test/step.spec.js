describe("Step spec", function() {
  beforeEach(function() {
    this.opts = {
      _id: "fake",
      save: function(fn) {
        fn();
      },
      stepType: app.constants.STEPTYPE.CLIENT,
      runInSandbox: function() {},
      form: {
        describe: function() {}
      },
      processors: [
        {
          _id: "fake"
        }
      ],
      postprocessors: []
    };
  });

  it("must have an id and type", function(done) {
    var fixture = this;
    assert.throws(
      function() {
        delete fixture.opts._id;
        var step = new app.Step(fixture.opts);
        step.run();
      },
      Error,
      "opts._id is null or undefined"
    );
    assert.throws(
      function() {
        delete fixture.opts.stepType;
        fixture.opts._id = "fake";
        new app.Step(fixture.opts);
      },
      Error,
      "Step type is null or undefined or not a valid type"
    );
    done();
  });

  it("can have a chain of processors but the chain must have atleast one", function(done) {
    var fixture = this;
    assert.throws(
      function() {
        fixture.opts.processors.length = 0;
        new app.Step(fixture.opts);
      },
      Error,
      "Steps must have atleast one processor"
    );

    done();
  });
  it("can either be offline (not requiring user input) or Online (user input required)", function(done) {
    var fixture = this;
    assert.throws(
      function() {
        fixture.opts.stepType = "faketype";
        new app.Step(fixture.opts);
      },
      Error,
      "Step type is null or undefined or not a valid type"
    );
    done();
  });

  it("online steps require a form", function(done) {
    var fixture = this;
    assert.throws(
      function() {
        delete fixture.opts.form;
        new app.Step(fixture.opts);
      },
      Error,
      "Client Step must have a form"
    );
    done();
  });

  it("can have a chain of postprocessors", function(done) {
    var fixture = this;
    fixture.opts.postprocessors.push({
      _id: "fakepostprocessor"
    });
    var step = new app.Step(fixture.opts);
    assert.deepEqual(step.postprocessors, fixture.opts.postprocessors);
    done();
  });

  it("client step can describe its form ", function(done) {
    var formDescription = {
        form: "this is a form"
      },
      processorDescription = "this is a processor",
      postprocessorDescription = "this is a postprocessors description",
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
      done();
    });
  });
});
