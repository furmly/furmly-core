module.exports = [
	{
		name: "_0AsyncValidator",
		schema: {
			requiresIdentity: { type: "Boolean", default: "requiresIdentity" },
			uid: { type: "String", unique: true, sparse: true },
			code: { type: "String", required: true },
			title: { type: "String", required: true }
		}
	},
	{
		name: "_0Lib",
		schema: {
			uid: { type: "String", unique: true, required: true },
			code: { type: "String", required: true }
		}
	},
	{
		name: "_0Process",
		schema: {
			requiresIdentity: { type: "Boolean", default: "requiresIdentity" },
			fetchProcessor: { type: "ObjectId", ref: "_0Processor" },
			uid: { type: "String", unique: true, sparse: true },
			title: { type: "String", required: true },
			description: { type: "String", required: true },
			steps: [{ type: "ObjectId", ref: "_0Step" }]
		}
	},
	{
		name: "_0Processor",
		schema: {
			standalone: { type: "Boolean", default: true },
			requiresIdentity: { type: "Boolean", default: "requiresIdentity" },
			uid: { type: "String", unique: true, sparse: true },
			code: { type: "String", required: true },
			title: { type: "String", required: true }
		}
	},
	{
		name: "_0Step",
		schema: {
			description: { type: "String" },
			mode: { type: "String" },
			processors: [{ type: "ObjectId", ref: "_0Processor" }],
			postprocessors: [{ type: "ObjectId", ref: "_0Processor" }],
			stepType: { type: "String", required: true },
			form: {
				elements: [
					{
						component_uid: { type: "String" },
						order: { type: "Number" },
						uid: { type: "String" },
						name: { type: "String", required: true },
						label: { type: "String" },
						description: { type: "String" },
						elementType: {
							type: "String",
							enum: [
								"INPUT",
								"SCRIPT",
								"DESIGNER",
								"HIDDEN",
								"GRID",
								"NAV",
								"FILEUPLOAD",
								"DOWNLOAD",
								"SELECTSET",
								"LABEL",
								"LARGEINPUT",
								"COMMAND",
								"SECTION",
								"TABS",
								"SELECT",
								"LIST",
								"IMAGE",
								"ACTIONVIEW",
								"HTMLVIEW",
								"WEBVIEW",
								"MESSENGER",
								"PARTIAL"
							],
							required: true
						},
						asyncValidators: [
							{ type: "ObjectId", ref: "_0AsyncValidator" }
						],
						validators: [
							{
								validatorType: {
									type: "String",
									enum: [
										"REQUIRED",
										"MAXLENGTH",
										"MINLENGTH",
										"REGEX"
									],
									required: true
								},
								args: { type: "Mixed" }
							}
						],
						args: { type: "Mixed" }
					}
				]
			}
		}
	}
];
