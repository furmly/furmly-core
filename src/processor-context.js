const { systemEntities } = require("./constants");
/**
 * Proxy function used to restrict access to system entities.
 * @return {Function} Constructed proxy function.
 */
function blockSystemEntities() {
  let args = Array.prototype.slice.call(arguments);
  if (this._systemEntities.indexOf(args[1]) !== -1)
    return args[args.length - 1](
      new Error(`Access Violation '${args[1]}' ${args[0]}`)
    );

  return args[0].apply(this, args.slice(1));
}
/**
 * This provides context for querying entities while running a processor.
 */
class ProcessorContext {
  constructor(repo) {
    const notQuery = { name: { $nin: repo._systemEntities.slice() } };
    const _getConfigProxy = function(name, fn) {
      if (this._systemEntities.indexOf(name) !== -1)
        return fn(new Error(`Access Violation '${name}'`));

      this.getConfig(name, fn);
    }.bind(repo);
    const _getConfigNamesProxy = function(...args) {
      if (args.length < 3) {
        args[2] = notQuery;
      } else {
        args[2] = Object.assign(args[2] || {}, notQuery);
      }
      this.getConfigNames.apply(this, args);
    }.bind(repo);

    /**
     * Find entity  of type {name} using {filter} . Please note querying system entities is not allowed
     * @param  {String}   name    Name of Collection/Table
     * @param  {Object}   filter  Query filter
     * @param  {Object}   options sorting,populating extra values etc [optional]
     * @param  {Function} fn      Callback
     *
     */
    this.get = blockSystemEntities.bind(repo, repo.queryEntity);
    /**
     * Count number of entities that match the filter supplied
     * @param  {String}   name   Name of Collection/Table
     * @param  {Object}   filter Query
     * @param  {Function} fn     Callback
     *
     */
    this.count = repo.countEntity.bind(this);
    /**
     * Update an entity
     * @param  {String}   name Name of the collection/table entity is located in
     * @param  {Object}   data Update data
     * @param  {Function} fn   Callback
     *
     */
    this.update = blockSystemEntities.bind(repo, repo.updateEntity);
    /**
     * Delete an entity with the supplied id
     * @param  {String}   name Name of Collection/Table
     * @param  {String}   id   Id of object to delete
     * @param  {Function} fn   Callback
     *
     */
    this.delete = blockSystemEntities.bind(repo, repo.deleteEntity);
    /**
     * Create an entity
     * @param  {String}   name Name of the collection/table entity is located in
     * @param  {Object}   data Update data
     * @param  {function} fn   Callback
     *
     */
    this.create = blockSystemEntities.bind(repo, repo.createEntity);
    /**
     * Creates an Entity Schema.
     * @param  {some}   name   Config Name
     * @param  {Object}   config Object schema
     * @param  {Function} fn     Callback
     *
     */
    this.createSchema = repo.createConfig.bind(repo);
    /**
     * Used to update schemas.
     * @param {String} name - name of schema to update.
     * @param {Object} schema - Schema config.
     * @param {Function} fn - Callback function
     */
    this.updateSchema = repo.updateConfig.bind(repo);
    /**
     * Used to count schema using a query.
     * @param {Object} query - search criteria.
     * @param {Function} fn - Callback function
     */
    this.countSchemas = repo.countConfig.bind(repo);
    /**
     * Get Schema Configuration
     * @param  {String}   name Name of Collection/Table
     * @param  {Function} fn   Callback
     *
     */
    this.getSchema = _getConfigProxy;
    /**
     * Get Schema Configuration Names
     * @param {Boolean} includeSchema - include the actual schema
     * @param {Boolean} includeInternalSchema - include internal schemas
     * @param {Object} query - filter
     * @param {Object} options - options passed with query
     * @param  {Function} fn Callback
     */
    this.getSchemas = _getConfigNamesProxy;
    /**
     * Used to create an entity id from a string
     * @param {string} id - entity id string
     * @returns {Object}
     */
    this.createId = repo.createId.bind(null);
    /**
     * Used for saving and retrieving step and process info.
     * @type {Object}
     */
    this.store = repo.store;
    /**
     * Function that runs aggregation query on persistance object.
     * @param  {String}    name Name of collection/table to run aggregation on
     * @param  {...Object} rest Other Args including aggregation query and callback
     *
     */
    this.aggregate = blockSystemEntities.bind(repo, repo.aggregateEntity);
    /**
     * Normalizes mongoose collection names to actual mongodb  collection names
     * @param  {String} name Name of Collection/Table
     * @return {String}      Correct collection name.
     */
    this.getCollectionName = blockSystemEntities.bind(
      repo,
      repo.getCollectionName
    );
    /**
     * Find entity  of type Step using {filter}
     * @param  {Object}   filter  Query filter
     * @param  {Object}   options sorting,populating extra values etc [optional]
     * @param  {Function} fn      Callback
     *
     */
    this.getStep = repo.queryEntity.bind(repo, systemEntities.step);
    /**
     * Save Lib (NOTE:this would only work in development)
     * @param {Object} data - System entity to save
     * @param {Object} options - options
     * @param {Func} fn - Callback function
     */
    this.saveLib = repo.saveSystemEntity.bind(repo, systemEntities.lib, "lib");
    /**
     * Find entity  of type Lib using {filter}
     * @param  {Object}   filter  Query filter
     * @param  {Object}   options sorting,populating extra values etc [optional]
     * @param  {Function} fn      Callback
     *
     */
    this.getLib = repo.queryEntity.bind(repo, systemEntities.lib);
    /**
     * Save Async Validator (NOTE:this would only work in development)
     * @param {Object} data - System entity to save
     * @param {Object} options - options
     * @param {Func} fn - Callback function
     */
    this.saveAsyncValidator = repo.saveSystemEntity.bind(
      repo,
      systemEntities.asyncValidator,
      "asyncValidator"
    );
    /**
     * Find entity  of type AsyncValidator using {filter}
     * @param  {Object}   filter  Query filter
     * @param  {Object}   options sorting,populating extra values etc [optional]
     * @param  {Function} fn      Callback
     *
     */
    this.getAsyncValidator = repo.queryEntity.bind(
      repo,
      systemEntities.asyncValidator
    );
    /**
     * Save Process (NOTE:this would only work in development)
     * @param {Object} data - System entity to save
     * @param {Object} options - options
     * @param {Func} fn - Callback function
     */
    this.saveProcess = repo.saveSystemEntity.bind(
      repo,
      systemEntities.process,
      "process"
    );
    /**
     * Find entity  of type Process using {filter}
     * @param  {Object}   filter  Query filter
     * @param  {Object}   options sorting,populating extra values etc [optional]
     * @param  {Function} fn      Callback
     *
     */
    this.getProcess = repo.queryEntity.bind(repo, systemEntities.process);
    /**
     * Save Processor (NOTE:this would only work in development)
     * @param {Object} data - System entity to save
     * @param {Object} options - options
     * @param {Func} fn - Callback function
     */
    this.saveProcessor = repo.saveSystemEntity.bind(
      repo,
      systemEntities.processor,
      "processor"
    );
    /**
     * Find entity  of type Processor using {filter}
     * @param  {Object}   filter  Query filter
     * @param  {Object}   options sorting,populating extra values etc [optional]
     * @param  {Function} fn      Callback
     *
     */
    this.getProcessor = function(...args) {
      //load all the necessary libs.
      let _processors,
        loadLibs = !!(args.length == 3 && args[1] && args[1].loadLibs),
        fn = args.splice(args.length - 1, 1, (er, processors) => {
          if (er) return fn(er);
          if (processors) {
            if (loadLibs) {
              if (!Array.prototype.isPrototypeOf(processors)) {
                _processors = [processors];
              } else _processors = processors;
              let refs = _processors.reduce(
                (sum, p) => sum.concat(p._references),
                []
              );
              let context = args[1].context;
              if (
                refs.length > 0 &&
                (!context || !context.libs || !context.libs.loadLib)
              )
                return fn(
                  new Error(
                    "Processor context is needed to setup a processors references"
                  )
                );
              if (refs.length > 0)
                return context.libs.loadLib.call(context, refs, er => {
                  if (er) return fn(er);
                  return fn(null, processors);
                });
            }
          }
          return fn(null, processors);
        })[0];
      args.unshift(systemEntities.processor);
      this.queryEntity.apply(repo, args);
    };
    this.getProcessor = this.getProcessor.bind(repo);
  }
}

module.exports = ProcessorContext;
