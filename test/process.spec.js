describe("Process spec", function() {
    beforeEach(function() {
      var self = this;
      this.processes = {};
      this.opts = {
        save: function(fn) {
          fn(null);
        },
        _id: "{id}",
        title: "{title}",
        description: "{description}",
        steps: [
          {
            _id: "{step id}"
          }
        ]
      };
    });
  
    it("can be several steps in a process but there must be atleast one step.", function(done) {
      this.opts.steps.length = 0;
      var fixture = this;
      assert.throws(
        function() {
          new app.Process(fixture.opts);
        },
        Error,
        "Process must contain atleast one step"
      );
      done();
    });
  
    it("Processess are created with a unique id,title,description and steps", function(done) {
      var processObj = new app.Process(this.opts),
        fixture = this;
      assert.isNotNull(processObj);
      assert.equal(processObj._id, this.opts._id);
      assert.equal(processObj.title, this.opts.title);
      assert.equal(processObj.description, this.opts.description);
      assert.deepEqual(processObj.steps, this.opts.steps);
  
      assert.throws(
        function() {
          delete fixture.opts.title;
          var p = new app.Process(fixture.opts);
        },
        Error,
        "Process must have a title"
      );
      done();
    });
  
    it("process with more than one step requires a store", function(done) {
      var fixture = this;
      this.opts.steps.push({});
      assert.throws(function() {
        new app.Process(fixture.opts);
      }, "Process with more than one step requires a store");
      done();
    });
  
    it("can describe its required steps", function(done) {
      const step1 = {
        _id: "wonderful step",
        describe: sinon.spy(function(fn) {
          fn(null, step1);
        })
      };
      const step2 = {
        _id: "awesome step",
        describe: sinon.spy(function(fn) {
          fn(null, step2);
        })
      };
      const fixture = this;
      this.opts.steps = [step1, step2];
  
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