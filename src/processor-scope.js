constants = require("./constants");
async = require("async");
uuid = require("uuid/v4");
const ElementFactory = require("./element-factory");
const Scope = require("./processor-context");
entityRepo = new Scope();
elementFactory = new ElementFactory();
systemEntities = constants.systemEntities;
args = {
  $isAuthorized: false
};
libs = {};
/**
 *  Used to skip processors
 * @type {Object}
 */
skip = {};
/**
 * @param {String} message
 */
warn = function(message) {};
this.module.exports = this;
async.parallel();