/**
 * Use a cache for db with entries defined as
 * portal:keys - list
 * store:keys - map
 * portal:names - map

 * portal:config:<portal key> - map
 * portal:credentials:<portal key> - map
 * portal:pagedata:link:<portal key> - map
 * portal:pagedata:name:<portal key> - map
 * portal:pagedata:reward:<portal key> - map
 *
 * status:<portal key>:<portal type> - map
 * topDeals - ordered list
 * store:names - map
 */

var redis = require('redis');

var client;

var connectToRedis = function() {
	console.log('connectToRedis host : '+process.env.REDIS_PORT_6379_TCP_ADDR);
	if (process.env.REDIS_PORT_6379_TCP_ADDR === undefined
		|| process.env.REDIS_PORT_6379_TCP_PORT === undefined) {

		setTimeout(connectToRedis, 1000);
	} else {
		console.log('redisConn connect to server');
		client = new redis.createClient({
			host: process.env.REDIS_PORT_6379_TCP_ADDR, 
			port: process.env.REDIS_PORT_6379_TCP_PORT
		});
		if (client) {
			console.log('client defined');
		} else {
			console.log('client not defined');
		}
	}
}

var retrieveCredentialsByPortalID = function(portalID, type, callback) {
	if (client === undefined) {
		setTimeout(retrieveCredentialsByPortalID,500,portalID,callback);
		connectToRedis();
	} else {
		if (type === undefined) {
			type = 'online';
		}
		console.log('retrieveCredentialsByPortalID finding map for '+'portal:credentials:'+portalID+':'+type);
		client.hgetall('portal:credentials:'+portalID+':'+type, callback);		
	}
}

var retrievePortalStatusKeys = function(type, callback) {
	if (client === undefined) {
		console.log('call to setTimeout for retrieveAllPortalStatus');
		setTimeout(retrieveAllPortalStatus, 500, type, callback);
		connectToRedis();
	} else {
		if (type === undefined) {
			type = 'online';
		}
		console.log('retrieveAllPortalStatus finding keys for type '+type);
		client.keys('status:*:'+type, callback);
	}
}

var retrievePortalStatus = function(statusKey, callback) {
	if (client === undefined) {
		console.log('call to setTimeout for retrievePortalStatusByPortalID');
		setTimeout(retrievePortalStatusByPortalID, 500, statusKey, callback);
		connectToRedis();
	} else {
		console.log('retrievePortalStatusByPortalID finding staus for '+statusKey);
		client.hgetall(statusKey, callback);
	}
}

var retrievePortalConfigByPortalID = function(portalID, type, callback) {
	if (client === undefined) {
		console.log('call to setTimeout for retrievePortalConfigByPortalID');
		setTimeout(retrievePortalConfigByPortalID,500,portalID, callback);
		connectToRedis();
	} else {
		if (type === undefined) {
			type = 'online';
		}
		console.log('retrievePortalConfigByPortalID finding map for '+'portal:config:'+portalID+':'+type);
		client.hgetall('portal:config:'+portalID+':'+type, callback);		
	}
}

var retrievePortalLinkDataByPortalID = function(portalID, type, callback) {
	if (client === undefined) {
		console.log('call to setTimeout for retrievePortalLinkDataByPortalID');
		setTimeout(retrievePortalLinkDataByPortalID,500,portalID, callback);
		connectToRedis();
	} else {
		if (type === undefined) {
			type = 'online';
		}
		console.log('retrievePortalLinkDataByPortalID finding one by '+portalID);
		client.hgetall('portal:pagedata:link:'+portalID+':'+type, callback);		
	}
}

var retrievePortalNameDataByPortalID = function(portalID, type, callback) {
	if (client === undefined) {
		console.log('call to setTimeout for retrievePortalNameDataByPortalID');
		setTimeout(retrievePortalNameDataByPortalID,500,portalID, callback);
		connectToRedis();
	} else {
		if (type === undefined) {
			type = 'online';
		}
		console.log('retrieveCredentialsByPortalID finding map for '+'portal:pagedata:name:'+portalID+':'+type);
		client.hgetall('portal:pagedata:name:'+portalID+':'+type, callback);		
	}
}

var retrievePortalRewardDataByPortalID = function(portalID, type, callback) {
	if (client === undefined) {
		console.log('call to setTimeout for retrievePortalRewardDataByPortalID');
		setTimeout(retrievePortalRewardDataByPortalID,500,portalID, callback);
		connectToRedis();
	} else {
		if (type === undefined) {
			type = 'online';
		}
		console.log('retrieveCredentialsByPortalID finding map for '+'portal:pagedata:reward:'+portalID+':'+type);
		client.hgetall('portal:pagedata:reward:'+portalID+':'+type, callback);		
	}
}

var retrievePortalKeys = function(callback) {
	if (client === undefined) {
		console.log('retrievePortalKeys client undefined');
		setTimeout(retrievePortalKeys,500, callback);
		connectToRedis();
	} else {
		console.log('retrievePortalKeys hgetall');
		client.lrange('portal:keys', 0, 50, callback);
	}
}

var retrieveStoreKeys = function(callback) {
	if (client === undefined) {
		setTimeout(retrieveStoreKeys,500, callback);
		connectToRedis();
	} else {
		client.hgetall('store:keys', callback);
	}
}

var updateStatus = function(status, callback) {
	//console.log(JSON.stringify([portal.portal.key, portal.portal.type]));
	if (client === undefined) {
		setTimeout(updateStatus,500,status,callback);
		connectToRedis();
	} else {
		client.hmset('status:'+status['portalKey']+':'+status['portalType'], status, callback);
	}
}

connectToRedis();

module.exports = {
	retrieveCredentials: retrieveCredentialsByPortalID,
	retrievePortalConfig: retrievePortalConfigByPortalID,
	retrievePortalLink: retrievePortalLinkDataByPortalID,
	retrievePortalName: retrievePortalNameDataByPortalID,
	retrievePortalReward: retrievePortalRewardDataByPortalID,
	retrievePortalStatusKeys: retrievePortalStatusKeys,
	retrievePortalStatus: retrievePortalStatus,
	retrievePortalKeys: retrievePortalKeys,
	retrieveStoreKeys: retrieveStoreKeys,
	updateStatus: updateStatus,
};
