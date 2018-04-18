const DynamoElement = require("../element"),
	misc = require("../element-utils"),
	_ = require("lodash"),
	async = require("async"),
	elementInvariants = misc.elementInvariants;

class Section extends DynamoElement {
	constructor(opts, factory) {
		super(opts);
		//add invariants here.
		this.invariants();
		misc.convert(factory, this.args, "elements");
	}

	describeSync() {
		let element = super.describeSync(),
			args = _.cloneDeep(element.args);
		misc.describeAllSync(args, "elements");
		element.args = args;
		return element;
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
	}
}

module.exports = Section;
