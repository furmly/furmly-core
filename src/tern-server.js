const TernServer = require("tern").Server;
const fs = require("fs");
const { systemEntities } = require("./constants");

const wrapLib = function(uid, code) {
  return `(function(args){${code}\n args["${uid}"]=exports;})(libs)`;
};
class Server {
  constructor(repo, context) {
    this.repo = repo;
    this.context = context;
  }
  init(cb) {
    const options = {
      defs: [],
      async: true,
      ecmaVersion: 6,
      plugins: { doc_comment: { strong: true } }
    };
    switch (this.context) {
      case Server.LIB:
        options.defs.push(fs.readFileSync("../res/lib.json"));
        break;
      default:
        options.defs.push(fs.readFileSync("../res/processor.json"));
        break;
    }
    this.server = new TernServer(options);

    switch (this.context) {
      case Server.PROCESSOR:
        this.repo.queryEntity(systemEntities.lib, {}, (er, allLibs) => {
          if (er) return cb(er);
          allLibs.forEach(lib => {
            this.server.addFile(
              lib._id.toString(),
              wrapLib(lib.uid, lib.getCode())
            );
          });
          cb();
        });
        break;
      default:
        cb();
    }
  }
  addDoc(...args) {
    this.server.addFile.apply(this.server, args);
  }
  delDoc(...args) {
    this.server.delFile.apply(this.server, args);
  }
  req(...args) {
    this.server.request.apply(this.server, args);
  }
}

Server.PROCESSOR = "PROCESSOR";
Server.LIB = "LIB";

module.exports = Server;
