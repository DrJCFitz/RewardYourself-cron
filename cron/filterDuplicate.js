var async = require('async');
var redis = require('../db/redis/redisConn.js');
var dynamo = require('../db/DynamoDB/dynamoDBConn.js');

var getStoreList = function(callback) {
	redis.getCachedStoreNames(function(err,data){
		if (err) {
			callback(err);
		}
		callback(null, Object.keys(data));
	});
}

var checkDuplicateRewards = function(storeList, callback){
    async.eachSeries(storeList,
        function(store, eachCallback){
          async.waterfall(
              [
	              function(callback){
	              	dynamo.queryStoreRewards(store, function(err,data){
	              		if (err) {
	              			callback(err);
	              		}
	              		if (null === data.Items || data.Items === undefined) {
	              			console.log('no data returned from DynamoDB')
	              			callback(true);
	              		}
	              		callback(null,data.Items);
	              	});
	              },
	              function(storeRewards, callback) {
	              	console.log('dataset for '+storeRewards[0].storeKey+' contains '+storeRewards.length+' points before reduction');
									var currValue = {};
									var removeData = storeRewards.filter(function(element, index, array){
										var val = element.reward.value*parseFloat(element.reward.equivalentPercentage);
										if (currValue[element.portalStoreKey] === undefined 
											|| currValue[element.portalStoreKey] !== val
											|| index >= (array.length - Object.keys(currValue).length)) {
											//console.log('currValue = '+currValue[element.portalStoreKey]+' and val = '+val+' which evaluates to '+JSON.stringify(currValue[element.portalStoreKey] !== val));
											currValue[element.portalStoreKey] = val;
											return false;
										} else {
											return true;
										}
									});
	              	console.log('dataset contains '+removeData.length+' less points after reduction');
									callback(null, removeData);
	              },
	              function(dataToRemove, callback) {
	              	dynamo.batchDelete(dataToRemove, 'Merchants', function(err,data){
	              		callback(null, data);
	              	});
	              }
              ],
              function(err){
                  console.log('finished series waterfall');
                  eachCallback(null, {});
              }
          );
        },
        function(err){
            console.log('finished series');
            callback(null, {});
        }
    );
}

async.waterfall(
    [
      getStoreList,
      checkDuplicateRewards
    ],
    function(err){
        console.log('first waterfall complete');
        process.exit();
    }
);

/*
what remains: 

delta:1800contacts 3 1469404800
united:1800contacts 3 1469404800
ebates:1800contacts 6 1469404800
american:1800contacts 4 1469404800
marriott:1800contacts 8 1469404800
etihad:1800contacts 1 1469404800
upromise:1800contacts 5 1469404800

ebates:1800contacts 5 1471392000

delta:1800contacts 3 1474156800
united:1800contacts 3 1474156800
ebates:1800contacts 5 1474156800
american:1800contacts 4 1474156800
marriott:1800contacts 8 1474156800
etihad:1800contacts 1 1474156800
upromise:1800contacts 5 1474156800
*/