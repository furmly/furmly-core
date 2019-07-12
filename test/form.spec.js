describe("Form spec", function() {
  beforeEach(function() {
    this.elements = [
      {
        name: "firstName",
        label: "First Name",
        type: "Text",
        args: {},
        description: "User's First Name",
        asyncValidators: [],
        validators: [],
        describe: function(fn) {
          fn(null, this);
        }
      }
    ];
  });

  it("must contain atleast one element", function(done) {
    this.elements.length = 0;
    assert.throws(
      function() {
        new app.Form({
          elements: this.elements
        });
      },
      Error,
      "Form does not contain any elements"
    );
    done();
  });

  it("can describe elements and properties", function(done) {
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
