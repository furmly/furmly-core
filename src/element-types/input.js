const FurmlyElement = require("../element"),
  constants = require("../constants"),
  _warn = require("../element-utils").warn(require("debug")("element:input"));

class Input extends FurmlyElement {
  constructor(opts) {
    super(opts);
    //add invariants here.
    this.invariants();
    this.dynamicFields.push("args.default");
  }
  invariants() {
    //checkout everything is fine
    if (typeof this.args === "undefined") _warn("element has no args");
    if (this.args && this.args.type && !constants.INPUTTYPE.in(this.args.type))
      throw new Error("Invalid input type");
  }
}

module.exports = Input;
