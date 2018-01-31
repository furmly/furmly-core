const debug = require("debug")("init");
/**
 * Startup initialization
 * @param  {Object} config Configuration
 * @return {Object}        Dynamo classes and constants.
 */
function init(config) {
	var constants = require("./constants");

	return {
		Engine: require("./engine"),
		Form: require("./form"),
		Process: require("./process"),
		Lib: require("./lib"),
		Step: require("./step"),
		Processor: require("./processor"),
		constants,
		systemEntities: constants.systemEntities,
		EntityRepo: require("./entity-repo"),
		Element: require("./element")
	};
}

/**
 * Returns an initialization function for dynamo
 * @module Dynamo
 */
module.exports = init;
