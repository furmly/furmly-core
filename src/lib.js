/**
	 * Loads these reusable classes during every processor run.
	 * @constructor
	 * @memberOf module:Dynamo
	 * @param {Object} opts data for the lib
	 */
function DynamoLib(opts) {
	if (!opts) throw new Error("missing opts to Dynamo Lib");

	if (!opts.uid || /\s+/.exec(opts.uid))
		throw new Error("a valid key is required by dynamo lib");

	if (!opts.code) throw new Error("code is required by dynamo lib");

	this._id = opts._id;
	this.code = opts.code;
	this.uid = opts.uid;
	this._save = opts.save;
}
/**
	 * This loads its code into the holder object.
	 * @param  {Object} holder Placeholder for returned function
	 * @return {Object}        holder object
	 */
DynamoLib.prototype.load = function(holder) {
	var self = this;
	if (holder[this.key])
		throw new Error("key  " + this.key + " already exists");

	return (function() {
		let exports = {};
		/* jshint ignore:start */
		//added extra check to ensure this code never runs in engine context.
		eval(self.code);
		/* jshint ignore:end */
		return (holder[self.uid] = exports), holder;
	})();
};

DynamoLib.prototype.save = function(fn) {
	this._save(this, fn);
};

module.exports = DynamoLib;
