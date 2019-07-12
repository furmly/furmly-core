module.exports = (lib, srcPath) => {
  return `
      const FurmlyLib = require(require("path").join(${JSON.stringify(
        srcPath
      )},"/lib"));
      const debug=require("debug")("lib:${lib.uid}");
    
      class Lib${lib._id} extends FurmlyLib {
        constructor(props) {
          props.save = (model,fn) =>{ 
          debug("Saving is not allowed in production "+"${lib._id}"); 
          fn(null,model);
          };
          super(props);
        }
        load(holder) {
            var self = this,
            code = this._code || this.code;
          if (holder[this.key]) throw new Error("key  " + this.key + " already exists");
        
          return (function() {
            let exports = {};
            /* jshint ignore:start */
            ${lib._code || lib.code}
            /* jshint ignore:end */
            return (holder[self.uid] = exports), holder;
          })();
           
        }
      }
      
      module.exports = new Lib${lib._id}(${JSON.stringify(
    lib,
    (key, value) =>
      key == "code" || key == "_code"
        ? "throw new Error('This code should never execute')"
        : value,
    " "
  )});
      `;
};
