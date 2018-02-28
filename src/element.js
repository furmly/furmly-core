const misc = require("./misc"),
	_ = require("lodash"),
	async=require('async'),
	uuid = require("uuid");

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

	if (!opts.save) throw new Error("element must have persistence service");

	this._id = opts._id;
	this._save = opts.save;
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
}
/**
	 * Creates a description of an element  a client can consume
	 * @param  {Function} fn callback
	 * @return {Object}      object representing the element.
	 */
DynamoElement.prototype.describe = function(fn) {
	fn(null, {
		name: this.name,
		label: this.label,
		elementType: this.elementType,
		args: this.args,
		description: this.description,
		validators: this.validators,
		uid: this.uid,
		order: this.order,
		component_uid: this.component_uid,
		asyncValidators: _.map(this.asyncValidators, "_id")
	});
};
DynamoElement.prototype.updateArgsComponentUID = function() {
	if (this.args) {
		misc.runThroughObj(
			[
				(key, data) => {
					if (key == "elementType" && !data.component_uid) {
						debugger;
						data.component_uid = uuid();
					}
				}
			],
			this.args
		);
	}
};
/**
	 * uses save service to save/update any async validators.
	 * @param  {Function} fn callback
	 * @return {Object}      saved object.
	 */
DynamoElement.prototype.save = function(fn) {
	var self = this;

	this.updateArgsComponentUID();

	async.parallel(
		_.map(this.asyncValidators, function(x) {
			return x.save.bind(x);
		}),
		function(er, asyncValidators) {
			if (er) return fn(er);

			fn(null, {
				_id: self._id,
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
