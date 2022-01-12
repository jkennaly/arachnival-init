const AWS = require("aws-sdk")
const redis = require("redis");
const client = redis.createClient({url: process.env.REDIS_URL});
exports.handler = async (event, context, callback) => {
    let lineupUrl = ""
    let responseCode = 200;
    //console.log("request: " + JSON.stringify(event));
    if (event.lineupUrl) {
        lineupUrl = event.lineupUrl;
    }
    if (!lineupUrl && event.queryStringParameters && event.queryStringParameters.lineupUrl) {
        lineupUrl = event.queryStringParameters.lineupUrl;
    }
  	if(!lineupUrl) return callback('No lineupUrl query parameter' + JSON.stringify(event))
    const leKey = 'arach-lineup.' + lineupUrl
  	let result;
	console.log('starting redis')
    	//await chromium.font('./.fonts/NotoColorEmoji.ttf');
        return client.connect()
    	  	.then(() => client.get(leKey))
    	  	//.then(x => console.log('started redis', x) || x)
    	  	.then(raw => JSON.parse(raw))
			.catch(err => {
				console.error('linedEvents Redis Error: ' + lineupUrl)
				console.error(err)
			})
			.then(data => {
				//console.log('From Redis', data)
				//return real data should be 200
				if (data && data.status !== 'pending') {
					 const response = {
				        "statusCode": 200,
				        "headers": {
				        },
				        "body": JSON.stringify(data),
				        "isBase64Encoded": false
				    };
				    return callback(null, response)
				} 
				//return placeholder-should be a 202 not 200
				if (data) {
					 const response = {
				        "statusCode": 202,
				        "headers": {
				        },
				        "body": JSON.stringify(data),
				        "isBase64Encoded": false
				    };
				    return callback(null, response)
				} 
				//console.log('Redis data not available, triggering collection')
				const pendingObject = {
					lineupUrl: lineupUrl,
					status: 'pending',
					triggered: Date.now(),
					eta: Date.now() + 120*1000
				}
				return client.set(leKey, JSON.stringify(pendingObject), {
					EX: 60 * 3
				})
					.then(() => {
						const awsRegion = "us-east-1";
					    const snsTopic = 'arn:aws:sns:us-east-1:246401628237:UncheckedLineupUrls';
					    const snsSubject = 'Arachnival Lineup';
					    // Create publish parameters
					    const message = JSON.stringify({lineupUrl})
					    var params = {
					      Message: message,
					      Subject: snsSubject,
					      TopicArn: snsTopic
					    };
					    var sns = new AWS.SNS({ region: awsRegion });
					    return sns.publish(params).promise()
					    	.then(() => {
								 const response = {
							        "statusCode": 202,
							        "headers": {
							        },
							        "body": JSON.stringify(pendingObject),
							        "isBase64Encoded": false
							    };
					    		return callback(null, response)
					    	})
					    	.catch(err => {
					    		console.error('SNS publish Error')
					    		console.error(err)
					    		return callback(err)
					    	})
					})
				//retunr placeholder-should be 202
				
		})
    .catch(error => {
        return callback(error);
    })
    .finally(() => {
    	client.quit()
    })
};