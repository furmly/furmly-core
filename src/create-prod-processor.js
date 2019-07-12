module.exports = (processor, srcPath) => {
  return `
    const FurmlyProcessor = require(require("path").join(${JSON.stringify(
      srcPath
    )},"/processor"));
    const debug=require("debug")("processor:${processor.uid ||
      processor.title}");
  
    class Processor${processor._id} extends FurmlyProcessor {
      constructor(props) {
        props.save = (model,fn) =>{ 
          debug("Saving is not allowed in production "+"${processor._id}"); 
          fn(null,model);
        };
        super(props);
        this.process = function(...args){
          let callback;
          let result;
          if(args.length == 1){
            callback=args[0];
          }else{
            result=args[0];
            callback=args[1];
          }
          debug("running...");
          try{
            ${processor._code || processor.code}
          }catch(e){
             callback(e);
          }
          
        };
      }
    }
    
    module.exports = new Processor${processor._id}(${JSON.stringify(
    processor,
    (key, value) =>
      key == "code" || key == "_code"
        ? "throw new Error('This code should never execute')"
        : value,
    " "
  )});
    `;
};
