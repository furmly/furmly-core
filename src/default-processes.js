module.exports = function(constants, systemEntities) {
	const _ = require("lodash"),
		misc = require("./misc");
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
	var createElement = misc.createElement;

	function createId() {
		return createHidden("_id");
	}

	function tag(obj, t) {
		return {
			dynamo_ref: t,
			template: obj
		};
	}

	function clone(obj) {
		return JSON.parse(JSON.stringify(obj));
	}

	function createHidden(x) {
		return createElement(x, "", "", constants.ELEMENTTYPE.HIDDEN);
	}

	/**
	 * Returns process definition for creating processes
	 * @param  {Object} elementTypeProcessorId      id of element list processor
	 * @param  {Object} inputElementTypeProcessorId id of processor list processor
	 * @return {Object}                             process definition object.
	 */

	function getCreateProcessDefinition(opts) {
		var elementTag = "$elementTemplate$",
			validatorTag = "$validatorTemplate$",
			asyncValidatorTag = "$asyncValidatorTemplate$",
			elementItemTemplate = {
				template_ref: elementTag,
				extension: [
					createElement("validators", "Validators", "", constants.ELEMENTTYPE.LIST, {
						itemTemplate: {
							template_ref: validatorTag
						}
					}),
					createElement("asyncValidators", "Asynchronous Validators", "", constants.ELEMENTTYPE.LIST, {
						itemTemplate: {
							template_ref: asyncValidatorTag
						}
					})
				]
			},
			gridCrudElements = [
				createElement("createTemplate", "Create Template", "", constants.ELEMENTTYPE.LIST, {
					itemTemplate: elementItemTemplate
				}),
				createElement(
					"createProcessor",
					"Processor that will create object",
					"",
					constants.ELEMENTTYPE.SELECT, {
						type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
						config: {
							value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
						}
					}
				),
				createElement("editTemplate", "Edit Template", "", constants.ELEMENTTYPE.LIST, {
					itemTemplate: elementItemTemplate,
					optional: true
				}),
				createElement(
					"editProcessor",
					"Processor that will edit object",
					"",
					constants.ELEMENTTYPE.SELECT, {
						type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
						config: {
							value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
						},
						optional: true
					}
				),
				createElement(
					"fetchSingleItemProcessor",
					"Processor that will fetch object before editing",
					"",
					constants.ELEMENTTYPE.SELECT, {
						type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
						config: {
							value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
						}
					}
				),
						createElement(
					"fetchTemplateProcessor",
					"Processor that will fetch a template before editing/creating",
					"",
					constants.ELEMENTTYPE.SELECT, {
						type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
						config: {
							value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
						}
					}
				)
			];
		return {
			title: "Create Process",
			description: "This process is used by system administrators to create new processes.",
			fetchProcessor: opts[constants.UIDS.PROCESSOR.FETCH_PROCESS],
			uid: constants.UIDS.PROCESS.CREATE_PROCESS,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				processors: [opts[constants.UIDS.PROCESSOR.CREATE_PROCESS]],
				form: {
					elements: [{
							elementType: constants.ELEMENTTYPE.DESIGNER,
							label: "Manage a Process",
							name: "process",
							args: {
								main: {
									name: "process",
									elements: [
										createId(),
										createElement("uid", "Unique Key (used for customization)", "", constants.ELEMENTTYPE.INPUT, {
											type: constants.INPUTTYPE.TEXT
										}),
										createElement("title", "Title of Process", "This is what will be visible to users", constants.ELEMENTTYPE.INPUT, {
											type: constants.INPUTTYPE.TEXT
										}),
										createElement("description", "Description of Process", "This description what will be visible to users.", constants.ELEMENTTYPE.INPUT, {
											type: constants.INPUTTYPE.LARGEINPUT
										}),
										createElement('requiresIdentity', 'Requires Identity', '', constants.ELEMENTTYPE.INPUT, {
											type: constants.INPUTTYPE.CHECKBOX
										}),
										createElement('disableBackwardNavigation','disables backward navigation','',constants.ELEMENTTYPE.INPUT,{type:constants.INPUTTYPE.CHECKBOX}),
										createElement('config', 'Additional Information', '', constants.ELEMENTTYPE.SCRIPT,{type:"JSON"})
									],
									relationships: {
										has: {
											processor: "fetchProcessor",
											"existing-processor":"fetchProcessor"
										},
										hasMany: {
											step: {
												path: "steps",
												hasSelect: false
											},
											'existing-step':{
												path:"steps"
											}
										}
									}
								},
								elements: {
									'existing-step':{
										relationships:{},
										elements:[createElement("_id","Step","",constants.ELEMENTTYPE.SELECT,{
											type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																config: {
																	value: opts[constants.UIDS.PROCESSOR.LIST_STEPS]
																}
										})]
									},
									'existing-processor':{
										relationships:{},
										elements:[createElement("_id","Step","",constants.ELEMENTTYPE.SELECT,{
											type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																config: {
																	value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																}
										})]
									},
									step: {
										elements: [
											createId(),
											createElement("mode", "Type of Step", "", constants.ELEMENTTYPE.SELECTSET, {
												items: [{
													id: constants.STEPMODE.PROCESS,
													displayLabel: "Default"
												}, {
													id: constants.STEPMODE.VIEW,
													displayLabel: "View"
												}]
											}),
											createElement(
												"info",
												"",
												"A step is a single form in a process. Processes can have any number of steps.",
												constants.ELEMENTTYPE.LABEL
											),
											createElement("description","Description of Step","",constants.ELEMENTTYPE.INPUT),
											createElement("stepType", "Type of Step", "Type of Step.", constants.ELEMENTTYPE.INPUT, {
												disabled: true,
												default: constants.STEPTYPE.CLIENT
											})
										],
										relationships: {
											has: {
												form: "form"
											},
											hasMany: {
												processor: "processors",
												'existing-processor':"processors"
											}
										}
									},
									form: {
										hasPreview: true,
										elements: [
											createElement(
												"description",
												"",
												"A form contains elements that are displayed to the user when a step is requested",
												constants.ELEMENTTYPE.LABEL
											)
										],
										relationships: {
											hasMany: {
												element: "elements"
											}
										}
									},
									processor: {
										elements: [
											createId(),
											createHidden("uid"),
											createElement("title", "Title", "Title", constants.ELEMENTTYPE.INPUT),
											createElement(
												"code",
												"This code runs when a client makes a request to the processor endpoint.",
												"Title",
												constants.ELEMENTTYPE.SCRIPT
											),
											createElement("requiresIdentity", "Requires Identity", "", constants.ELEMENTTYPE.INPUT, {
												type: constants.INPUTTYPE.CHECKBOX,
												default: true
											})
										]
									},
									validator: {
										elements: tag(
											[
												createElement("validatorType", "Type of Validator", "", constants.ELEMENTTYPE.SELECTSET, {
													path: "args",
													items: [{
														id: constants.VALIDATORTYPE.REQUIRED,
														displayLabel: "Required",
														elements: []
													}, {
														id: constants.VALIDATORTYPE.MAXLENGTH,
														displayLabel: "Maximum Number of Characters",
														elements: [
															createElement("max", "Max", "", constants.ELEMENTTYPE.INPUT, {
																type: constants.INPUTTYPE.NUMBER
															})
														]
													}, {
														id: constants.VALIDATORTYPE.MINLENGTH,
														displayLabel: "Minimum Number of Characters",
														elements: [
															createElement("min", "Minimum", "", constants.ELEMENTTYPE.INPUT, {
																type: constants.INPUTTYPE.NUMBER
															})
														]
													},
													{
														id: constants.VALIDATORTYPE.REGEX,
														displayLabel: "Regular Expression",
														elements: [
															createElement("exp", "Expression", "", constants.ELEMENTTYPE.INPUT)
														]
													}]
												})
											],
											validatorTag
										)
									},
									asyncValidator: {
										elements: tag(
											[
												createId(),
												createHidden("uid"),
												createElement("title", "Title", "Title", constants.ELEMENTTYPE.INPUT),
												createElement(
													"code",
													"This code runs when a client makes a request to the processor endpoint.",
													"Title",
													constants.ELEMENTTYPE.SCRIPT
												),
												createElement("requiresIdentity", "Requires Identity", "", constants.ELEMENTTYPE.INPUT, {
													type: constants.INPUTTYPE.CHECKBOX,
													default: true
												})
											],
											asyncValidatorTag
										)
									},
									element: {
										elements: tag(
											[
												createElement("elementType", "Element type", "The type of element", constants.ELEMENTTYPE.SELECTSET, {
													path: "args",
													items: [
													{
														id:constants.ELEMENTTYPE.PARTIAL,
														displayLabel:'Partial',
														elements:[
														createElement("elements", "Elements in the section", "Elements in the partial", constants.ELEMENTTYPE.LIST, {
																itemTemplate: elementItemTemplate,
															}),
														createElement("processor","Processor that will fire","",constants.ELEMENTTYPE.SELECT,{
															type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																config: {
																	value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																}
														}),
														createElement('processorArgs', 'Processor Arguments', '', constants.ELEMENTTYPE.SCRIPT, {
																type: 'JSON'
															})
														]
													},
													{
														id:constants.ELEMENTTYPE.COMMAND,
														displayLabel:'Command',
														elements:[
														    createElement('commandProcessor', 'Processor', '', constants.ELEMENTTYPE.SELECT, {
																type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																config: {
																	value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																}
															}),
															createElement('commandType','Type','',constants.ELEMENTTYPE.SELECTSET,{
																items: [
																	{
																		id: constants.COMMANDTYPE.DEFAULT,
																		displayLabel: "Default",
																		elements: []
																	},
																	{
																		id: constants.COMMANDTYPE.DOWNLOAD,
																		displayLabel: "Download",
																		elements: []
																	}
																]
															}),
															createElement('commandText','Text','',constants.ELEMENTTYPE.INPUT),
															createElement('commandIcon','Icon','',constants.ELEMENTTYPE.INPUT),
															createElement('commandProcessorArgs','Processor Args','',constants.ELEMENTTYPE.SCRIPT)
														]
													},
													{
														id:constants.ELEMENTTYPE.MESSENGER,
														displayLabel:'Chat Messenger',
														elements:[
                                                             
														]
													},
														{
														id:constants.ELEMENTTYPE.WEBVIEW,
														displayLabel:'Web View',
														elements:[
														        createElement('url','URL','',constants.ELEMENTTYPE.INPUT)
														]
														},

													{
														id: constants.ELEMENTTYPE.HTMLVIEW,
														displayLabel: 'HTML View',
														elements: [
															createElement('html', 'HTML', '', constants.ELEMENTTYPE.SCRIPT, {
																type: "ejs"
															})
														]
													}, {
														id: constants.ELEMENTTYPE.ACTIONVIEW,
														displayLabel: 'Action View',
														elements: [
															createElement('action', 'Action processor', '', constants.ELEMENTTYPE.SELECT, {
																type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																config: {
																	value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																}
															}),
															createElement("elements", "Elements supplying action parameters", "", constants.ELEMENTTYPE.LIST, {
																itemTemplate: elementItemTemplate
															}),
															createElement('commandText', 'Command Text', '', constants.ELEMENTTYPE.INPUT)
														]
													}, {
														id: constants.ELEMENTTYPE.LABEL,
														displayLabel: "Label",
														elements: []
													}, {
														id: constants.ELEMENTTYPE.HIDDEN,
														displayLabel: "Hidden Field (i.e id)",
														elements: []
													}, {
														id: constants.ELEMENTTYPE.SCRIPT,
														displayLabel: "Scripts(i.e Javascript,JSON,EJS)",
														elements: [createElement('type', 'Type (json,Javascript or ejs)', '', constants.ELEMENTTYPE.INPUT)]
													}, {
														id: constants.ELEMENTTYPE.NAV,
														displayLabel: "Navigation",
														elements: [
															createElement("text", "Text (visible to client.)", "Text", constants.ELEMENTTYPE.INPUT),
															createElement("type", "Type", "", constants.ELEMENTTYPE.SELECTSET, {
																path: "config",
																items: [{
																	id: constants.NAVIGATIONTYPE.DYNAMO,
																	displayLabel: "Link to a Dynamo process/view",
																	elements: [
																		createElement("value", "Select a Dynamo Process", "", constants.ELEMENTTYPE.SELECT, {
																			type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																			config: {
																				value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSES]
																			}
																		})
																	]
																}, {
																	id: constants.NAVIGATIONTYPE.CLIENT,
																	displayLabel: "Link to a Client Side Process",
																	elements: [
																		createElement("value", "Client Process UID", "", constants.ELEMENTTYPE.INPUT, {
																			type: constants.INPUTTYPE.TEXT
																		})
																	]
																}]
															}),
															createElement("params","Params (pipe delimited strings, e.g name=chidi|number=8|height=23) ","",constants.ELEMENTTYPE.INPUT)
														]
													}, {
														id: constants.ELEMENTTYPE.FILEUPLOAD,
														displayLabel: "File Upload",
														elements: [
															createElement("fileType", "Allowed file extensions", "", constants.ELEMENTTYPE.INPUT, {
																type: constants.INPUTTYPE.TEXT
															}),
															createElement("showPreview", "Show Preview", "", constants.ELEMENTTYPE.INPUT, {
																type: constants.INPUTTYPE.CHECKBOX
															})
														]
													}, {
														id: constants.ELEMENTTYPE.GRID,
														displayLabel: "Grid",
														elements: [
															createElement("filter", "Items used to filter the grid", "", constants.ELEMENTTYPE.LIST, {
																itemTemplate: elementItemTemplate,
																optional: true
															}),
															createElement("filterProcessor","async retrieve items used to filter grid","",constants.ELEMENTTYPE.SELECT,{
																type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																	config: {
																		value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																	}
															}),
															createElement("filterCommands","commands used by the filter to perform things like print...etc","",constants.ELEMENTTYPE.LIST,{
                                                               itemTemplate:[createElement("commandProcessor","Processor that will run when command fires","",constants.ELEMENTTYPE.SELECT,{
                                                               	type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																	config: {
																		value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																	}
																}),
                                                               createElement("commandText","Text Displayed by the client","",constants.ELEMENTTYPE.INPUT),
                                                               createElement("commandIcon","Name of the icon to be displayed by the client","",constants.ELEMENTTYPE.INPUT)]
															}),
															createElement('pageCount','Page Count','',constants.ELEMENTTYPE.INPUT,{
																type:constants.INPUTTYPE.NUMBER
															}),
															createElement("dontAutoFetchFromSource","Fetch from source on load ?","",constants.ELEMENTTYPE.INPUT,{
																type:constants.INPUTTYPE.CHECKBOX
															}),
															createElement(
																"mode",
																"Grid mode (CRUD expects Create/Edit/Update Templates)",
																"",
																constants.ELEMENTTYPE.SELECTSET, {
																	path: "extra",
																	items: [{
																		id: constants.GRIDMODE.DEFAULT,
																		displayLabel: "Default",
																		elements: []
																	}, {
																		id: constants.GRIDMODE.EDITONLY,
																		displayLabel: "Edit Only",
																		elements: gridCrudElements.slice().filter(x => /edit/i.test(x.name) || /fetch/i.test(x.name))
																	}, {
																		id: constants.GRIDMODE.CREATEONLY,
																		displayLabel: 'Create Only',
																		elements: gridCrudElements.slice().filter(x => /create/i.test(x.name) || /fetch/i.test(x.name))
																	}, {
																		id: constants.GRIDMODE.CRUD,
																		displayLabel: "CRUD (Create/Edit/Update Templates required)",
																		elements: gridCrudElements
																	}]
																}
															),
															createElement("commands", "Commands", "List of commands to attach to grid items.", constants.ELEMENTTYPE.LIST, {
																itemTemplate: [
																	createElement("commandType", "Command Type", "", constants.ELEMENTTYPE.SELECTSET, {
																		path: "command",
																		items: [{
																			id: constants.GRIDCOMMANDTYPE.PROCESSOR,
																			displayLabel: "Processor",
																			elements: [
																				createElement("value", "Select a Processor", "", constants.ELEMENTTYPE.SELECT, {
																					type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																					config: {
																						value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																					}
																				})
																			]
																		}, {
																			id: constants.GRIDCOMMANDTYPE.NAV,
																			displayLabel: "Navigation Link",
																			elements: [
																				createElement(
																					"value",
																					"Select a Process to navigate to",
																					"",
																					constants.ELEMENTTYPE.SELECT, {
																						type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																						config: {
																							value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSES]
																						}
																					}
																				)
																			]
																		}]
																	}),

																	createElement("commandText", "Command Text", "", constants.ELEMENTTYPE.INPUT, {
																		type: constants.INPUTTYPE.TEXT
																	}),
																	createElement("commandIcon", "Command Icon", "", constants.ELEMENTTYPE.INPUT)
																],
																optional: true
															}),
															createElement(
																"source",
																"Source",
																"This returns the items to display. The processor must be paginatable",
																constants.ELEMENTTYPE.SELECT, {
																	type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																	config: {
																		value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																	}
																}
															),
															createElement("gridArgs", "Arguments (passed to all processors)", "", constants.ELEMENTTYPE.SCRIPT, {
																type: "JSON"
															}),
															createElement(
																"templateConfig",
																'Template (JSON representing template/template config e.g {"name":"basic","config":{name:"Name"}})',
																"",
																constants.ELEMENTTYPE.SCRIPT, {
																	type: 'JSON'
																}
															)
														]
													}, {
														id: constants.ELEMENTTYPE.IMAGE,
														displayLabel: "Image",
														elements: [
															createElement("type", "Type of Image", "", constants.ELEMENTTYPE.SELECTSET, {
																path: "config",
																items: [{
																	id: constants.IMAGETYPE.URL,
																	displayLabel: "Link",
																	elements: [
																		createElement("data", "Url", "", constants.ELEMENTTYPE.INPUT, {
																			type: constants.INPUTTYPE.TEXT
																		})
																	]
																}, {
																	id: constants.IMAGETYPE.REL,
																	displayLabel: "Relative (Client will provide image)",
																	elements: [
																		createElement("data", "Identifier", "", constants.ELEMENTTYPE.INPUT, {
																			type: constants.INPUTTYPE.TEXT
																		})
																	]
																}, {
																	id: constants.IMAGETYPE.DATA,
																	displayLabel: "Image data as a base64 URL",
																	elements: [
																		createElement("data", "Base64 Image String", "", constants.ELEMENTTYPE.INPUT, {
																			type: constants.INPUTTYPE.TEXT
																		})
																	]
																}]
															})
														]
													}, {
														id: constants.ELEMENTTYPE.INPUT,
														displayLabel: "Input",
														elements: [
															createElement(
																"type",
																"Type of Input",
																"The user interface uses this value to determine what type of input",
																constants.ELEMENTTYPE.SELECTSET, {
																	path:"config",
																	processor:opts[constants.UIDS.PROCESSOR.LIST_INPUT_TYPES]
																}
															)
														]
													}, {
														id: constants.ELEMENTTYPE.SELECT,
														displayLabel: "Select",
														elements: [
															createElement(
																"type",
																"Type of Select",
																"The user interface uses this value to determine the available types",
																constants.ELEMENTTYPE.SELECTSET, {
																	path: "config",
																	items: [{
																		id: constants.ELEMENT_SELECT_SOURCETYPE.FORM,
																		displayLabel: "Another Element in the form.",
																		elements: [
																			createElement(
																				"value",
																				"Name of Element",
																				"This the name of the element that represents the source",
																				constants.ELEMENTTYPE.INPUT
																			),
																			createElement(
																				"path",
																				"Property to bind to.",
																				"Property of the element that contains list to bind to.",
																				constants.ELEMENTTYPE.INPUT
																			)
																		]
																	}, {
																		id: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																		displayLabel: "Processor",
																		elements: [
																			createElement("value", "Value", "", constants.ELEMENTTYPE.SELECT, {
																				type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																				config: {
																					value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																				}
																			}),
																			createElement("customArgs", "Custom Arguments", "", constants.ELEMENTTYPE.SCRIPT, {
																				type: 'JSON'
																			})
																		]
																	}]
																}
															),
															createElement('mode','Mode (Default or ObjectId)','', constants.ELEMENTTYPE.SELECTSET,{
																items:[{
																	displayLabel:'Normal',
																	id:'',
																},
																{
																	displayLabel:"ObjectId",
																	id:'ObjectId'
																}]
															})
														]
													}, {
														id: constants.ELEMENTTYPE.SELECTSET,
														displayLabel: "Option Groups",
														elements: [
															createElement(
																"path",
																"Path (Required)",
																"Processors will use this path to refer to items contained here",
																constants.ELEMENTTYPE.INPUT, {
																	type: constants.INPUTTYPE.TEXT
																}
															),
															createElement('processor', 'Processor (overrides items)', '', constants.ELEMENTTYPE.SELECT, {
																type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																config: {
																	value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																}
															}),
															createElement('processorArgs', 'Processor Arguments', '', constants.ELEMENTTYPE.SCRIPT, {
																type: 'JSON'
															}),
															createElement("items", "Options", "Options under groups.", constants.ELEMENTTYPE.LIST, {
																itemTemplate: [
																	createElement(
																		"id",
																		"Result of Selection",
																		"This is what is sent back to the processor as the value of this field",
																		constants.ELEMENTTYPE.INPUT
																	),
																	createElement("displayLabel", "Label displayed to user", "", constants.ELEMENTTYPE.INPUT),
																	createElement("elements", "Properties to add", "", constants.ELEMENTTYPE.LIST, {
																		itemTemplate: elementItemTemplate
																	})
																]
															}),
															createElement('mode','Mode (Default or ObjectId)','', constants.ELEMENTTYPE.SELECTSET,{
																items:[{
																	displayLabel:'Normal',
																	id:'',
																},
																{
																	displayLabel:"ObjectId",
																	id:'ObjectId'
																}]
															})
														]
													}, {
														id: constants.ELEMENTTYPE.LIST,
														displayLabel: "List",
														elements: [
															createElement(
																"itemTemplate",
																"Template",
																"Template used to create and edit items in this list",
																constants.ELEMENTTYPE.LIST, {
																	itemTemplate: elementItemTemplate
																}
															),
															createElement(
																"options",
																"Options",
																"Specific options that affects the lists behavior",
																constants.ELEMENTTYPE.SELECTSET, {
																	path: "behavior",
																	items: [{
																		id: "TAG",
																		displayLabel: "Tag Template",
																		elements: [
																			createElement("dynamo_ref", "Tag", "", constants.ELEMENTTYPE.INPUT, {
																				type: constants.INPUTTYPE.TEXT
																			})
																		]
																	}, {
																		id: "REF",
																		displayLabel: "Reference a Tag",
																		elements: [
																			createElement(
																				"description",
																				"",
																				"The item template with the referenced tag will override the configured template if found.",
																				constants.ELEMENTTYPE.LABEL
																			),
																			createElement("template_ref", "Referenced Tag", "", constants.ELEMENTTYPE.INPUT, {
																				type: constants.INPUTTYPE.TEXT
																			}),
																			createElement(
																				"extension",
																				"Extensions (additional UI components)",
																				"",
																				constants.ELEMENTTYPE.LIST, {
																					itemTemplate: elementItemTemplate
																				}
																			)
																		]
																	}]
																}
															),
															createElement('listItemDataTemplateProcessor', 'Data Template Processor', '', constants.ELEMENTTYPE.SELECT, {
																type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
																config: {
																	value: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS]
																}
															}),
															createElement("rowTemplate", 'Template (JSON representing template/template config e.g {"name":"basic","config":{name:"Name"}})', "", constants.ELEMENTTYPE.SCRIPT, {
																type: "JSON"
															}),
															createElement('disabled', 'Disabled', '', constants.ELEMENTTYPE.INPUT, {
																type: constants.INPUTTYPE.CHECKBOX
															})
														]
													}, {
														id: constants.ELEMENTTYPE.SECTION,
														displayLabel: "Section",
														elements: [
															createElement("elements", "Elements in the section", "Elements in the section", constants.ELEMENTTYPE.LIST, {
																itemTemplate: elementItemTemplate
															})
														]
													}]
												}),
												createElement("name", "Name", "This is the name processors use when sending requests", constants.ELEMENTTYPE.INPUT),
												createElement("label", "Label", "This is the item used to display placeholder text for elements", constants.ELEMENTTYPE.INPUT),
												createElement("order", "Display (tells the container where to place this element)", "", constants.ELEMENTTYPE.INPUT, {
													type: constants.INPUTTYPE.NUMBER
												}),
												createElement(
													"uid",
													"Unique Identifier (possibly used to customize the appearance on clientside",
													"",
													constants.ELEMENTTYPE.INPUT
												),
												createElement("description", "Description", "Explanation of elements purpose", constants.ELEMENTTYPE.INPUT),
											    createElement("component_uid","Component_uid","",constants.ELEMENTTYPE.HIDDEN)
											],
											elementTag
										),
										relationships: {
											hasMany: {
												validator: "validators",
												asyncValidator: "asyncValidators"
											}
										}
									}
								}
							},
							asyncValidators: [],
							description: "Used to design/edit processes",
							validators: []
						},
						createElement("label", "Explanation", "Please enter your password here before clicking save", constants.ELEMENTTYPE.LABEL),
						createElement("password", "Password (Current User)", "", constants.ELEMENTTYPE.INPUT, {
							type: constants.INPUTTYPE.PASSWORD
						}),
						createElement("createClaim", "Create claim if it does not exist", "", constants.ELEMENTTYPE.INPUT, {
							type: constants.INPUTTYPE.CHECKBOX,
							default: true
						})
					]
				}
			}]
		};
	}

	function manageProcessesDefinition(opts) {
		return {
			title: "Manage Process",
			description: "System administrators can create and edit existing processes",
			uid: constants.UIDS.PROCESS.MANAGE_PROCESS,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				mode: constants.STEPMODE.VIEW,
				processors: [],
				form: {
					elements: [
						createElement("grid", "Manage Processes", "This view lets administators manage processes", constants.ELEMENTTYPE.GRID, {
							mode: constants.GRIDMODE.DEFAULT,
							source: opts[constants.UIDS.PROCESSOR.LIST_PROCESSES],
							gridArgs: `{"entityName":"${systemEntities.process}","entityLabel":"title"}`,
							filter: [createElement("title", "Title", "", constants.ELEMENTTYPE.INPUT)],
							templateConfig: '{"name":"basic","config":{"title":"Title","description":"Description"}}',
							commands: [{
								commandType: constants.GRIDCOMMANDTYPE.NAV,
								commandText: "edit",
								commandIcon: "mode_edit",
								command: {
									value: constants.UIDS.PROCESS.CREATE_PROCESS
								}
							}]
						})
					]
				}
			}]
		};
	}

	function manageEntitiesDefinition(opts) {
		var templateName = "entitiesItemTemplate",
			arrayTemplateName = "arrayItemTemplate";
		(baseItemTemplate = [
			createElement("propertyName", "Property Name", "", constants.ELEMENTTYPE.INPUT),
			createElement("propertyType", "Property Type", "", constants.ELEMENTTYPE.SELECTSET, {
				path: "props",
				items: [{
					id: constants.ENTITYTYPE.STRING,
					displayLabel: "String"
				}, {
					id: constants.ENTITYTYPE.NUMBER,
					displayLabel: "Number"
				}, {
					id: constants.ENTITYTYPE.BOOLEAN,
					displayLabel: "Boolean"
				}, {
					id: constants.ENTITYTYPE.DATE,
					displayLabel: "Date"
				}, {
					id: constants.ENTITYTYPE.OBJECT,
					displayLabel: "Object",
					elements: [
						createElement("properties", "Properties", "", constants.ELEMENTTYPE.LIST, {
							itemTemplate: {
								template_ref: templateName
							}
						})
					]
				}, {
					id: constants.ENTITYTYPE.ARRAY,
					displayLabel: "Array",
					elements: [
						createElement("properties", "Of", "", constants.ELEMENTTYPE.LIST, {
							options: "TAG",
							behavior: {
								dynamo_ref: arrayTemplateName
							},
							itemTemplate: null
						})
					]
				}, {
					id: constants.ENTITYTYPE.REFERENCE,
					displayLabel: "Reference an existing Schema",
					elements: [
						createElement("ref", "Reference", "", constants.ELEMENTTYPE.SELECT, {
							type: constants.ELEMENT_SELECT_SOURCETYPE.PROCESSOR,
							config: {
								value: opts[constants.UIDS.PROCESSOR.LIST_ENTITY_SCHEMAS]
							}
						})
					]
				}]
			})
		]), (gui = createElement("choice", "Properties (different ways of creating the same thing)", "", constants.ELEMENTTYPE.SELECTSET, {
			path: "template",
			items: [{
				id: "Gui",
				displayLabel: "Designer",
				elements: [
					createElement("value", "Entity Template", "", constants.ELEMENTTYPE.LIST, {
						options: "TAG",
						behavior: {
							dynamo_ref: templateName
						},
						itemTemplate: baseItemTemplate
					})
				]
			}, {
				id: "Code",
				displayLabel: "Advanced (Direct Creation)",
				elements: [createElement("value", "Entity Template", "", constants.ELEMENTTYPE.SCRIPT)]
			}]
		}));
		arrayItemTemplate = clone(baseItemTemplate);
		var propertyName = arrayItemTemplate.splice(0, 1)[0],
			items = arrayItemTemplate[0].args.items;
		items.forEach(function(x, index) {
			if (x.id !== constants.ENTITYTYPE.REFERENCE) x.elements ? x.elements.splice(0, 0, propertyName) : (x.elements = [propertyName]);
			if (x.id == constants.ENTITYTYPE.ARRAY)
				x.elements[1].args.itemTemplate = {
					template_ref: arrayTemplateName
				};
		});

		baseItemTemplate[1].args.items.filter(x => x.id == constants.ENTITYTYPE.ARRAY)[0].elements[0].args.itemTemplate = arrayItemTemplate;

		return {
			title: "Manage Schemas",
			description: "System administators can create and exist entity schemas",
			uid: constants.UIDS.PROCESS.MANAGE_ENTITY_SCHEMA,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				mode: constants.STEPMODE.VIEW,
				processors: [],
				form: {
					elements: [
						createElement("grid", "Manage Schemas", "", constants.ELEMENTTYPE.GRID, {
							mode: constants.GRIDMODE.CRUD,
							source: opts[constants.UIDS.PROCESSOR.LIST_ENTITY_SCHEMAS],
							filter: [createElement("name", "By Name", "", constants.ELEMENTTYPE.INPUT)],
							templateConfig: '{"name":"basic","config":{"displayLabel":"Name"}}',
							commands: [],
							extra: {
								createTemplate: [
									createElement("name", "Entity Name", "", constants.ELEMENTTYPE.INPUT),
									createElement("createCRUD", "Create Crud Process for Admins", "", constants.ELEMENTTYPE.INPUT, {
										type: constants.INPUTTYPE.CHECKBOX,
										default: true
									}),
									createElement("displayProperty", "Display Property", "", constants.ELEMENTTYPE.INPUT),
									createElement("group", "Menu Group", "", constants.ELEMENTTYPE.INPUT),
									createElement("category", "Menu Category", "", constants.ELEMENTTYPE.INPUT),
									gui,
									createElement("password", "Password (Current User)", "", constants.ELEMENTTYPE.INPUT, {
										type: constants.INPUTTYPE.PASSWORD
									})
								],
								createProcessor: opts[constants.UIDS.PROCESSOR.CREATE_SCHEMA],
								editTemplate: [
									createHidden("name"),
									gui,
									createElement("password", "Password (Current User)", "", constants.ELEMENTTYPE.INPUT, {
										type: constants.INPUTTYPE.PASSWORD
									})
								],
								fetchSingleItemProcessor: opts[constants.UIDS.PROCESSOR.FETCH_SCHEMA],
								editProcessor: opts[constants.UIDS.PROCESSOR.UPDATE_SCHEMA]
							}
						})
					]
				}
			}]
		};
	}

	function manageProcessorsDefinition(opts) {
		var template = [
			createId(),
			createElement("title", "Enter Title", "title of the processor", constants.ELEMENTTYPE.INPUT, {
				type: constants.INPUTTYPE.TEXT
			}),
			createElement("code", "Enter Code", "", constants.ELEMENTTYPE.SCRIPT),
			createElement("requiresIdentity", "Requires Identity", "", constants.ELEMENTTYPE.INPUT, {
				type: constants.INPUTTYPE.CHECKBOX
			}),
			createElement("password", "Password (Current User)", "", constants.ELEMENTTYPE.INPUT, {
				type: constants.INPUTTYPE.PASSWORD
			}),
			createElement("createClaim", "Create claim if it does not exist", "", constants.ELEMENTTYPE.INPUT, {
				type: constants.INPUTTYPE.CHECKBOX
			})
		];

		return {
			title: "Manage Processors",
			description: "System administators can create and edit existing processors",
			uid: constants.UIDS.PROCESS.MANAGE_PROCESSOR,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				mode: constants.STEPMODE.VIEW,
				processors: [],
				form: {
					elements: [
						createElement("grid", "Manage Processors", "This view lets administators manage processors", constants.ELEMENTTYPE.GRID, {
							mode: constants.GRIDMODE.CRUD,
							source: opts[constants.UIDS.PROCESSOR.LIST_PROCESSORS],
							gridArgs: `{"entityName":"${systemEntities.processor}","entityLabel":"title"}`,
							filter: [createElement("title", "Title", "", constants.ELEMENTTYPE.INPUT)],
							commands: [],
							templateConfig: '{"name":"basic","config":{"title":"Title","description":"Description","_id":"ID"}}',
							extra: {
								createTemplate: template,
								createProcessor: opts[constants.UIDS.PROCESSOR.CREATE_PROCESSOR],
								editTemplate: template,
								editProcessor: opts[constants.UIDS.PROCESSOR.CREATE_PROCESSOR]
							}
						})
					]
				}
			}]
		};
	}

	function manageLibsDefinition(opts) {
		var template = [
			createId(),
			createElement("uid", "Enter Title (no space)", "title of the lib", constants.ELEMENTTYPE.INPUT, {
				type: constants.INPUTTYPE.TEXT
			}),
			createElement("code", "Enter Code", "", constants.ELEMENTTYPE.SCRIPT),
			createElement("password", "Password (Current User)", "", constants.ELEMENTTYPE.INPUT, {
				type: constants.INPUTTYPE.PASSWORD
			})
		];

		return {
			title: "Manage Libraries",
			description: "System administators can create and edit existing processors",
			uid: constants.UIDS.PROCESS.MANAGE_LIBS,
			steps: [{
				stepType: constants.STEPTYPE.CLIENT,
				mode: constants.STEPMODE.VIEW,
				processors: [],
				form: {
					elements: [
						createElement("grid", "Manage Libs", "This view lets administators manage libs", constants.ELEMENTTYPE.GRID, {
							mode: constants.GRIDMODE.CRUD,
							source: opts[constants.UIDS.PROCESSOR.LIST_LIBS],
							templateConfig: '{"name":"basic","config":{"_id":"ID","uid":"UID"}}',
							gridArgs: `{"entityName":"${systemEntities.lib}","entityLabel":"uid"}`,
							filter: [createElement("title", "Title", "", constants.ELEMENTTYPE.INPUT)],
							commands: [],
							extra: {
								createTemplate: template,
								createProcessor: opts[constants.UIDS.PROCESSOR.CREATE_LIB],
								editTemplate: template,
								editProcessor: opts[constants.UIDS.PROCESSOR.CREATE_LIB]
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
		[constants.UIDS.PROCESS.MANAGE_LIBS]: manageLibsDefinition,
		[constants.UIDS.PROCESS.MANAGE_ENTITY_SCHEMA]: manageEntitiesDefinition
	};
};