const DynamoElement = require("../element"),
	misc = require("../element-utils"),
	_ = require("lodash"),
	async = require("async"),
	_warn = misc.warn(require("debug")("element:selectset"));
elementInvariants = misc.elementInvariants;

class Selectset extends DynamoElement {
	constructor(opts, factory) {
		super(opts);
		//add invariants here.
		this.invariants();
		if (this.args.items) {
			this.args.items.forEach(x => {
				misc.convert(factory, x, "elements");
			});
		}
		this.dynamicFields.push("args.items.displayLabel");
	}
	describe(fn) {
		super.describe((er, description) => {
			if (er) return fn(er);
			let tasks = [];

			if (this.args.items && this.args.items.length) {
				description.args.items.forEach(x => {
					tasks.push(misc.describeAll.bind(null, x, "elements"));
				});
			}
			if (tasks.length)
				return async.parallel(tasks, er => {
					if (er) return fn(er);
					return fn(null, description);
				});

			return fn(null, description);
		});
	}
	describeSync() {

		let element = super.describeSync(),
			args = _.clone(element.args);
		if (args.items && args.items.length) {
			args.items.forEach((x, index) => {
				misc.describeAllSync(x, "elements");
			});
		}
		element.args = args;
		return element;
	}
	invariants() {
		//checkout everything is fine
		elementInvariants._ensureArgs(this);
		if (
			!this.args.processor &&
			(!this.args.items || !this.args.items.length)
		)
			_warn(
				"All selectsets/option groups must either have a processor or atleast one element in its items.PLEASE NOTE: This will result in exception in production"
			);

		if (this.args.items)
			for (var i = this.args.items.length - 1; i >= 0; i--) {
				let curr = this.args.items[i];
				if (typeof curr.id === "undefined")
					throw new Error(
						"All selectset options must have a valid id"
					);
			}
	}
}

module.exports = Selectset;
