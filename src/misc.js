	Function.prototype.getFunctionBody = function() {
		var entire = this.toString();
		return entire.substring(entire.indexOf("{") + 1, entire.lastIndexOf("}"));
			//.replace(/\r/g, '').replace(/\n/g, '').replace(/\t/g, '');
	};

	exports.getCurrentScriptPath = function() {
		// Relative path from current working directory to the location of this script
		var pathToScript = path.relative(process.cwd(), __filename);

		// Check if current working dir is the same as the script
		if (process.cwd() === __dirname) {
			// E.g. "./foobar.js"
			return '.' + path.sep + pathToScript;
		} else {
			// E.g. "foo/bar/baz.js"
			return pathToScript;
		}
	};