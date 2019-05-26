const FurmlyElement = require("../element"),
  _constants = require("../constants"),
  misc = require("../element-utils"),
  async = require("async"),
  _ = require("lodash"),
  _warn = misc.warn(require("debug")("element:grid")),
  elementInvariants = misc.elementInvariants;

class Grid extends FurmlyElement {
  constructor(opts, factory) {
    super(opts);
    //add invariants here.
    this.invariants();
    const params = super.getServices();
    misc.convert(factory, this.args, "filter", params);
    misc.convert(factory, this.args.extra, "createTemplate", params);
    misc.convert(factory, this.args.extra, "editTemplate", params);
  }
  describeSync() {
    let element = super.describeSync(),
      args = element.args;
    misc.describeAllSync(args, "filter");
    misc.describeAllSync(args.extra, "createTemplate");
    misc.describeAllSync(args.extra, "editTemplate");
    return element;
  }
  describe(fn) {
    super.describe((er, description) => {
      if (er) return fn(er);
      async.parallel(
        [
          misc.describeAll.bind(null, description.args, "filter"),
          misc.describeAll.bind(null, description.args.extra, "createTemplate"),
          misc.describeAll.bind(null, description.args.extra, "editTemplate")
        ],
        er => {
          if (er) return fn(er);
          return fn(null, description);
        }
      );
    });
  }
  invariants() {
    //checkout everything is fine
    elementInvariants._ensureArgs(this);
    elementInvariants._ensureArray(this.args.commands);
    elementInvariants._ensureArray(this.args.filter);
    if (!this.args.source)
      throw new Error(
        `All grids must have a args.source ${JSON.stringify(this)}`
      );
    if (this.args.mode && !_constants.GRIDMODE.in(this.args.mode))
      throw new Error(
        "Invalid grid mode , i.e " + _constants.GRIDMODE.toString()
      );
    if (
      ((this.args.mode && this.args.mode == _constants.GRIDMODE.CRUD) ||
        !this.args.mode) &&
      (!this.args.extra ||
        !this.args.extra.createTemplate ||
        !this.args.extra.createTemplate.length ||
        !this.args.extra.createProcessor) &&
      !this.args.extra.fetchTemplateProcessor
    )
      throw new Error(
        `all CRUD grids require a createTemplate and a createProcessor ${JSON.stringify(
          this
        )}`
      );
    if (
      this.args.mode &&
      this.args.mode == _constants.GRIDMODE.EDITONLY &&
      (!this.args.extra ||
        !this.args.extra.editTemplate ||
        !this.args.extra.editTemplate.length ||
        !this.args.extra.editProcessor) &&
      !this.args.extra.fetchTemplateProcessor
    )
      throw new Error(
        `all EDITONLY grids require a editTemplate and a editProcessor ${JSON.stringify(
          this
        )}`
      );

    if (this.args.filter && this.args.filterProcessor)
      _warn(
        "both filter and filter processor are set. Filter processor will take precidence"
      );
  }
}

module.exports = Grid;
