module.exports = {
	dev: {
		data: {
			url: 'mongodb://localhost:27017/dynamo'
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
			url: 'mongodb://localhost:27017/unit_test'
		},
		processors: {
			ttl: 5000
		},
		postprocessors: {
			ttl: 50000
		}
	}
};