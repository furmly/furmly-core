var Sandbox= require('Sandboxed-module');
this.crosshairs='madting';
Sandbox.require('./test',{
	locals:{message:'it works!'}
});