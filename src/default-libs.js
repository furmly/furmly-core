/*jshint esversion: 6 */
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
				function convertFilter(data) {
					var query = {};
					Object.keys(data).forEach(function(key) {
						if (typeof data[key] == "string") {
							query[key] = new RegExp(data[key], "i");
							return;
						}
						if (typeof data[key] == "object" && !RegExp.prototype.isPrototypeOf(data[key])) {
							query[key] = convertFilter(data[key]);
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
		// .createLib((()=>{
		// 	exports=function(){

		// 	}
		// }).getFunctionBody(),constants.UIDS.LIB.CONVERT_AND_SAVE_FILE)
		.createLib(
			(() => {
				function create(entityName, entityLabel, menuGroup, menuCategory, schema, fn) {
					debug(`creating crud for entity ${entityName}`);
					let constants = this.constants,
						self = this,
						title = `Manage ${entityName}`,
						create_uid = `CREATE_${entityName}_${Math.ceil(Math.random() * 10)}`,
						update_uid = `UPDATE_${entityName}_${Math.ceil(Math.random() * 10)}`,
						template = [this.libs.createId()];

					async.waterfall(
						[
							callback => {
								this.entityRepo.saveProcessor(
									{
										title: `Create ${entityName}`,
										code: `debug('creating new ${entityName}...'); \n this.entityRepo.create('${entityName}',this.args.entity,callback)`,
										uid: create_uid
									},
									{ retrieve: true },
									(er, proc) => {
										if (er) return callback(er);
										this.entityRepo.saveProcessor(
											{
												title: `Update ${entityName}`,
												uid:update_uid,
												code: `debug('update ${entityName}...'); \n this.entityRepo.update('${entityName}',this.args.entity,callback)`
											},
											{ retrieve: true },
											(er, proc) => {
												if (er) return callback(er);
												this.entityRepo.getProcessor(
													{ uid:{ $in:[create_uid, update_uid, constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC]} },
													(er, list) => {
														if (er) return callback(er);
														//console.log(list);
														return callback(null, list);
													}
												);
											}
										);
									}
								);
							},
							(processors, callback) => {
								if (processors.length !== 3) return callback(new Error("Cannot locate all the required processors"));

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
							console.log('here');

							debug("located crud processors...\n converting schema to template...");
							template = template.concat(new self.libs.ElementsConverter(self.libs, result, constants).convert(schema));
							debug(`finished conversion :${JSON.stringify(template, null, " ")}`);
							template.push(
								self.libs.createElement("password", "Enter Password (Current User)", "", constants.ELEMENTTYPE.INPUT, { type: constants.INPUTTYPE.PASSWORD })
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
														source: result[constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC]._id,
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
									}
								]
							};

							self.entityRepo.saveProcess(processInstance, function(er, proc) {
								if (er) return fn(er);

								let userManager = self.entityRepo.infrastructure().userManager;
								if (!userManager) return fn(new Error("Entity Repo does not provide a means of creating menus"));
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
											userManager.saveMenu(
												{
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
						debug(`converter called with arguments ${JSON.stringify(arguments, null, " ")}`);
						return this.libs.createElement(name, this.firstWord(name), "", this.constants.ELEMENTTYPE.SELECT, {
							type: this.constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
							config: {
								value: this.processors[this.constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC]._id
							},
							customArgs: `{"entityName":"${data.ref}",entityLabel:"displayLabel"}`
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
