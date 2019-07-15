/**
 * all the constants
 */
constants = require("./constants");
async = require("async");
uuid = require("uuid/v4");
const ElementFactory = require("./element-factory");

/**
 * Processor sentityRepo
 * @class
 */
function Scope() {}

/**
 * @typedef {function(err:object,result:object)} Callback
 */

/**
 * Find entity  of type {name} using {filter} . Please note querying system entities is not allowed
 * @param  {String}   name    Name of Collection/Table
 * @param  {object}   filter  Query filter
 * @param  {object}   options sorting,populating extra values etc [optional]
 * @param  {Callback} fn      Callback
 *
 */
Scope.prototype.get = function(name, filter, options, fn) {};
/**
 * Count number of entities that match the filter supplied
 * @param  {String}   name   Name of Collection/Table
 * @param  {Object}   filter Query
 * @param  {Callback} fn     Callback
 *
 */
Scope.prototype.count = function(name, filter, fn) {};
/**
 * Update an entity
 * @param  {String}   name Name of the collection/table entity is located in
 * @param  {Object}   data Update data
 * @param  {Callback} fn   Callback
 *
 */
Scope.prototype.update = function(name, data, fn) {};
/**
 * Delete an entity with the supplied id
 * @param  {String}   name Name of Collection/Table
 * @param  {String}   id   Id of object to delete
 * @param  {Callback} fn   Callback
 *
 */
Scope.prototype.delete = function(name, id, fn) {};
/**
 * Create an entity
 * @param  {String}   name Name of the collection/table entity is located in
 * @param  {Object}   data Update data
 * @param  {Callback} fn   Callback
 *
 */
Scope.prototype.create = function(name, data, fn) {};
/**
 * Creates an Entity Schema.
 * @param  {string}   name   Config Name
 * @param  {Object}   config Object schema
 * @param  {Callback} fn     Callback
 *
 */
Scope.prototype.createSchema = function(name, config, fn) {};
/**
 * Used to update schemas.
 * @param {String} name - name of schema to update.
 * @param {Object} schema - Schema config.
 * @param {Callback} fn - Callback function
 */
Scope.prototype.updateSchema = function(name, schema, fn) {};
/**
 * Used to count schema using a query.
 * @param {Object} query - search criteria.
 * @param {Function} fn - Callback function
 */
Scope.prototype.countSchemas = function(query, fn) {};
/**
 * Get Schema Configuration
 * @param  {String}   name Name of Collection/Table
 * @param  {Function} fn   Callback
 */
Scope.prototype.getSchema = function(name, fn) {};
/**
 * Get Schema Configuration Names
 * @param {Boolean} includeSchema - include the actual schema
 * @param {Boolean} includeInternalSchema - include internal schemas
 * @param {Object} query - filter
 * @param {Object} options - options passed with query
 * @param  {Callback} fn Callback
 */
Scope.prototype.getSchemas = function(
  includeSchema,
  includeInternalSchema,
  query,
  options,
  fn
) {};
/**
 * Used to create an entity id from a string
 * @param {string} id - entity id string
 * @returns {Object}
 */
Scope.prototype.createId = function(id) {};
/**
 * Used for saving and retrieving step and process info.
 * @type {EntityStore}
 */
Scope.prototype.store = {};
/**
 * Function that runs aggregation query on persistance object.
 * @param  {String}    name Name of collection/table to run aggregation on
 * @param  {...Object} rest Other Args including aggregation query and callback
 *
 */
Scope.prototype.aggregate = function(name, ...rest) {};
/**
 * Normalizes mongoose collection names to actual mongodb  collection names
 * @param  {String} name Name of Collection/Table
 * @return {String}      Correct collection name.
 */
Scope.prototype.getCollectionName = function(name) {};
/**
 * Find entity  of type Step using {filter}
 * @param  {Object}   filter  Query filter
 * @param  {Object}   options sorting,populating extra values etc [optional]
 * @param  {Callback} fn      Callback
 *
 */
Scope.prototype.getStep = function(filter, options, fn) {};
/**
 * Save Lib (NOTE:this would only work in development)
 * @param {Object} data - System entity to save
 * @param {Object} options - options
 * @param {Callback} fn - Callback function
 */
Scope.prototype.saveLib = function(data, options, fn) {};
/**
 * Find entity  of type Lib using {filter}
 * @param  {Object}   filter  Query filter
 * @param  {Object}   options sorting,populating extra values etc [optional]
 * @param  {Callback} fn      Callback
 *
 */
Scope.prototype.getLib = function(filter, options, fn) {};
/**
 * Save Async Validator (NOTE:this would only work in development)
 * @param {Object} data - System entity to save
 * @param {Object} options - options
 * @param {Callback} fn - Callback function
 */
Scope.prototype.saveAsyncValidator = function(data, options, fn) {};
/**
 * Find entity  of type AsyncValidator using {filter}
 * @param  {Object}   filter  Query filter
 * @param  {Object}   options sorting,populating extra values etc [optional]
 * @param  {Callback} fn      Callback
 *
 */
Scope.prototype.getAsyncValidator = function(filter, options, fn) {};
/**
 * Save Process (NOTE:this would only work in development)
 * @param {Object} data - System entity to save
 * @param {Object} options - options
 * @param {Callback} fn - Callback function
 */
Scope.prototype.saveProcess = function(data, options, fn) {};
/**
 * Find entity  of type Process using {filter}
 * @param  {Object}   filter  Query filter
 * @param  {Object}   options sorting,populating extra values etc [optional]
 * @param  {Callback} fn      Callback
 *
 */
Scope.prototype.getProcess = function(filter, options, fn) {};
/**
 * Save Processor (NOTE:this would only work in development)
 * @param {Object} data - System entity to save
 * @param {Object} options - options
 * @param {Callback} fn - Callback function
 */
Scope.prototype.saveProcessor = function(data, options, fn) {};
/**
 * Find entity  of type Processor using {filter}
 * @param  {Object}   filter  Query filter
 * @param  {Object}   options sorting,populating extra values etc [optional]
 * @param  {Callback} fn      Callback
 *
 */
Scope.prototype.getProcessor = function(filter, options, fn) {};

entityRepo = new Scope();
elementFactory = new ElementFactory();
systemEntities = constants.systemEntities;
args = {
  $isAuthorized: false
};
libs = {};
/**
 *  Used to skip processors by setting processor uid/_id on this object
 */
skip = {
  processorName: true
};
/**
 * @param {string} message
 */
warn = function(message) {};
this.module.exports = this;
