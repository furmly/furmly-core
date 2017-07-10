/*jshint esversion: 6 */
module.exports = function(constants) {
	require('./misc');


	function createLib(code, uid) {
		if (!uid) {
			console.log(arguments);
			throw new Error('Every default lib must have a uid');
		}
		if (!this.libs) {
			this.libs = {};
			this.createLib = createLib.bind(this);
		}

		this.libs[uid] = {
			code: code,
			uid: uid
		};
		return this;
	}

	return createLib.call({}, (() => {
			function convertFilter(data) {
				var query = {};
				Object.keys(data).forEach(function(key) {
					if (typeof data[key] == 'string') {

						query[key] = new RegExp(data[key], "i");
						return;
					}
					if (typeof data[key] == 'object' && !RegExp.prototype.isPrototypeOf(data[key])) {
						query[key] = convertFilter(data[key]);
						return;
					}
					query[key] = data[key];
				});
				return query;
			}
			exports = convertFilter;
		}).getFunctionBody(), constants.UIDS.LIB.CONVERT_FILTER)
		.createLib((() => {
			function convert(prop, list) {
				if (Array.prototype.slice.call(arguments) == 1) {
					list = prop;
					prop = null;
				}
				return list.map(x => ({
					displayLabel: (prop ? x[prop] : x),
					_id: x._id
				}));
			}
			exports = convert;
		}).getFunctionBody(), constants.UIDS.LIB.CONVERT_TO_SELECTABLE_LIST)
		.libs;
};