let uuid = require("uuid/v4");

Function.prototype.getFunctionBody = function() {
	var entire = this.toString();
	return entire.substring(entire.indexOf("{") + 1, entire.lastIndexOf("}"));
};

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
