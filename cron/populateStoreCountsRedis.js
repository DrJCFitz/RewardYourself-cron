var async = require('async');
var redisConn = require('../db/redis/redisConn.js');

var getKeysToClear = function(callback) {
 	callback(null, ['store:counts', 'store:names']);
}

var clearKeys = function(keys, callback) {
	keys.forEach(function(key){
		redisConn.keyExists(key, function(err,response){
			if (parseInt(response) > 0) {
				redisConn.wipeKey(key, function(wipeErr, wipeResp){
					console.log('wipeKey response: '+key+' '+JSON.stringify(wipeResp));
					callback(null,{});
				});
			} else {
				callback(null,{});
			}
		});
	});
}

var cacheData = function(data, callback) {
	var dataLength = data.length;
	var incrementCount = 0;
	var nameCount = 0;
	data.forEach(function(element){
		redisConn.cacheStoreName(element.storeKey, element.name, function(err,cacheResp){
			nameCount++;
			if (incrementCount === dataLength && nameCount === dataLength) {
				callback(null,{});
			}
		})
		redisConn.incrementStoreCountByOne(element.storeKey, function(err,cacheResp){
			incrementCount++;
			if (incrementCount === dataLength && nameCount === dataLength) {
				callback(null,{});
			}
		});
	});	
}

module.exports = function(dataIn, callback) {
	var getDataToParse = function(keyResult, callback) {
		callback(null, dataIn);
	}

	async.waterfall(
	    [
	    	getKeysToClear,
	      clearKeys,
	      getDataToParse,
	      cacheData
	    ],
	    function(err){
	    		if (err) callback(err, null);
	        console.log('populateStoreCounts waterfall complete');
	        callback(null, {});
	    }
	);	
}
