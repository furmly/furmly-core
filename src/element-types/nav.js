const FurmlyElement = require("../element"),
	elementInvariants = require("../element-utils").elementInvariants,
	_constants = require("../constants");

class Nav extends FurmlyElement {
	constructor(opts) {
		super(opts);
		//add invariants here.
		this.invariants();
		this.dynamicFields.push("args.text");
	}
	invariants() {
		//checkout everything is fine
		elementInvariants._ensureArgs(this);
		if (!this.args.type)
			throw new Error(
				"All navigation elements require a type i.e" +
					_constants.NAVIGATIONTYPE.toString()
			);
		if (!_constants.NAVIGATIONTYPE.in(this.args.type))
			throw new Error(
				"Invalid navigation element type i.e " +
					_constants.NAVIGATIONTYPE.toString()
			);
	}
}

module.exports = Nav;
