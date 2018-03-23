let constants = require("./constants"),
	systemEntities = constants.systemEntities;
module.exports = [
	{
		name: systemEntities.asyncValidator,
		schema: {
			requiresIdentity: { type: "Boolean", default: "requiresIdentity" },
			uid: { type: "String", unique: true, sparse: true },
			code: { type: "String", required: true },
			title: { type: "String", required: true }
		},
		updated: "Date"
	},
	{
		name: systemEntities.lib,
		schema: {
			uid: { type: "String", unique: true, required: true },
			code: { type: "String", required: true }
		},
		updated: "Date"
	},
	{
		name: systemEntities.process,
		schema: {
			requiresIdentity: { type: "Boolean", default: "requiresIdentity" },
			disableBackwardNavigation: { type: "Boolean"},
			fetchProcessor: { type: "ObjectId", ref: systemEntities.processor },
			uid: { type: "String", unique: true, sparse: true },
			title: { type: "String", required: true },
			description: { type: "String", required: true },
			steps: [{ type: "ObjectId", ref: systemEntities.step }],
			config: { type: "Mixed" }
		},
		updated: "Date"
	},
	{
		name: systemEntities.processor,
		schema: {
			standalone: { type: "Boolean", default: true },
			requiresIdentity: { type: "Boolean", default: "requiresIdentity" },
			uid: { type: "String", unique: true, sparse: true },
			code: { type: "String", required: true },
			title: { type: "String", required: true }
		},
		updated: "Date"
	},
	{
		name: systemEntities.step,
		schema: {
			description: { type: "String" },
			mode: { type: "String" },
			processors: [{ type: "ObjectId", ref: systemEntities.processor }],
			postprocessors: [
				{ type: "ObjectId", ref: systemEntities.processor }
			],
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
							enum: Object.keys(constants.ELEMENTTYPE),
							required: true
						},
						asyncValidators: [
							{
								type: "ObjectId",
								ref: systemEntities.asyncValidator
							}
						],
						validators: [
							{
								validatorType: {
									type: "String",
									enum: Object.keys(constants.VALIDATORTYPE),
									required: true
								},
								args: { type: "Mixed" }
							}
						],
						args: { type: "Mixed" }
					}
				]
			}
		},
		updated: "Date"
	}
];
