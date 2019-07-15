const { NodeVM, VMScript } = require("vm2"),
  constants = require("./constants"),
  systemEntities = constants.systemEntities,
  async = require("async"),
  uuid = require("uuid/v4"),
  debug = require("debug")("sandbox"),
  path = require("path"),
  sandboxCode = require("fs").readFileSync(
    __dirname + path.sep + "sandbox-queue.js"
  ),
  elementFactory = new (require("./element-factory"))();

/**
 * Class used for running processors that are not part of a steps chain of processors
 * @class
 * @memberOf module:Furmly
 * @param {Object} opts Class constructor options , including entityRepo and processors.
 */
function FurmlySandbox({ entityRepo, extensions = {} }) {
  if (!entityRepo) throw new Error("EntityRepo is required by all processors");

  this.script = new VMScript(sandboxCode);
  this.extensions = extensions;
  this.entityRepo = entityRepo;
}

FurmlySandbox.prototype.getSandbox = function(
  { processors, postProcessors, context, etc = {}, includeExtensions = false },
  fn
) {
  const _c = {
    processorsTimeout: 60000,
    ...(etc || {}),
    args: context,
    entityRepo: this.entityRepo,
    systemEntities,
    constants,
    async,
    debug,
    elementFactory,
    uuid,
    task: {
      processors,
      postProcessors,
      returnResult: fn
    }
  };
  if (includeExtensions) Object.assign(_c, { ...this.extensions });
  return new NodeVM({
    require: false,
    requireExternal: false,
    sandbox: {
      context: _c
    }
  });
};

/**
 * Run processor(s) created in constructor
 * @param  {Object}   context Processor context
 * @param  {Function} fn      Callback
 * @return {Object}           Result of operation
 */
FurmlySandbox.prototype.run = function(args, fn) {
  const vm = this.getSandbox(args, fn);
  // then run script
  vm.run(this.script);
};
module.exports = FurmlySandbox;
