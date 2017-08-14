/*jshint esversion: 6 */
module.exports = function(constants) {
	var misc = require('./misc');


	function createLib(code, uid) {
		if (!uid) {

			throw new Error('Every default lib must have a uid');
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

	return createLib.call({}, (() => {
			function convertFilter(data) {
				var query = {};
				Object.keys(data).forEach(function(key) {
					if (typeof data[key] == 'string') {

						query[key] = new RegExp(data[key], "i");
						return;
					}
					if (typeof data[key] == 'object' && !RegExp.prototype.isPrototypeOf(data[key])) {
						query[key] = convertFilter(data[key]);
						return;
					}
					query[key] = data[key];
				});
				return query;
			}
			exports = convertFilter;
		}).getFunctionBody(), constants.UIDS.LIB.CONVERT_FILTER)
		.createLib((() => {
			function convert(prop, list) {

				if (Array.prototype.slice.call(arguments).length == 1) {
					list = prop;
					prop = null;
				}
				return list.map(x => ({
					displayLabel: (prop ? x[prop] : x),
					_id: x._id || x
				}));
			}
			exports = convert;
		}).getFunctionBody(), constants.UIDS.LIB.CONVERT_TO_SELECTABLE_LIST)
		.createLib((() => {

			function create(entityName, entityLabel, menuGroup, menuCategory, schema, fn) {
				let constants = this.constants,
					self = this,
					title = `Manage ${entityName}`,
					template = [
						this.libs.createId()
					];

				async.waterfall([
					(callback) => {
						this.entityRepo.get(this.systemEntities.processor, {
							uid: {
								$in: [constants.UIDS.PROCESSOR.CREATE_ENTITY, constants.UIDS.PROCESSOR.UPDATE_ENTITY, constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC]
							}
						}, callback);
					},
					(processors, callback) => {
						if (processors.length !== 3)
							return callback(new Error('Cannot locate all the required processors'));

						callback(null, processors.reduce((x, y) => {
							return x[y.uid] = y, x;
						}, {}));
					}
				], (er, result) => {
					if (er) return fn(er);


					template = template.concat(new self.libs.ElementsConverter(self.libs, result, constants).convert(schema));
					var processInstance = {
						title: title,
						description: `System administators can create and edit existing ${entityName}`,
						uid: `${entityName}_CRUD_` + (Math.random() * 10),
						steps: [{
							stepType: constants.STEPTYPE.CLIENT,
							mode: constants.STEPMODE.VIEW,
							processors: [],
							form: {
								elements: [
									self.libs.createElement('grid', `Manage ${entityName}`, `This view lets administators manage ${entityName}`, constants.ELEMENTTYPE.GRID, {
										mode: constants.GRIDMODE.CRUD,
										source: result[constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC]._id,
										gridArgs: `{"entityName":"${entityName}","entityLabel":"${entityLabel}"}`,
										filter: [
											self.libs.createElement(`${entityLabel}`, `By ${entityLabel[0].toUpperCase()+entityLabel.substring(1)}`, '', constants.ELEMENTTYPE.INPUT)
										],
										commands: [],
										extra: {
											createTemplate: template,
											createProcessor: result[constants.UIDS.PROCESSOR.CREATE_ENTITY]._id,
											editTemplate: template,
											editProcessor: result[constants.UIDS.PROCESSOR.UPDATE_ENTITY]._id
										}
									})
								]
							}
						}]

					};

					self.entityRepo.saveProcess(processInstance, function(er, proc) {
						if (er) return fn(er);

						let userManager = self.entityRepo.infrastructure().userManager;
						if (!userManager)
							return fn(new Error('Entity Repo does not provide a means of creating menus'));
						async.waterfall([
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
									icon: 'process',
									claims: [result._id],
									type: 'DYNAMO',
									value: proc._id,
									category: menuCategory || 'MAINMENU',
									client: userManager.webClient.clientId,
								}, callback);
							}
						], function(er) {
							if (er) return fn(er);

							return fn(null, 'successfully created crud process');
						});
					});

				});

			}

			exports = create;

		}).getFunctionBody(), constants.UIDS.LIB.CREATE_CRUD_PROCESS)
		.createLib(`exports= ${misc.createElement.toString()}`, constants.UIDS.LIB.CREATE_ELEMENT)
		.createLib((() => {
			exports = function() {
				return this.createElement('_id', '', '', constants.ELEMENTTYPE.HIDDEN);
			};
		}).getFunctionBody(), constants.UIDS.LIB.CREATE_ID)
		.createLib((() => {
			function ElementsConverter(libs, processors, constants) {
				this.libs = libs;
				this.processors = processors;
				this.constants = constants;
			}
			ElementsConverter.prototype.convert = function(x) {
				var elements = [],
					keys = Object.keys(x),
					self = this;

				for (var i = 0; i < keys.length; i++) {
					var result, y = keys[i];
					if (Array.prototype.isPrototypeOf(x[y])) {
						result = self.map[`${constants.ENTITYTYPE.ARRAY}`].call(self, x[y], y);
					}
					if (typeof x[y] == 'string' && self.map[x[y]]) {
						//this should only happen if entity is a reference in an array.
						//console.log('probably found an ObjectId in an Array');
						//console.log(x[y]);
						if (x[y] !== constants.ENTITYTYPE.REFERENCE) throw new Error('Must be a Reference')

						result = self.map[x[y]].call(self, x, y);
						//console.log(result);
						elements.push(result);
						break;
					}

					if (!result && typeof x[y] == 'object') {
						if (self.map[x[y].type]) {
							result = self.map[x[y].type].call(self, x[y], y);
						} else
						//it doesnt have a type therefore treat it like an object.

							result = self.map[`${constants.ENTITYTYPE.OBJECT}`].call(self, x[y], y);
					}
					if (!result)
						throw new Error('unknown type , could not parse');


					//console.log(result);
					elements.push(result);
				}
				return elements;
			};
			ElementsConverter.prototype.map = {
				[constants.ENTITYTYPE.STRING]: function(data, name) {
					return this.libs.createElement(name, this.firstWord(name), '', this.constants.ELEMENTTYPE.INPUT, {
						type: constants.INPUTTYPE.TEXT
					});
				},
				[constants.ENTITYTYPE.NUMBER]: function(data, name) {
					return this.libs.createElement(name, this.firstWord(name), '', this.constants.ELEMENTTYPE.INPUT, {
						type: constants.INPUTTYPE.NUMBER
					});
				},
				[constants.ENTITYTYPE.BOOLEAN]: function(data, name) {
					return this.libs.createElement(name, this.firstWord(name), '', this.constants.ELEMENTTYPE.INPUT, {
						type: this.constants.INPUTTYPE.CHECKBOX
					});
				},
				[constants.ENTITYTYPE.DATE]: function(data, name) {
					return this.libs.createElement(name, this.firstWord(name), '', this.constants.ELEMENTTYPE.INPUT, {
						type: constants.INPUTTYPE.DATE
					});
				},
				[constants.ENTITYTYPE.OBJECT]: function(data, name) {
					return this.libs.createElement(name, this.firstWord(name), '', this.constants.ELEMENTTYPE.SECTION, {
						elements: this.convert(data)
					});
				},
				[constants.ENTITYTYPE.ARRAY]: function(data, name) {
					return this.libs.createElement(name, this.firstWord(name), '', this.constants.ELEMENTTYPE.LIST, {
						itemTemplate: this.convert(data[0])
					});
				},
				[constants.ENTITYTYPE.REFERENCE]: function(data, name) {
					return this.libs.createElement("_id", 'id', '', this.constants.ELEMENTTYPE.SELECT, {
						type: this.constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
						config: {
							value: this.processors[this.constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC]._id
						},
						customArgs: `{"entityName":"${data.ref}",entityLabel:"displayLabel"}`,
					});
				}
			};
			ElementsConverter.prototype.firstWord = function(string) {
				return string[0].toUpperCase() + string.substring(1);
			};
			exports = ElementsConverter;

		}).getFunctionBody(), constants.UIDS.LIB.CONVERT_SCHEMA_TO_ELEMENTS)
		.libs;
};