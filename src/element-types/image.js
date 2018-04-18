const DynamoElement = require("../element"),
	_constants = require("../constants"),
	misc = require("../element-utils"),
	_warn = misc.warn(require("debug")("element:image")),
	elementInvariants = misc.elementInvariants;

class Image extends DynamoElement {
	constructor(props) {
		super(props);
		this.invariants();
	}
	invariants() {
		elementInvariants._ensureArgs(this);
		if (!this.args.type)
			throw new Error(
				"All Images require a valid type i.e " +
					_constants.IMAGETYPE.toString()
			);
		if (!_constants.IMAGETYPE.in(this.args.type))
			throw new Error(
				"Invalid image type , i.e " + _constants.IMAGETYPE.toString()
			);

		if (!this.args.config || !this.args.config.data)
			throw new Error("All images require config.data");
	}
}

module.exports = Image;
