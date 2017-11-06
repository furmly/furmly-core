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
		.call({},
			(() => {
				function convertFilter(data) {
					var query = {};
					Object.keys(data).forEach(function(key) {
						if (typeof data[key] == "string") {
							query[key] = new RegExp(data[key], "i");
							return;
						}
						if (typeof data[key] == "object" && !RegExp.prototype.isPrototypeOf(data[key]) && !data[key].isObjectID) {
							query[key] = convertFilter(data[key]);
							return;
						}
						if (typeof data[key] == "object" && data[key].isObjectID) {
							query[key] = data[key].value;
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
				function convert(prop, list) {
					if (Array.prototype.slice.call(arguments).length == 1) {
						list = prop;
						prop = null;
					}
					return list.map(x => ({
						displayLabel: prop ? x[prop] : x,
						_id: x._id || x
					}));
				}
				exports = convert;
			}).getFunctionBody(),
			constants.UIDS.LIB.CONVERT_TO_SELECTABLE_LIST
		)
		.createLib((() => {
			function convert(entityName, file, context, checks, extend, fileUpload, fileParser, threadPool, entityRepo, fn) {
				function getDefaultChecks(_keys) {
					return (function(rows, cb) {
						let errors = [],
							requiredKeys = _keys.sort();
						console.log(`sorted keys ${requiredKeys}`);
						try {


							for (var i = 0; i < rows.length; i++) {
								let keys = Object.keys(rows[i]);
								if (keys.length < requiredKeys.length) {
									errors.push(`Missing column(s) row:${i+1}`);
									continue;
								}
								let _sortedKeys = keys.sort(),
									mustHave = requiredKeys.slice();

								for (var z = 0; z < _sortedKeys.length; z++) {
									if (rows[i][_sortedKeys[z]]) {
										mustHave.splice(mustHave.indexOf(_sortedKeys[z]), 1);
									}
								}
								if (mustHave.length)
									errors.push(`row ${i+1} does not have a valid value for column(s) ${mustHave.join(',')}`);
							}
							console.log(errors)
							if (errors.length) return cb(errors.join('|'));

							cb(null, rows);
						} catch (e) {
							cb(e);
						}
					}).toString().replace('_keys', JSON.stringify(_keys));
				};

				fileUpload.readFile(file, (er, data, description) => {
					if (er) return debug('An error occurred while reading uploaded file'), debug(er), fn(new Error('Error occurred while attempting to read uploaded file'));

					fileParser.parseOnly(description, data, (er, rows) => {
						if (er) return debug('An error occurred while parsing uploaded file'), debug(er), fn(new Error('Error occurred while attempting to parse uploaded file'));

						let process =
							"    console.log('its running at all');" +
							"    if(!data.items.length) return cb(new Error('file has no rows'));" +
							"    let _innerChecks='{i}';" +
							"    try{" +
							"        console.log('converting items...');" +
							"        let joined = data.items.map((x,ind)=>{" +
							"           return Object.assign({},x,data.rest||{});" +
							"        });" +
							"        console.log('conversion successful');" +
							"        if(!_innerChecks)return cb(null,joined);" +
							"        _innerChecks(joined,(er)=>{" +
							"            if(er) return cb(er);" +

							"            cb(null,joined);" +
							"        });" +

							"    }catch(e){" +
							"        return cb(new Error('error occurred processing file records'));" +
							"    }";


						debug(rows);

						let _checks = !checks ? '' : (Function.prototype.isPrototypeOf(checks)) ? checks.toString() : getDefaultChecks(checks),
							_process = new Function('data', 'cb', process.replace('\'{i}\'', _checks));

						threadPool.run({
							items: rows,
							rest: context
						}, _process, function(er, result) {

							if (er) return debug('an error occurred in threadpool'), debug(er), fn(new Error(Array.prototype.isPrototypeOf(er) && er.join() || er));

							debug(result);

							debug('thread pool work completed successfully');

							extend = extend || function(list, cb) {
								setImmediate(cb, null, list);
							};
							debug('finished setting up extend');
							//debug(extend);
							debug(extend.toString());
							extend(result, (er, extendedResult) => {
								debug('got here');
								if (er) return fn(er);

								debug(extendedResult);
								let tasks = extendedResult.map(x => (entityRepo.create.bind(entityRepo, entityName, x)));
								//debug(tasks);

								async.parallel(tasks, function(er) {
									if (er) return debug('an error occurred while saving items'), fn(er);

									debug('finished!!!!');

									fn(null, 'Successfully uploaded records');
								});
							})



						});
					});
				});
			}



			exports = convert;

		}).getFunctionBody(), constants.UIDS.LIB.CONVERT_AND_SAVE_FILE)
		.createLib(
			(() => {
				function create(entityName, entityLabel, menuGroup, menuCategory, schema, fn) {
					debug(`creating crud for entity ${entityName}`);

					let constants = this.constants,
						self = this,
						title = `Manage ${entityName}`,
						create_uid = `CREATE_${entityName}_${Math.ceil(Math.random() * 10)}`,
						update_uid = `UPDATE_${entityName}_${Math.ceil(Math.random() * 10)}`,
						get_uid = `GET_${entityName}_${Math.ceil(Math.random() * 10)}`,
						template = [this.libs.createId()],
						userManager = self.entityRepo.infrastructure().userManager;
					if (!userManager) return fn(new Error("Entity Repo does not provide a means of reating menus"));

					async.waterfall(
						[
							callback => {
								this.entityRepo.saveProcessor({
										title: `Create ${entityName}`,
										code: `debug('creating new ${entityName}...'); \n this.entityRepo.create('${entityName}',this.args.entity,callback)`,
										uid: create_uid
									}, {
										retrieve: true
									},
									(er, proc) => {
										if (er) return callback(er);
										this.entityRepo.saveProcessor({
												title: `Update ${entityName}`,
												uid: update_uid,
												code: `debug('update ${entityName}...'); \n this.entityRepo.update('${entityName}',this.args.entity,callback)`
											}, {
												retrieve: true
											},
											(er, proc) => {
												if (er) return callback(er);

												this.entityRepo.saveProcessor({
													title: `Get ${entityName}`,
													uid: get_uid,
													code: `debug('fetching ${entityName}...');\nthis.$checkDomain=true; \nthis.libs.getEntity.call(this,'${entityName}','${entityLabel}',callback);`
												}, (er, pr) => {
													if (er) return callback(er);

													this.entityRepo.getProcessor({
															uid: {
																$in: [create_uid, update_uid, get_uid, this.constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC]
															}
														},
														(er, list) => {
															if (er) return callback(er);
															debug(list);
															let _list = list.slice().filter(x => this.constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC !== x.uid);
															async.parallel(_list.map(v => userManager.saveClaim.bind(userManager, {
																type: userManager.constants.CLAIMS.PROCESSOR,
																description: v.title,
																value: v._id
															})), (er, _claims) => {
																if (er) return callback(er);
                                                                debug(_claims);
																async.parallel(_claims.map(x => userManager.addClaimToRole.bind(userManager, userManager.defaultRole, null, x[0])), (er) => {
																	if (er) return callback(er);
																	return callback(null, list);
																});


															});



														}
													);

												});



											}
										);
									}
								);
							},
							(processors, callback) => {
								if (processors.length !== 4) return callback(new Error("Cannot locate all the required processors"));

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

							debug("located crud processors...\n converting schema to template...");
							template = template.concat(new self.libs.ElementsConverter(self.libs, result, constants).convert(schema));
							debug(`finished conversion :${JSON.stringify(template, null, " ")}`);
							template.push(
								self.libs.createElement("password", "Enter Password (Current User)", "", constants.ELEMENTTYPE.INPUT, {
									type: constants.INPUTTYPE.PASSWORD
								})
							);

							var processInstance = {
								title: title,
								description: `System administators can create and edit existing ${entityName}`,
								uid: `${entityName}_CRUD_` + Math.ceil(Math.random() * 10),
								steps: [{
									stepType: constants.STEPTYPE.CLIENT,
									mode: constants.STEPMODE.VIEW,
									processors: [],
									form: {
										elements: [
											self.libs.createElement(
												"grid",
												`Manage ${entityName}`,
												`This view lets administators manage ${entityName}`,
												constants.ELEMENTTYPE.GRID, {
													mode: constants.GRIDMODE.CRUD,
													source: result[get_uid]._id,
													gridArgs: `{"entityName":"${entityName}","entityLabel":"${entityLabel}"}`,
													filter: [
														self.libs.createElement(
															`${entityLabel}`,
															`By ${entityLabel[0].toUpperCase() + entityLabel.substring(1)}`,
															"",
															constants.ELEMENTTYPE.INPUT
														)
													],
													templateConfig: `{"name":"basic","config":{"${entityLabel || "name"}":"Title"}}`,
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
								}]
							};

							self.entityRepo.saveProcess(processInstance, function(er, proc) {
								if (er) return fn(er);

								async.waterfall(
									[
										userManager.saveClaim.bind(userManager, {
											type: userManager.constants.CLAIMS.PROCESS,
											description: title,
											value: proc._id
										}),
										function(result) {
											var args = Array.prototype.slice.call(arguments);
											var callback = args[args.length - 1];
											userManager.addClaimToRole(userManager.defaultRole, null, result, function(er, role) {
												if (er) return callback(er);
												callback(null, result);
											});
										},
										function(result, callback) {
											userManager.saveMenu({
													displayLabel: title,
													group: menuGroup,
													icon: "process",
													claims: [result._id],
													type: "DYNAMO",
													value: proc._id,
													category: menuCategory || "MAINMENU",
													client: userManager.webClient.clientId
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
		.createLib(`exports= ${misc.createElement.toString()}`, constants.UIDS.LIB.CREATE_ELEMENT)
		.createLib(
			(() => {
				exports = function() {
					return this.createElement("_id", "", "", constants.ELEMENTTYPE.HIDDEN);
				};
			}).getFunctionBody(),
			constants.UIDS.LIB.CREATE_ID
		)
		.createLib(
			(() => {

				function ElementsConverter(libs, processors, constants) {
					this.libs = libs;
					this.processors = processors;
					this.constants = constants;
					debug("elements converter constructor called");
				}
				ElementsConverter.prototype.convert = function(x) {
					let elements = [],
						keys = Object.keys(x),
						self = this;
					debug("converting---x");
					debug(x);
					debug("------x");
					debug("number of properties " + keys.length);
					debug(keys);

					for (var i = 0; i < keys.length; i++) {
						let result,
							y = keys[i];

						if (Array.prototype.isPrototypeOf(x[y])) {
							debug(`converting property ${y} which is an array ${JSON.stringify(x[y], null, " ")} `);
							result = self.map[`${constants.ENTITYTYPE.ARRAY}`].call(self, x[y], y);
							debug("array result-----x");
							debug(result);
							debug("------x");
						}
						if (typeof x[y] == "string" && self.map[x[y]]) {
							//this should only happen if entity is a reference in an array.
							debug(`converting property ${y} string ${x[y]}`);
							if (x[y] !== constants.ENTITYTYPE.REFERENCE) throw new Error("Must be a Reference");

							result = self.map[x[y]].call(self, x, y);
							debug("result-----x");
							debug(result);
							debug("------x");
							elements.push(result);
							break;
						}

						if (!result && typeof x[y] == "object") {
							debug(`converting property ${y} which is an object ${JSON.stringify(x[y], null, " ")} `);
							if (self.map[x[y].type]) {
								debug("type is known calling the appropriate type");
								result = self.map[x[y].type].call(self, x[y], y);
								debug("result-----x");
								debug(result);
								debug("-------x");
							} else {
								//it doesnt have a type therefore treat it like an object.
								debug("type is unknown so treating it like an object...");
								result = self.map[`${constants.ENTITYTYPE.OBJECT}`].call(self, x[y], y);
								debug("result-----x");
								debug(result);
								debug("-------x");
							}
						}
						if (!result) throw new Error("unknown type , could not parse");

						elements.push(result);
					}
					debug(`elements---------x\n ${JSON.stringify(elements, null, " ")}\n-------x`);

					return elements;
				};
				ElementsConverter.prototype.map = {
					[constants.ENTITYTYPE.STRING]: function(data, name) {
						debug(`converter called with arguments ${JSON.stringify(arguments, null, " ")}`);
						return this.libs.createElement(name, this.firstWord(name), "", this.constants.ELEMENTTYPE.INPUT, {
							type: constants.INPUTTYPE.TEXT
						});
					},
					[constants.ENTITYTYPE.NUMBER]: function(data, name) {
						debug(`converter called with arguments ${JSON.stringify(arguments, null, " ")}`);
						return this.libs.createElement(name, this.firstWord(name), "", this.constants.ELEMENTTYPE.INPUT, {
							type: constants.INPUTTYPE.NUMBER
						});
					},
					[constants.ENTITYTYPE.BOOLEAN]: function(data, name) {
						debug(`converter called with arguments ${JSON.stringify(arguments, null, " ")}`);
						return this.libs.createElement(name, this.firstWord(name), "", this.constants.ELEMENTTYPE.INPUT, {
							type: this.constants.INPUTTYPE.CHECKBOX
						});
					},
					[constants.ENTITYTYPE.DATE]: function(data, name) {
						debug(`converter called with arguments ${JSON.stringify(arguments, null, " ")}`);
						return this.libs.createElement(name, this.firstWord(name), "", this.constants.ELEMENTTYPE.INPUT, {
							type: constants.INPUTTYPE.DATE
						});
					},
					[constants.ENTITYTYPE.OBJECT]: function(data, name) {
						debug(`converter called with arguments ${JSON.stringify(arguments, null, " ")}`);
						return this.libs.createElement(name, this.firstWord(name), "", this.constants.ELEMENTTYPE.SECTION, {
							elements: this.convert(data)
						});
					},
					[constants.ENTITYTYPE.ARRAY]: function(data, name) {
						debug(`converter called with arguments ${JSON.stringify(arguments, null, " ")}`);
						return this.libs.createElement(name, this.firstWord(name), "", this.constants.ELEMENTTYPE.LIST, {
							itemTemplate: this.convert(data[0])
						});
					},
					[constants.ENTITYTYPE.REFERENCE]: function(data, name) {
						debug(`reference converter called with arguments ${JSON.stringify(arguments, null, " ")}`);
						return this.libs.createElement(name, this.firstWord(name), "", this.constants.ELEMENTTYPE.SELECT, {
							type: this.constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
							config: {
								value: this.processors[this.constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC]._id
							},
							customArgs: `{"entityName":"${data.ref}",entityLabel:"name"}`
						});
					}
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
				//should be called with request scope.
				exports = function(fn) {
					if (!this.args.$authorized) return fn(new Error("Unauthorized"));
					let userManager = this.entityRepo.infrastructure().userManager,
						user = this.args.$user,
						password = this.args.password || (this.args.entity && this.args.entity.password);
					if (!userManager) return fn(new Error("Entity Repo does not provide a means of checking user password"));

					if (!user || !password) return fn(new Error("Invalid Credentials"));

					userManager.checkPassword(user.domain, user.client.clientId, user.username, password, (er, valid) => {
						if (er) return fn(er);
						if (!valid) return fn(new Error("Invalid Credentials"));
						fn();
					});
				};
			}).getFunctionBody(),
			constants.UIDS.LIB.CHECK_USER_PASSWORD_AND_PRIVILEDGE
		).libs;
};