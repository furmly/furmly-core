const DynamoElement = require("../element"),
	_constants = require("../constants"),
	misc = require("../element-utils"),
	elementInvariants = misc.elementInvariants;
class Command extends DynamoElement {
	constructor(opts) {
		super(opts);
		//add invariants here.
		this.invariants();
		this.dynamicFields.push("args.commandText");
		this.dynamicFields.push("args.commandIcon");
		this.dynamicFields.push("args.commandProcessorArgs");
	}
	isDefault() {
		return (
			!this.args.commandType ||
			this.args.commandType == _constants.COMMANDTYPE.DEFAULT
		);
	}
	invariants() {
		//checkout everything is fine
		elementInvariants._ensureArgs(this);

		if (this.isDefault() && !this.args.commandProcessor)
			throw new Error("All default command elements require a processor");

		if (this.isDefault() && this.args.commandProcessorArgs) {
			elementInvariants._ensureValidJSONString(
				this.args.commandProcessorArgs
			);
		}

		if (
			this.args.commandType &&
			!_constants.COMMANDTYPE.in(this.args.commandType)
		)
			throw new Error(
				"Invalid command type i.e " + _constants.COMMANDTYPE.toString()
			);
	}
}

module.exports = Command;
