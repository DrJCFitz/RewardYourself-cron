/* statusCheck.js
 * requires "portal" object with configurable keys and callback
 * 
 * portal : {
 * 	allStoreSelector: string,
 *  auth: {
 *		credentials : {
 * 			username: string,
 * 			usernameSelector: string,
 * 			password: string,
 * 			passwordSelector: string
 * 		},
 *    submitForm: boolean
 *		submitSelector: string
 *		url: string
 *	}
 *  baseUrl: string,
 *  initialLoadSelector: string,
 *  key: string,
 *  loadSelector: string,
 *  loadJquery: boolean,
 * 	loginLinkSelector: string
 *  logoutlink: string,
 *  pageData: {
 *		name : {
 *			element: string,
 * 			...	
 *		},
 *		link : {
 *			element: string,
 * 			...
 *		},
 *		reward : {
 *			element: string,
 * 			...
 *		}
 *  },
 *  pagination: boolean,
 *  paginationPageCountSelector: string,
 *  paginationChangeSelector: string,
 *  paginationLimitSelector: string,
 *  requiresAuth: boolean,
 *  rootElement: string
 *  scrapeType: integer {0,1,2}
 *  storePath: string,
 *  tokenVariable: string,	
 *  waitTimeout: integer
 * }
 *
 */

try {
	var Spooky = require('spooky');
} catch (e) {
  var Spooky = require('../lib/spooky');
}

var accessToken = null;
var pageCount = 0;
var currentPage = 0;
var retry = 0;
var retryLimit = 5;

var config = 
	{ child: { 
		'transport': 'http', 
		'ssl-protocol':'any', 
		'ignore-ssl-errors':'yes'
  },
  casper: { 
  	logLevel: 'debug',
    verbose: true,
    viewportSize: { 
    	width: 800, 
    	height: 600
    },
    remoteScripts: [ ],
    pageSettings: 
    {
      javascriptEnabled: true,
      loadImages: false,
      loadPlugins: true,
      localToRemoteUrlAccessEnabled: false,
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/43.0.2357.130 Chrome/43.0.2357.130 Safari/537.36",
      userName: null,
      password: null,
      XSSAuditingEnabled: false
  	}
  }
}

var response = {
	health: { 
		jquery: false,
		rootElementExists: false,
		elementCount: 0,
		nameElementExists: false,
		linkElementExists: false,
		rewardElementExists: false,
		nameElementPopulated: false,
		linkElementPopulated: false,
		rewardElementPopulated: false
	}
};

var statusCheck = function(portal, callback) {
	// any remoteScripts pushed to CasperJS config remain there until removed
	// avoid loading the same script multiple times
	config.casper.remoteScripts = [];
	if (portal.config.loadJquery !== undefined && portal.config.loadJquery === 'true') {
		config.casper.remoteScripts.push('https://code.jquery.com/jquery-2.1.3.min.js');
	}

	var retrieveToken = function() {
		if (portal.tokenVariable !== undefined) {
			spooky.then(
				[
				 {portal:portal},
				 function() {
	 				this.emit('token', 
						this.evaluate(
							function(portal){
								return eval(portal.tokenVariable);
							},
							{portal: portal})
					);
				}
			]);			
		}
	}
	
	/*
	 *  Pages with pagination may have a default limit
	 *  This step selects a pagination limit (typically the maximum number)
	 * and then waits for the page to refresh
	 */
	var setPagination = function() {
		console.log('setPagination');
		if (portal.config.pagination !== undefined 
			&& portal.config.pagination === 'true'
			&& portal.config.paginationLimitSelector !== undefined 
			&& portal.config.paginationLimitSelector !== '') {
			spooky.then([{portal:portal},
				function(){
					this.emit('console','clicking paginationLimitSelector');
					this.waitForSelector(portal.config.paginationLimitSelector,
						function(){
							this.click(portal.config.paginationLimitSelector);
						},
						function(){
							this.emit('console','no all paginationLimitSelector link');
						},
						parseInt(portal.config.waitTimeout)
					);								
				}]
			);
			spooky.then([{portal:portal},
				function(){
					this.emit('console','waiting for refresh after paginationLimit');
					this.waitForSelectorTextChange(portal.config.paginationChangeSelector,
						function(){}, // then
						function(){ // onTimeout
							this.emit('console','no all paginationLimitSelector link');
						},
						parseInt(portal.config.waitTimeout) // timeout
					);								
				}]
			);
		}
	}

	/*
	 *   The pagination [ageCount variable is used to determine whether additonal steps
	 * are necessary. 
	 *   For flexibility we should not rely on a "next" button existing, so that 
	 * means that we need to keep track of the pages that have been processed.
	 */
	var evaluatePaginationPageCount = function() {
		console.log('evaluatePaginationPageCount');
		if (portal.config.pagination !== undefined 
			&& portal.config.pagination === 'true'
			&& portal.config.paginationPageCountSelector !== undefined 
			&& portal.config.paginationPageCountSelector !== '') {
			spooky.then([{portal:portal},
				function(){
					this.emit('console','finding total pageCount');
					// try to evaluate the number of selectors
					this.emit('pageCount', this.evaluate(function(portal){
						var numPageSelectors = jQuery(portal.config.paginationPageCountSelector).length;
						var lastElementText = 0;
						if (parseInt(numPageSelectors) > 0) {
							lastElementText = (jQuery(portal.config.paginationPageCountSelector).eq(numPageSelectors-1).text()) ? 
								jQuery(portal.config.paginationPageCountSelector).eq(numPageSelectors-1).text() : 
								jQuery(portal.config.paginationPageCountSelector).eq(numPageSelectors-2).text();
						}
						if (parseInt(lastElementText) > 0) {
							return JSON.stringify(lastElementText);
						} else {
							return JSON.stringify(numPageSelectors);
						}
					}));
				}]
			);
		}
	}

	/*
	 * Use navToNextPage() to advance pagination after processing data from scrape()
	 * Assume [for the moment] that the "next" page selector is the last pagination
	 * identifiable by the paginationPageCountSelector
	 */
	var navToNextPage = function() {
		console.log('navToNextPage');
		if (portal.config.pagination !== undefined 
			&& portal.config.pagination === 'true'
			&& portal.config.paginationPageCountSelector !== undefined 
			&& portal.config.paginationPageCountSelector !== '') {
			spooky.then([{portal:portal},
				function(){
					this.emit('console','advancing to next page by finding and clicking last paginationPageCountSelector');
					this.evaluate(function(portal){
						var numPageSelectors = jQuery(portal.config.paginationPageCountSelector).length;
						jQuery(portal.config.paginationPageCountSelector).eq(numPageSelectors).click();
					});
				}]
			);
		}
	}

	var navToAllStores = function() {
		console.log('navToAllStores '+JSON.stringify(portal.config.allStoreSelector !== undefined && portal.config.allStoreSelector !== ''));
		// this can be a link from the base url or a selector for pagination
		if (portal.config.allStoreSelector !== undefined && portal.config.allStoreSelector !== '') {
			console.log('navToAllStores allStoreSelector: '+portal.config.allStoreSelector);
			spooky.then([{portal:portal},function(){
				this.emit('console','clicking all stores link');
				this.waitForSelector(portal.config.allStoreSelector,
					function(){
						this.emit('console','clicking allStoreSelector :'+portal.config.allStoreSelector)
						this.click(portal.config.allStoreSelector);
					},
					function(){
						this.emit('console','timeout waiting for all stores link');
					},
					parseInt(portal.config.waitTimeout));				
			}]);
		} else if (portal.config.storePath !== undefined && portal.config.storePath !== '') {
			spooky.then([{portal:portal},function(){
				this.emit('console','opening path '+portal.config.storePath);
				this.open(portal.config.baseUrl+portal.config.storePath);
			}]);
		}
		// 
		setPagination();
		evaluatePaginationPageCount();
	}

	var scrape = function(){
		console.log('scrape');
		  /*
			spooky.then(function(){
				this.capture('healthCheckScrapeData.png');
			});
			*/
			if (portal.config.continueSelector !== undefined && portal.config.continueSelector !== '') {
				spooky.then([{portal:portal},
					function(){
						this.click(portal.config.continueSelector);
					}
				]);
			}
			spooky.then(function(){
				this.scrollToBottom();
			});
			spooky.then([{
					portal:portal,
					response:response
				},
        function(){
        	/** define functions to run in page **/
					// this can be written as it should be executed in the page context
					var checkHealth = function(portal){
						// explicitly define defaults on object
						var health = {
							jquery: false,
							rootElementExists: false,
							elementCount: 0,
							nameElementExists: false,
							linkElementExists: false,
							rewardElementExists: false,
							nameElementPopulated: false,
							linkElementPopulated: false,
							rewardElementPopulated: false
						};
						// all processing will fail if jQuery is not loaded into the window somehow, so this is the first check
						if (health.jquery = (jQuery !== undefined)) {
							// the root element is the container for all the other name/link/reward data
        			if (health.rootElementExists = ( jQuery(portal.config.rootElement).length > 0 )) {
        				// name, link, and reward nodes typically fall under one parent element
	        			if (health.nameElementExists = (jQuery(portal.config.rootElement).find(portal.pageData.name.element).length > 0)) {
	        				health.elementCount = jQuery(portal.config.rootElement).find(portal.pageData.name.element).length;
	        				var halfCount = parseInt(health.elementCount / 2);
	        				health.linkElementExists = (jQuery(portal.config.rootElement).find(portal.pageData.link.element).length > 0);
	 								health.rewardElementExists = (jQuery(portal.config.rootElement).find(portal.pageData.reward.element).length > 0);
	 						
			 						// verify the text is not blank; sample elements in the middle of the page to avoid edge effects
			 						health.nameElementPopulated = jQuery(portal.config.rootElement).find(portal.pageData.name.element).eq(halfCount).text() !== '';
			 						health.linkElementPopulated = jQuery(portal.config.rootElement).find(portal.pageData.link.element).eq(halfCount).text() !== '';
			 						health.rewardElementPopulated = jQuery(portal.config.rootElement).find(portal.pageData.reward.element).eq(halfCount).text() !== '';
          			}        			
          		}
						}
						return JSON.stringify(health);
					}
					/*
		 		    var scrapeMerchantData = function(portal, response){
		 		    	var merchants = [];
		    			jQuery(portal.portal.rootElement).each(function(index, element){
							var name, link, reward;
							var name = jQuery(element).find(portal.pageData.name.element).text().trim();
		    				if ( name !== '') {
		    					link = jQuery(element).find(portal.pageData.link.element).attr(portal.pageData.link.attr);
		    					reward = jQuery(element).find(portal.pageData.reward.element).text().trim();
		        				if (portal.pageData.reward.replace !== undefined) {
		        					reward = reward.replace(new RegExp(portal.pageData.reward.replace),'').trim();
		        				}
		        				merchants.push({name: name, link:link, reward:reward});
		    				}
		    			});
		    			return JSON.stringify(merchants);
					}
					*/
        	/** end define functions to run in page **/

        	/** act upon page based on initial or [repeated] pagination settings **/
					// identify AJAX-loaded pages by defining the loadSelector (a spinner div)
					if (portal.config.loadSelector !== undefined && this.visible(portal.config.loadSelector) ) {
						this.emit('console','pagination exists? '+JSON.stringify(this.exists(portal.config.pagination)));
						this.emit('console','loader visible?'+JSON.stringify(this.visible(portal.config.loadSelector)));
						this.emit('console','loader exists?'+JSON.stringify(this.exists(portal.config.loadSelector)));
						// wait while the selector is visible in order to scrape all data loaded on the page
						this.waitWhileVisible(portal.config.loadSelector,
							function(){ // success function
								// give a read on what page we are on
								this.emit('currentPage',JSON.stringify(true));
								// scrape the page data
								this.emit('health', this.evaluate(checkHealth,{portal:portal}));
								//this.emit('processed',this.evaluate(scrapeMerchantData,{portal:portal}));
							},
							function(){ // timeout function
								this.emit('console','loadSelector wait timed out');
							},
							5000
						);
					} else { 
						// wait for the root element or end element to load
						var initialLoadSelector = portal.rootElement;
						if (portal.config.initialLoadSelector !== undefined && portal.config.initialLoadSelector !== '') {
							initialLoadSelector = portal.config.initialLoadSelector;
						}
						this.emit('console', 'initialLoadSelector: '+initialLoadSelector);
						this.waitForSelector(initialLoadSelector,
							function(){ // success function
								//this.emit('currentPage',JSON.stringify(true));
								// scrape the page data
								this.emit('health', this.evaluate(checkHealth,{portal:portal}));
								//this.emit('processed', this.evaluate(scrapeMerchantData,{portal:portal, response:response}));
							},
							function(){ // timeout function
								/*
								this.capture('initialLoadSelector_timeout.png');
								*/
								this.echo('initialLoadSelector element wait timed out');
								this.emit('health', JSON.stringify(response.health));
							},
							parseInt(portal.config.waitTimeout)
						); 
					}
			}]);
			spooky.then(function(){
				this.emit('console','waiting for any additonal steps');
				this.wait(500);
			});
/*
			spooky.then([{portal:portal},function(){
				// global variables in this script are outside the [web] page context and are not updated
				// the emit functions can access current values of these variables, 
				// so control flow logic should be done there by passing updated values into functions executed in the page context
				if (portal.config.scrapeType > 2 && 
					(portal.config.pagination !== undefined && portal.config.pagination !== '')) {
					this.waitForSelector(portal.config.pagination,
						function(){
							this.emit('pagination',JSON.stringify(true));
							this.click(portal.config.pagination);												
						},
						function(){
							this.emit('console', 'waiting for pagination selector: fail');
						},
						5000
					);
				}
			}]);
*/
	}
	
	var logoutFromPortal = function() {
		if (portal.config.logoutLink !== undefined 
			&& (portal.config.requiresAuth !== undefined && portal.config.requiresAuth === 'true') ) {
			spooky.then([{portal:portal},function(){
				this.emit('console','logoutLink exists? '+JSON.stringify(this.exists(portal.config.logoutLinkSelector)));
				if (this.exists(portal.config.logoutLinkSelector) ){
					this.emit('console',"clicking logoutLink")
					this.click(portal.config.logoutLinkSelector);		
				}			
			}]);
		}
	}

	var navToBasePage = function() {
		console.log('navToBasePage portal: '+JSON.stringify(portal));
		// nav to base url page
		spooky.start(portal.config.baseUrl, 
			function() {
				//this.capture('baseUrl.png');
				/*
				phantom.cookiesEnabled = true;
				if (portal.cookies !== undefined) {
					portal.cookies.forEach(function(cookie) {
						phantom.addCookie(cookie);
					});
				}
				*/
			}
		);
		authenticate();
	}

	var authenticate = function() {
		console.log('authenticate');
		if (portal.config.requiresAuth !== undefined && portal.config.requiresAuth === 'true') {
			// click a link to show the login page
			if (portal.config.loginLinkSelector !== undefined && portal.config.loginLinkSelector !== '') {			
				spooky.then([{portal:portal},
					function(){
						this.emit('console','waiting for login link');
						this.waitForSelector(portal.config.loginLinkSelector,
							function(){
								this.emit('console','clicking login link');
								this.click(portal.config.loginLinkSelector);					
							},
							function(){
								this.emit('console','login link has not appeared');							
							},
							5000
						);
					}
				]);
			}

			// proceed to fill in form fields if these are defined
			if (portal.config.requiresAuth !== undefined 
				&& portal.config.requiresAuth === 'true'
				&& portal.auth.formSelector !== undefined 
				&& portal.auth.formSelector !== '' 
				&& portal.auth.credentials !== undefined) {
				// wait for form and fill credentials
				spooky.then([{portal:portal},
					function(){
						this.waitForSelector(portal.auth.formSelector,
							function(){
								//this.capture(portal['key']+'_'+'authPage.png');
								this.emit('console','filling login page');
								this.emit('console','credentials:'+JSON.stringify(portal.auth.credentials));
								this.fillSelectors(portal.auth.formSelector, 
										portal.auth.credentials, 
										portal.auth.submitForm );
								//this.capture(portal['key']+'_'+'filledAuth.png');
							},
							function(){
								this.emit('console','login form did not load');
							},
							parseInt(portal.config.waitTimeout)
						);
					}
				]);
			} else {
				this.emit('console', 'not enough information provided to find and/or fill login form');
			}

			if (portal.auth.submitForm !== undefined && portal.auth.submitForm === 'false') {
				spooky.then([{portal:portal},
					function(){
						this.emit('console','clicking auth form submit');
						this.click(portal.auth.submitSelector);
					}
				]);
			}

			// wait for a "logout" link -- or some indicator of logged-in status -- to appear
			spooky.then([{portal:portal},
				function(){
					this.emit('console','waiting after form submit');
					this.waitUntilVisible(portal.config.logoutLinkSelector,
						function(){}, //then
						function(){}, //onTimeout
						parseInt(portal.config.waitTimeout) //timeout
					);
				}
			]);
		}
	}

	var startScrape = function(portal) {
		navToBasePage();
		if (portal.cookies !== undefined) {
			portal.cookies.forEach(function(cookie) {
				phantom.addCookie(cookie);
			});
		}
		if (portal.config.scrapeType === 1) {
			// grab a token; end scraping in favor of a cURL request
			retrieveToken();
		} else {
			// point the browser toward the all stores page
			navToAllStores();
			// scrape the page
			scrape();
		}

		return spooky.run();
	}
	
	var spookyFunction = function (err, res) {
	    if (err) {
	        e = new Error('Failed to initialize SpookyJS');
	        e.details = err;
	        throw e;
	    }

	    // This executes in the Node context
		spooky.on('error', function (e, stack) {
		    console.error(e);
		
		    if (stack) {
		        console.log(stack);
		    }
		});
		
		
		// Uncomment this block to see all of the things Casper has to say.
		// There are a lot.
		// He has opinions.
		spooky.on('console', function (line) {
		    console.log(line);
		});

   	spooky.on("resource.requested", function(requestData, networkRequest){
			console.log('Request (#' + requestData.id + '): ' + JSON.stringify(requestData));
			if (requestData.url == 'about:blank') {
	  			// this is a redirect url that prevents scraping
	  			networkRequest.abort();
			}
   	});
		
   	spooky.on('error', function(msg, stacktrace){
			//callback(true, "ERROR: "+msg);
   		console.log("ERROR: "+msg);
		});

		spooky.on("page.error", function(msg, trace) {
			console.log("ERROR: " + msg 
		    		+" for ["+portal.key+","+portal.type+"]");
		    //callback(true, "ERROR: " + msg 
		    //		+" for ["+portal.portal.key+","+portal.portal.type+"]");
		});

		spooky.on("load.failed", function(object) {
	    callback(true, "ERROR: Load failed");
		});
		
		spooky.on("resource.error", function(resourceError) {
	    //callback(true, "Error "+resourceError.errorCode+": "+resourceError.errorString
	    console.log("ERROR: " + resourceError.errorCode + ": "+resourceError.errorString); 
		});
		
		spooky.on('health', function (healthResult) {
			console.log('health: '+healthResult);
			console.log('health retry: '+JSON.stringify(retry));
			response.health = JSON.parse(healthResult);
			console.log('health conditional: '+JSON.stringify([response.health.elementCount, retry]));
			if (response.health.elementCount === 0 && retry < retryLimit) {
				scrape();
				retry++;
			}
		});

		spooky.on('currentPage', function (result) {
			console.log('currentPage: '+result);
			currentPage++;
		});

		spooky.on('pageCount', function (count) {
			console.log('count: '+count);
			pageCount = count;
		});

		spooky.on('token', function (token) {
			console.log('token: '+token);
			accessToken = token;
		});
/*		
		spooky.on('pagination', function (bool) {
			if (portal.pagination !== undefined && portal.pagination === true
				&& pageCount < paginationPageCount) {
				// use logic based on {numerical, next} identifier to click link for next page in sequence
				navToNextPage(pageCount, paginationPageCount);
				//openPageAndScrape();				
			}
		});
*/
		// if the response array is unset, use the entire incoming data as response
		// otherwise, append new merchant data to existing response.merchants array
/*
		spooky.on('processed', function (scrapeResult) {
			//console.log('processed: '+scrapeResult);
			scrapedMerchants = JSON.parse(scrapeResult);
			console.log('merchants before `processed` call: '+response.merchants.length);
			console.log('merchants in scrapeResult : '+scrapedMerchants.length);
			console.log('first merchant in scrapeResult : '+JSON.stringify(scrapedMerchants[0]));
			
			response.merchants = response.merchants.concat(scrapedMerchants);
			console.log('merchants after `processed` call: '+response.merchants.length);
		});
*/	
		spooky.on('run.complete', function(){
			//console.log('run complete # merchants:'+response.merchants.length);
			//if (portal.scrapeType !== 1 && response.health !== undefined) {
				console.log('portal health: '+JSON.stringify(response.health));
				callback(null, JSON.stringify(response.health));
			//} else if (portal.scrapeType === 1 ) {
			//	callback(null, accessToken);
			//} else {
			//	callback([111, 'merchants not found'], JSON.stringify(response));
			//}
		});		

		return startScrape(portal);
	}
	var spooky = new Spooky(config, spookyFunction);
}

module.exports = statusCheck;
