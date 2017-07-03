/*jshint loopfunc: true */
this.SANDBOX_CONTEXT = true;
var module_context = this;
module_context.skip = {};
if (typeof entityRepo !== 'undefined')
	module_context.entityRepo = entityRepo;
if (typeof constants !== 'undefined')
	module_context.constants = constants;
if (typeof systemEntities !== 'undefined')
	module_context.systemEntities = systemEntities;


module_context.args = context.args;
module.exports = {
	getResult: function(fn) {
		function run() {
			var firstProcessor = context.processors[0],
				tasks = [];
			tasks.push(async.timeout(function(cb) {
				firstProcessor.process.call(module_context, cb);
			}, context.processorsTimeout));

			function process(i, list, timeout) {
				return async.timeout(function(result, cb) {
					if (!module_context.skip[list[i]._id] && !module_context.completed) {
						list[i].process.call(module_context, result, cb);
						return;
					}
					cb(null, result);
				}, timeout);
			}

			for (var i = 1; i < context.processors.length; i++) {
				tasks.push(process(i, context.processors, context.processorsTimeout || 1500));
			}

			async.waterfall(tasks, function(er, result) {
				if (er) return fn(er);
				if (context.postprocessors && context.postprocessors.length) {
					var postTasks = [];
					var first = context.postprocessors[0];
					postTasks.push(async.timeout(function(cb) {
						first.process.call(module_context, cb);
					}, context.postprocessorsTimeout));
					for (var i = 1; i < context.postprocessors; i++)
						postTasks.push(process(i, context.postprocessors, context.postprocessorsTimeout || 1500));

					async.waterfall(tasks, function(er, result) {
						if (er) {
							//write to some error log somewhere.
							console.log('postprocessors failed:' + JSON.stringify(er));
						}
					});
				}

				fn(er, result);
			});
		}
		if (typeof systemEntities !== 'undefined' && typeof entityRepo !== 'undefined') {
			//load reusable libs
			entityRepo.getLib(systemEntities.lib, {}, function(er, libs) {
				if (er) return fn(er);
				module_context.libs = libs.reduce(function(holder, lib) {
					//console.log(lib);
					return lib.load(holder);
				}, {});

				run();
			});
			return;
		}
		run();



	}
};