let uuid = require("uuid/v4");

Function.prototype.getFunctionBody = function() {
	var entire = this.toString();
	return entire.substring(entire.indexOf("{") + 1, entire.lastIndexOf("}"));
};

/**
 * Used to create elements
 * @param  {String} name        Name of element
 * @param  {String} label       Element label
 * @param  {Strirng} description Description of the elements use
 * @param  {String} type        Element type  eg INPUT,SELECT etc
 * @param  {Object} args        Elements custom arguments
 * @param  {Array} validators  Element validators
 * @param  {Array} asyncVals   Elements asyncValidators
 * @return {Object}             New Element.
 */
var createElement = function(
	name,
	label,
	description,
	type,
	args,
	validators,
	asyncVals
) {
	if (
		typeof name !== "string" ||
		typeof label !== "string" ||
		typeof description !== "string" ||
		typeof type !== "string" ||
		(args && typeof args !== "object")
	)
		throw new Error("illegal argument(s) passed to createElement");

	return {
		elementType: type,
		label: label,
		name: name,
		args: args,
		asyncValidators: asyncVals || [],
		description: description,
		validators: validators || [],
		component_uid: uuid()
	};
};

module.exports = {
	createElement: createElement
};
