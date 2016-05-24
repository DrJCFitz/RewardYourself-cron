var async = require('async');
var redis = require('../db/redis/redisConn.js');
var encryptDecrypt = require('./encryptDecrypt');
var statusCheck = require('./statusCheckRedis.js');

/**
 * getPortalData()
 *
 * used in the first step of the outer waterfall process, 
 * getPortalData queries the database for all portals available for processing
 * 
 * @param callback -- callback for passing a return value to the next function in sequence
 */
var getPortalKeys = function(callback){
    // get the online portal information
    redis.retrievePortalKeys(function(err, portals){
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

var describeMerchantStep = function(rawData, callback){
     console.log('using spookyResult/curlResult to describe merchant');
     callback(null, {});
     // check to make sure the `merchants` key is defined on the curlResult argument
     //   and that the array length is not zero
     /*
     if ( undefined == curlResult.merchants || curlResult.merchants.length === 0 ) {
        callback(true,curlResult);
     } else {
        console.log(curlResult.merchants.length+" merchants returned for "
                +"["+portal.portal.key+","+portal.portal.type+"]");
        // the merchants array consists of a simple object
        //   {name: '...', link: '...', reward: '...' }
        // use portal data to expand the scope and implement custom logic in describeMerchant
        var merchants = describeMerchant( portal, curlResult.merchants );
        callback(null, merchants);
     }*/
}

var writeDynamoStep = function(writeMongoResult, writeDynamoCallback){
    console.log('writing results to AWS DynamoDB');
    writeDynamoCallback(null, {});
    /*
    if (err) {
        console.log('there was an error and portal loop is exiting');
        writeDynamoCallback();
    }
    //console.log(JSON.stringify(writeMongoResult));
    console.log('typeof writeMongoResult: '+JSON.stringify(typeof writeMongoResult));
    dynamoBatchWrite(writeMongoResult, 'Merchants', function(err, data){
        if (err) {
            console.log('there was an error writing to dynamo, loop is exiting');
        }
        writeDynamoCallback();
    });
    */
  }
var writeRedisStep = function(dataToWrite, callback){
    console.log('writing describeMerchant results to redis');
    if ((dataToWrite.portalKey !== undefined && dataToWrite.portalKey !== '')
        && dataToWrite.portalType !== undefined && dataToWrite.portalType !=='') {
        redis.updateStatus(dataToWrite, function(err, result){
            if (err) { console.log(err); callback(err); }
            console.log('refreshStatus result: '+JSON.stringify(result));
            callback(null, result);
        });        
    } else {
        console.log('writeRedisStep: portalKey or portalType in dataToWrite not correctly set');
        callback(null, {});
    }
    /*
    // last step per portal: bulk-write results to mongoDB merchants table
    // mongoDB store will only be used for current data
    mongodb.updateMerchants(portal, describeResult, function(err, data){
        if (err) {
            console.log(err);
        }
        console.log('mongo wrote items');
        //console.log(data);
        describeCallback(null, describeResult);
    });
    */
}

var actOnPortals = function(portalData, callback){
    async.eachSeries(portalData,
        function(portal, eachCallback){
            // put any functions dependent on portal being in scope below
            console.log('acting on portal '+JSON.stringify(portal));
            var portalData = {config: {}, 
                pageData: { link: {}, name: {}, reward: {} },
                credentials: {}
            };
            async.waterfall(
                [
                 function(callback){
                    console.log('portalConfig step portalData: '+JSON.stringify(portalData));
                    redis.retrievePortalConfig(portal,'online',function(err, config){
                        if (err) callback(err);
                        portalData['config'] = config;
                        callback(null,portalData);
                    });
                 },
                 function(config, callback){
                    console.log('retrievePortalLink step portalData: '+JSON.stringify(portalData));
                    redis.retrievePortalLink(portal,'online',function(err, linkData){
                        if (err) callback(err);
                        portalData['pageData']['link'] = linkData;
                        callback(null,linkData);
                    });
                 },
                 function(linkData, callback){
                    console.log('retrievePortalName step portalData: '+JSON.stringify(portalData));
                    redis.retrievePortalName(portal,'online',function(err, nameData){
                        if (err) callback(err);
                        portalData['pageData']['name'] = nameData;
                        callback(null,nameData);
                    });
                 },
                 function(nameData, callback){
                    console.log('retrievePortalReward step portalData: '+JSON.stringify(portalData));
                    redis.retrievePortalReward(portal,'online',function(err, rewardData){
                        if (err) callback(err);
                        portalData['pageData']['reward'] = rewardData;
                        callback(null,rewardData);
                    });
                 },
                 function(rewardData, callback){
                    console.log('retrieving credentials with portal id: '+JSON.stringify([portalData, rewardData]));
                    if (portal.requiresAuth !== undefined && portal.requiresAuth === 'true') {
                        redis.retrieveCredentials(portal, function(err, credentials){
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
                    statusCheck(portalData, function(err, pageData){
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
                    console.log('spookyResult: '+JSON.stringify(typeof spookyResult));
                    console.log('using curl in combination with pageToken');
                    // make sure to pass an object to writeMongo
                    var result = JSON.parse(spookyResult);
                    result['portalKey'] = portalData.config.key;
                    result['portalType'] = portalData.config.type;
                    result['dateCreated'] = parseInt(new Date().getTime()/1000);
                    callback(null,result);
                    // if scrapeType 1, URL-encode the string and pass it to curlScrape
                    /*
                    if (portalData.portal.scrapeType === 1) {
                        var accessToken = encodeURIComponent(spookyResult);
                        var returnCurlData = function(curlErr, curlData){
                            if (curlErr) {
                                callback(curlErr,curlData);
                            }
                            // if the cURL request completes successfully, create a response
                            // object and populate it with the merchant data array
                            var response = {};
                            console.log('curlData: '+JSON.stringify(curlData));
                            response.merchants = curlData;
                            // pass the response object along to the describeMerchant block
                            callback(null, response);
                        }
                        console.log('cronRemote accessToken urlencoded: '+encodeURIComponent(accessToken));
                        curlScrape(portal, accessToken, returnCurlData);
                    } else {
                        // For scrapeType != 1, the spookyResult is a response object
                        //  pass along to the describeMerchant block
                     console.log('cronRemote typeof spookyResult? '+JSON.stringify(typeof spookyResult));
                     //console.log('cronRemote JSON.parse(spookyResult)'+JSON.stringify(JSON.parse(spookyResult)));
                        callback(null,JSON.parse(spookyResult));
                    }
                    */
                  },
                  writeRedisStep,
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
      getPortalKeys,
      actOnPortals
    ],
    function(err){
        console.log('first waterfall complete');
        process.exit();
    }
);
