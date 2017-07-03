/*jshint esversion: 6 */

module.exports = function(constants, systemEntities) {
	const _ = require('lodash');
	/**
	 * Function used for creating element objects
	 * @param  {String} name        Scope name of element
	 * @param  {String} label       Placeholder text
	 * @param  {String} description Description of elements purpose
	 * @param  {Sting} type        Type of element
	 * @param  {Array} asyncVals   Array of async validators required by element
	 * @param  {Array} validators  Array of clientside validators to be applied on element on the client
	 * @param  {Object} args        Specific Args of element required by the element type
	 * @return {Object}             Object representing an element
	 */
	var createElement = function(name, label, description, type, args, validators, asyncVals) {
		if (typeof name !== 'string' || typeof label !== 'string' || typeof description !== 'string' || typeof type !== 'string' || (args && typeof args !== 'object'))
			throw new Error('illegal argument(s) passed to createElement');

		return {
			elementType: type,
			label: label,
			name: name,
			args: args,
			asyncValidators: asyncVals || [],
			description: description,
			validators: validators || []
		};
	};


	/**
	 * Returns process definition for creating processes
	 * @param  {Object} elementTypeProcessorId      id of element list processor
	 * @param  {Object} inputElementTypeProcessorId id of processor list processor
	 * @return {Object}                             process definition object.
	 */

	function getCreateProcessDefinition(opts) {
		function tag(obj, t) {
			return {
				dynamo_ref: t,
				template: obj
			};
		}
		var elementTag = '$elementTemplate$',
			validatorTag = '$validatorTemplate$',
			asyncValidatorTag = '$asyncValidatorTemplate$',
			elementItemTemplate = {
				template_ref: elementTag,
				extension: [
					createElement('validators', 'Validators', '', constants.ELEMENTTYPE.LIST, {
						itemTemplate: {
							template_ref: validatorTag
						}
					}),
					createElement('asyncValidators', 'Asynchronous Validators', '', constants.ELEMENTTYPE.LIST, {
						itemTemplate: {
							template_ref: asyncValidatorTag
						}
					})
				]
			};
		return {
			title: 'Create Process',
			description: 'This process is used by system administrators to create new processes.',
			fetchProcessor: opts[constants.UIDS.PROCESSOR.FETCH_PROCESS],
			uid: constants.UIDS.PROCESS.CREATE_PROCESS,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				processors: [opts[constants.UIDS.PROCESSOR.CREATE_PROCESS]],
				form: {
					elements: [{
						elementType: constants.ELEMENTTYPE.DESIGNER,
						label: 'Manage a Process',
						name: 'process',
						args: {
							main: {
								name: 'process',
								elements: [
									createElement('title', 'Title of Process', 'This is what will be visible to users', constants.ELEMENTTYPE.INPUT, {
										type: constants.INPUTTYPE.TEXT
									}),
									createElement('description', 'Description of Process', 'This description what will be visible to users.', constants.ELEMENTTYPE.INPUT, {
										type: constants.INPUTTYPE.LARGEINPUT
									})
								],
								relationships: {
									has: {
										processor: 'fetchProcessor'
									},
									hasMany: {
										step: {
											path: 'steps',
											hasSelect: false
										}
									}
								}

							},
							elements: {
								step: {
									elements: [
										createElement('description', '',
											'A step is a single form in a process. Processes can have any number of steps.',
											constants.ELEMENTTYPE.LABEL),
										createElement('stepType', 'Type of Step', 'Type of Step.',
											constants.ELEMENTTYPE.INPUT, {
												disabled: true,
												default: constants.STEPTYPE.CLIENT
											})
									],
									relationships: {
										has: {
											form: 'form'
										},
										hasMany: {
											processor: 'processors'
										}
									}
								},
								form: {
									hasPreview: true,
									elements: [
										createElement('description', '',
											'A form contains elements that are displayed to the user when a step is requested',
											constants.ELEMENTTYPE.LABEL)
									],
									relationships: {
										hasMany: {
											element: 'elements'
										}
									}
								},
								processor: {
									elements: [
										createElement('title', 'Title',
											'Title',
											constants.ELEMENTTYPE.INPUT),
										createElement('code', 'This code runs when a client makes a request to the processor endpoint.',
											'Title',
											constants.ELEMENTTYPE.SCRIPT)
									]
								},
								validator: {
									elements: tag([
										createElement('validatorType', 'Type of Validator', '',
											constants.ELEMENTTYPE.SELECTSET, {
												path: 'args',
												items: [{
													id: constants.VALIDATORTYPE.REQUIRED,
													displayLabel: 'Required',
													elements: []
												}, {
													id: constants.VALIDATORTYPE.MAXLENGTH,
													displayLabel: 'Maximum Number of Characters',
													elements: [
														createElement('max', 'Max', '', constants.ELEMENTTYPE.INPUT, {
															type: constants.INPUTTYPE.NUMBER
														})
													]
												}, {
													id: constants.VALIDATORTYPE.MINLENGTH,
													displayLabel: 'Minimum Number of Characters',
													elements: [
														createElement('min', 'Minimum', '', constants.ELEMENTTYPE.INPUT, {
															type: constants.INPUTTYPE.NUMBER
														})
													]
												}]
											})
									], validatorTag)
								},
								asyncValidator: {
									elements: tag([
										createElement('title', 'Title',
											'Title',
											constants.ELEMENTTYPE.INPUT),
										createElement('code', 'This code runs when a client makes a request to the processor endpoint.',
											'Title',
											constants.ELEMENTTYPE.SCRIPT)
									], asyncValidatorTag)
								},
								element: {
									elements: tag([
										createElement('elementType', 'Element type',
											'The type of element',
											constants.ELEMENTTYPE.SELECTSET, {
												path: 'args',
												items: [{
													id: constants.ELEMENTTYPE.NAV,
													displayLabel: 'Navigation',
													elements: [
														createElement('text', 'Text (visible to client.)',
															'Text',
															constants.ELEMENTTYPE.INPUT),
														createElement('type', 'Type',
															'',
															constants.ELEMENTTYPE.SELECTSET, {
																path: 'value',
																items: [{
																	id: constants.NAVIGATIONTYPE.DYNAMO,
																	displayLabel: 'Link to a Dynamo process/view',
																	elements: [
																		createElement('value', 'Select a Dynamo Process', '', constants.ELEMENTTYPE.SELECT, {
																			type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																			value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSES]
																		})
																	]
																}, {
																	id: constants.NAVIGATIONTYPE.CLIENT,
																	displayLabel: 'Link to a Client Side Process',
																	elements: [
																		createElement('value', 'Client Process UID', '', constants.ELEMENTTYPE.INPUT, {
																			type: constants.INPUTTYPE.TEXT
																		})
																	]
																}]
															})
													]
												}, {
													id: constants.ELEMENTTYPE.FILEUPLOAD,
													displayLabel: 'File Upload',
													elements: [
														createElement('fileType', 'Allowed file extensions', '', constants.ELEMENTTYPE.INPUT, {
															type: constants.INPUTTYPE.TEXT
														})
													]
												}, {
													id: constants.ELEMENTTYPE.GRID,
													displayLabel: 'Grid',
													elements: [
														createElement('filter', 'Items used to filter the grid', '', constants.ELEMENTTYPE.LIST, {
															itemTemplate: elementItemTemplate,
															optional: true
														}),
														createElement('mode', 'Grid mode (CRUD expects Create/Edit/Update Templates)', '', constants.ELEMENTTYPE.SELECTSET, {
															path: 'extra',
															items: [{
																id: constants.GRIDMODE.DEFAULT,
																displayLabel: 'Default',
																elements: []
															}, {
																id: constants.GRIDMODE.CRUD,
																displayLabel: 'CRUD (Create/Edit/Update Templates required)',
																elements: [
																	createElement('createTemplate', 'Create Template', '', constants.ELEMENTTYPE.LIST, {
																		itemTemplate: elementItemTemplate
																	}),
																	createElement('createProcessor', 'Processor that will create object', '', constants.ELEMENTTYPE.SELECT, {
																		type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																		value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																	}),
																	createElement('editTemplate', 'Edit Template', '', constants.ELEMENTTYPE.LIST, {
																		itemTemplate: elementItemTemplate,
																		optional: true
																	}),
																	createElement('editProcessor', 'Processor that will edit object', '', constants.ELEMENTTYPE.SELECT, {
																		type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																		value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS],
																		optional: true
																	})
																]
															}]
														}),
														createElement('commands', 'Commands', 'List of commands to attach to grid items.', constants.ELEMENTTYPE.LIST, {
															itemTemplate: [
																createElement('commandType', 'Command Type', '', constants.ELEMENTTYPE.SELECTSET, {
																	items: [{
																		id: constants.GRIDCOMMANDTYPE.PROCESSOR,
																		displayLabel: 'Processor',
																		elements: [
																			createElement('command', 'Select a Processor', '', constants.ELEMENTTYPE.SELECT, {
																				type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																				value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																			})
																		]
																	}, {
																		id: constants.GRIDCOMMANDTYPE.NAV,
																		displayLabel: 'Navigation Link',
																		elements: [
																			createElement('command', 'Select a Process to navigate to', '', constants.ELEMENTTYPE.SELECT, {
																				type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																				value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSES]
																			})
																		]
																	}]
																}),

																createElement('commandText', 'Command Text', '', constants.ELEMENTTYPE.INPUT, {
																	type: constants.INPUTTYPE.TEXT
																})
															],
															optional: true
														}),
														createElement('source', 'Source', 'This returns the items to display. The processor must be paginatable', constants.ELEMENTTYPE.SELECT, {
															type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
															value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
														}),
														createElement('gridArgs', 'Arguments (passed to all processors)', '', constants.ELEMENTTYPE.SCRIPT, {
															type: 'JSON'
														})
													]
												}, {
													id: constants.ELEMENTTYPE.IMAGE,
													displayLabel: 'Image',
													elements: [
														createElement('type', 'Type of Image', '', constants.ELEMENTTYPE.SELECTSET, {
															items: [{
																id: constants.IMAGETYPE.REL,
																displayLabel: 'Relative (Client will provide image)',
																elements: []
															}, {
																id: constants.IMAGETYPE.DATA,
																displayLabel: 'Image data as a base64 URL',
																elements: [
																	createElement('data', 'Base64 Image String', '', constants.ELEMENTTYPE.INPUT, {
																		type: constants.INPUTTYPE.TEXT
																	})
																]
															}]
														})
													]
												}, {
													id: constants.ELEMENTTYPE.INPUT,
													displayLabel: 'Input',
													elements: [
														createElement('type', 'Type of Input',
															'The user interface uses this value to determine what type of input',
															constants.ELEMENTTYPE.SELECT, {
																type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																value: opts[constants.UIDS.PROCESSOR.LIST_INPUT_TYPES]
															})
													]
												}, {
													id: constants.ELEMENTTYPE.SELECT,
													displayLabel: 'Select',
													elements: [
														createElement('type', 'Type of Select',
															'The user interface uses this value to determine the available types',
															constants.ELEMENTTYPE.SELECTSET, {
																items: [{
																	id: constants.ELEMENT_SELECT_SOURCETYPE.FORM,
																	displayLabel: 'Another Element in the form.',
																	elements: [
																		createElement('value', 'Name of Element',
																			'This the name of the element that represents the source',
																			constants.ELEMENTTYPE.INPUT),
																		createElement('path', 'Property to bind to.',
																			'Property of the element that contains list to bind to.',
																			constants.ELEMENTTYPE.INPUT)
																	]
																}, {
																	id: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																	displayLabel: 'Processor',
																	elements: [
																		createElement('value', 'Value', '', constants.ELEMENTTYPE.SELECT, {
																			type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																			value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																		}),
																		createElement('args', 'Custom Arguments', '', constants.ELEMENTTYPE.SCRIPT)
																	]
																}],

															})
													]
												}, {
													id: constants.ELEMENTTYPE.SELECTSET,
													displayLabel: 'Option Groups',
													elements: [
														createElement('path', 'Optional path', 'Processors will use this path to refer to items contained here',
															constants.ELEMENTTYPE.INPUT, {
																type: constants.INPUTTYPE.TEXT
															}),
														createElement('items', 'Options', 'Options under groups.',
															constants.ELEMENTTYPE.LIST, {
																itemTemplate: [
																	createElement('id', 'Result of Selection',
																		'This is what is sent back to the processor as the value of this field',
																		constants.ELEMENTTYPE.INPUT),
																	createElement('displayLabel', 'Label displayed to user', '',
																		constants.ELEMENTTYPE.INPUT),
																	createElement('elements', 'Properties to add', '', constants.ELEMENTTYPE.LIST, {
																		itemTemplate: elementItemTemplate
																	})

																]
															})
													]
												}, {
													id: constants.ELEMENTTYPE.LIST,
													displayLabel: 'List',
													elements: [
														createElement('itemTemplate', 'Template', 'Template used to create and edit items in this list',
															constants.ELEMENTTYPE.LIST, {
																itemTemplate: elementItemTemplate
															}),
														createElement('options', 'Options', 'Specific options that affects the lists behavior',
															constants.ELEMENTTYPE.SELECTSET, {
																path: 'behavior',
																items: [{
																	id: 'TAG',
																	displayLabel: 'Tag Template',
																	elements: [createElement('dynamo_ref', 'Tag', '', constants.ELEMENTTYPE.INPUT, {
																		type: constants.INPUTTYPE.TEXT
																	})]
																}, {
																	id: 'REF',
																	displayLabel: 'Reference a Tag',
																	elements: [
																		createElement('description', '', 'The item template with the referenced tag will override the configured template if found.',
																			constants.ELEMENTTYPE.LABEL),
																		createElement('template_ref', 'Referenced Tag', '', constants.ELEMENTTYPE.INPUT, {
																			type: constants.INPUTTYPE.TEXT
																		})
																	]
																}]
															})
													]
												}, {
													id: constants.ELEMENTTYPE.SECTION,
													displayLabel: 'Section',
													elements: [createElement('elements', 'Elements in the section', 'Elements in the section',
														constants.ELEMENTTYPE.LIST, {
															itemTemplate: elementItemTemplate
														})]
												}]
											}),
										createElement('name', 'Name',
											'This is the name processors use when sending requests',
											constants.ELEMENTTYPE.INPUT),
										createElement('label', 'Label',
											'This is the item used to display placeholder text for elements',
											constants.ELEMENTTYPE.INPUT),
										createElement('description', 'Description',
											'Explanation of elements purpose',
											constants.ELEMENTTYPE.INPUT)
									], elementTag),
									relationships: {
										hasMany: {
											validator: 'validators',
											asyncValidator: 'asyncValidators'
										}
									}
								}
							}
						},
						asyncValidators: [],
						description: 'Used to design/edit processes',
						validators: []
					}]
				}
			}]

		};
	}

	function manageProcessesDefinition(opts) {
		return {
			title: 'Manage Process',
			description: 'System administrators can create and edit existing processes',
			uid: constants.UIDS.PROCESS.MANAGE_PROCESS,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				mode: constants.STEPMODE.VIEW,
				processors: [],
				form: {
					elements: [
						createElement('grid', 'Manage Processes', 'This view lets administators manage processes', constants.ELEMENTTYPE.GRID, {
							mode: constants.GRIDMODE.DEFAULT,
							source: opts[constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC],
							gridArgs: `{"entityName":"${systemEntities.process}","entityLabel":"title"}`,
							filter: [createElement('title', 'Title', '', constants.ELEMENTTYPE.INPUT)],
							commands: [{
								commandType: constants.GRIDCOMMANDTYPE.NAV,
								commandText: 'edit',
								command: constants.UIDS.PROCESS.CREATE_PROCESS
							}]
						})
					]
				}
			}]
		};
	}

	function manageProcessorsDefinition(opts) {
		var template = [createElement('title', 'Enter Title', 'title of the processor', constants.ELEMENTTYPE.INPUT, {
			type: constants.INPUTTYPE.TEXT
		}), createElement('code', 'Enter Code', '', constants.ELEMENTTYPE.SCRIPT)];

		return {
			title: 'Manage Processors',
			description: 'System administators can create and edit existing processors',
			uid: constants.UIDS.PROCESS.MANAGE_PROCESSOR,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				mode: constants.STEPMODE.VIEW,
				processors: [],
				form: {
					elements: [
						createElement('grid', 'Manage Processors', 'This view lets administators manage processors', constants.ELEMENTTYPE.GRID, {
							mode: constants.GRIDMODE.CRUD,
							source: opts[constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC],
							gridArgs: `{"entityName":"${systemEntities.processor}","entityLabel":"title"}`,
							filter: [
								createElement('title', 'Title', '', constants.ELEMENTTYPE.INPUT)
							],
							commands: [],
							extra: {
								createTemplate: template,
								createProcessor: opts[constants.UIDS.PROCESSOR.CREATE_ENTITY],
								editTemplate: template,
								editProcessor: opts[constants.UIDS.PROCESSOR.UPDATE_ENTITY]
							}
						})
					]
				}
			}]

		};
	}

	function manageLibsDefinition(opts) {
		var template = [createElement('uid', 'Enter Title (no space)', 'title of the lib', constants.ELEMENTTYPE.INPUT, {
			type: constants.INPUTTYPE.TEXT
		}), createElement('code', 'Enter Code', '', constants.ELEMENTTYPE.SCRIPT)];

		return {
			title: 'Manage Libraries',
			description: 'System administators can create and edit existing processors',
			uid: constants.UIDS.PROCESS.MANAGE_LIBS,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				mode: constants.STEPMODE.VIEW,
				processors: [],
				form: {
					elements: [
						createElement('grid', 'Manage Libs', 'This view lets administators manage libs', constants.ELEMENTTYPE.GRID, {
							mode: constants.GRIDMODE.CRUD,
							source: opts[constants.UIDS.PROCESSOR.LIST_ENTITY_GENERIC],
							gridArgs: `{"entityName":"${systemEntities.lib}","entityLabel":"uid"}`,
							filter: [
								createElement('title', 'Title', '', constants.ELEMENTTYPE.INPUT)
							],
							commands: [],
							extra: {
								createTemplate: template,
								createProcessor: opts[constants.UIDS.PROCESSOR.CREATE_ENTITY],
								editTemplate: template,
								editProcessor: opts[constants.UIDS.PROCESSOR.UPDATE_ENTITY]
							}
						})
					]
				}
			}]

		};
	}

	return {
		[constants.UIDS.PROCESS.CREATE_PROCESS]: getCreateProcessDefinition,
		[constants.UIDS.PROCESS.MANAGE_PROCESS]: manageProcessesDefinition,
		[constants.UIDS.PROCESS.MANAGE_PROCESSOR]: manageProcessorsDefinition,
		[constants.UIDS.PROCESS.MANAGE_LIBS]: manageLibsDefinition
	};

};