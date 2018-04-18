const DynamoElement = require("../element"),
	misc = require("../element-utils"),
	elementInvariants = misc.elementInvariants;

class ActionView extends DynamoElement {
	constructor(opts, factory) {
		super(opts);
		//add actionview invariants here.
		this.invariants();
		misc.convert(factory, this.args, "elements");
	}
	describe(fn) {
		async.waterfall(
			[
				super.describe.bind(this),
				(description, cb) => {
					misc.describeAll(description.args, "elements", er => {
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
	invariants() {
		//checkout everything is fine
		elementInvariants._ensureArgs(this);
		if (!this.args.elements || !this.args.elements.length)
			throw new Error(
				"All action views must contain atleast one element"
			);

		if (!this.args.commandText) _warn("commandText is blank");
		if (this.args.commandText && typeof this.args.commandText !== "string")
			throw new Error("commandText of actionview must be a string");
	}
}

module.exports = ActionView;
