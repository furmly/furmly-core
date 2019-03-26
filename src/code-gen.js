function CodeGenerator(opts, parser) {
  if (!parser) throw new Error("Code Generator requires a parser");
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
  this.parser = parser;
}

CodeGenerator.prototype.optimize = function(source, opts) {
  let optz = this.defaultOptimizations.slice();

  if (opts && Array.prototype.isPrototypeOf(opts)) {
    optz = optz.concat(opts);
  }
  const context = { result: {} };
  const result = {
    code: this.parser(source, (...args) => {
      args.unshift(context);
      optz.forEach(x => x.apply(this, args));
    })
  };

  return Object.assign(result, context.result || {});
};

CodeGenerator.prototype.optimizations = {
  "Try-catch-all-async-functions": function(context, node) {
    if (
      node.type == "ArrowFunctionExpression" ||
      node.type == "FunctionExpression" ||
      node.type == "FunctionDeclaration"
    ) {
      let callbackName;
      if ((callbackName = this._hasCallback(node))) {
        let body = node.body,
          exceptionHandler = `\n//an unexpected error has just occurred. \n ${callbackName}(e);`;

        body.update(
          `{\ntry{\n${body.source()}\n} catch(e){${exceptionHandler}}}`
        );
      }
    }
  },
  "Count-all-lib-references": function(context, node) {
    //check if expression is of type member.
    if (
      node.type == "MemberExpression" &&
      node.property &&
      node.object &&
      node.object.type == "MemberExpression" &&
      node.object.property &&
      node.object.property.name == "libs" &&
      node.property.name
    ) {
      if (!context.result.references) context.result.references = {};
      context.result.references[node.property.name] = context.result.references[
        node.property.name
      ]
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
CodeGenerator.prototype._possibleErrorNames = [/^er$/i, /^err$/i, /^error$/i];
CodeGenerator.prototype._hasCallback = function(node) {
  if (node.params && node.params.length) {
    for (var i = 0; i < this._possibleCallbackNames.length; i++) {
      if (
        this._possibleCallbackNames[i].test(
          node.params[node.params.length - 1].name
        )
      )
        return node.params[node.params.length - 1].name;
    }
    for (var i = 0; i < this._possibleErrorNames.length; i++) {
      if (this._possibleErrorNames[i].test(node.params[0].name))
        return this._searchAncestorsForCallbackName(node);
    }
  }
  return false;
};

CodeGenerator.prototype._searchAncestorsForCallbackName = function(node) {
  if (node.type == "Program" || node == null) return "callback";

  if (
    (node.type == "ArrowFunctionExpression" ||
      node.type == "FunctionExpression" ||
      node.type == "FunctionDeclaration") &&
    node.params &&
    node.params.length
  ) {
    for (var i = 0; i < this._possibleCallbackNames.length; i++) {
      if (
        this._possibleCallbackNames[i].test(
          node.params[node.params.length - 1].name
        )
      )
        return node.params[node.params.length - 1].name;
    }
  }

  return this._searchAncestorsForCallbackName(node.parent);
};

module.exports = CodeGenerator;
