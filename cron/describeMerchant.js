var portal_keys;
var currentTimeStamp = new Date();
var timeStampForDay = new Date(currentTimeStamp.getFullYear(),
    currentTimeStamp.getMonth(),
    currentTimeStamp.getDate())/1000;
var uniqueIds = [];

var merchant = function( merch, portal ) {
    this.name = parseName( merch.name, portal );
    this.portalStoreKey = portal.config.key + ':' + merchantNameToKey( merch.name );
    this.storeKey = merchantNameToKey( merch.name );
    if (merch.link !== undefined) {
        this.link = '';
        if (merch.link.indexOf('http') === -1) {
            this.link = portal.config.baseUrl;
            if (merch.link.indexOf('/') !== 0) {
                // because choice doesn't prepend hrefs with a slash
                merch.link = ('/').concat(merch.link);
            }            
        }
    }
    this.link += merch.link;
    this.reward = parseReward( merch.reward, portal );
    this.topStoreRating = (this.reward !== null && this.reward.limit === null && this.reward.rate !== null) ? Math.round(100*portal.config.equivalentPercentage*this.reward.value)/100 : 0.00;
    this.storeType = portal.config.type;
    this.dateCreated = timeStampForDay;
    // use the id for the timestamp in seconds
    this['_id']= portal.config.key + '_' + this.storeKey + '_' + timeStampForDay;
    return this;
}

var reward = function ( value, unit, rate, limit, portal ) {
    this.value = value;
    this.unit = unit;
    this.rate = rate;
    this.limit = limit;
    this.equivalentPercentage = portal.config.equivalentPercentage;
    this.currency = portal.config.currency;
    return this;
}

var parseName = function( rawName, portal ){
	//debug(rawName);
    if (portal.pageData.name.replace === true ) {
        return rawName.replace(new RegExp(portal.pageData.name.regex), '').trim();
    } else {
        return rawName.trim();
    }
}

var parseReward = function( rawReward, portal ){
    //console.log( rawReward );
    //console.log(portal.pageData.reward.regex);
    var unit, rate, limit, value;
    var matchReward = rawReward.match(new RegExp(portal.pageData.reward.regex));
    //console.log('describeMerchant matchReward: '+JSON.stringify(matchReward));
    if ( null != matchReward ) {
        limit = ( null == matchReward[portal.pageData.reward.limitIndex] ) ? null : matchReward[portal.pageData.reward.limitIndex];
        if ( null == matchReward[portal.pageData.reward.dollarIndex] ) {
            unit = ( null == matchReward[portal.pageData.reward.unitIndex] ) ? null : matchReward[portal.pageData.reward.unitIndex];
            rate = ( null == matchReward[portal.pageData.reward.rateIndex] ) ? null :  matchReward[portal.pageData.reward.rateIndex];
        } else { 
            unit = matchReward[portal.pageData.reward.dollarIndex];
            rate = (matchReward[portal.pageData.reward.unitIndex] === undefined) ? null : matchReward[portal.pageData.reward.unitIndex];
        }
        if (rate) {
            rate = rate.replace(/\s/,'');
        }
        if (unit) {
            unit = unit.trim();
        }
        value = ( null == matchReward[portal.pageData.reward.valueIndex] ) ? 0.0 : parseFloat(matchReward[portal.pageData.reward.valueIndex]);
        //console.log('matchReward components: '+JSON.stringify([value, limit, unit,rate]));
        return new reward( value, unit, rate, limit, portal );
    } else {
    	return matchReward;
    }
}

var merchantNameToKey = function( merchantName ) {
    // strip any spaces or special characters from name and convert to lowercase
    var keyName = merchantName.replace(/\W+/g,'').replace(/\s+/g,'').toLowerCase().trim();
    //console.log('merchantNameToKey portal_keys: '+JSON.stringify(portal_keys));
    if (portal_keys[keyName] === undefined ) {
        return keyName.trim();
    } else {
        return portal_keys[keyName];
    }
}

var process = function( portal, merchants, portalKeys, callback) {
    portal_keys = portalKeys;
    console.log('describeMerchant input ' + merchants.length);
    //console.log('global portal_keys undefined?: '+JSON.stringify(undefined === portalKeys));
    var dedupedMerch = [];
    var uniqueIds = [];
    merchants.forEach(function(merchElement, index, array){
        generatedMerchant = new merchant(merchElement, portal);
        if (uniqueIds.indexOf(generatedMerchant.portalStoreKey) === -1 
            && generatedMerchant.reward !== null) {
            uniqueIds.push(generatedMerchant.portalStoreKey);
            dedupedMerch.push(generatedMerchant);
        } else {
            console.log('duplicate entry for ' + generatedMerchant.portalStoreKey);
        }
    });
    console.log('uniqueIds length ' + uniqueIds.length);
    console.log('describeMerchant output ' + dedupedMerch.length);
    callback(null, dedupedMerch);
}

module.exports = process;
