const debug = require("debug")("processor");

/**
	 * Class Constuctor for a DynamoProcessor
	 * @constructor
	 * @memberOf module:Dynamo
	 * @param {Any} opts Constructor arguments
	 */
function DynamoProcessor(opts) {
	if (!opts.code) {
		debug(opts);
		throw new Error("Processor must include code to run");
	}

	if (!opts.title) {
		debug(opts);
		throw new Error("Processor must have a title");
	}

	if (!opts.save) {
		debug(opts);
		throw new Error("Processor needs save service for persistence");
	}

	var self = this;
	this._id = opts._id;
	this.code = opts.code;
	this.title = opts.title;
	this._save = opts.save;
	this.uid = opts.uid;
	this.requiresIdentity = opts.requiresIdentity;

	/**
		 *  User customisable code ran in sandbox.
		 * @param  {Any}   result  passed in result for previous processor.
		 * @param  {Function} callback callback function.
		 * @return {Any}            result of process.
		 */
	this.process = function(result, callback) {
		if (typeof result == "function") {
			callback = result;
			result = null;
		}
		try {
			self.validate();
			/* jshint ignore:start */
			if (this.SANDBOX_CONTEXT)
				//added extra check to ensure this code never runs in engine context.
				eval(self.code);
			/* jshint ignore:end */
		} catch (e) {
			// statements
			console.log(
				"error caught by processor , description: \n" + e.message
			);
			callback(e);
		}
	};
}
/**
	 * Class invariant function
	 * @return {Void} nothing
	 */
DynamoProcessor.prototype.validate = function() {
	if (!this._id) throw new Error("Processor requires a valid _id");
};

/**
	 * Creates a description of the processor a client can consume
	 * @param  {Function} fn callback
	 * @return {Object}      object representing the processor.
	 */
DynamoProcessor.prototype.describe = function(fn) {
	fn(null, {
		title: this.title,
		_id: this._id
	});
};

/**
	 * Persists this object using passed in persistence service
	 * @param  {Function} fn calllback
	 * @return {Any}      saved object
	 */
DynamoProcessor.prototype.save = function(fn) {
	var model = {
		_id: this._id,
		code: this.code,
		title: this.title
	};
	if (this.uid) {
		model.uid = this.uid;
	}

	this._save(model, fn);
};

module.exports = DynamoProcessor;
