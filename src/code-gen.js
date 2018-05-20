const parser = require("./parser");
function CodeGenerator(opts) {
	this.defaultOptimizations = [];
	if (opts) {
		if (opts.defaultOptimizations && opts.defaultOptimizations.length) {
			opts.defaultOptimizations.forEach(x =>
				this.defaultOptimizations.push(this.optimizations[x])
			);
		}
		if (opts.possibleCallbackNames) {
			this._possibleCallbackNames.concat(opts.possibleCallbackNames);
		}
	}
}

CodeGenerator.prototype.optimize = function(source, opts) {
	let optz = this.defaultOptimizations.slice();


	if (opts && Array.prototype.isPrototypeOf(opts)) {
		optz = optz.concat(opts);
	}
	let context = { result: {} },
		result = {
			code: parser(source, (...args) => {
				args.unshift(context);
				optz.forEach(x => x.apply(this, args));
			})
		};

	return Object.assign(result, context.result || {});
};

CodeGenerator.prototype.optimizations = {
	"Try-catch-all-async-functions": function(context, node) {
		if (node.type == "ArrowFunctionExpression") {
		//	debugger;
			let body = node.body,
				exceptionHandler =
					"//an unexpected error has just occurred. \n callback(e);";

			if (this._hasCallback(node)) {
				exceptionHandler=`//an unexpected error has just occurred. \n ${node.params[
					node.params.length - 1
				].name}(e);`;
			}
			body.update(
				`{try{${body.source()}} catch(e){${exceptionHandler}}}`
			);
		}
	},
	"Count-all-lib-references": function(context, node) {
		//check if expression is of type member.
		if (
			node.type == "MemberExpression" &&
			node.property &&
			node.object &&
			node.object.type == "MemberExpression" &&
			node.object.object &&
			node.object.object.type == "ThisExpression" &&
			node.object.property &&
			node.object.property.name == "libs"
		) {
			if (!context.result.references) context.result.references = {};
			context.result.references[node.property.name] = context.result
				.references[node.property.name]
				? 1
				: context.result.references[node.property.name] + 1;
		}
	}
};

CodeGenerator.prototype._possibleCallbackNames = [
	/^cb$/i,
	/callback/i,
	/^fn$/i
];
CodeGenerator.prototype._hasCallback = function(node) {
	if (node.params && node.params.length) {
		for (var i = 0; i < this._possibleCallbackNames.length; i++) {
			if (
				this._possibleCallbackNames[i].test(
					node.params[node.params.length - 1].name
				)
			)
				return true;
		}
	}
	return false;
};

module.exports = CodeGenerator;
