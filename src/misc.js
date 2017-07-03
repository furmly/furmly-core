	Function.prototype.getFunctionBody = function() {
		var entire = this.toString();
		return entire.substring(entire.indexOf("{") + 1, entire.lastIndexOf("}"))
		.replace(/\r/g, '').replace(/\n/g, '').replace(/\t/g, '');
	};