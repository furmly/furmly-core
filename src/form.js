const async = require("async"),
	_ = require("lodash");
/**
	 * Form used by Client based Steps
	 * @constructor
	 * @memberOf module:Furmly
	 * @param {Any} opts Contructor arguments
	 */
function FurmlyForm(opts) {
	if (!opts || !opts.elements || !opts.elements.length)
		throw new Error("Form does not contain any elements");

	this.elements = opts.elements;
}

/**
	 * Creates a description of a form a client can consume
	 * @param  {Function} fn callback
	 * @return {Object}      object representing the form.
	 */
FurmlyForm.prototype.describe = function(fn) {

	async.parallel(
		_.map(this.elements, function(e) {
			return e.describe.bind(e);
		}),
		function(er, result) {
			if (er) return fn(er);
			fn(null, {
				elements: result
			});
		}
	);
};
/**
	 * saves the form using the persistence service.
	 * @param  {Function} fn callback
	 * @return {Any}      saved object.
	 */
FurmlyForm.prototype.save = function(fn) {
	async.parallel(
		_.map(this.elements, function(x) {
			return x.save.bind(x);
		}),
		function(er, elements) {
			if (er) return fn(er);
			fn(null, {
				elements: elements //_.map(elements, '_id')
			});
		}
	);
};

module.exports = FurmlyForm;
