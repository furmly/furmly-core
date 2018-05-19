/**
	 * Class Constuctor for a DynamoProcessor
	 * @constructor
	 * @memberOf module:Dynamo
	 * @param {Any} opts Constructor arguments
	 */
function DynamoProcessor(opts) {
	(this.debug = require("debug")("processor-constructor")),
		(constants = require("./constants"));
	if (!opts.code) {
		this.debug(opts);
		throw new Error("Processor must include code to run");
	}

	if (!opts.title) {
		this.debug(opts);
		throw new Error("Processor must have a title");
	}

	if (!opts.save) {
		this.debug(opts);
		throw new Error("Processor needs save service for persistence");
	}

	var self = this;
	this._id = opts._id;
	this.code = opts.code;
	this.title = opts.title;
	this.uid = opts.uid;
	this.requiresIdentity = opts.requiresIdentity;
	this.standalone = opts.standalone;
	this._code = opts._code;
	this._references = opts._references;
	this.codeGenerator = opts.codeGenerator;
	Object.defineProperties(this, {
		_save: {
			enumerable: false,
			get: function() {
				return opts.save;
			}
		}
	});

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
			let code = self._code || self.code;
			self.validate();
			/* jshint ignore:start */
			if (this.SANDBOX_CONTEXT) {
				//added extra check to ensure this code never runs in engine context.
				this.debug(`running processor '${self.title}' ${self._id} `);

				eval(code);
			}

			/* jshint ignore:end */
		} catch (e) {
			// statements
			this.debug(
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
		title: this.title,
		requiresIdentity: this.requiresIdentity,
		standalone: this.standalone
	};
	if (this.uid) {
		model.uid = this.uid;
	}
	if (this.codeGenerator) {
		let { code, references = {} } = this.codeGenerator.optimize(model.code);
		model._code = code;
		model._references = Object.keys(references);
	}
	this._save(model, fn);
};

module.exports = DynamoProcessor;
