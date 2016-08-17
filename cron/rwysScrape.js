var async = require('async');
var redis = require('../db/redis/redisConn.js');
var dynamo = require('../db/DynamoDB/dynamoDBConn.js');
var encryptDecrypt = require('./encryptDecrypt');
var describeMerchant = require('./describeMerchant.js');
var scrape = require('./scrapeRedis.js');

var clearKeys = function(callback) {
    ['store:counts', 'store:names'].forEach(function(key, index, origArray){
        redis.keyExists(key, function(err,response){
            if (parseInt(response) > 0) {
                redis.wipeKey(key, function(wipeErr, wipeResp){
                    console.log('wipeKey response: '+key+' '+JSON.stringify(wipeResp));
                });
            }
        });
        if (index === (origArray.length-1)) {
            callback(null,{});
        }
    });
}

/**
 * getAllPortalStatus()
 *
 * used in the first step of the outer waterfall process, 
 * getPortalData queries the database for all portals available for processing
 * 
 * @param callback -- callback for passing a return value to the next function in sequence
 */
var getAllPortalStatus = function(data, callback){
    // get the online portal information
    redis.retrievePortalStatusKeys('online',function(err, portals){
        if (err) { 
            callback(err,portals); 
        }
        console.log(portals.length+' portals in array');
        // returns an array of portal data
        callback(null,portals);
    })
}

/**
 * decryptCredentials()
 * 
 * used to decrypt the username and password credentials with the public key
 * @param encryptedCredentials - an object with `username` and `password` keys
 * @param callback - callback for returning data to the next function in sequence 
 */
var decryptCredentials = function(encryptedCredentials, callback){
    if (encryptedCredentials !== null && encryptedCredentials !== '') {
        var credentialsObj = {
            username: encryptDecrypt.decrypt(encryptedCredentials.username),
            password: encryptDecrypt.decrypt(encryptedCredentials.password)
        };
        callback(null, credentialsObj);
    } else {
        callback(null, null);
    }
}

var writeDynamoStep = function(describeResult, writeDynamoCallback){
    console.log('writing results to AWS DynamoDB');
    
    if (typeof describeResult !== 'object' || describeResult.length === 0) {
        console.log('no described merchants were passed to writeDynamoStep');
        writeDynamoCallback(true,{});
    }
    //console.log(JSON.stringify(writeMongoResult));
    console.log('typeof describeResult: '+JSON.stringify(typeof describeResult));
    dynamo.batchWrite(describeResult, 'Merchants', function(err, data){
        if (err) {
            console.log('there was an error writing to dynamo, loop is exiting');
        }
        writeDynamoCallback(null,data);
    });
}

var writeRedisStep = function(dataToWrite, callback){
    console.log('writing describeMerchant results to redis');
    if (typeof dataToWrite !== 'object' || dataToWrite.length === 0) {
        console.log('no described merchants were passed to writeRedisStep');
        callback(null, dataToWrite);
    }

    populateStoreCounts(dataToWrite, function(err,dataOut) {
        console.log(JSON.stringify(dataOut));
        callback(null, dataToWrite);
    });
}

var actOnPortals = function(portalData, callback){
    async.eachSeries(portalData,
        function(portal, eachCallback){
            // put any functions dependent on portal being in scope below
            console.log('acting on portal '+JSON.stringify(portal));
            var portalData = {config: {}, 
                pageData: { link: {}, name: {}, reward: {} },
                credentials: {},
                status: {},
                key: portal.split(':')[1]
            };
            var storeKeyNames = {};
            async.waterfall(
                [function(callback){
                      redis.retrieveStoreKeys(function(err, storeKeys){
                          if (err) console.log(err);
                          console.log('portal_keys length: '+Object.keys(storeKeys).length);
                          storeKeyNames = storeKeys; 
                          callback(null,storeKeys);
                    });
                 },
                 function(storeKeys,callback){
                    console.log('storeKeys result: '+Object.keys(storeKeys).length);
                    console.log('portalConfig step status: '+JSON.stringify(portalData));
                    redis.retrievePortalStatus(portal,function(err, status){
                        if (err) callback(err);
                        portalData['status'] = status;
                        portalData['status']['continue'] = true;
                        for (var key in portalData['status']) {
                            if (portalData['status'][key] === 'false' 
                                || portalData['status'][key] === 0) {
                                portalData['status']['continue'] = false;
                                console.log('portalData indicates insufficient status to continue: '+JSON.stringify(portalData));
                            }                            
                        }
                        if (portalData['status']['continue'] === true) {
                            callback(null,portalData);
                        } else {
                            eachCallback(null, {});
                        }
                    });
                 },
                 function(portalStatus, callback){
                    console.log('portalConfig step portalData: '+JSON.stringify(portalData));
                    redis.retrievePortalConfig(portalData.key,'online',function(err, config){
                        if (err) callback(err);
                        portalData['config'] = config;
                        callback(null,portalData);
                    });
                 },
                 function(config, callback){
                    console.log('retrievePortalLink step portalData: '+JSON.stringify(portalData));
                    redis.retrievePortalLink(portalData.key,'online',function(err, linkData){
                        if (err) callback(err);
                        portalData['pageData']['link'] = linkData;
                        callback(null,linkData);
                    });
                 },
                 function(linkData, callback){
                    console.log('retrievePortalName step portalData: '+JSON.stringify(portalData));
                    redis.retrievePortalName(portalData.key,'online',function(err, nameData){
                        if (err) callback(err);
                        portalData['pageData']['name'] = nameData;
                        callback(null,nameData);
                    });
                 },
                 function(nameData, callback){
                    console.log('retrievePortalReward step portalData: '+JSON.stringify(portalData));
                    redis.retrievePortalReward(portalData.key,'online',function(err, rewardData){
                        if (err) callback(err);
                        portalData['pageData']['reward'] = rewardData;
                        callback(null,rewardData);
                    });
                 },
                 function(rewardData, callback){
                    console.log('retrieving credentials with portal id: '+JSON.stringify([portalData, rewardData]));
                    if (portal.requiresAuth !== undefined && portal.requiresAuth === 'true') {
                        redis.retrieveCredentials(portalData.key, function(err, credentials){
                            if (err) { 
                                callback(err); 
                            }
                            if (credentials === null) { 
                                console.log('WARNING: credentials not found for '+portal); 
                            }
                            callback(err, dbData);
                        });                  
                    } else {
                        callback(null, null);
                    }
                 },
                 decryptCredentials,
                 // scrape the page with the set portal data
                 function(decryptedCredentials, callback) {
                    console.log('starting page scrape process');
                    if (decryptedCredentials !== null) {
                        portalData['credentials'] = decryptedCredentials;
                    }
                    scrape(portalData, function(err, pageData){
                        if (err) {
                            console.log('spooky returned error');
                            callback(err,pageData); 
                        }
                        // For most scrapeTypes, will return an object: {response: {health: {}, merchants: [] } }
                        //   for scrapeType 1, will return a string: 'accessToken'
                        // Pass the data onto the next function
                        callback(null,pageData);
                    });
                  },
                  function(spookyResult, callback){
                    console.log('using spookyResult to describe merchant '+(typeof spookyResult));
                    //console.log('spookyResult '+ spookyResult);
                    var result = JSON.parse(spookyResult);
                    // check to make sure the `merchants` key is defined on the curlResult argument
                    //   and that the array length is not zero
                    if ( null == result || result.length === 0 ) {
                        console.log('describeMerchantBlock callback error');
                        callback(true,result);
                    } else {
                        console.log(result.length+" merchants returned for "
                                +"["+portalData.config.key+","+portalData.config.type+"]");
                        // the merchants array consists of a simple object
                        //   {name: '...', link: '...', reward: '...' }
                        // use portal data to expand the scope and implement custom logic in describeMerchant
                        var merchants = describeMerchant( portalData, result, storeKeyNames, function(err,descMerchs){
                            //console.log('describeMerchant returns: '+JSON.stringify(descMerchs));
                            callback(null, descMerchs);
                        });
                    }
                  },
                  function(dataToWrite, callback) {
                    var dataLength = dataToWrite.length;
                    var incrementCount = 0;
                    var nameCount = 0;
                    dataToWrite.forEach(function(element){
                        redis.cacheStoreName(element.storeKey, element.name, function(err,cacheResp){
                            nameCount++;
                            if (incrementCount === dataLength && nameCount === dataLength) {
                                callback(null, dataToWrite);
                            }
                        })
                        redis.incrementStoreCountByOne(element.storeKey, function(err,cacheResp){
                            incrementCount++;
                            if (incrementCount === dataLength && nameCount === dataLength) {
                                callback(null, dataToWrite);
                            }
                        });
                    });
                  },
                  writeDynamoStep
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
      clearKeys,
      getAllPortalStatus,
      actOnPortals
    ],
    function(err){
        console.log('first waterfall complete');
        process.exit();
    }
);
