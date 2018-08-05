const FurmlyElement = require("../element"),
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
	}
}

module.exports = Input;
