/**
 * Function for creating default lib functions.
 * @param  {Object} constants System Constants
 * @return {Void}           Nothing
 */
module.exports = function(constants) {
  var misc = require("./misc");

  function createLib(code, uid) {
    if (!uid) {
      throw new Error("Every default lib must have a uid");
    }
    if (!this.libs) {
      this.libs = {};
      this.createLib = createLib.bind(this);
    }

    this.libs[uid] = {
      code: code,
      uid: uid
    };
    return this;
  }

  return createLib
    .call(
      {},
      (() => {
        /**
         * This function is used to convert external queries to db filter objects.
         * @param {Object} data filter object used in a query
         * @param {Object} parent parent of the filter object[optional]
         */
        function convertFilter(data, parent) {
          var query = {};
          Object.keys(data).forEach(function(key) {
            if (typeof data[key] === "string") {
              query[(parent && `${parent}.${key}`) || key] = new RegExp(
                data[key],
                "i"
              );
              return;
            }
            if (
              typeof data[key] == "object" &&
              !RegExp.prototype.isPrototypeOf(data[key]) &&
              !data[key].isObjectID &&
              !data[key].$objectID
            ) {
              Object.assign(
                query,
                convertFilter(data[key], (parent && `${parent}.${key}`) || key)
              );
              return;
            }
            if (
              typeof data[key] == "object" &&
              (data[key].isObjectID || data[key].$objectID)
            ) {
              query[key] = data[key].value || data[key].$objectID;
              return;
            }
            query[key] = data[key];
          });
          return query;
        }
        exports = convertFilter;
      }).getFunctionBody(),
      constants.UIDS.LIB.CONVERT_FILTER
    )
    .createLib(
      (() => {
        /**
         * This function converts a list of items to a selectable list the UI can understand using the "prop" as the label for each item.
         * @param {string} prop This is the propertyName used as the label for each item in the list
         * @param {Array} list Array of items to be displayed in a list
         */
        function convert(prop, list) {
          if (Array.prototype.slice.call(arguments).length == 1) {
            list = prop;
            prop = null;
          }
          return list.map(x => ({
            displayLabel: prop ? x[prop] : x,
            uid: x.uid,
            _id: x._id || x
          }));
        }
        exports = convert;
      }).getFunctionBody(),
      constants.UIDS.LIB.CONVERT_TO_SELECTABLE_LIST
    )
    .createLib(
      (() => {
        /**
         *
         * @param {string} entityName This is the name of the entity to be created for each row
         * @param {string} file location of the file
         * @param {Object} context extra information to add to every row.
         * @param {function(obj:Object)} checks custom validation to be performed on every row.
         * @param {function} extend can be used to customize the output before saving
         * @param {FileUpload} fileUpload used to retrieve the uploaded file.
         * @param {FileParser} fileParser used to parse the uploaded file
         * @param {Object} threadPool [deprecated] used to run the function in a differnt thread context.
         * @param {ProcessorContext} entityRepo entityRepo
         * @param {User} user the user making this request
         * @param {Callback} fn callback function
         */
        function convert(
          entityName,
          file,
          context,
          checks,
          extend,
          fileUpload,
          fileParser,
          threadPool,
          entityRepo,
          user,
          fn
        ) {
          function getDefaultChecks(_keys) {
            return (rows, cb) => {
              let errors = [],
                requiredKeys = _keys.sort();
              this.debug(`sorted keys ${requiredKeys}`);
              try {
                for (var i = 0; i < rows.length; i++) {
                  let keys = Object.keys(rows[i]);
                  if (keys.length < requiredKeys.length) {
                    errors.push(`Missing column(s) row:${i + 1}`);
                    continue;
                  }
                  let _sortedKeys = keys.sort(),
                    mustHave = requiredKeys.slice();

                  for (var z = 0; z < _sortedKeys.length; z++) {
                    if (
                      rows[i][_sortedKeys[z]] &&
                      mustHave.indexOf(_sortedKeys[z]) >= 0
                    ) {
                      mustHave.splice(mustHave.indexOf(_sortedKeys[z]), 1);
                    }
                  }
                  if (mustHave.length)
                    errors.push(
                      `row ${i +
                        1} does not have a valid value for column(s) ${mustHave.join(
                        ","
                      )}`
                    );
                }
                this.debug(errors);
                if (errors.length) return cb(errors.join("|"));

                cb(null, rows);
              } catch (e) {
                cb(e);
              }
            };
          }
          function process(data, cb) {
            this.debug("its running at all");
            if (!data.items.length) return cb(new Error("file has no rows"));
            let _innerChecks = !checks
              ? null
              : Function.prototype.isPrototypeOf(checks)
              ? checks
              : getDefaultChecks.call(this, checks);
            try {
              this.debug("converting items...");
              let joined = data.items.map((x, ind) => {
                return Object.assign({}, x, data.rest || {});
              });
              this.debug("conversion successful");
              if (!_innerChecks) return cb(null, joined);
              _innerChecks.call(this, joined, er => {
                if (er) return cb(er);
                cb(null, joined);
              });
            } catch (e) {
              return cb(new Error("error occurred processing file records"));
            }
          }

          fileUpload.readFile(file, user, (er, data, description) => {
            if (er)
              return (
                this.debug("An error occurred while reading uploaded file"),
                this.debug(er),
                fn(
                  new Error(
                    "Error occurred while attempting to read uploaded file"
                  )
                )
              );

            fileParser.parseOnly(description, data, (er, rows) => {
              if (er)
                return (
                  this.debug("An error occurred while parsing uploaded file"),
                  this.debug(er),
                  fn(
                    new Error(
                      "Error occurred while attempting to parse uploaded file"
                    )
                  )
                );

              this.debug(rows);

              process.call(
                this,
                {
                  items: rows,
                  rest: context
                },
                (er, result) => {
                  if (er)
                    return (
                      this.debug("an error occurred in threadpool"),
                      this.debug(er),
                      fn(
                        new Error(
                          (Array.prototype.isPrototypeOf(er) && er.join()) || er
                        )
                      )
                    );

                  this.debug(result);

                  this.debug("thread pool work completed successfully");

                  extend =
                    extend ||
                    function(list, cb) {
                      setImmediate(cb, null, list);
                    };
                  this.debug("finished setting up extend");
                  //this.debug(extend);
                  this.debug(extend.toString());
                  extend(result, (er, extendedResult) => {
                    this.debug("got here");
                    if (er) return fn(er);

                    this.debug(extendedResult);
                    let tasks = extendedResult.map(x =>
                      entityRepo.create.bind(entityRepo, entityName, x)
                    );
                    //this.debug(tasks);

                    this.async.parallel(tasks, (er, results) => {
                      if (er) {
                        let reversals = [];
                        results.forEach(item => {
                          if (item && item.length) {
                            reversals.push(item[0]._id);
                          }
                        });

                        if (reversals.length) {
                          return this.async.parallel(
                            [
                              entityRepo.delete.bind(
                                entityRepo,
                                entityName,
                                reversals
                              )
                            ],
                            err => {
                              if (err) return fn(err);
                              return fn(er);
                            }
                          );
                        }

                        return (
                          this.debug("an error occurred while saving items"),
                          fn(er)
                        );
                      }

                      this.debug("finished!!!!");

                      fn(null, "Successfully uploaded records");
                    });
                  });
                }
              );
            });
          });
        }

        exports = convert;
      }).getFunctionBody(),
      constants.UIDS.LIB.CONVERT_AND_SAVE_FILE
    )
    .createLib(
      (() => {
        /**
         * Create a default C(reate)R(ead)U(pdate)D(elete) process for an an entity
         * @param {string} entityName Entity name e.g Student
         * @param {string} entityLabel The prop that can be used as a label if the entity is to be selected from a list
         * @param {string} menuGroup The menu group the created process would belong to e.g MAINMENU
         * @param {string} menuCategory The menu category the process would belong to
         * @param {Object} schema The schema definition object e.g {name:{type:"String"}}
         * @param {Callback} fn The callback function
         */
        function create(
          entityName,
          entityLabel,
          menuGroup,
          menuCategory,
          schema,
          fn
        ) {
          this.debug(`creating crud for entity ${entityName}`);

          let constants = this.constants,
            self = this,
            title = `Manage ${entityName}`,
            create_uid = `CREATE_${entityName}_${Math.ceil(
              Math.random() * 10
            )}`,
            update_uid = `UPDATE_${entityName}_${Math.ceil(
              Math.random() * 10
            )}`,
            get_uid = `GET_${entityName}_${Math.ceil(Math.random() * 10)}`,
            template = [this.libs.createId()],
            server = self.infrastructure.server;
          if (!server)
            return fn(
              new Error(
                "Entity Repo does not provide a means of creating menus"
              )
            );

          this.async.waterfall(
            [
              this.async.parallel.bind(this.async, [
                this.entityRepo.saveProcessor.bind(this.entityRepo, {
                  title: `Create ${entityName}`,
                  code: `this.debug('creating new ${entityName}...'); \nthis.libs.isAuthorized.call(this,(er)=>{\nif(er) return callback(er);\nthis.entityRepo.create('${entityName}',this.args.entity,callback);\n})`,
                  uid: create_uid
                }),
                this.entityRepo.saveProcessor.bind(this.entityRepo, {
                  title: `Update ${entityName}`,
                  uid: update_uid,
                  code: `this.debug('update ${entityName}...'); \nthis.libs.isAuthorized.call(this,(er)=>{if(er) return callback(er);\nthis.entityRepo.update('${entityName}',this.args.entity,callback);\n})`
                }),
                this.entityRepo.saveProcessor.bind(this.entityRepo, {
                  title: `Get ${entityName}`,
                  uid: get_uid,
                  code: `this.debug('fetching ${entityName}...');\nthis.$checkDomain=true; \nthis.libs.getEntity.call(this,'${entityName}','${entityLabel}',callback);`
                })
              ]),
              (_processors, callback) => {
                this.entityRepo.getProcessor(
                  {
                    uid: {
                      $in: [
                        create_uid,
                        update_uid,
                        get_uid,
                        this.constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC
                      ]
                    }
                  },
                  (er, list) => {
                    if (er) return callback(er);
                    this.debug(list);
                    let _list = list
                      .slice()
                      .filter(
                        x =>
                          this.constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC !==
                          x.uid
                      );
                    callback(null, { _list, list });
                  }
                );
              },
              ({ _list, list }, callback) => {
                this.async.parallel(
                  _list.map(v => {
                    return cb => {
                      server.saveClaim(
                        {
                          type: server.constants.CLAIMS.PROCESSOR,
                          description: v.title,
                          value: v._id
                        },
                        (er, claim) => {
                          cb(er, claim);
                        }
                      );
                    };
                  }),
                  (er, _claims) => {
                    return callback(er, { list, _claims });
                  }
                );
              },
              ({ list, _claims }, callback) => {
                this.debug(_claims);
                this.async.parallel(
                  _claims.map(x =>
                    server.addClaimToRole.bind(
                      server,
                      server.defaultRole,
                      null,
                      x
                    )
                  ),
                  er => {
                    if (er) return callback(er);
                    return callback(null, list);
                  }
                );
              },
              (processors, callback) => {
                if (processors.length !== 4)
                  return callback(
                    new Error("Cannot locate all the required processors")
                  );

                callback(
                  null,
                  processors.reduce((x, y) => {
                    return (x[y.uid] = y), x;
                  }, {})
                );
              }
            ],
            (er, result) => {
              if (er) return fn(er);
              this.debug(
                "located crud processors...\n converting schema to template..."
              );
              template = template.concat(
                new self.libs.ElementsConverter(
                  self.libs,
                  result,
                  constants
                ).convert(schema)
              );
              this.debug(
                `finished conversion :${JSON.stringify(template, null, " ")}`
              );
              template.push(
                self.libs.createElement(
                  "$password",
                  "Enter Password (Current User)",
                  "",
                  constants.ELEMENTTYPE.INPUT,
                  {
                    type: constants.INPUTTYPE.PASSWORD
                  }
                )
              );

              var processInstance = {
                title: title,
                description: `System administators can create and edit existing ${entityName}`,
                uid: `${entityName}_CRUD_` + Math.ceil(Math.random() * 10),
                steps: [
                  {
                    stepType: constants.STEPTYPE.CLIENT,
                    mode: constants.STEPMODE.VIEW,
                    processors: [],
                    form: {
                      elements: [
                        self.libs.createElement(
                          "grid",
                          `Manage ${entityName}`,
                          `This view lets administators manage ${entityName}`,
                          constants.ELEMENTTYPE.GRID,
                          {
                            mode: constants.GRIDMODE.CRUD,
                            source: result[get_uid]._id,
                            gridArgs: `{"entityName":"${entityName}","entityLabel":"${entityLabel}"}`,
                            filter: [
                              self.libs.createElement(
                                `${entityLabel}`,
                                `By ${entityLabel[0].toUpperCase() +
                                  entityLabel.substring(1)}`,
                                "",
                                constants.ELEMENTTYPE.INPUT
                              )
                            ],
                            templateConfig: `{"name":"basic","config":{"${entityLabel ||
                              "name"}":"Title"}}`,
                            commands: [],
                            extra: {
                              createTemplate: template,
                              createProcessor: result[create_uid]._id,
                              editTemplate: template,
                              editProcessor: result[update_uid]._id
                            }
                          }
                        )
                      ]
                    }
                  }
                ]
              };

              self.entityRepo.saveProcess(processInstance, (er, proc) => {
                if (er) return fn(er);

                this.async.waterfall(
                  [
                    server.saveClaim.bind(server, {
                      type: server.constants.CLAIMS.PROCESS,
                      description: title,
                      value: proc._id
                    }),
                    function(result) {
                      var args = Array.prototype.slice.call(arguments);
                      var callback = args[args.length - 1];
                      server.addClaimToRole(
                        server.defaultRole,
                        null,
                        result,
                        function(er, role) {
                          if (er) return callback(er);
                          callback(null, result);
                        }
                      );
                    },
                    function(result, callback) {
                      server.saveMenu(
                        {
                          displayLabel: title,
                          group: menuGroup,
                          icon: "process",
                          claims: [result._id],
                          type: "FURMLY",
                          value: proc._id,
                          activated: true,
                          category: menuCategory || "MAINMENU",
                          client: server.webClient.clientId
                        },
                        callback
                      );
                    }
                  ],
                  function(er) {
                    if (er) return fn(er);

                    return fn(null, "successfully created crud process");
                  }
                );
              });
            }
          );
        }

        exports = create;
      }).getFunctionBody(),
      constants.UIDS.LIB.CREATE_CRUD_PROCESS
    )
    .createLib(
      (() => {
        /**
         * Load a libs
         * @param {string|ObjectID|Array.<string>|Array.<ObjectID>} toLoad Id of library to load
         * @param {Callback} fn
         */
        function loadLibs(toLoad, fn) {
          //load reusable libs
          if (typeof toLoad == "string") toLoad = [toLoad];
          let libQuery = { uid: { $in: toLoad } },
            _problem,
            moreLibs = {};

          this.entityRepo.getLib(libQuery, (er, libs) => {
            if (er) return fn(er);

            libs.reduce(function(holder, lib) {
              try {
                if (typeof holder[lib.uid] !== "undefined") return holder;
                var _l = lib.load(holder);
                //loaded[lib.uid] = 1;
                (lib._references || []).forEach(x => {
                  if (typeof holder[x] == "undefined") moreLibs[x] = 1;
                });
                return _l;
              } catch (e) {
                this.debug(`failed to load library ${lib.title} id:${lib._id}`);
                this.debug(e);
                _problem = e;
                return holder;
              }
              //give holder async and debug.
            }, this.libs);
            if (_problem) return fn(_problem);

            let _libs = Object.keys(moreLibs);
            if (_libs.length > 0) {
              return loadLibs.call(this, _libs, fn);
            }
            fn();
          });
        }
        exports = loadLibs;
      }).getFunctionBody(),
      constants.UIDS.LIB.LOAD
    )
    .createLib(
      `
      /**
       * Turn string camel case
       * @param {string} str string to be turned
       * @returns {string}
       **/
      exports=${misc.toCamelCase.toString()}`,
      constants.UIDS.LIB.TO_CAMEL_CASE
    )
    .createLib(
      `
      /**
       * Used to create elements
       * @param  {String} name        Name of element
       * @param  {String} label       Element label
       * @param  {Strirng} description Description of the elements use
       * @param  {String} type        Element type  eg INPUT,SELECT etc
       * @param  {Object} args        Elements custom arguments
       * @param  {Array} validators  Element validators
       * @param  {Array} asyncVals   Elements asyncValidators
       * @return {Object}             New Element.
       */
      exports=${misc.createElement.toString()}`,
      constants.UIDS.LIB.CREATE_ELEMENT
    )
    .createLib(
      `exports=${misc.findElementByName.toString()}`,
      constants.UIDS.LIB.FIND_ELEMENT_BY_NAME
    )
    .createLib(
      `exports=${misc.createRegexValidator.toString()}`,
      constants.UIDS.LIB.CREATE_REGEX_VALIDATOR
    )
    .createLib(
      `exports=${misc.createMinLengthValidator.toString()}`,
      constants.UIDS.LIB.CREATE_MIN_LENGTH_VALIDATOR
    )
    .createLib(
      `exports=${misc.createMaxLengthValidator.toString()}`,
      constants.UIDS.LIB.CREATE_MAX_LENGTH_VALIDATOR
    )
    .createLib(
      `exports=${misc.createRequiredValidator.toString()}`,
      constants.UIDS.LIB.CREATE_REQUIRED_VALIDATOR
    )
    .createLib(
      (() => {
        /**
         * Used to create an element of hidden elementType
         * @returns {Element}
         */
        exports = function() {
          return this.createElement(
            "_id",
            "",
            "",
            this.constants.ELEMENTTYPE.HIDDEN
          );
        };
      }).getFunctionBody(),
      constants.UIDS.LIB.CREATE_ID
    )
    .createLib(
      (() => {
        /**
         * Used to convert an entity to its reasonable equivalent elements.
         * @constructor
         * @param {Object} libs libs
         * @param {Object} processors some default processors
         * @param {*} constants
         */
        function ElementsConverter(libs, processors, constants) {
          this.libs = libs;
          this.processors = processors;
          this.constants = constants;
          //debug("elements converter constructor called");
          this.map = {
            [this.constants.ENTITYTYPE.STRING]: function(data, name) {
              return this.libs.createElement(
                name,
                this.firstWord(name),
                "",
                this.constants.ELEMENTTYPE.INPUT,
                {
                  type: this.constants.INPUTTYPE.TEXT
                }
              );
            },
            [this.constants.ENTITYTYPE.NUMBER]: function(data, name) {
              return this.libs.createElement(
                name,
                this.firstWord(name),
                "",
                this.constants.ELEMENTTYPE.INPUT,
                {
                  type: this.constants.INPUTTYPE.NUMBER
                }
              );
            },
            [this.constants.ENTITYTYPE.BOOLEAN]: function(data, name) {
              return this.libs.createElement(
                name,
                this.firstWord(name),
                "",
                this.constants.ELEMENTTYPE.INPUT,
                {
                  type: this.constants.INPUTTYPE.CHECKBOX
                }
              );
            },
            [this.constants.ENTITYTYPE.DATE]: function(data, name) {
              return this.libs.createElement(
                name,
                this.firstWord(name),
                "",
                this.constants.ELEMENTTYPE.INPUT,
                {
                  type: this.constants.INPUTTYPE.DATE
                }
              );
            },
            [this.constants.ENTITYTYPE.OBJECT]: function(data, name) {
              return this.libs.createElement(
                name,
                this.firstWord(name),
                "",
                this.constants.ELEMENTTYPE.SECTION,
                {
                  elements: this.convert(data)
                }
              );
            },
            [this.constants.ENTITYTYPE.ARRAY]: function(data, name) {
              return this.libs.createElement(
                name,
                this.firstWord(name),
                "",
                this.constants.ELEMENTTYPE.LIST,
                {
                  itemTemplate: this.convert(data[0])
                }
              );
            },
            [this.constants.ENTITYTYPE.REFERENCE]: function(data, name) {
              return this.libs.createElement(
                name,
                this.firstWord(name),
                "",
                this.constants.ELEMENTTYPE.SELECT,
                {
                  type: this.constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
                  config: {
                    value: this.processors[
                      this.constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC
                    ]._id,
                    customArgs: `{"entityName":"${
                      data.ref
                    }","entityLabel":"name"}`
                  }
                }
              );
            }
          };
        }
        ElementsConverter.prototype.convert = function(x) {
          let elements = [],
            keys = Object.keys(x),
            self = this;

          for (var i = 0; i < keys.length; i++) {
            let result,
              y = keys[i];

            if (Array.prototype.isPrototypeOf(x[y])) {
              result = self.map[this.constants.ENTITYTYPE.ARRAY].call(
                self,
                x[y],
                y
              );
            }
            if (typeof x[y] == "string" && self.map[x[y]]) {
              //this should only happen if entity is a reference in an array.
              if (x[y] !== this.constants.ENTITYTYPE.REFERENCE)
                throw new Error("Must be a Reference");

              result = self.map[x[y]].call(self, x, y);
              elements.push(result);
              break;
            }

            if (!result && typeof x[y] == "object") {
              if (self.map[x[y].type]) {
                result = self.map[x[y].type].call(self, x[y], y);
              } else {
                result = self.map[`${this.constants.ENTITYTYPE.OBJECT}`].call(
                  self,
                  x[y],
                  y
                );
              }
            }
            if (!result) throw new Error("unknown type , could not parse");

            elements.push(result);
          }

          return elements;
        };

        ElementsConverter.prototype.firstWord = function(string) {
          return string[0].toUpperCase() + string.substring(1);
        };
        exports = ElementsConverter;
      }).getFunctionBody(),
      constants.UIDS.LIB.CONVERT_SCHEMA_TO_ELEMENTS
    )
    .createLib(
      (() => {
        /**
         * Retrieves an entity
         * @param {string} entityName Name of the entity to fetch
         * @param {string} entityLabel Prop used to the label for each entity fetched
         * @param {function} extend Function used to extend each item feched [optional]
         * @param {Callback} fn Callback function
         */
        exports = function(entityName, entityLabel, extend, fn) {
          var options,
            query = {},
            self = this,
            args = this.args,
            entity = entityName;
          if (Array.prototype.slice.call(arguments).length == 3) {
            fn = extend;
            extend = null;
          }
          if (this.args && this.args.count) {
            options = {
              limit: this.args.count,
              sort: this.args.sort || {
                _id: -1
              }
            };
            if (this.args.depth) {
              options.full = true;
            }
            if (this.args._id)
              if (this.args.prev) {
                query._id = {
                  $gt: this.args._id
                };
                options.sort._id = 1;
              } else {
                query._id = {
                  $lt: this.args._id
                };
              }
          }

          if (this.args.query) {
            this.debug("query exists....");
            Object.assign(query, this.libs.convertFilter(this.args.query));
            this.debug(query);
          }

          if (this.$checkDomain && this.args.$user.domain) {
            query.domain = { $in: [this.args.$user.domain, undefined, null] };
          }
          this.entityRepo.get(entity, query, options, function(er, x) {
            if (er) return fn(er);
            var result = !args.full
              ? x.map(function(z) {
                  return {
                    _id: z._id,
                    displayLabel: z[entityLabel]
                  };
                })
              : extend
              ? x.map(v => extend(v))
              : x;
            if (!args.count) fn(null, result);
            else {
              if (query._id) delete query._id;
              self.entityRepo.count(entity, query, function(er, count) {
                fn(er, {
                  items: result,
                  total: count
                });
              });
            }
          });
        };
      }).getFunctionBody(),
      constants.UIDS.LIB.GET_ENTITY
    )
    .createLib(
      (() => {
        //should be called with request scope.
        /**
         * Checks user authorization and password if required
         * @param {Callback} fn callback function
         */
        exports = function(fn) {
          //when using only password authentication.
          if (
            !this.args.$authorized &&
            !this.infrastructure.config.disableSecurity
          )
            return fn(new Error("Unauthorized"));
          const server = this.infrastructure.server;
          const user = this.args.$user;
          const password =
            this.args.$password ||
            (this.args.entity && this.args.entity.$password);
          if (!server)
            return fn(
              new Error(
                "Entity Repo does not provide a means of checking user password"
              )
            );

          if (!user || !password) return fn(new Error("Invalid Credentials"));

          server.checkPassword(
            user.domain,
            user.client.clientId,
            user.username,
            password,
            (er, valid) => {
              if (er) return fn(er);
              if (!valid) return fn(new Error("Invalid Credentials"));
              if (this.args.entity) delete this.args.entity.$password;
              fn();
            }
          );
        };
      }).getFunctionBody(),
      constants.UIDS.LIB.CHECK_USER_PASSWORD_AND_PRIVILEDGE
    ).libs;
};
