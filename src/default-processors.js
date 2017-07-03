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

	var createProcessCode = (() => {
		this.entityRepo.saveProcess(this.args, callback);
	}).getFunctionBody();

	var fetchProcessCode = (() => {
		this.entityRepo.getProcess({
			$or: [{
				_id: this.args._id
			}, {
				uid: this.args._id
			}]
		}, callback);
	}).getFunctionBody();

	var listEntityTemplate = (() => {
		var options, query = {},
			args = this.args;
		if (this.args && this.args.count) {

			options = {
				limit: this.args.count,
				sort: this.args.sort || {
					_id: 1
				}
			};
			if (this.args._id)
				if (this.args.prev) {
					query.$lt = {
						_id: this.args._id
					};
				} else {
					query.$gt = {
						_id: this.args._id
					};
				}

			if (this.args.query)
				_.assign(query, this.libs.convertFilter(this.args.query));

		}
		console.log('querying...');
		console.log(query);
		this.entityRepo.get($entity, query, options, function(er, x) {
			if (er) return callback(er);
			var result = !args.full ? x.map(function(z) {
				return {
					_id: z._id,
					displayLabel: z$label
				};
			}) : x;
			if (!args.count)
				callback(null, result);
			else
				this.entityRepo.count($entity, query, function(er, count) {
					callback(er, {
						items: result,
						total: count
					});
				});


		});
	}).getFunctionBody();

	var fetchEntityTemplate = (() => {
		this.entityRepo.get($entity, {
			_id: this.args._id
		}, callback);
	}).getFunctionBody();

	var createEntityCode = (() => {
		this.entityRepo.create(this.args.entityName, this.args.entity, callback);
	}).getFunctionBody();

	var updateEntityCode = (() => {
		this.entityRepo.update(this.args.entityName, this.args.entity, callback);
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
		.processors;

};