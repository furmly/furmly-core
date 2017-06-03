/*jshint loopfunc: true */
this.SANDBOX_CONTEXT = true;
var module_context = this;
module_context.skip = {};
module.exports = {
	getResult: function(fn) {
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
};