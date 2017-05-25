/*jshint loopfunc: true */
this.SANDBOX_CONTEXT = true;
var module_context = this;
module.exports = {
	getResult: function(fn) {
		var firstProcessor = context.processors[0];
		tasks.push(function(callback) {
			firstProcessor.process.call(module_context, callback);
		});
		for (var i = 0; i < context.processors.length; i++)
			tasks.push(function(result, callback) {
				context.processors[i].process.call(module_context, callback);
			});

		async.waterfall(tasks, function(er, result) {
			if (er) return fn(er);

			if (context.postprocessors) {
				tasks.length = 0;
				var first = context.postprocessors[0];
				tasks.push(function(callback) {
					first.process.call(module_context, callback);
				});
				for (var i = 0; i < context.postprocessors; i++)
					tasks.push(function(result, callback) {
						context.postprocessors[i].process.call(module_context, callback);
					});

				context.postprocessors.splice(0, 0, first);

				async.waterfall(tasks, function(er, result) {
					fn(er, result);
				});
				return;
			}

			fn(er, result);
		});
	}
};