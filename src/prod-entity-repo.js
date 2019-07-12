const debug = require("debug")("prod-entity-repo");
const async = require("async");
const ObjectID = require("mongodb").ObjectID;
const { systemEntities } = require("./constants");
const fs = require("fs");
const EntityRepo = require("./entity-repo");
const createProdProcessor = require("./create-prod-processor");
const createProdLib = require("./create-prod-lib");
const FurmlyProcessor = require("./processor");
const FurmlyLib = require("./lib");

const getIDOnly = function(item) {
  return (
    ((typeof item == "string" || ObjectID.prototype.isPrototypeOf(item)) &&
      item) ||
    item._id
  );
};

const genericTransformer = function(clazz, type, fetchPath, item, fn) {
  if (!(item instanceof clazz)) {
    const _id = getIDOnly(item);
    if (!_id) {
      return fn(new Error(`Cannot save new ${type} in production`));
    }
    try {
      return fn(null, require(fetchPath(_id)));
    } catch (e) {
      return fn(e);
    }
  }
  return fn(null, item);
};

class ProdEntityRepo extends EntityRepo {
  constructor(opts) {
    super(opts);
    this.processorsFolder =
      this.config.processorsFolder || `${__dirname}/_processors`;
    this.libsFolder = this.config.libsFolder || `${__dirname}/_libs`;
    this.getProcessorPath = this.getProcessorPath.bind(this);
    this.getLibPath = this.getLibPath.bind(this);
    this.transformers[systemEntities.processor] = (item, fn) => {
      // transform processor using require.
      genericTransformer(
        FurmlyProcessor,
        "processor",
        this.getProcessorPath,
        item,
        fn
      );
    };
    this.transformers[systemEntities.lib] = (item, fn) => {
      genericTransformer(FurmlyLib, "lib", this.getLibPath, item, fn);
    }; // transform lib using require.
  }
  getProcessorPath(id) {
    return `${this.processorsFolder}/${id}`;
  }
  getLibPath(id) {
    return `${this.libsFolder}/${id}`;
  }
  init(cb) {
    debug("=================== entity repo production ===================");
    super.init(err => {
      if (err) {
        debug(`an error occurred during super init :${err}`);
        return cb(err);
      }
      debug("super init completed successfully...");
      debug("checking init advice");
      if (!this.config.init) {
        debug("no need to init");
        return cb();
      }
      debug("creating local files..");
      async.parallel(
        [
          fn =>
            this.queryEntity(
              systemEntities.processor,
              {},
              { noTransformaton: true },
              (err, processors) => {
                if (err) return cb(err);
                debug("successfully retrieved all processors");
                this.exportAll(
                  processors,
                  createProdProcessor,
                  this.processorsFolder,
                  fn
                );
              }
            ),
          fn =>
            this.queryEntity(
              systemEntities.lib,
              {},
              { noTransformaton: true },
              (err, libs) => {
                if (err) return cb(err);
                debug("successfully retrieved all libs");
                this.exportAll(
                  libs,
                  createProdLib,
                  this.libsFolder || "./_libs",
                  fn
                );
              }
            )
        ],
        er => {
          if (er) return cb(err);
          debug(
            "=================== entity repo init successful ==================="
          );
          cb();
        }
      );
    });
  }
  exportAll(arr, getTemplate, location, fn) {
    debug("exporting...");
    if (!fs.existsSync(location)) {
      fs.mkdirSync(location);
    }
    async.parallel(
      arr.map(x => cb => {
        debug(`fetching template for ${x._id}`);
        const template = getTemplate(x, __dirname);
        fs.writeFile(`${location}/${x._id}.js`, template, cb);
      }),
      er => {
        if (er) return fn(er);
        debug("successfully exported all");
        fn();
      }
    );
  }

  updateEntity(...args) {
    if (
      args[0] === systemEntities.lib ||
      args[0] === systemEntities.processor
    ) {
      return args[args.length - 1](
        new Error("Cannot update new Libs/Processors in production")
      );
    }
    return super.updateEntity.apply(this, args);
  }
  createEntity(...args) {
    if (
      args[0] === systemEntities.lib ||
      args[0] === systemEntities.processor
    ) {
      return args[args.length - 1](
        new Error("Cannot create new Libs/Processors in production")
      );
    }
    return super.createEntity.apply(this, args);
  }
}
module.exports = ProdEntityRepo;
