/*jshint esversion: 6 */

module.exports = function(constants, systemEntities) {
	var _ = require('lodash');
	require('./misc');

	function createProcessor(title, code, uid) {
		if (!uid) {
			console.log(arguments);
			throw new Error('Every default processor must have a uid');
		}
		if (!this.processors) {
			this.processors = {};
			this.createProcessor = createProcessor.bind(this);
		}

		this.processors[uid] = {
			title: title,
			code: code,
			uid: uid
		};
		return this;
	}

	let createProcessCode = (() => {
			this.entityRepo.saveProcess(this.args.process, callback);
		}).getFunctionBody(),

		fetchProcessCode = (() => {
			this.entityRepo.get(this.systemEntities.process, {
				$or: [{
					_id: this.args._id
				}, {
					uid: this.args._id
				}]
			}, {
				full: true,
				noTransformaton: true
			}, function(er, proc) {
				if (er) return callback(er);

				callback(null, proc.length ? {
					process: proc[0]
				} : null);
			});
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
						_id: 1
					}
				};
				if (this.args._id)
					if (this.args.prev) {
						query._id = {
							$lt: this.args._id
						};
						options.sort._id = -1;
					} else {
						query._id = {
							$gt: this.args._id
						};
					}

				if (this.args.query)
					_.assign(query, this.libs.convertFilter(this.args.query));

			}
			this.entityRepo.get(entity, query, options, function(er, x) {
				if (er) return callback(er);
				var result = !args.full ? x.map(function(z) {
					return {
						_id: z._id,
						displayLabel: z$label
					};
				}) : x;
				if (!args.count)
					callback(null, result);
				else {
					if (query._id)
						delete query._id;
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
			this.entityRepo.get($entity, {
				_id: this.args._id
			}, callback);
		}).getFunctionBody(),

		createEntityCode = (() => {
			this.entityRepo.create(this.args.entityName, this.args.entity, callback);
		}).getFunctionBody(),

		updateEntityCode = (() => {
			this.entityRepo.update(this.args.entityName, this.args.entity, callback);
		}).getFunctionBody(),

		fetchSchemaCode = (() => {
			var self = this;
			this.entityRepo.getSchema(this.args._id, function(er, code) {
				if (er) return callback(er);

				var result = {
					choice: 'Code',
					name: self.args._id,
					template: {
						value: JSON.stringify(code, null, ' ')
					}
				};
				callback(null, result);
			});
		}).getFunctionBody(),

		listEntitySchemaCode = (() => {
			var self = this;
			this.entityRepo.getSchemas(function(er, types) {
				if (er) return callback(er);
				var every = this.libs.convertToSelectableList(types);
				var total = every.length;
				if (self.args.count) {
					every = every.sort((x, y) => {
						return x._id - y._id;
					});
					var index = self.args._id ? every.indexOf(every.filter(x => x._id == self.args._id)[0]) : 0;
					every = every.slice(index, (index + self.args.count) > every.length ? (index + (every.length - index)) : (index + self.args.count));
					callback(null, {
						items: every,
						total: total
					});
					return;
				}
				callback(null, every);
			}.bind(this));

		}).getFunctionBody(),
		createSchemaCode = (() => {
			function resolve(type, data) {

				function parse(data) {
					var template = {};
					data.forEach((x) => {
						if (x.propertyType == constants.ENTITYTYPE.OBJECT) {
							template[x.propertyName] = parse(x.properties);
							return;
						}
						if (x.propertyType == constants.ENTITYTYPE.ARRAY) {
							template[x.propertyName] = [parse(x.properties)];
							return;
						}

						if (x.propertyType == constants.ENTITYTYPE.REFERENCE) {
							template[x.propertyName] = {
								type: 'ObjectId',
								ref: x.ref
							};
							return;
						}

						template[x.propertyName] = {
							type: x.propertyType
						};
					});
					return template;
				}
				switch (type) {
					case 'Code':
						return JSON.parse(data);
					case 'Gui':
						return parse(data);
				}
			}

			var data = resolve(this.args.entity.choice, this.args.entity.template.value),
				self = this;
			this.entityRepo.createSchema(this.args.entity.name, data, function(er) {
				if (er) return callback(er);

				if (self.args.entity.createCRUD && self.args.entity.displayProperty) {
					//create a crud process for this entity.
					self.libs.createCRUDProcess.call(self,
						self.args.entity.name,
						self.args.entity.displayProperty,
						self.args.entity.group,
						self.args.entity.category, data, callback);
					return;
				}
				callback(null, "Successfully created config");
			});

		}).getFunctionBody(),
		updateSchemaCode = (() => {
			this.entityRepo.updateSchema(this.args.entity.name, JSON.parse(this.args.entity.template.value), callback);

		}).getFunctionBody();



	return createProcessor.call({}, 'Lists Entities per query', listEntityTemplate.replace('$entity', 'args.entityName').replace('$label', '[args.entityLabel]'), constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC)
		.createProcessor('Lists processors', listEntityTemplate.replace('$entity', `'${systemEntities.processor}'`).replace('$label', '.title'), constants.UIDS.PROCESSOR.LIST_PROCESSORS)
		.createProcessor('Lists async validators', listEntityTemplate.replace('$entity', `'${systemEntities.asyncValidator}'`).replace('$label', '.title'), constants.UIDS.PROCESSOR.LIST_ASYNC_VALIDATORS)
		.createProcessor('Lists processes', listEntityTemplate.replace('$entity', `'${systemEntities.process}'`).replace('$label', '.title'), constants.UIDS.PROCESSOR.LIST_PROCESSES)
		.createProcessor('Lists input types', 'var self=this;callback(null,Object.keys(this.constants.INPUTTYPE).map(function(x){return {_id:self.constants.INPUTTYPE[x],displayLabel:self.constants.INPUTTYPE[x]}; }));', constants.UIDS.PROCESSOR.LIST_INPUT_TYPES)
		.createProcessor('Lists element types', 'callback(null,Object.keys(this.constants.ELEMENTTYPE).map(function(x){return {_id:x,displayLabel:x}; })); ', constants.UIDS.PROCESSOR.LIST_ELEMENT_TYPES)
		.createProcessor('Fetch Process', fetchProcessCode, constants.UIDS.PROCESSOR.FETCH_PROCESS)
		.createProcessor('Create Process', createProcessCode, constants.UIDS.PROCESSOR.CREATE_PROCESS)
		.createProcessor('Create an Entity', createEntityCode, constants.UIDS.PROCESSOR.CREATE_ENTITY)
		.createProcessor('Update an Entity', updateEntityCode, constants.UIDS.PROCESSOR.UPDATE_ENTITY)
		.createProcessor('Fetch a single Entity', fetchEntityTemplate.replace('$entity', 'this.args.entityName'), constants.UIDS.PROCESSOR.FETCH_ENTITY)
		.createProcessor('List schemas', listEntitySchemaCode, constants.UIDS.PROCESSOR.LIST_ENTITY_SCHEMAS)
		.createProcessor('Fetch schema', fetchSchemaCode, constants.UIDS.PROCESSOR.FETCH_SCHEMA)
		.createProcessor('Create Schema', createSchemaCode, constants.UIDS.PROCESSOR.CREATE_SCHEMA)
		.createProcessor('Update Schema', updateSchemaCode, constants.UIDS.PROCESSOR.UPDATE_SCHEMA)
		.processors;

};