//'use strict';

const {
  async,
  entityRepo,
  debug,
  systemEntities,
  constants,
  task: { processors, postProcessors, returnResult }
} = context;
const { task, ...others } = context;
const processorsTimeout = context.processorsTimeout || 1500;
const postProcessorsTimeout = context.postProcessorsTimeout || 1500;
const module_context = others;
let loaded = {};
let lib_context = {};
module_context.skip = {};
module_context.SANDBOX_CONTEXT = true;

function addGetProp(name, obj, result) {
  Object.defineProperties(obj, {
    [name]: {
      enumerable: false,
      get: function() {
        return result;
      }
    }
  });
}

function runLibs(toLoad, loaded, fn) {
  //load reusable libs
  let libQuery = {},
    loadAll = typeof toLoad == "boolean",
    moreLibs = {};

  if (!loadAll) {
    libQuery.uid = { $in: toLoad };
  }

  entityRepo.getLib(libQuery, (er, libs) => {
    if (er) return fn(er);

    module_context.libs = libs.reduce(function(holder, lib) {
      try {
        var _l = lib.load(holder);
        loaded[lib.uid] = 1;
        (lib._references || []).forEach(x => {
          if (!loaded[x] && !loadAll) moreLibs[x] = 1;
        });
        return _l;
      } catch (e) {
        debug(`failed to load library ${lib.title} id:${lib._id}`);
        debug(e);
        return holder;
      }
      //give holder async and debug.
    }, lib_context);

    let _libs = Object.keys(moreLibs);
    if (_libs.length > 0) {
      return runLibs(_libs, loaded, fn);
    }
    debug("-=-=-=-=- Loaded Libs -=-=-=-=-=-");
    debug(loaded);
    debug("-=-=-=-=-=-=-=-=-=-=");
    fn();
  });
}

function run() {
  const firstProcessor = processors[0];
  const tasks = [];
  tasks.push(
    async.timeout(
      cb => {
        firstProcessor.process.call(module_context, cb);
      },
      processorsTimeout,
      "Processor failed to return"
    )
  );

  const process = (i, list, timeout) => {
    return async.timeout((result, cb) => {
      if (
        !module_context.skip[list[i]._id] &&
        !module_context.skip.$all &&
        !module_context.completed
      ) {
        list[i].process.call(module_context, result, cb);
        return;
      }
      cb(null, result);
    }, timeout);
  };

  for (var i = 1; i < processors.length; i++) {
    tasks.push(process(i, processors, processorsTimeout));
  }

  async.waterfall(tasks, (er, result) => {
    if (er) return returnResult(er);
    if (postProcessors && postProcessors.length) {
      var postTasks = [];
      var first = postProcessors[0];
      postTasks.push(
        async.timeout(cb => {
          first.process.call(module_context, cb);
        }, context.postProcessorsTimeout)
      );
      for (var i = 1; i < postProcessors; i++)
        postTasks.push(process(i, postProcessors, postProcessorsTimeout));

      async.waterfall(postTasks, (er, result) => {
        if (er) {
          //write to some error log somewhere.
          debug("postProcessors failed:" + JSON.stringify(er));
        }
      });
    }

    returnResult(er, result);
  });
}

function init() {
  if (typeof context.constants !== "undefined")
    addGetProp("constants", lib_context, constants);

  if (typeof context.systemEntities !== "undefined")
    addGetProp("systemEntities", lib_context, systemEntities);

  if (typeof async !== "undefined") addGetProp("async", lib_context, async);
  if (typeof debug !== "undefined") {
    let warn = function(message) {
      debug(`warn:${message}`);
    };
    addGetProp("debug", lib_context, debug);
    addGetProp("warn", lib_context, warn);
    module_context.warn = warn;
  }
  if (typeof context.uuid !== "undefined")
    addGetProp("uuid", lib_context, context.uuid);

  if (typeof elementFactory !== undefined)
    addGetProp("elementFactory", lib_context, context.elementFactory);
  if (
    typeof systemEntities !== "undefined" &&
    typeof entityRepo !== "undefined"
  ) {
    let query = Object.keys(
      processors.reduce((sum, x) => {
        (x._references || []).forEach(k => {
          Object.assign(sum, { [k]: 1 });
        });
        return sum;
      }, {})
    );
    if (constants) query = query.concat(constants.UIDS.LIB.values());

    return runLibs(query, loaded, er => {
      if (er) return returnResult(er);
      return run();
    });
  }
  run();
}

init();
