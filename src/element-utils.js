const async = require("async");
module.exports = {
	warn: function(debug) {
		return function(message) {
			debug && debug(`warn:${message}`);
		};
	},
	convert: function(factory, parent, name) {
		if (parent && parent[name] && parent[name].length) {
			parent[name] = factory.getAll(factory, parent[name]);
		}
	},
	describeAll: function(parent, propertyName, cb) {
		if (!parent || !parent[propertyName].length) return setImmediate(cb);
		let arr = parent[propertyName];
		async.parallel(arr.map(x => x.describe.bind(x)), (er, result) => {
			if (er) return cb(er);
			parent[propertyName] = result;
			return cb();
		});
	},
	elementInvariants: {
		_ensureArgs: function(item) {
			if (!item.args) throw new Error("element must contain args");
		},
		_ensureArray: function(item) {
			if (item && !Array.prototype.isPrototypeOf(item))
				throw new Error("Expected an Array , got a :" + typeof item);
		},
		_ensureValidJSONString: function(string) {
			try {
				JSON.parse(string);
			} catch (e) {
				throw new Error("Invalid json string");
			}
		}
		//,
		// _ensureElement: function(item) {
		// 	if (!item) {
		// 		debugger;
		// 		throw new Error(
		// 			"undefined/null is not a valid value for an element"
		// 		);
		// 	}
		// 	if (
		// 		typeof item.name !== "string" ||
		// 		typeof item.label !== "string" ||
		// 		(item.description && typeof item.description !== "string") ||
		// 		typeof item.elementType !== "string" ||
		// 		(item.args && typeof item.args !== "object")
		// 	) {
		// 		throw new Error("illegal argument(s) passed to createElement");
		// 	}
		// },

		// _ensureElements: function(arr, extend) {
		// 	this._ensureArray(arr);
		// 	for (var i = arr.length - 1; i >= 0; i--) {
		// 		this._ensureElement(arr[i]);
		// 		if (extend) arr[i] = extend(arr[i]);
		// 	}
		// }
	}
};
