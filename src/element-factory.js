let fs = require("fs"),
  debug = require("debug")("element-factory"),
  path = require("path"),
  Base = require("./element"),
  location = __dirname + "/element-types";
let resolvedElementTypes = fs.readdirSync(location).reduce((sum, x) => {
  return (
    (sum[path.basename(x, path.extname(x))] = require(`${location}/${x}`)), sum
  );
}, {});
/**
 * Used to generate elements.
 */
class ElementFactory {
  /**
   * Returns an element
   * @param {Object} opts options
   */
  get(opts) {
    if (!opts || !opts.elementType)
      throw new Error("All elements must have an elementType");
    debug(`constructing element of type ${opts.elementType}`);

    try {
      let type = opts.elementType.toLowerCase();
      if (resolvedElementTypes[type])
        return new resolvedElementTypes[type](opts, this);

      return new Base(opts);
    } catch (e) {
      debug("something went wrong while trying to contruct an element");
      debug(e);
      throw e;
    }
  }
  /**
   *
   * @param {ElementFactory} factory factory used to create elements
   * @param {Array} arr Array of params
   * @param {Object} extensionParams [optional] used to create specific elements
   */
  getAll(factory, arr, extensionParams = {}) {
    if (typeof arr == "undefined")
      throw new Error("Array to convert to elements cannot be undefined");
    if (arr.length) {
      return arr.map(x => factory.get({ ...x, ...extensionParams }));
    }
    return [];
  }
}

module.exports = ElementFactory;
