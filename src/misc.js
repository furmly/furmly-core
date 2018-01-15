let uuid = require("uuid/v4"),
	constants = require("./constants"),
	glob = require("glob");

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
let createElement = function(
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

function findElementByName(arr, name) {
	let constants =
		typeof this.constants == "undefined" ? constants : this.constants;
	const _internalSearches = {
		default: function(...args) {
			return findElementByName.apply(this, args);
		},
		[constants.GRID]: function(grid, name) {
			let item = null;
			if ((item = findElementByName(grid.args.filter, name))) return item;

			return item;
		},
		[constants.SELECTSET]: function(set, name) {
			let item = null;
			if ((item = findElementByName(set.args.items, name))) {
				return item;
			}

			return item;
		},
		[constants.LIST]: function(list, name) {
			let item = null;
			if ((item = findElementByName(list.args.itemTemplate, name))) {
				return item;
			}

			return item;
		}
	};
	if (!arr || !arr.length) return null;
	let item = null;
	for (var i = arr.length - 1; i >= 0; i--) {
		item = arr[i];
		if (item.name == name) {
			return item;
		}
		if (
			(_internalSearches[item.elementType] &&
				(item = _internalSearches[item.elementType](item, name))) ||
			(item.args &&
				item.args.elements &&
				(item = internalSearches.default(item.args.elements))) ||
			(item.elements && (item = internalSearches.default(item.elements)))
		) {
			return item;
		}
	}
	return item;
}

/**
	 * Returns Array of Strings
	 * @memberOf module:Dynamo
	 * @param  {String} folderPath
	 * @param  {Function} callback
	 * @return {String}
	 */
var getDirectories = function(src, callback) {
	glob(src + "/**/*", callback);
};
var toObjectString = function(obj) {
	return JSON.stringify(obj, null, " ");
};
function runThroughObj(
	conditions,
	data,
	result = {},
	parent = null,
	parentKey = null,
	index = null
) {
	if (data && typeof data === "object") {
		Object.keys(data).forEach(key => {
			for (var v = 0; v < conditions.length; v++) {
				if (conditions[v](key, data, result, parent, parentKey, index))
					return result;
			}
			if (Array.prototype.isPrototypeOf(data[key]))
				return data[key].forEach(function(element, index) {
					runThroughObj(
						conditions,
						element,
						result,
						data,
						key,
						"" + index
					);
				});
			if (data[key] && typeof data[key] == "object")
				return runThroughObj(conditions, data[key], result, data, key);
		});
	}

	return result;
}
/**
	 * Returns a function that checks if a property is defined
	 * @memberOf module:Dynamo
	 * @param  {String} propertyName
	 * @return {Function}
	 */
var isNotDefined = function(prop) {
	return function(item) {
		return typeof item == "object" && typeof item[prop] == "undefined";
	};
};

/**
	 * Returns a function that checks the type of the supplied argument
	 * @memberOf module:Dynamo
	 * @param  {String} value
	 * @return {Function}
	 */
var typeOf = function(value) {
	return function(item) {
		return typeof item == value;
	};
};

/**
	 * Returns a function that returns the first child of an array result.
	 * @memberOf module:Dynamo
	 * @param  {Function} fn
	 * @return {Object}
	 */
var getOne = function(fn) {
	return function(er, result) {
		if (result && result.length) {
			result = result[0];
		}
		return fn(er, result);
	};
};

var notAFunction = function(x) {
	return typeof x !== "function";
};

/**
	 * Capitalizes Text
	 * @memberOf module:Dynamo
	 * @param  {String} txt
	 * @return {String}
	 */
function capitalizeText(txt) {
	return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : txt;
}

module.exports = {
	createElement,
	findElementByName,
	getDirectories,
	getOne,
	capitalizeText,
	notAFunction,
	typeOf,
	isNotDefined,
	runThroughObj,
	toObjectString
};
