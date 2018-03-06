let uuid = require("uuid/v4"),
	constants = require("./constants"),
	// debug = require("debug")("misc"),
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
	if (
		typeof invariants == "undefined" &&
		!arguments.callee.elementInvariants
	) {
		let _constants =
				typeof this.constants == "undefined"
					? constants
					: this.constants,
			_warn =
				typeof this.warn == "undefined" ? warn(this.debug) : this.warn;
		arguments.callee.elementInvariants = $invariants;
	}

	uuid = typeof uuid !== "undefined" ? uuid : this.uuid;
	let element = {
		elementType: type,
		label: label,
		name: name,
		args: args,
		asyncValidators: asyncVals || [],
		description: description,
		validators: validators || [],
		component_uid: uuid()
	};
	let _invariants =
		(typeof invariants !== "undefined" && invariants) ||
		arguments.callee.elementInvariants;

	if (typeof _invariants._ensureElement !== "function") {
		debugger;
		console.log("something light");
	}
	_invariants._ensureElement(element);
	if (_invariants[type]) {
		try {
			_invariants[type](element);
		} catch (e) {
			throw new Error(
				`An error occurred while creating element {${name}} type {${type}} error:{${e}} `
			);
		}
	}

	return element;
};
const elementInvariants = function() {
		let _constants =
				typeof this.constants == "undefined"
					? constants
					: this.constants,
			_warn = typeof this.warn == "undefined" ? warn() : this.warn;
		return {
			[_constants.ELEMENTTYPE.INPUT]: function(item) {
				if (typeof item.args === "undefined")
					_warn("element has no args");
			},
			[_constants.ELEMENTTYPE.SELECT]: function(item) {
				this._ensureArgs(item);
				if (!_constants.ELEMENT_SELECT_SOURCETYPE.in(item.args.type)) {
					throw new Error(
						"all select elements must have a valid type i.e " +
							_constants.ELEMENT_SELECT_SOURCETYPE.toString()
					);
				}
				if (
					item.args.type === _constants.ELEMENT_SELECT_SOURCETYPE &&
					!item.args.config
				)
					throw new Error(
						"all select elements must have a processor if they are in processor mode"
					);

				if (
					item.args.config &&
					item.args.config.processorArgs &&
					typeof item.args.config.processorArgs !== "string"
				)
					throw new Error("Illegal Processor Arguments");

				if (
					item.args.config &&
					item.args.config.processorArgs &&
					typeof item.args.config.processorArgs == "string"
				) {
					this._ensureValidJSONString(item.args.config.processorArgs);
				}
			},
			[_constants.ELEMENTTYPE.SELECTSET]: function(item) {
				this._ensureArgs(item);
				if (
					!item.args.processor &&
					(!item.args.items || !item.args.items.length)
				)
					_warn(
						"All selectsets/option groups must either have a processor or atleast one element in its items.PLEASE NOTE: This will result in exception in production"
					);

				if (item.args.items)
					for (var i = item.args.items.length - 1; i >= 0; i--) {
						let curr = item.args.items[i];
						if (typeof curr.id === "undefined")
							throw new Error(
								"All selectset options must have a valid id"
							);
						if (curr.elements && curr.elements.length)
							this._ensureElements(curr.elements);
					}
			},
			[_constants.ELEMENTTYPE.NAV]: function(item) {
				this._ensureArgs(item);
				if (!item.args.type)
					throw new Error(
						"All navigation elements require a type i.e" +
							_constants.NAVIGATIONTYPE.toString()
					);
				if (!_constants.NAVIGATIONTYPE.in(item.args.type))
					throw new Error(
						"Invalid navigation element type i.e " +
							_constants.NAVIGATIONTYPE.toString()
					);
			},
			[_constants.ELEMENTTYPE.LIST]: function(item) {
				this._ensureArgs(item);
				if (
					item.args.itemTemplate &&
					Array.prototype.isPrototypeOf(item.args.itemTemplate)
				)
					this._ensureElements(item.args.itemTemplate);

				if (
					item.args.itemTemplate &&
					!Array.prototype.isPrototypeOf(item.args.itemTemplate) &&
					(!item.args.itemTemplate.dynamo_ref ||
						!item.args.template_ref)
				)
					_warn(
						"itemTemplate does not contain dynamo_ref but its template is not directly an array"
					);

				if (
					item.args.behavior &&
					item.args.behavior.extension &&
					!Array.prototype.isPrototypeOf(item.args.behavior.extension)
				)
					throw new Error("All template extensions must be arrays");

				if (item.args.behavior && item.args.behavior.extension)
					this._ensureElements(item.args.behavior.extension);
			},
			[_constants.ELEMENTTYPE.IMAGE]: function(item) {
				this._ensureArgs(item);
				if (!item.args.type)
					throw new Error(
						"All Images require a valid type i.e " +
							_constants.IMAGETYPE.toString()
					);
				if (!_constants.IMAGETYPE.in(item.args.type))
					throw new Error(
						"Invalid image type , i.e " +
							_constants.IMAGETYPE.toString()
					);

				if (!item.args.config || !item.args.config.data)
					throw new Error("All images require config.data");
			},
			[_constants.ELEMENTTYPE.HTMLVIEW]: function(item) {
				this._ensureArgs(item);

				if (item.args.html && typeof item.args.html !== "string")
					throw new Error(
						"HtmlView args.html property must be a string"
					);
			},
			[_constants.ELEMENTTYPE.ACTIONVIEW]: function(item) {
				this._ensureArgs(item);
				if (!item.args.elements || !item.args.elements.length)
					throw new Error(
						"All action views must contain atleast one element"
					);

				if (!item.args.commandText) _warn("commandText is blank");
				if (
					item.args.commandText &&
					typeof item.args.commandText !== "string"
				)
					throw new Error(
						"commandText of actionview must be a string"
					);

				if (item.args.elements)
					this._ensureElements(item.args.elements);
			},
			[_constants.ELEMENTTYPE.GRID]: function(item) {
				this._ensureArgs(item);
				this._ensureArray(item.args.commands);
				this._ensureArray(item.args.filter);
				if (!item.args.source)
					throw new Error("All grids must have a args.source ");
				if (item.args.mode && !_constants.GRIDMODE.in(item.args.mode))
					throw new Error(
						"Invalid grid mode , i.e " +
							_constants.GRIDMODE.toString()
					);
				if (
					((item.args.mode &&
						item.args.mode == _constants.GRIDMODE.CRUD) ||
						!item.args.mode) &&
					(!item.args.extra ||
						!item.args.extra.createTemplate ||
						!item.args.extra.createTemplate.length ||
						!item.args.extra.createProcessor)
				)
					throw new Error(
						"all CRUD grids require a createTemplate and a createProcessor"
					);
				if (
					item.args.mode &&
					item.args.mode == _constants.GRIDMODE.EDITONLY &&
					(!item.args.extra ||
						!item.args.extra.editTemplate ||
						!item.args.extra.editTemplate.length ||
						!item.args.extra.editProcessor)
				)
					throw new Error(
						"all CRUD grids require a createTemplate and a createProcessor"
					);

				if (item.args.filter && item.args.filterProcessor)
					_warn(
						"both filter and filter processor are set. Filter processor will take precidence"
					);
			},
			[_constants.ELEMENTTYPE.COMMAND]: function(item) {
				this._ensureArgs(item);
				const isDefault = () =>
					!item.args.commandType ||
					item.args.commandType == _constants.COMMANDTYPE.DEFAULT;
				if (isDefault() && !item.args.commandProcessor)
					throw new Error(
						"All default command elements require a processor"
					);

				if (isDefault() && item.args.commandProcessorArgs) {
					this._ensureValidJSONString(item.args.commandProcessorArgs);
				}

				if (
					item.args.commandType &&
					!_constants.COMMANDTYPE.in(item.args.commandType)
				)
					throw new Error(
						"Invalid command type i.e " +
							_constants.COMMANDTYPE.toString()
					);
			},
			[_constants.ELEMENTTYPE.FILEUPLOAD]: function(item) {
				this._ensureArgs(item);
				if (!item.args.fileType)
					throw new Error("All file uploads require a args.fileType");
			},
			_ensureArgs: function(item) {
				if (!item.args) throw new Error("element must contain args");
			},
			_ensureArray: function(item) {
				if (item && !Array.prototype.isPrototypeOf(item))
					throw new Error(
						"Expected an Array , got a :" + typeof item
					);
			},
			_ensureValidJSONString: function(string) {
				try {
					JSON.parse(string);
				} catch (e) {
					throw new Error("Invalid json string");
				}
			},
			_ensureElement: function(item) {
				if (!item) {
					debugger;
					throw new Error(
						"undefined/null is not a valid value for an element"
					);
				}
				if (
					typeof item.name !== "string" ||
					typeof item.label !== "string" ||
					(item.description &&
						typeof item.description !== "string") ||
					typeof item.elementType !== "string" ||
					(item.args && typeof item.args !== "object")
				) {
					this.debug && this.debug(arguments);
					throw new Error(
						"illegal argument(s) passed to createElement"
					);
				}
			},
			_ensureElements: function(arr) {
				this._ensureArray(arr);
				for (var i = arr.length - 1; i >= 0; i--) {
					this._ensureElement(arr[i]);
					if (this[arr[i].elementType])
						this[arr[i].elementType](arr[i]);
				}
			},
			toString: function() {
				return convertObjectToString(this);
			}
			//need to add more for each of the implemented elements.
		};
	},
	invariants = elementInvariants();

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
	let _constants =
		typeof this.constants == "undefined" ? constants : this.constants;
	//this.debug(constants);
	//this.debug(`looking for ${name}`);
	const _internalSearches = {
		default: (...args) => {
			return findElementByName.apply(this, args);
		},
		[_constants.GRID]: (grid, name) => {
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
		[_constants.SELECTSET]: (set, name) => {
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
		[_constants.LIST]: (list, name) => {
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
				(item = _internalSearches.default(item.args.elements, name))) ||
			(item.elements &&
				(item = _internalSearches.default(item.elements, name)))
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
 * Returns an initialization function for dynamo
 * @module misc
 */
module.exports = {
	createElement,
	findElementByName,
	elementInvariants,
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
	warn
};
