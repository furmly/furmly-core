const { NodeVM } = require("vm2"),
	constants = require("./constants"),
	systemEntities = constants.systemEntities,
	async = require("async"),
	debug = require("debug")("sandbox"),
	DynamoProcessor = require("./processor"),
	path = require("path"),
	sandboxCode = require("fs").readFileSync(
		__dirname + path.sep + "processor-sandbox.js"
	),
	uuid = require("uuid");

/**
	 * Inner class used for running processors that are not part of a steps chain of processors
	 * @memberOf module:Dynamo
	 * @param {Object} opts Class constructor options , including entityRepo and processors.
	 */
function DynamoSandbox(opts) {
	var args;
	if (
		!opts ||
		(!(opts instanceof DynamoProcessor) &&
			(!opts.processors || !opts.processors.length))
	)
		throw new Error("A sandbox needs atleast one processor to run");

	if (
		!opts.entityRepo &&
		opts instanceof DynamoProcessor &&
		(args = Array.prototype.slice.call(arguments)).length == 1
	)
		throw new Error("EntityRepo is required by all processors");

	var processors = opts instanceof DynamoProcessor ? [opts] : opts,
		entityRepo =
			opts instanceof DynamoProcessor ? args[1] : opts.entityRepo;

	this.run = function(context, fn) {
		let vm = new NodeVM({
			require: false,
			requireExternal: false,
			sandbox: {
				context: {
					args: context,
					processors,
					postprocessors: [],
					processorsTimeout: 60000,
					systemEntities,
					constants,
					entityRepo: entityRepo,
					async,
					debug,
					uuid
				}
			}
		});
		let handle = vm.run(sandboxCode);
		handle.getResult(fn);
	};
}

module.exports = DynamoSandbox;
