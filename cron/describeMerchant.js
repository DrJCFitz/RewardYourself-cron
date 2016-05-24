var portal_keys;
var currentTimeStamp = new Date();
var timeStampForDay = new Date(currentTimeStamp.getFullYear(),
    currentTimeStamp.getMonth(),
    currentTimeStamp.getDay())/1000;

var merchant = function( merch, portal ) {
    this.name = parseName( merch.name, portal );
    this.storeKey = merchantNameToKey( merch.name );
    if (portal.pageData.link.path !== undefined) {
        this.link = portal.baseUrl + portal.pageData.link.path + merch.link;
    } else {
    	var linkSplit = merch.link.split(new RegExp('(\\.+)?(.+)'));
    	this.link = ((linkSplit[1] !== undefined) ? portal.baseUrl : '') + linkSplit[2];
    }
    this.reward = parseReward( merch.reward, portal );
    this.topStoreRating = (this.reward.limit === null && this.reward.rate !== null) ? Math.round(100*this.reward.equivalentPercentage*this.reward.value)/100 : 0.00;
    this.portalName = portal.name;
    this.portalKey = portal._id;
    this.type = portal.type;
    this.dateCreated = timeStampForDay;
    return this;
}

var reward = function ( value, unit, rate, limit, portal ) {
    this.value = value;
    this.unit = unit;
    this.rate = rate;
    this.limit = limit;
    // use the id for the timestamp in seconds
    this['_id']= portal._id+timeStampForDay;
    this.equivalentPercentage = portal.equivalentPercentage;
    this.currency = portal.currency;
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
    //debug( rawReward );
    //debug(self.variables.merchant.reward.regex);
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
            rate = matchReward[portal.pageData.reward.dollarIndex];
        }
        value = ( null == matchReward[portal.pageData.reward.valueIndex] ) ? 0.0 : parseFloat(matchReward[portal.pageData.reward.valueIndex]);
        return new reward( value, unit, rate, limit, portal );
    } else {
    	return matchReward;
    }
}

var merchantNameToKey = function( merchantName ) {
    // strip any spaces or special characters from name and convert to lowercase
    var keyName = merchantName.replace(/\W+/g,'').replace(/\s+/g,'').toLowerCase().trim();
    console.log('merchantNameToKey portal_keys: '+JSON.stringify(portal_keys));
    if (portal_keys[keyName] === undefined ) {
        return keyName.trim();
    } else {
        return portal_keys[keyName];
    }
}

var process = function( portal, merchants, portalKeys) {
    portal_keys = portalKeys;
    console.log('global portal_keys undefined?: '+JSON.stringify(undefined === portalKeys));

    merchants.forEach(function(merchElement, index, array){
        array[index] = new merchant(merchElement, portal);
    });
    console.log('describeMerchants outputs: '+JSON.stringify(merchants));
    return merchants;
}

module.exports = process;
