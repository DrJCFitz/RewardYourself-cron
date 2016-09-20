var AWS = require('aws-sdk');
var dynamo = new AWS.DynamoDB({region: process.env.DYNAMODB_REGION, endpoint: process.env.DYNAMODB_ENDPOINT });
var docClient = new AWS.DynamoDB.DocumentClient({params:{}, service: dynamo});
console.log('DynamoDB region: ' + process.env.DYNAMODB_REGION + ', endpoint: ' + process.env.DYNAMODB_ENDPOINT);

var objectToDynamo = function(inputObject) {
	var dynOut = {};
	Object.keys(inputObject).forEach(function(key){
		if ( (typeof(inputObject[key]) !== 'string') ||
				(typeof(inputObject[key]) === 'string' && inputObject[key]) ) {
			dynOut[key] = describeProperty(inputObject[key]);
		}
	});
	return dynOut;
}
var describeProperty = function(inputProperty) {
	switch (typeof inputProperty) {
	case 'number':
		return {"N":inputProperty.toString()};
		break;
	case 'string':
		return {"S":inputProperty};
		break;
	case 'object':
		if (inputProperty === null) {
			return {"NULL":true};
		} else {
			return {"M":objectToDynamo(inputProperty)};
		}
		break;
	}
}

// must pass keyObj in form of {hash: val, range: val}
var batchGet = function(tableName, keyObj, callback) {
	table = tableName || 'Merchants';
	var requestItems = {};
	requestItems[table] = {Keys: [keyObj]};
	var params = { RequestItems: requestItems };

	var queryCallback = function(err, data){
		if (err) {
			console.log(err);
			callback(err, data);
		} else {
			console.log('query response: '+JSON.stringify(data));
			callback(null, data);
		}
	}

	docClient.batchGet(params, queryCallback);
}

// Iterate over all of the additional URLs and keep kicking off batches of up to 25 items
var batchWrite = function(items, table, callback) {
	var params = { RequestItems: { } };
	console.log('batchWrite initial length of items: '+items.length);
	table = table || 'Merchants';
	params['RequestItems'][table] = [];
	
	var attempt = 0;
	var batchCount = 0;
	while (items.length > 0) {

	    // Pull off up to 25 items from the list
	    for (var i = params['RequestItems'][table].length; i < 25; i++) {

	        // Nothing else to add to the batch if the input list is empty
	        if (items.length === 0) {
	            break;
	        }

	        // Take a URL from the list and add a new PutRequest to the list of requests
	        // targeted at the Image table
	        item = items.pop();
	    	//console.log('batchWrite length of items after pop: '+items.length);
	        params['RequestItems'][table].push({ PutRequest: {Item: objectToDynamo(item) }});
	    }
	    // Kick off this batch of requests
	    console.log("Calling BatchWriteItem with a new batch of "
	            + params['RequestItems'][table].length + " items");
	    console.log("batchCount = "+batchCount+" set to execute in "+(10*batchCount)+" seconds");
	    console.log("form of params sent to batchWrite: "+JSON.stringify(params));
	    dynamo.batchWriteItem(params, doBatchWriteItem);

	    // Initialize a new blank params variable
	    params['RequestItems'][table] = [];
	    batchCount++;
	}
	
	//A callback that repeatedly calls BatchWriteItem until all of the writes have completed
	function doBatchWriteItem(err, data) {
      batchCount--;
	    if (err) {
	        console.log(err); // an error occurred
	        if (batchCount === 0) {
		        callback(err, data);
	        }
	    } else {
	        console.dir(data);
	    	if (('UnprocessedItems' in data) && (table in data.UnprocessedItems)) {
          // More data. Call again with the unprocessed items.
          var params = {
              RequestItems: data.UnprocessedItems
          };
	    		attempt++;
          batchCount++;
          console.log("Calling BatchWriteItem again to retry "
              + params['RequestItems'][table].length + "UnprocessedItems in "+(10*attempt)+" seconds");
          console.log("batchCount increased to "+batchCount);
          setTimeout(function(){
          		dynamo.batchWriteItem(params, doBatchWriteItem);
          	},10000*attempt);
	        } else {
	            console.log("BatchWriteItem processed all items in the batch, batchCount = "+batchCount);
	            if (batchCount === 0) {
		            console.log("batchWrite processed all batches");
		            callback(null, data);	            	
	            }
	        }
	    }
	}
}

var batchDelete = function(items, table, callback) {
	var params = { RequestItems: { } };
	console.log('batchWrite initial length of items: '+items.length);
	table = table || 'Merchants';
	params['RequestItems'][table] = [];
	
	var attempt = 0;
	var batchCount = 0;
	while (items.length > 0) {

	    // Pull off up to 25 items from the list
	    for (var i = params['RequestItems'][table].length; i < 25; i++) {

	        // Nothing else to add to the batch if the input list is empty
	        if (items.length === 0) {
	            break;
	        }

	        // Take a URL from the list and add a new PutRequest to the list of requests
	        // targeted at the Image table
	        item = items.pop();
	        var deleteItem = {portalStoreKey: item.portalStoreKey, dateCreated: item.dateCreated };
	    	//console.log('batchWrite length of items after pop: '+items.length);
	        params['RequestItems'][table].push({ DeleteRequest: { Key: objectToDynamo(deleteItem) }});
	    }
	    // Kick off this batch of requests
	    console.log("Calling BatchWriteItem with a new batch of "
	            + params['RequestItems'][table].length + " items");
	    console.log("batchCount = "+batchCount+" set to execute in "+(10*batchCount)+" seconds");
	    console.log("form of params sent to batchWrite: "+JSON.stringify(params));
	    dynamo.batchWriteItem(params, doBatchWriteItem);

	    // Initialize a new blank params variable
	    params['RequestItems'][table] = [];
	    batchCount++;
	}
	
	//A callback that repeatedly calls BatchWriteItem until all of the writes have completed
	function doBatchWriteItem(err, data) {
      batchCount--;
	    if (err) {
	        console.log(err); // an error occurred
	        if (batchCount === 0) {
		        callback(err, data);
	        }
	    } else {
	        console.dir(data);
	    	if (('UnprocessedItems' in data) && (table in data.UnprocessedItems)) {
          // More data. Call again with the unprocessed items.
          var params = {
              RequestItems: data.UnprocessedItems
          };
	    		attempt++;
          batchCount++;
          console.log("Calling BatchWriteItem again to retry "
              + params['RequestItems'][table].length + "UnprocessedItems in "+(10*attempt)+" seconds");
          console.log("batchCount increased to "+batchCount);
          setTimeout(function(){
          		dynamo.batchWriteItem(params, doBatchWriteItem);
          	},10000*attempt);
	        } else {
	            console.log("BatchWriteItem processed all items in the batch, batchCount = "+batchCount);
	            if (batchCount === 0) {
		            console.log("batchWrite processed all batches");
		            callback(null, data);	            	
	            }
	        }
	    }
	}
}

// must pass keyObj in form of {hash: val, range: val}
var get = function(tableName, keyObj, callback) {
	table = tableName || 'Merchants';
	var params = { TableName: tableName };
	params['Key'] = keyObj;

	var queryCallback = function(err, data){
		if (err) {
			console.log(err);
			callback(err, data);
		} else {
			console.log('query response: '+JSON.stringify(data));
			callback(null, data);
		}
	}

	docClient.get(params, queryCallback);
}

var queryStoreRewards = function(storeKey, callback) {
	var params = {};
	params.TableName = 'Merchants';
	params.Select = 'ALL_PROJECTED_ATTRIBUTES';
	params.IndexName = 'StoreIndex';
	params.KeyConditionExpression = 'storeKey = :value';
	params.ExpressionAttributeValues = {':value': storeKey };
	params.FilterExpression = "attribute_exists(reward)";

	var queryCallback = function(err, data){
		if (err) {
			//console.log(err);
			callback(err, data);
		} else {
			//console.log('query response: '+JSON.stringify(data));
			callback(null, data);
		}
	}
	docClient.query(params, queryCallback);	
}

var queryByHash = function(tableName, hashKey, hashValue, callback) {
	var params = {};
	params.TableName = tableName;
	params.Select = 'ALL_ATTRIBUTES';
	params.IndexName = 'StoreIndex';
	params.KeyConditionExpression = hashKey+' = :value';
	params.ExpressionAttributeValues = {':value': hashValue };

	var queryCallback = function(err, data){
		if (err) {
			//console.log(err);
			callback(err, data);
		} else {
			//console.log('query response: '+JSON.stringify(data));
			callback(null, data);
		}
	}

	docClient.query(params, queryCallback);
	
}

var queryByHashDateRange = function(tableName, hashKey, hashValue, dateRange, callback) {
	var params = {};
	params.TableName = tableName;
	params.Select = 'ALL_ATTRIBUTES';
	params.IndexName = 'StoreIndex';
	params.KeyConditionExpression = hashKey+' = :hashValue AND dateCreated BETWEEN :startDateRange AND :endDateRange';
	params.ExpressionAttributeValues = {
		':hashValue': hashValue, 
		':startDateRange': dateRange[0],
		':endDateRange': dateRange[1]
	};

	var queryCallback = function(err, data){
		if (err) {
			//console.log(err);
			callback(err, data);
		} else {
			//console.log('query response: '+JSON.stringify(data));
			callback(null, data);
		}
	}

	docClient.query(params, queryCallback);
	
}

var put = function(tableName, data, callback) {
	table = tableName || 'Merchants';
	var params = { TableName: table };
	params.Item = data;

	var putItemCallback = function(err, data){
		if (err) {
			console.log(err);
		} else {
			console.log('putItem response: '+JSON.stringify(data));
		}
	}

	docClient.put(params, putItemCallback);
}

module.exports = {
	get: get,
	batchGet: batchGet,
	batchDelete: batchDelete,
	queryByHash: queryByHash,
	queryStoreRewards: queryStoreRewards,
	queryByHashDateRange: queryByHashDateRange,
	put: put,
	batchWrite: batchWrite
};