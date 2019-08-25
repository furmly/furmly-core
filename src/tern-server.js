const TernServer = require("tern").Server;
const javascript_def = require("tern/defs/ecmascript.json");
require("tern/plugin/doc_comment");
const path = require("path");
const { systemEntities, EVENTS } = require("./constants");

const wrapLib = function(uid, code) {
  return `(function(args){ let exports; ${code}\n args["${uid}"]=exports; })(libs)`;
};
class Server {
  constructor(repo, context) {
    this.repo = repo;
    this.context = context;
    this.repo.on(EVENTS.ENTITY_REPO.UPDATE, ({ name, data }) => {
      if (this.server && name == systemEntities.lib) {
        this.server.addFile(
          data._id.toString(),
          wrapLib(data.uid, data._code || data.code)
        );
      }
    });
  }
  init(cb) {
    const options = {
      defs: [javascript_def],
      async: true,
      getFile: () => {
        console.log("getting files");
      },
      ecmaVersion: 6,
      plugins: { doc_comment: { strong: true } }
    };

    switch (this.context) {
      case Server.LIB:
        options.defs.push(require(path.join(__dirname, "../res/lib.json")));
        break;
      default:
        options.defs.push(
          require(path.join(__dirname, "../res/processor.json"))
        );
        break;
    }

    this.server = new TernServer(options);

    switch (this.context) {
      case Server.PROCESSOR:
        this.repo.queryEntity(systemEntities.lib, {}, (er, allLibs) => {
          if (er) return cb(er);
          this.server.addFile("init.js", "let libs={};");
          allLibs.forEach(lib => {
            this.server.addFile(
              lib._id.toString(),
              wrapLib(lib.uid, lib.getCode())
            );
          });
          this.server.flush(cb);
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
  request(...args) {
    this.server.request.apply(this.server, args);
  }
}

Server.PROCESSOR = "PROCESSOR";
Server.LIB = "LIB";

module.exports = Server;
