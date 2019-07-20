describe("Tern Server", function() {
  before(function() {
    this.entityRepo = new app.EntityRepo({
      config
    });
    this.engine = new app.Engine({
      entitiesRepository: this.entityRepo,
      ternServers: {
        [app.TernServer.PROCESSOR]: new app.TernServer(
          this.entityRepo,
          app.TernServer.PROCESSOR
        )
      }
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

  it("can do lib auto completion", function(done) {
    this.engine.requestForTern(
      app.TernServer.PROCESSOR,
      {
        query: {
          type: "completions",
          file: "myfile.js",
          end: 5
        },
        files: [
          {
            type: "full",
            name: "myfile.js",
            text: "libs."
          }
        ]
      },
      (er, completions) => {
        assert.isNull(er);
        assert.isNotNull(completions);
        this.engine.count(app.constants.systemEntities.lib, {}, (er, count) => {
          assert.isNull(er);
          assert.isTrue(count === completions.completions.length);
          done();
        });
      }
    );
  });
});
