const debug = require("debug")("init");
/**
 * Startup initialization
 * @param  {Object} config Configuration
 * @return {Object}        Furmly classes and constants.
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
    Element: require("./element"),
    LocalEntityRepo: require("./prod-entity-repo")
  };
}

/**
 * Returns an initialization function for furmly
 * @module Furmly
 */
module.exports = init;
