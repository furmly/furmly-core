let uuid = require("uuid/v4"),
	constants = require("./constants"),
	elementFactory = new (require("./element-factory"))(),
	glob = require("glob");

Function.prototype.getFunctionBody = function() {
	var entire = this.toString();
	return entire.substring(entire.indexOf("{") + 1, entire.lastIndexOf("}"));
};

const warn = function(debug) {
	return function(message) {
		debug && debug(`warn:${message}`);
	};
};
let toCamelCase = function(str) {
	return str
		.replace(/\s(.)/g, function($1) {
			return $1.toUpperCase();
		})
		.replace(/\s/g, "")
		.replace(/^(.)/, function($1) {
			return $1.toLowerCase();
		});
};
const freeze = function(obj) {
	Object.keys(obj).forEach(Object.freeze);
};
/**
 * Used to create elements
 * @memberOf module:misc
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
	let _elementFactory =
		typeof elementFactory !== "undefined"
			? elementFactory
			: this.elementFactory;
	return _elementFactory
		.get({
			name,
			label,
			elementType: type,
			args,
			validators,
			description,
			asyncValidators: asyncVals
		})
		.describeSync();
};
/**
 * convention for inner element lists in compound elements.
 * @type {Array}
 */
const knownElementsLocations = [
	"elements",
	"args.elements",
	"args.items",
	"args.itemTemplate",
	"args.extra.createTemplate",
	"args.extra.editTemplate",
	"args.filter"
];
/**
 * search for a property path in the supplied item and run function on every item in the found list.
 * @param  {Object} item  Object to search
 * @param  {Array} locs  Array of locations to look for
 * @param  {Function} match Predicate function to determine if the right array has been located
 * @param  {Function} run   Action to execute on every item in found list.
 * @return {Void}       Returns nothing.
 */
function searchForList(item, locs, match, run) {
	debugger;
	match = match || (curr => typeof curr[0].elementType == "undefined");
	locs.forEach(loc => {
		let curr = item,
			list = loc.split(".");

		for (var i = 0; i <= list.length - 1; i++) {
			if (typeof curr[list[i]] == "undefined") break;

			curr = curr[list[i]];

			if (
				i == list.length - 1 &&
				Array.prototype.isPrototypeOf(curr) &&
				curr.length
			) {
				if (!match(curr)) {
					curr.forEach(x => {
						searchForList(x, locs, run);
					});
				} else
					curr.forEach(x => {
						searchForList(x, locs, run);
						run(x);
					});
			}
		}
	});
}

let convertObjectToString = function(obj) {
	let str = "{";
	Object.keys(obj).forEach((key, index, arr) => {
		let value = obj[key];
		if (typeof value == "string") value = `"${value}"`;
		if (typeof value == "function") {
			value = value.toString();
		}
		if (typeof value == "object") {
			if (Array.prototype.isPrototypeOf(value))
				value = `[${value
					.map(x => convertObjectToString(x))
					.join(",")}]`;
			else value = convertObjectToString(value);
		}

		str += `${key}:${value}`;

		if (index == arr.length - 1) return (str += "}");

		str += ",";
	});

	return str;
};
let createRequiredValidator = function() {
	let _constants =
		typeof this.constants == "undefined" ? constants : this.constants;
	return {
		validatorType: _constants.VALIDATORTYPE.REQUIRED
	};
};
let createRegexValidator = function(exp, error) {
	let _constants =
		typeof this.constants == "undefined" ? constants : this.constants;
	return {
		validatorType: _constants.VALIDATORTYPE.REGEX,
		error,
		args: {
			exp
		}
	};
};
let createMinLengthValidator = function(min, error) {
	let _constants =
		typeof this.constants == "undefined" ? constants : this.constants;
	return {
		validatorType: _constants.VALIDATORTYPE.MINLENGTH,
		error,
		args: {
			min
		}
	};
};
let createMaxLengthValidator = function(max, error) {
	let _constants =
		typeof this.constants == "undefined" ? constants : this.constants;
	return {
		validatorType: _constants.VALIDATORTYPE.MAXLENGTH,
		error,
		args: {
			max
		}
	};
};
function findElementByName(arr, name) {
	debugger;
	let _constants =
		typeof this.constants == "undefined" ? constants : this.constants;
	//this.debug(constants);
	//this.debug(`looking for ${name}`);
	const _internalSearches = {
		default: (...args) => {
			return findElementByName.apply(this, args);
		},
		[_constants.ELEMENTTYPE.GRID]: (grid, name) => {
			let item = null;
			if (
				(item = findElementByName.call(
					this,
					(grid.args && grid.args.filter) || null,
					name
				))
			)
				return item;

			return item;
		},
		[_constants.ELEMENTTYPE.SELECTSET]: (set, name) => {
			let item = null;
			if (
				(item = findElementByName.call(
					this,
					(set.args && set.args.items) || null,
					name
				))
			) {
				return item;
			}

			return item;
		},
		[_constants.ELEMENTTYPE.LIST]: (list, name) => {
			let item = null;
			if (
				(item = findElementByName.call(
					this,
					(list.args && list.args.itemTemplate) || null,
					name
				))
			) {
				return item;
			}

			return item;
		}
	};
	if (arr && !Array.prototype.isPrototypeOf(arr)) {
		arr = [arr];
	}
	if (!arr || !arr.length) return null;
	let item = null;
	for (var i = arr.length - 1; i >= 0; i--) {
		curr = arr[i];
		if (curr.name == name) {
			return curr;
		}

		if (
			(_internalSearches[curr.elementType] &&
				(item = _internalSearches[curr.elementType](curr, name))) ||
			(curr.args &&
				curr.args.elements &&
				(item = _internalSearches.default(curr.args.elements, name))) ||
			(curr.elements &&
				(item = _internalSearches.default(curr.elements, name)))
		) {
			return item;
		}
	}
	return item;
}

/**
	 * Returns Array of Strings
	 * @memberOf module:misc
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
	 * @memberOf module:misc
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
	 * @memberOf module:misc
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
	 * @memberOf module:misc
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
	 * @memberOf module:misc
	 * @param  {String} txt
	 * @return {String}
	 */
function capitalizeText(txt) {
	return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : txt;
}

/**
 * Returns an initialization function for furmly
 * @module misc
 */

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
	toObjectString,
	createRegexValidator,
	createRequiredValidator,
	createMaxLengthValidator,
	createMinLengthValidator,
	toCamelCase,
	warn,
	freeze,
	knownElementsLocations,
	searchForList
};
