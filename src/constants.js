function createConstants() {
	function Constant() {
		var array = Array.prototype.slice.call(arguments);
		for (var i = 0; i < array.length; i++) {
			if (typeof array[i] == "string") {
				this[array[i]] = array[i];
				continue;
			}
			if (array[i].length == 1) {
				this[array[i][0]] = array[i][0];
				continue;
			}
			this[array[i][0]] = array[i][1];
		}
	}
	Constant.prototype.in = function(val) {
		for (var i in this) {
			if (this.hasOwnProperty(i) && this[i] == val) return true;
		}
		return false;
	};

	return {
		PROCESSSTATUS: new Constant("COMPLETED", "RUNNING"),
		COMMANDTYPE: new Constant("DEFAULT", "DOWNLOAD"),
		STEPSTATUS: new Constant("COMPLETED", "RUNNING"),
		PROCESSORTYPE: new Constant("SERVER", "CLIENT"),
		GRIDMODE: new Constant("DEFAULT", "CRUD", "EDITONLY", "CREATEONLY"),
		GRIDCOMMANDTYPE: new Constant("PROCESSOR", "NAV"),
		STEPMODE: new Constant("VIEW", "PROCESS"),
		STEPTYPE: new Constant("OFFLINE", "CLIENT"),
		ELEMENT_SELECT_SOURCETYPE: new Constant("PROCESSOR", "FORM"),
		ENTRYMODE: new Constant(["OBJECTID", "ObjectId"]),
		VALIDATORTYPE: new Constant(
			"REQUIRED",
			"MAXLENGTH",
			"MINLENGTH",
			"REGEX"
		),
		INPUTTYPE: new Constant(
			["TEXT", "text"],
			["NUMBER", "number"],
			["DATE", "date"],
			["CHECKBOX", "checkbox"],
			["PASSWORD", "password"]
		),
		NAVIGATIONTYPE: new Constant("CLIENT", "DYNAMO"),
		IMAGETYPE: new Constant("REL", "DATA", "URL"),
		UIDS: {
			LIB: new Constant(
				["CREATE_MIN_LENGTH_VALIDATOR", "createMinLengthValidator"],
				["CREATE_MAX_LENGTH_VALIDATOR", "createMaxLengthValidator"],
				["CREATE_REGEX_VALIDATOR", "createRegexValidator"],
				["CREATE_REQUIRED_VALIDATOR", "createRequiredValidator"],
				["CONVERT_FILTER", "convertFilter"],
				["CREATE_ID", "createId"],
				["CHECK_USER_PASSWORD_AND_PRIVILEDGE", "isAuthorized"],
				["CONVERT_SCHEMA_TO_ELEMENTS", "ElementsConverter"],
				["CREATE_CRUD_PROCESS", "createCRUDProcess"],
				["CREATE_ELEMENT", "createElement"],
				["FIND_ELEMENT_BY_NAME", "findElementByName"],
				["CONVERT_TO_SELECTABLE_LIST", "convertToSelectableList"],
				["CONVERT_AND_SAVE_FILE", "convertFileAndSave"]
			),
			PROCESSOR: new Constant(
				"GET_DOMAINS",
				"FETCH_SCHEMA",
				"CREATE_SCHEMA",
				"UPDATE_SCHEMA",
				"LIST_ENTITY_SCHEMAS",
				"LIST_ENTITY_TYPES",
				"LIST_ENTITY_GENERIC",
				"LIST_ASYNC_VALIDATORS",
				"LIST_PROCESSES",
				"LIST_LIBS",
				"LIST_PROCESSORS",
				"LIST_INPUT_TYPES",
				"LIST_ELEMENT_TYPES",
				"LIST_STEPS",
				"FETCH_PROCESS",
				"CREATE_PROCESS",
				"CREATE_LIB",
				"CREATE_PROCESSOR",
				"CREATE_ENTITY",
				"UPDATE_ENTITY",
				"FETCH_ENTITY",
				"MENU_FILTER"
			),
			PROCESS: new Constant(
				"MANAGE_ENTITY_SCHEMA",
				"CREATE_PROCESS",
				"MANAGE_PROCESS",
				"MANAGE_PROCESSOR",
				"MANAGE_LIBS"
			)
		},
		ENTITYTYPE: new Constant(
			["STRING", "String"],
			["NUMBER", "Number"],
			["DATE", "Date"],
			["BOOLEAN", "Boolean"],
			["OBJECT", "Object"],
			["REFERENCE", "ObjectId"],
			["ARRAY", "Array"]
		),
		ELEMENTTYPE: new Constant(
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
		),
		systemEntities: {
			step: "_0Step",
			processor: "_0Processor",
			process: "_0Process",
			asyncValidator: "_0AsyncValidator",
			lib: "_0Lib"
		}
	};
}

module.exports = createConstants();
