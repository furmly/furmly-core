module.exports = {
  dev: {
    data: {
      furmly_url: "mongodb://localhost:27017/furmly"
    },
    processors: {
      ttl: 5000
    },
    postprocessors: {
      ttl: 50000
    }
  },
  unitTest: {
    data: {
      furmly_url: "mongodb://localhost:27017/unit_test"
    },
    infrastructure: {
      disableSecurity: true
    },
    codeGenerator: {
      defaultOptimizations: ["Count-all-lib-references"]
    },
    processors: {
      ttl: 300000
    },
    postprocessors: {
      ttl: 50000
    }
  }
};
