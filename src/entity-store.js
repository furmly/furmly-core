const mongoose = require("mongoose");
const ObjectID = require("mongodb").ObjectID;

class SimpleEntityStore {
  constructor(ttl) {
    this.collection = mongoose.connection.db.collection("_temp_store_");
    this.ttl = ttl || 60;
  }
  /**
   * Used to retrieve something from the store.
   * @param {String} id - ObjectId or String of store item
   * @param {Function} fn Callback
   */
  get(id, fn) {
    this.collection.findOne(
      {
        _id: id ? ObjectID(id) : id
      },
      fn
    );
  }
  /**
   * Used to updated store information about an ongoing process
   * @param {String} id - Key
   * @param {Object} info - Process infor
   * @param {Object} extra -[optional] extra process info
   * @param {Func} fn - Callback function.
   */
  update(id, info, extra, fn) {
    if (Array.prototype.slice.call(arguments).length == 3) {
      fn = extra;
      extra = null;
    }
    this.collection.updateOne(
      {
        _id: id ? ObjectID(id) : id
      },
      {
        $set: {
          value: info,
          extra: extra,
          createdOn: new Date()
        }
      },
      fn
    );
  }
  /**
   * Remove information for a process
   * @param {String} id Key
   * @param {Func} fn - Callback function
   */
  remove(id, fn) {
    this.collection.deleteOne(
      {
        _id: id ? ObjectID(id) : id
      },
      fn
    );
  }
  /**
   * Store information about a process and ensure it is wiped after the process goes stale
   * @param {Object} info - Information about a process
   * @param {Object} extra - Extra information
   * @param {Func} fn -Callback function
   */
  keep(info, extra, fn) {
    if (Array.prototype.slice.call(arguments).length == 2) {
      fn = extra;
      extra = null;
    }
    this.createIndex(() => {
      this.collection.insertOne(
        {
          value: info,
          extra: extra,
          createdOn: new Date()
        },
        fn
      );
    });
  }
  createIndex(fn) {
    this.collection.createIndex(
      {
        createdOn: 1
      },
      {
        expireAfterSeconds: this.ttl
      },
      fn
    );
  }
}

module.exports = SimpleEntityStore;
