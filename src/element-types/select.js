const FurmlyElement = require("../element"),
  elementInvariants = require("../element-utils").elementInvariants,
  _constants = require("../constants");

class Select extends FurmlyElement {
  constructor(opts) {
    super(opts);
    //add invariants here.
    this.invariants();
  }
  describe(fn) {
    super.describe((er, description) => {
      if (er) return fn(er);

      if (
        this.args.type === _constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR &&
        this.args.config.value
      ) {
		  debugger;
        this.runProcessor(
          this.args.config.value,
          (this.args.config &&
            this.args.config.customArgs &&
            JSON.parse(this.args.config.customArgs)) ||
            {},
          (er, result) => {
            if (er) return fn(er);
            description.args.items = result;
            fn(null, description);
          }
        );
        return;
      }

      return fn(null, description);
    });
  }
  invariants() {
    //checkout everything is fine
    elementInvariants._ensureArgs(this);
    if (!_constants.ELEMENT_SELECT_SOURCETYPE.in(this.args.type)) {
      throw new Error(
        "all select elements must have a valid type i.e " +
          _constants.ELEMENT_SELECT_SOURCETYPE.toString()
      );
    }
    if (
      this.args.type === _constants.ELEMENT_SELECT_SOURCETYPE &&
      !this.args.config
    )
      throw new Error(
        "all select elements must have a processor if they are in processor mode"
      );

    if (
      this.args.config &&
      this.args.config.customArgs &&
      typeof this.args.config.customArgs !== "string"
    )
      throw new Error("Illegal Processor Arguments");

    if (
      this.args.config &&
      this.args.config.customArgs &&
      typeof this.args.config.customArgs == "string"
    ) {
      elementInvariants._ensureValidJSONString(this.args.config.customArgs);
    }
  }
}

module.exports = Select;
