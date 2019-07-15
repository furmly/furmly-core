describe("Processor spec", function() {
  var Sandbox = require("sandboxed-module");
  beforeEach(function() {
    var fixtures = this;
    var save = function(fn) {
      fn();
    };
    this.message1 = "fake ran!!!";
    this.message2 = "faker also ran!!!";
    this.locals = {
      context: {
        debug: _debug,
        async: require("async"),
        task: {
          processors: [
            new app.Processor({
              _id: "fake",
              title: "Returns a message",
              save: save,
              code: "callback(null,'{0}')".replace("{0}", fixtures.message1)
            }),
            new app.Processor({
              _id: "faker",
              title: "Returns a message",
              save: save,
              code: "callback(null,'{0} ' + result);".replace(
                "{0}",
                fixtures.message2
              )
            })
          ]
        }
      }
    };
  });
  it("processors are uniquely identifiable and contain code to run", function(done) {
    assert.throws(
      function() {
        new app.Processor({
          _id: "fake",
          code: "this.debug('great!!')"
        });
      },
      Error,
      "Processor must have a title"
    );
    assert.throws(
      function() {
        new app.Processor({
          _id: "fake",
          code: "this.debug('great!!')",
          title: "Creates a new User"
        });
      },
      Error,
      "Processor needs save service for persistence"
    );
    assert.throws(
      function() {
        new app.Processor({
          _id: "fake",
          title: "Creates a new User"
        });
      },
      Error,
      "Processor must include code to run"
    );
    done();
  });

  it("can timeout processor after configured period", function() {
    this.locals.context.task.processors[0].code = " 'did nothing'; ";
    this.locals.context.task.returnResult = function(er, result) {
      assert.isUndefined(result);
      assert.isNotNull(er);
      assert.equal(er.code, "ETIMEDOUT");
    };
    Sandbox.require("../src/sandbox-queue", {
      locals: this.locals
    });
  });

  it("can skip a processor", function(done) {
    const fixtures = this;
    this.locals.context.task.processors[0].code =
      "this.skip['faker']=true; " + this.locals.context.task.processors[0].code;
    this.locals.context.task.returnResult = function(er, result) {
      assert.isDefined(result);
      assert.isNotNull(result);
      assert.isNull(er);
      assert.equal(result.indexOf(fixtures.message1) !== -1, true);
      assert.equal(result.indexOf(fixtures.message2) == -1, true);
      done();
    };
    Sandbox.require("../src/sandbox-queue", {
      locals: this.locals
    });
  });

  it("can run multple processors", function(done) {
    const fixtures = this;
    this.locals.context.task.returnResult = function(er, result) {
      assert.isDefined(result);
      assert.isNotNull(result);
      assert.isNull(er);
      assert.equal(result.indexOf(fixtures.message1) !== -1, true);
      assert.equal(result.indexOf(fixtures.message2) !== -1, true);
      done();
    };
    Sandbox.require("../src/sandbox-queue", {
      locals: this.locals
    });
  });
});
