let util = require("util"),
	FurmlyProcessor = require("./processor");
/**
	 * Inherits from processor. Runs user editable code for validation. It is used to validate elements before submission.
	 * @constructor
	 * @memberOf module:Furmly
	 * @param {Object} opts [description]
	 */
function FurmlyAsyncValidator(opts) {
	var self = this;
	FurmlyProcessor.call(this, opts);

	var _process = this.process;
	//convert result to boolean value.
	/**
		 * Runs user editable code and returns a boolean.
		 * @param  {Any}   result result of previous processor in chain
		 * @param  {Function} fn     callback
		 * @return {Any}          result of processing sent to client
		 */
	this.process = function(result, fn) {
		_process.call(this, result, function(er, result) {
			fn(er, {
				valid: !!result
			});
		});
	};
}
util.inherits(FurmlyAsyncValidator, FurmlyProcessor);

module.exports = FurmlyAsyncValidator;
