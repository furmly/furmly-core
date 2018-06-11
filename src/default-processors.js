module.exports = function(constants, systemEntities) {
	var _ = require("lodash"),
		debug = require("debug")("default-processors");
	require("./misc");

	function createProcessor(title, code, uid, standalone = true) {
		if (!uid) {
			debug(arguments);
			throw new Error("Every default processor must have a uid");
		}
		if (!this.processors) {
			this.processors = {};
			this.createProcessor = createProcessor.bind(this);
		}

		this.processors[uid] = {
			title: title,
			code: code,
			uid: uid,
			requiresIdentity: true,
			standalone
		};
		return this;
	}

	let createProcessCode = (() => {
			this.libs.isAuthorized.call(this, er => {
				if (er) return callback(er);
				this.entityRepo.saveProcess(
					this.args.process,
					{ retrieve: true },
					(er, proc) => {
						if (er) return callback(er);
						if (!this.args.createClaim)
							return callback(
								null,
								`Saved ${this.args.process.title}'`
							);
						if (this.args.createClaim) {
							let inf = this.entityRepo.infrastructure();
							if (!inf || !inf.userManager)
								return (
									this.debug(
										"infrastructure not available for create process"
									),
									callback(
										new Error(
											"infrastructure is not available"
										)
									)
								);

							if (!this.args.process._id) {
								let _processors = proc.steps.reduce(
									(sum, x, index) => {
										return x.processors.reduce((o, v) => {
											return o.push(v), o;
										}, sum);
									},
									[]
								);
								this.async.parallel(
									_processors.map(x =>
										inf.userManager.saveClaim.bind(
											inf.userManager,
											{
												type:
													inf.userManager.constants
														.CLAIMS.PROCESSOR,
												description: x.title,
												value: x._id
											}
										)
									),
									er => {
										if (er)
											return (
												this.debug(
													`an error occurred while attempting to save claims for processes processors ${er.message}`
												),
												this.debug(er)
											);
									}
								);
							}

							inf.userManager.getClaims(
								{ value: proc._id },
								(er, claim) => {
									if (er)
										return (
											this.debug(
												"error occurred while querying claims"
											),
											callback(er)
										);
									if (!claim || !claim.length)
										return inf.userManager.saveClaim(
											{
												type:
													inf.userManager.constants
														.CLAIMS.PROCESS,
												description: `${proc.title}`,
												value: proc._id
											},
											er => {
												if (er) return callback(er);
												callback(
													null,
													`Successfully saved '${proc.title}' and claim`
												);
											}
										);

									return callback(
										null,
										`Saved '${this.args.process.title}'`
									);
								}
							);
						}
					}
				);
			});
		}).getFunctionBody(),
		createProcessorCode = (() => {
			this.libs.isAuthorized.call(this, er => {
				if (er) return callback(er);
				this.entityRepo.saveProcessor(
					this.args.entity,
					{ retrieve: true },
					(er, _p) => {
						if (er) return callback(er);
						const success = () =>
							callback(null, {
								message: `Successfully saved ${_p.title}`
							});
						if (this.args.entity.createClaim) {
							let um = this.entityRepo.infrastructure()
								.userManager;
							um.getClaims(
								{ value: _p._id.toString() },
								(er, claims) => {
									if (!er && !claims.length) {
										return um.saveClaim(
											{
												type:
													um.constants.CLAIMS
														.PROCESSOR,
												description: _p.title,
												value: _p._id.toString()
											},
											er => {
												if (!er) {
													return callback(null, {
														message: `Successfully saved ${_p.title} and Claim`
													});
												}
												return success();
											}
										);
									}
									return success();
								}
							);
							return;
						}

						return success();
					}
				);
			});
		}).getFunctionBody(),
		createLibCode = (() => {
			this.libs.isAuthorized.call(this, er => {
				if (er) return callback(er);
				this.entityRepo.saveLib(this.args.entity, callback);
			});
		}).getFunctionBody(),
		fetchProcessCode = (() => {
			let query = this.args._id
				? {
						$or: [
							{
								_id: this.args._id
							},
							{
								uid: this.args._id
							}
						]
					}
				: null;
			if (query)
				this.entityRepo.getProcess(
					query,
					{
						full: true,
						noTransformaton: true
					},
					(er, proc) => {
						if (er) return callback(er);

						callback(
							null,
							proc.length
								? {
										process: proc[0]
									}
								: null
						);
					}
				);
			else callback(null, null);
		}).getFunctionBody(),
		listEntityTemplate = (() => {
			var options,
				query = {},
				self = this,
				args = this.args,
				entity = $entity;
			if (this.args && this.args.count) {
				options = {
					limit: this.args.count,
					sort: this.args.sort || {
						_id: -1
					}
				};
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

				if (this.args.query)
					Object.assign(
						query,
						this.libs.convertFilter(this.args.query)
					);
			}
			this.entityRepo.$get($parameters, options, function(er, x) {
				if (er) return callback(er);
				var result = !args.full
					? x.map(function(z) {
							return {
								_id: z._id,
								displayLabel: z$label
							};
						})
					: x;
				if (!args.count) callback(null, result);
				else {
					if (query._id) delete query._id;
					self.entityRepo.count(entity, query, function(er, count) {
						callback(er, {
							items: result,
							total: count
						});
					});
				}
			});
		}).getFunctionBody(),
		fetchEntityTemplate = (() => {
			this.entityRepo.get(
				$entity,
				{
					_id: this.args._id
				},
				callback
			);
		}).getFunctionBody(),
		fetchSchemaCode = (() => {
			var self = this;
			this.entityRepo.getSchema(this.args.name, function(er, code) {
				if (er) return callback(er);

				var result = {
					choice: "Code",
					name: self.args.name,
					template: {
						value: JSON.stringify(code, null, " ")
					}
				};
				callback(null, result);
			});
		}).getFunctionBody(),
		listEntitySchemaCode = (() => {
			var options,
				query = {},
				self = this,
				args = this.args;
			if (this.args && this.args.count) {
				options = {
					limit: this.args.count,
					sort: this.args.sort || {
						_id: -1
					}
				};
				if (this.args._id)
					if (this.args.prev) {
						query._id = {
							$gt: this.entityRepo.createId(this.args._id)
						};
						options.sort._id = 1;
					} else {
						query._id = {
							$lt: this.entityRepo.createId(this.args._id)
						};
					}

				if (this.args.query)
					Object.assign(
						query,
						this.libs.convertFilter(this.args.query)
					);
			}

			this.debug(query);
			this.entityRepo.getSchemas(
				args.full,
				false,
				query,
				options,
				function(er, x) {
					if (er) return callback(er);
					var result = !args.full
						? x.map(function(z) {
								return {
									_id: z,
									displayLabel: z
								};
							})
						: x;
					if (!args.count) callback(null, result);
					else {
						if (query._id) delete query._id;
						self.entityRepo.countSchemas(query, function(
							er,
							count
						) {
							callback(er, {
								items: result,
								total: count
							});
						});
					}
				}.bind(this)
			);
		}).getFunctionBody(),
		createSchemaCode = (() => {
			function resolve(type, data) {
				const parsePropertyWithName = (template, x) => {
					if (x.propertyType == this.constants.ENTITYTYPE.OBJECT) {
						template[
							x.propertyName || x.props.propertyName
						] = parse(x.props.properties);
						return;
					}
					if (x.propertyType == this.constants.ENTITYTYPE.ARRAY) {
						template[x.propertyName || x.props.propertyName] = [
							parse(x.props.properties)
						];
						return;
					}

					if (x.propertyType == this.constants.ENTITYTYPE.REFERENCE) {
						template[x.propertyName || x.props.propertyName] = {
							type: "ObjectId",
							ref: x.props.ref
						};
						return;
					}

					template[x.propertyName || x.props.propertyName] = {
						type: x.propertyType
					};
				};

				const parsePropertyWithoutName = (template, x) => {
					if (x.propertyType !== this.constants.ENTITYTYPE.REFERENCE)
						throw new Error(
							"all entity types must have a propertyName except REFERENCE"
						);

					template.type = "ObjectId";
					template.ref = x.props.ref;
				};

				const parse = data => {
					var template = {};
					data.forEach(x => {
						if (
							x.propertyName ||
							(x.props && x.props.propertyName)
						) {
							parsePropertyWithName(template, x);
						} else {
							parsePropertyWithoutName(template, x);
						}
					});
					return template;
				};
				switch (type) {
					case "Code":
						return JSON.parse(data);
					case "Gui":
						return parse(data);
				}
			}

			var data = resolve.call(
					this,
					this.args.entity.choice,
					this.args.entity.template.value
				),
				self = this;
			this.debug(
				"entity to create--------:\n" +
					JSON.stringify(data) +
					"\n-----------:"
			);
			this.libs.isAuthorized.call(this, er => {
				if (er) return callback(er);
				this.entityRepo.createSchema(
					this.args.entity.name,
					data,
					er => {
						if (er) return callback(er);

						if (
							self.args.entity.createCRUD &&
							self.args.entity.displayProperty
						) {
							//create a crud process for this entity.
							self.libs.createCRUDProcess.call(
								self,
								self.args.entity.name,
								self.args.entity.displayProperty,
								self.args.entity.group,
								self.args.entity.category,
								data,
								(er, result) => {
									if (er)
										//delete what you just created this.entityRepo.deleteSchema()
										return (
											this.debug(
												"an error occurred while creating schema ..rolling back"
											),
											callback(er)
										);

									callback(null, result);
								}
							);
							return;
						}
						callback(null, "Successfully created config");
					}
				);
			});
		}).getFunctionBody(),
		updateSchemaCode = (() => {
			this.libs.isAuthorized.call(this, er => {
				if (er) return callback(er);
				this.entityRepo.updateSchema(
					this.args.entity.name,
					JSON.parse(this.args.entity.template.value),
					callback
				);
			});
		}).getFunctionBody();

	return createProcessor
		.call(
			{},
			"Lists Entities per query",
			listEntityTemplate
				.replace("$entity", "args.entityName")
				.replace("$get", "get")
				.replace("$parameters", "entity,query")
				.replace("$label", "[args.entityLabel]"),
			constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC
		)
		.createProcessor(
			"Lists processors",
			listEntityTemplate
				.replace("$entity", `'${systemEntities.processor}'`)
				.replace("$get", "getProcessor")
				.replace("$parameters", "query")
				.replace("$label", ".title"),
			constants.UIDS.PROCESSOR.LIST_PROCESSORS
		)
		.createProcessor(
			"Lists async validators",
			listEntityTemplate
				.replace("$entity", `'${systemEntities.asyncValidator}'`)
				.replace("$get", "getAsyncValidator")
				.replace("$parameters", "query")
				.replace("$label", ".title"),
			constants.UIDS.PROCESSOR.LIST_ASYNC_VALIDATORS
		)
		.createProcessor(
			"Lists processes",
			listEntityTemplate
				.replace("$entity", `'${systemEntities.process}'`)
				.replace("$get", "getProcess")
				.replace("$parameters", "query")
				.replace("$label", ".title"),
			constants.UIDS.PROCESSOR.LIST_PROCESSES
		)
		.createProcessor(
			"Lists libs",
			listEntityTemplate
				.replace("$entity", `'${systemEntities.lib}'`)
				.replace("$get", "getLib")
				.replace("$parameters", "query")
				.replace("$label", ".uid"),
			constants.UIDS.PROCESSOR.LIST_LIBS
		)
		.createProcessor(
			"List steps",
			listEntityTemplate
				.replace("$entity", `'${systemEntities.lib}'`)
				.replace("$get", "getStep")
				.replace("$parameters", "query")
				.replace("$label", ".description"),
			constants.UIDS.PROCESSOR.LIST_STEPS
		)
		.createProcessor(
			"Lists input types",
			(() => {
				const getElementsFor = elementType => {
					const getDateUI = name => {
						return this.libs.createElement(
							name,
							`${name}`,
							"",
							this.constants.ELEMENTTYPE.SELECTSET,
							{
								path: `${name}Config`,
								items: [
									{
										id: "DATE",
										displayLabel: "date",
										elements: [
											this.libs.createElement(
												"date",
												"Date",
												"",
												this.constants.ELEMENTTYPE
													.INPUT,
												{
													type: this.constants
														.INPUTTYPE.DATE
												}
											)
										]
									},
									{
										id: this.constants.DATE.TODAY,
										displayLabel: "today",
										elements: []
									}
								]
							}
						);
					};
					switch (elementType) {
						case this.constants.INPUTTYPE.DATE:
							return [
								getDateUI("min"),
								getDateUI("max"),
								this.libs.createElement(
									"isRange",
									"Range ?",
									"",
									this.constants.ELEMENTTYPE.INPUT,
									{ type: this.constants.INPUTTYPE.CHECKBOX }
								)
							];
						default:
							return [];
					}
				};
				callback(
					null,
					Object.keys(this.constants.INPUTTYPE).map(x => {
						let id = this.constants.INPUTTYPE[x];
						return {
							id,
							displayLabel: id,
							elements: getElementsFor(id)
						};
					})
				);
			}).getFunctionBody(),
			constants.UIDS.PROCESSOR.LIST_INPUT_TYPES
		)
		.createProcessor(
			"Lists element types",
			"callback(null,Object.keys(this.constants.ELEMENTTYPE).map(function(x){return {_id:x,displayLabel:x}; })); ",
			constants.UIDS.PROCESSOR.LIST_ELEMENT_TYPES
		)
		.createProcessor(
			"Fetch Process",
			fetchProcessCode,
			constants.UIDS.PROCESSOR.FETCH_PROCESS
		)
		.createProcessor(
			"Create Process",
			createProcessCode,
			constants.UIDS.PROCESSOR.CREATE_PROCESS
		)
		.createProcessor(
			"Create or Edit Processor",
			createProcessorCode,
			constants.UIDS.PROCESSOR.CREATE_PROCESSOR
		)
		.createProcessor(
			"Create or Edit Lib",
			createLibCode,
			constants.UIDS.PROCESSOR.CREATE_LIB
		)
		.createProcessor(
			"Fetch a single Entity",
			fetchEntityTemplate.replace("$entity", "this.args.entityName"),
			constants.UIDS.PROCESSOR.FETCH_ENTITY
		)
		.createProcessor(
			"Menu Filter",
			"\nlet commands= this.libs.menuFilters;\nif(!commands||!Array.prototype.isPrototypeOf(commands) ||!commands.length)\ncallback(null,this.args.menu);else {\n\n\ncommands[0]=commands[0].bind(this,this.args.menu);\n\nthis.async.waterfall(commands.map(command=>{\n    return command.bind(this);\n}),(er,menu)=>{\n    if(er) return callback(er);\n    \n    callback(null,menu);\n}); }\n",
			constants.UIDS.PROCESSOR.MENU_FILTER
		)
		.createProcessor(
			"List schemas",
			listEntitySchemaCode,
			constants.UIDS.PROCESSOR.LIST_ENTITY_SCHEMAS
		)
		.createProcessor(
			"Fetch schema",
			fetchSchemaCode,
			constants.UIDS.PROCESSOR.FETCH_SCHEMA
		)
		.createProcessor(
			"Create Schema",
			createSchemaCode,
			constants.UIDS.PROCESSOR.CREATE_SCHEMA
		)
		.createProcessor(
			"Get Domains",
			"let inf=this.entityRepo.infrastructure(); if(!inf||!inf.userManager)callback(new Error('infrastructure not properly setup'));else inf.userManager.getDomains({}||this.args.query,(er,domains)=>{if(er) return callback(er); callback(null,this.libs.convertToSelectableList('name',domains));})",
			constants.UIDS.PROCESSOR.GET_DOMAINS
		)
		.createProcessor(
			"Update Schema",
			updateSchemaCode,
			constants.UIDS.PROCESSOR.UPDATE_SCHEMA
		).processors;
};
