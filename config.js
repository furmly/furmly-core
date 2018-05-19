module.exports = {
	dev: {
		data: {
			dynamo_url: 'mongodb://localhost:27017/dynamo'
		},
		processors: {
			ttl: 5000
		},
		postprocessors: {
			ttl: 50000
		}
	},
	unitTest: {
		data: {
			dynamo_url: 'mongodb://localhost:27017/unit_test'
		},
		codeGenerator:{},
		processors: {
			ttl: 300000
		},
		postprocessors: {
			ttl: 50000
		}
	}
};