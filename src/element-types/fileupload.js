const DynamoElement = require("../element"),
	misc = require("../element-utils"),
	elementInvariants = misc.elementInvariants;

class Fileupload extends DynamoElement {
	constructor(opts) {
		super(opts);
		//add invariants here.
		this.invariants();
	}
	invariants() {
		//checkout everything is fine
		elementInvariants._ensureArgs(this);
		if (!this.args.fileType)
			throw new Error("All file uploads require a args.fileType");
	}
}

module.exports = Fileupload;
