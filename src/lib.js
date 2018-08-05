/**
	 * Loads these reusable classes during every processor run.
	 * @constructor
	 * @memberOf module:Furmly
	 * @param {Object} opts data for the lib
	 */
function FurmlyLib(opts) {
	if (!opts) throw new Error("missing opts to Furmly Lib");

	if (!opts.uid || /\s+/.exec(opts.uid))
		throw new Error("a valid key is required by furmly lib");

	if (!opts.code) throw new Error("code is required by furmly lib");
	const debug = require("debug")("lib");
	this._id = opts._id;
	this.code = opts.code;
	this.uid = opts.uid;
	this._save = opts.save;
	this._code = opts._code;
	this._references = opts._references;
	Object.defineProperties(this, {
		codeGenerator: { enumerable: false, value: opts.codeGenerator },
		debug: {
			enumerable: false,
			get: function() {
				return debug;
			}
		}
	});
}
/**
	 * This loads its code into the holder object.
	 * @param  {Object} holder Placeholder for returned function
	 * @return {Object}        holder object
	 */
FurmlyLib.prototype.load = function(holder) {
	var self = this,
		code = this._code || this.code;
	if (holder[this.key])
		throw new Error("key  " + this.key + " already exists");

	return (function() {
		let exports = {};
		/* jshint ignore:start */
		//added extra check to ensure this code never runs in engine context.
		self.debug(`loading ${self._id}`);
		eval(code);
		/* jshint ignore:end */
		return (holder[self.uid] = exports), holder;
	})();
};

FurmlyLib.prototype.save = function(fn) {
	if (this.codeGenerator) {
		//optimize code.
		let { code, references = {} } = this.codeGenerator.optimize(this.code);
		this._code = code;
		this._references = Object.keys(references);
	}
	this._save(this, fn);
};

module.exports = FurmlyLib;
