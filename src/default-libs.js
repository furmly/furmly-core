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
			this.libs = createLib.bind(this);
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
		.libs;
};