/*jshint loopfunc: true */
//'use strict';

let module_context = context,
	async = context.async,
	entityRepo = context.entityRepo,
	debug = context.debug,
	systemEntities = context.systemEntities,
	constants = context.constants,
	lib_context = {};
module_context.skip = {};
module_context.SANDBOX_CONTEXT = true;

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
module.exports = {
	getResult: fn => {
		const run = () => {
			var firstProcessor = context.processors[0],
				tasks = [];
			tasks.push(
				async.timeout(cb => {
					firstProcessor.process.call(module_context, cb);
				}, context.processorsTimeout)
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

			for (var i = 1; i < context.processors.length; i++) {
				tasks.push(
					process(
						i,
						context.processors,
						context.processorsTimeout || 1500
					)
				);
			}

			async.waterfall(tasks, (er, result) => {
				if (er) return fn(er);
				if (context.postprocessors && context.postprocessors.length) {
					var postTasks = [];
					var first = context.postprocessors[0];
					postTasks.push(
						async.timeout(cb => {
							first.process.call(module_context, cb);
						}, context.postprocessorsTimeout)
					);
					for (var i = 1; i < context.postprocessors; i++)
						postTasks.push(
							process(
								i,
								context.postprocessors,
								context.postprocessorsTimeout || 1500
							)
						);

					async.waterfall(postTasks, (er, result) => {
						if (er) {
							//write to some error log somewhere.
							debug(
								"postprocessors failed:" + JSON.stringify(er)
							);
						}
					});
				}

				fn(er, result);
			});
		};
		if (
			typeof systemEntities !== "undefined" &&
			typeof entityRepo !== "undefined"
		) {
			//load reusable libs

			entityRepo.getLib({}, (er, libs) => {
				if (er) return fn(er);

				module_context.libs = libs.reduce(function(holder, lib) {
					try {
						return lib.load(holder);
					} catch (e) {
						debug(
							`failed to load library ${lib.title} id:${lib._id}`
						);
						debug(e);
						return holder;
					}
					//give holder async and debug.
				}, lib_context);

				run();
			});
			return;
		}
		run();
	}
};
