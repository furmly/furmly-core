global.fs = require("fs");
global.sinon = require("sinon");
global._ = require("lodash");
global.config = require("../config")[process.env.profile || "unitTest"];
global.app = require("../src/index.js")(config);
global._async = require("async");
global._debug = require("debug")("test");
global.mongoose = require("mongoose");

function deleteFile(path) {
  try {
    fs.unlinkSync(path);
  } catch (e) {}
}

function deleteDir(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index) {
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

function clearCollection(name, fn) {
  mongoose.connection.db.collection("schemas").deleteMany({ name }, er => {
    if (er) fn(er);
    delete mongoose.connection.models[name];
    delete mongoose.modelSchemas[name];
    delete mongoose.models[name];

    mongoose.connection.db.dropCollection(name.toLowerCase() + "s", function(
      er
    ) {
      if (er) {
        mongoose.connection.db.dropCollection(
          name.toLowerCase() + "es",
          function() {
            fn();
          }
        );
        return;
      }
      fn();
    });
  });
}

function wipeMongoSchemas(done) {
  _debug("schemas wiped");
  mongoose.modelSchemas = {};
  mongoose.models = {};
  done();
}

global.wipeMongoSchemas = wipeMongoSchemas;
global.clearCollection = clearCollection;
global.deleteFile = deleteFile;
global.deleteDir = deleteDir;
