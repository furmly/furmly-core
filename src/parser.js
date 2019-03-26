var parse = require("acorn").parse;

module.exports = function(src, opts, fn) {
  if (typeof opts === "function") {
    fn = opts;
    opts = {};
  }
  if (src && typeof src === "object" && src.constructor.name === "Buffer") {
    src = src.toString();
  } else if (src && typeof src === "object") {
    opts = src;
    src = opts.source;
    delete opts.source;
  }
  src = src === undefined ? opts.source : src;
  if (typeof src !== "string") src = String(src);
  if (opts.parser) parse = opts.parser.parse;
  var ast = parse(src, opts);

  var result = {
    chunks: src.split(""),
    toString: function() {
      return result.chunks.join("");
    },
    inspect: function() {
      return result.toString();
    }
  };

  (function walk(node, parent) {
    insertHelpers(node, parent, result.chunks);

    Object.keys(node).forEach(function(key) {
      if (key === "parent") return;

      var child = node[key];
      if (Array.prototype.isPrototypeOf(child)) {
        child.forEach(function(c) {
          if (c && typeof c.type === "string") {
            walk(c, node);
          }
        });
      } else if (child && typeof child.type === "string") {
        walk(child, node);
      }
    });
    fn(node);
  })(ast, undefined);

  return result.toString();
};

function insertHelpers(node, parent, chunks) {
  node.parent = parent;

  node.source = function() {
    return chunks.slice(node.start, node.end).join("");
  };

  if (node.update && typeof node.update === "object") {
    var prev = node.update;
    Object.keys(prev).forEach(function(key) {
      update[key] = prev[key];
    });
    node.update = update;
  } else {
    node.update = update;
  }

  function update(s) {
    chunks[node.start] = s;
    for (var i = node.start + 1; i < node.end; i++) {
      chunks[i] = "";
    }
  }
}
