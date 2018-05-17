const _ = require("lodash"),
	constants = require("./constants"),
	async = require("async"),
	debug = require("debug")("element"),
	uuid = require("uuid");

const ex = /^\$/;

/**
	 * Class representing DynamoElement
	 * @constructor
	 * @memberOf module:Dynamo
	 * @param {Any} opts Constructor options
	 */
function DynamoElement(opts) {
	if (!opts) throw new Error("opts cannot be null");

	if (!opts.name) throw new Error("element name must be valid");

	if (!opts.elementType) throw new Error("element type must be valid");

	if (!constants.ELEMENTTYPE.in(opts.elementType))
		throw new Error("Unknown element type " + opts.elementType);

	//this._id = opts._id;
	this.name = opts.name;
	this.elementType = opts.elementType;
	this.label = opts.label;
	this.description = opts.description;
	this.args = opts.args;
	this.asyncValidators = opts.asyncValidators || [];
	this.validators = opts.validators || [];
	this.uid = opts.uid;
	this.order = opts.order;
	this.component_uid = opts.component_uid || uuid();
	Object.defineProperties(this, {
		getLibValue: {
			enumerable: false,
			value: opts.getLibValue
		},
		dynamicFields: {
			enumerable: false,
			value: [
				"label",
				"description",
				"validators.error",
				"validators.args.exp",
				"validators.args.min",
				"validators.args.max"
			]
		}
	});
}

DynamoElement.prototype.getValue = function(value, fn) {
	if (this.isLibValue(value)) {
		if (!this.getLibValue)
			throw new Error(
				"element must have a means of retrieving library values"
			);
		return this.getLibValue(value, fn);
	}
	return setImmediate(fn, null, value);
};

DynamoElement.prototype.setValue = function(description, path, fn) {
	let curr = description,
		tasks = [],
		list = path.split("."),
		set = (context, path, cb) => {
			this.getValue(context[path], (er, value) => {
				if (er) return cb(er);
				context[path] = value;
				return cb();
			});
		};

	for (var i = 0; i <= list.length - 1; i++) {
		if (Array.prototype.isPrototypeOf(curr)) {
			if (i == list.length - 1) {
				//ive reached the end.
				curr.forEach(x => {
					if (x[list[i]]) tasks.push(set.bind(this, x, list[i]));
				});
			} else
				curr = curr.reduce((sum, x) => {
					if (x[list[i]]) sum.push(x[list[i]]);
					return sum;
				}, []);

			if (!curr.length) break;

			continue;
		}
		if (curr[list[i]]) {
			if (i == list.length - 1)
				//i have reached the end.
				tasks.push(set.bind(this, curr, list[i]));
			else curr = curr[list[i]];
		} else {
			break;
		}
	}
	if (tasks.length)
		return async.parallel(tasks, er => {
			if (er) return fn(er);
			return fn(null, description);
		});

	return fn(null, description);
};
/**
	 * Creates a description of an element  a client can consume
	 * @param  {Function} fn callback
	 * @return {Object}      object representing the element.
	 */
DynamoElement.prototype.describe = function(fn) {
	let element = {
		name: this.name,
		label: this.label,
		elementType: this.elementType,
		args: Object.assign({}, this.args),
		description: this.description,
		validators: this.validators,
		uid: this.uid,
		order: this.order,
		component_uid: this.component_uid,
		asyncValidators: _.map(this.asyncValidators, "_id")
	};

	let tasks = this.dynamicFields.map(x =>
		this.setValue.bind(this, element, x)
	);
	async.parallel(tasks, (er, values) => {
		if (er) return fn(er);
		fn(null, element);
	});
};
/**
 * Sync description of an element. Note no dynamic value resolution is possible with this method.
 * @return {Object} Object representation of element.
 */
DynamoElement.prototype.describeSync = function() {
	let element = {
		name: this.name,
		elementType: this.elementType,
		args: this.args,
		validators: this.validators,
		component_uid: this.component_uid,
		asyncValidators: _.map(this.asyncValidators, "_id")
	};
	//this was clobbering existing processors.
	if (typeof this.label !== "undefined") element.label = this.label;
	if (typeof this.description !== "undefined")
		element.description = this.description;
	if (typeof this.order !== "undefined") element.order = this.order;
	if (typeof this.uid !== "undefined") element.uid = this.uid;
	return element;
};

DynamoElement.prototype.isLibValue = function(value) {
	return ex.test(value);
};

//DynamoElement.prototype.elementInvariants = misc.elementInvariants;

/**
	 * uses save service to save/update any async validators.
	 * @param  {Function} fn callback
	 * @return {Object}      saved object.
	 */
DynamoElement.prototype.save = function(fn) {
	var self = this;

	//this.updateArgsComponentUID();

	async.parallel(
		_.map(this.asyncValidators, function(x) {
			return x.save.bind(x);
		}),
		function(er, asyncValidators) {
			if (er) return fn(er);

			fn(null, {
				//_id: self._id,
				name: self.name,
				label: self.label,
				elementType: self.elementType,
				args: self.args,
				description: self.description,
				validators: self.validators,
				component_uid: self.component_uid,
				uid: self.uid,
				order: self.order,
				asyncValidators: _.map(asyncValidators, "_id")
			});
		}
	);
};

module.exports = DynamoElement;
