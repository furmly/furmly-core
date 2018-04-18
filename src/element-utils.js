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
	describeAllSync: function(parent, name) {
		if (parent && parent[name]) {
			parent[name] = parent[name].map(x => {
				if (typeof x.describeSync !== "function") {
					return x;
				}
				return x.describeSync();
			});
		}
	},
	describeAll: function(parent, propertyName, cb) {
		if (!parent || !parent[propertyName] || !parent[propertyName].length)
			return setImmediate(cb);
		let arr = parent[propertyName];
		async.parallel(arr.map(x => x.describe.bind(x)), (er, result) => {
			if (er) return cb(er);
			parent[propertyName] = result;
			return cb();
		});
	},
	elementInvariants: {
		_ensureArgs: function(item) {
			if (!item.args)
				throw new Error(
					`element ${JSON.stringify(item)} must contain args`
				);
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
	}
};
