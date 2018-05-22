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
				function convertFilter(data, parent) {
					var query = {};
					Object.keys(data).forEach(function(key) {
						if (typeof data[key] === "string") {
							query[
								(parent && `${parent}.${key}`) || key
							] = new RegExp(data[key], "i");
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
								convertFilter(
									data[key],
									(parent && `${parent}.${key}`) || key
								)
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
		.createLib(
			(() => {
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
										errors.push(
											`Missing column(s) row:${i + 1}`
										);
										continue;
									}
									let _sortedKeys = keys.sort(),
										mustHave = requiredKeys.slice();

									for (
										var z = 0;
										z < _sortedKeys.length;
										z++
									) {
										if (rows[i][_sortedKeys[z]]) {
											mustHave.splice(
												mustHave.indexOf(
													_sortedKeys[z]
												),
												1
											);
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
						if (!data.items.length)
							return cb(new Error("file has no rows"));
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
							return cb(
								new Error(
									"error occurred processing file records"
								)
							);
						}
					}
					debugger;
					fileUpload.readFile(file, user, (er, data, description) => {
						if (er)
							return (
								this.debug(
									"An error occurred while reading uploaded file"
								),
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
									this.debug(
										"An error occurred while parsing uploaded file"
									),
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
											this.debug(
												"an error occurred in threadpool"
											),
											this.debug(er),
											fn(
												new Error(
													(Array.prototype.isPrototypeOf(
														er
													) &&
														er.join()) ||
														er
												)
											)
										);

									this.debug(result);

									this.debug(
										"thread pool work completed successfully"
									);

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
											entityRepo.create.bind(
												entityRepo,
												entityName,
												x
											)
										);
										//this.debug(tasks);

										this.async.parallel(tasks, er => {
											if (er)
												return (
													this.debug(
														"an error occurred while saving items"
													),
													fn(er)
												);

											this.debug("finished!!!!");

											fn(
												null,
												"Successfully uploaded records"
											);
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
				function create(
					entityName,
					entityLabel,
					menuGroup,
					menuCategory,
					schema,
					fn
				) {
					this.debug(`creating crud for entity ${entityName}`);
					debugger;
					let constants = this.constants,
						self = this,
						title = `Manage ${entityName}`,
						create_uid = `CREATE_${entityName}_${Math.ceil(
							Math.random() * 10
						)}`,
						update_uid = `UPDATE_${entityName}_${Math.ceil(
							Math.random() * 10
						)}`,
						get_uid = `GET_${entityName}_${Math.ceil(
							Math.random() * 10
						)}`,
						template = [this.libs.createId()],
						userManager = self.entityRepo.infrastructure()
							.userManager;
					if (!userManager)
						return fn(
							new Error(
								"Entity Repo does not provide a means of reating menus"
							)
						);

					this.async.waterfall(
						[
							this.async.parallel.bind(this.async, [
								this.entityRepo.saveProcessor.bind(
									this.entityRepo,
									{
										title: `Create ${entityName}`,
										code: `this.debug('creating new ${entityName}...'); \n this.entityRepo.create('${entityName}',this.args.entity,callback)`,
										uid: create_uid
									}
								),
								this.entityRepo.saveProcessor.bind(
									this.entityRepo,
									{
										title: `Update ${entityName}`,
										uid: update_uid,
										code: `this.debug('update ${entityName}...'); \n this.entityRepo.update('${entityName}',this.args.entity,callback)`
									}
								),
								this.entityRepo.saveProcessor.bind(
									this.entityRepo,
									{
										title: `Get ${entityName}`,
										uid: get_uid,
										code: `this.debug('fetching ${entityName}...');\nthis.$checkDomain=true; \nthis.libs.getEntity.call(this,'${entityName}','${entityLabel}',callback);`
									}
								)
							]),
							(_processors, callback) => {
								this.entityRepo.getProcessor(
									{
										uid: {
											$in: [
												create_uid,
												update_uid,
												get_uid,
												this.constants.UIDS.PROCESSOR
													.LIST_ENTITY_GENERIC
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
													this.constants.UIDS
														.PROCESSOR
														.LIST_ENTITY_GENERIC !==
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
											userManager.saveClaim(
												{
													type:
														userManager.constants
															.CLAIMS.PROCESSOR,
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
										userManager.addClaimToRole.bind(
											userManager,
											userManager.defaultRole,
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
										new Error(
											"Cannot locate all the required processors"
										)
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
								`finished conversion :${JSON.stringify(
									template,
									null,
									" "
								)}`
							);
							template.push(
								self.libs.createElement(
									"password",
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
								uid:
									`${entityName}_CRUD_` +
									Math.ceil(Math.random() * 10),
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
														mode:
															constants.GRIDMODE
																.CRUD,
														source:
															result[get_uid]._id,
														gridArgs: `{"entityName":"${entityName}","entityLabel":"${entityLabel}"}`,
														filter: [
															self.libs.createElement(
																`${entityLabel}`,
																`By ${entityLabel[0].toUpperCase() +
																	entityLabel.substring(
																		1
																	)}`,
																"",
																constants
																	.ELEMENTTYPE
																	.INPUT
															)
														],
														templateConfig: `{"name":"basic","config":{"${entityLabel ||
															"name"}":"Title"}}`,
														commands: [],
														extra: {
															createTemplate: template,
															createProcessor:
																result[
																	create_uid
																]._id,
															editTemplate: template,
															editProcessor:
																result[
																	update_uid
																]._id
														}
													}
												)
											]
										}
									}
								]
							};

							self.entityRepo.saveProcess(
								processInstance,
								(er, proc) => {
									if (er) return fn(er);

									this.async.waterfall(
										[
											userManager.saveClaim.bind(
												userManager,
												{
													type:
														userManager.constants
															.CLAIMS.PROCESS,
													description: title,
													value: proc._id
												}
											),
											function(result) {
												var args = Array.prototype.slice.call(
													arguments
												);
												var callback =
													args[args.length - 1];
												userManager.addClaimToRole(
													userManager.defaultRole,
													null,
													result,
													function(er, role) {
														if (er)
															return callback(er);
														callback(null, result);
													}
												);
											},
											function(result, callback) {
												userManager.saveMenu(
													{
														displayLabel: title,
														group: menuGroup,
														icon: "process",
														claims: [result._id],
														type: "DYNAMO",
														value: proc._id,
														activated: true,
														category:
															menuCategory ||
															"MAINMENU",
														client:
															userManager
																.webClient
																.clientId
													},
													callback
												);
											}
										],
										function(er) {
											if (er) return fn(er);

											return fn(
												null,
												"successfully created crud process"
											);
										}
									);
								}
							);
						}
					);
				}

				exports = create;
			}).getFunctionBody(),
			constants.UIDS.LIB.CREATE_CRUD_PROCESS
		)
		.createLib(
			(() => {
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
								if (typeof holder[lib.uid] !== "undefined")
									return holder;
								var _l = lib.load(holder);
								//loaded[lib.uid] = 1;
								(lib._references || []).forEach(x => {
									if (typeof holder[x] == "undefined")
										moreLibs[x] = 1;
								});
								return _l;
							} catch (e) {
								this.debug(
									`failed to load library ${lib.title} id:${lib._id}`
								);
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
			`exports=${misc.toCamelCase.toString()}`,
			constants.UIDS.LIB.TO_CAMEL_CASE
		)
		.createLib(
			`exports=${misc.createElement.toString()}`,
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
				function ElementsConverter(libs, processors, constants) {
					this.libs = libs;
					this.processors = processors;
					this.constants = constants;
					//debug("elements converter constructor called");
					this.map = {
						[this.constants.ENTITYTYPE.STRING]: function(
							data,
							name
						) {
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
						[this.constants.ENTITYTYPE.NUMBER]: function(
							data,
							name
						) {
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
						[this.constants.ENTITYTYPE.BOOLEAN]: function(
							data,
							name
						) {
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
						[this.constants.ENTITYTYPE.OBJECT]: function(
							data,
							name
						) {
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
						[this.constants.ENTITYTYPE.ARRAY]: function(
							data,
							name
						) {
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
						[this.constants.ENTITYTYPE.REFERENCE]: function(
							data,
							name
						) {
							return this.libs.createElement(
								name,
								this.firstWord(name),
								"",
								this.constants.ELEMENTTYPE.SELECT,
								{
									type: this.constants
										.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
									config: {
										value: this.processors[
											this.constants.UIDS.PROCESSOR
												.LIST_ENTITY_GENERIC
										]._id
									},
									customArgs: `{"entityName":"${data.ref}",entityLabel:"name"}`
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
							result = self.map[
								this.constants.ENTITYTYPE.ARRAY
							].call(self, x[y], y);
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
								result = self.map[x[y].type].call(
									self,
									x[y],
									y
								);
							} else {
								result = self.map[
									`${this.constants.ENTITYTYPE.OBJECT}`
								].call(self, x[y], y);
							}
						}
						if (!result)
							throw new Error("unknown type , could not parse");

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
				//should be called with request scope.
				exports = function(fn) {
					if (!this.args.$authorized)
						return fn(new Error("Unauthorized"));
					let userManager = this.entityRepo.infrastructure()
							.userManager,
						user = this.args.$user,
						password =
							this.args.password ||
							(this.args.entity && this.args.entity.password);
					if (!userManager)
						return fn(
							new Error(
								"Entity Repo does not provide a means of checking user password"
							)
						);

					if (!user || !password)
						return fn(new Error("Invalid Credentials"));

					userManager.checkPassword(
						user.domain,
						user.client.clientId,
						user.username,
						password,
						(er, valid) => {
							if (er) return fn(er);
							if (!valid)
								return fn(new Error("Invalid Credentials"));
							fn();
						}
					);
				};
			}).getFunctionBody(),
			constants.UIDS.LIB.CHECK_USER_PASSWORD_AND_PRIVILEDGE
		).libs;
};
