const { NodeVM } = require("vm2"),
	constants = require("./constants"),
	systemEntities = constants.systemEntities,
	async = require("async"),
	debug = require("debug")("sandbox"),
	FurmlyProcessor = require("./processor"),
	path = require("path"),
	sandboxCode = require("fs").readFileSync(
		__dirname + path.sep + "processor-sandbox.js"
	),
	elementFactory = new (require("./element-factory"))(),
	uuid = require("uuid");

/**
	 * Class used for running processors that are not part of a steps chain of processors
	 * @class
	 * @memberOf module:Furmly
	 * @param {Object} opts Class constructor options , including entityRepo and processors.
	 */
function FurmlySandbox(opts) {
	var args;
	if (
		!opts ||
		(!(opts instanceof FurmlyProcessor) &&
			(!opts.processors || !opts.processors.length))
	)
		throw new Error("A sandbox needs atleast one processor to run");

	if (
		!opts.entityRepo &&
		opts instanceof FurmlyProcessor &&
		(args = Array.prototype.slice.call(arguments)).length == 1
	)
		throw new Error("EntityRepo is required by all processors");

	(this.processors = opts instanceof FurmlyProcessor ? [opts] : opts.processors),
		(this.entityRepo =
			opts instanceof FurmlyProcessor ? args[1] : opts.entityRepo);
}
/**
 * Run processor(s) created in constructor
 * @param  {Object}   context Processor context
 * @param  {Function} fn      Callback
 * @return {Object}           Result of operation
 */
FurmlySandbox.prototype.run = function(context, ttl, fn) {
	if (Array.prototype.slice.call(arguments).length == 2) {
		fn = ttl;
		ttl = null;
	}
	let vm = new NodeVM({
		require: false,
		requireExternal: false,
		sandbox: {
			context: {
				args: context,
				processors: this.processors.slice(),
				postprocessors: [],
				processorsTimeout: ttl || 60000,
				systemEntities,
				constants,
				entityRepo: this.entityRepo,
				async,
				debug,
				elementFactory,
				uuid
			}
		}
	});
	let handle = vm.run(sandboxCode);
	handle.getResult(fn);
};
module.exports = FurmlySandbox;
