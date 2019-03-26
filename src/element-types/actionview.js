const FurmlyElement = require("../element"),
  {
    describeAllSync,
    describeAll,
    convert,
    warn,
    elementInvariants
  } = require("../element-utils"),
  async = require("async"),
  _warn = warn(require("debug")("element:actionview")),
  _ = require("lodash");

class ActionView extends FurmlyElement {
  constructor(opts, factory) {
    super(opts);
    //add actionview invariants here.
    this.invariants();
    convert(factory, this.args, "elements");
  }
  describe(fn) {
    async.waterfall(
      [
        super.describe.bind(this),
        (description, cb) => {
          describeAll(description.args, "elements", er => {
            if (er) return cb(er);
            return cb(null, description);
          });
        }
      ],
      (er, description) => {
        if (er) return fn(er);
        return fn(null, description);
      }
    );
  }
  describeSync() {
    let element = super.describeSync(),
      args = element.args;
    describeAllSync(args, "elements");
    return element;
  }
  invariants() {
    //checkout everything is fine
    elementInvariants._ensureArgs(this);
    if (!this.args.elements || !this.args.elements.length)
      throw new Error("All action views must contain atleast one element");

    if (!this.args.commandText) _warn("commandText is blank");
    if (this.args.commandText && typeof this.args.commandText !== "string")
      throw new Error("commandText of actionview must be a string");
  }
}

module.exports = ActionView;
