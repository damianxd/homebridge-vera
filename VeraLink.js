/* 
 * VeraLink v0.1
 * Damian Alarcon
 * Dec 2015
 * damian@laerit.dk
 */

var async          = require('async');
var prompt          = require('prompt');
var fs              = require('fs');
var request         = require("request-promise");

// Add retry logic around the request call
function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    function attemptRequest(retriesLeft) {
      request(options)
        .then(response => resolve(response))
        .catch(error => {
          if (retriesLeft > 0) {
            const backoffDelay = 1000 * Math.pow(2, 3 - retriesLeft);
            console.log(`Retrying in ${backoffDelay} milliseconds...`);
            setTimeout(() => attemptRequest(retriesLeft - 1), backoffDelay);
          } else {
            reject(error);
          }
        });
    }

    attemptRequest(3); // Retry up to 3 times
  });
}

async.series([
    function(callback) {
        // ... (previous code)

        // Inside your schema.conform function for VeraIP
        conform: function(value) {
            url = "http://" + value + "/port_3480/data_request?id=lu_sdata";
            try {
                return makeRequest(url, { method: 'GET', uri: url, json: true, timeout: 1500 })
                    .then(data => {
                        if (typeof data === 'object' && data !== null) {
                            listsrooms = data.rooms;
                            return true;
                        } else {
                            console.log('Your VeraIP (' + value + ') has no connection, please check that it is a correct one')
                            return false;
                        }
                    })
                    .catch(error => {
                        console.error('Error making request:', error);
                        return false;
                    });
            } catch (ex) {
                console.error('Exception making request:', ex);
                return false;
            }
        }

        // ... (rest of the code)

        prompt.start();

        prompt.get(schema, function (err, result) {
            // ... (rest of the code)
        });
    },
    function(callback) {
        callback();
        var config          = require('./config.js');
        var path            = require('path');
        var Accessory       = require(config.mainHNpath+'/lib/Accessory.js').Accessory;
        var Bridge          = require(config.mainHNpath+'/lib/Bridge.js').Bridge;
        var Service         = require(config.mainHNpath+'/lib/Service.js').Service;
        var Characteristic  = require(config.mainHNpath+'/lib/Characteristic.js').Characteristic;
        var uuid            = require(config.mainHNpath+'/lib/util/uuid');
        var AccessoryLoader = require(config.mainHNpath+'/lib/AccessoryLoader.js');
        var storage         = require(config.mainHNpath+'/node_modules/node-persist/node-persist.js');
        var hashing         = require("create-hash");
        var debug           = require("debug")('VeraLink');
        
        process.on('uncaughtException', function (err) {
            debug(err);
        });
        
        var HAPNode = {'request':request, 'storage':storage, 'uuid':uuid, 'Bridge':Bridge, 'Accessory':Accessory, 'accessoryLoader':AccessoryLoader, 'hashing':hashing, 'Service':Service, 'Characteristic':Characteristic, 'debug':debug};
        var functions       = require('./lib/functions.js')(HAPNode,config); 
        console.log("HAP-NodeJS starting...");

        // Initialize our storage system
        storage.initSync();

        // Load Vera info from the data_request URL
        functions.getVeraInfo().then(function(verainfo)
        {
            if(typeof verainfo === 'object')
            {
                if(config.bridged === true)
                {
                    functions.processrooms(verainfo);
                    functions.createSceneBridge(verainfo);
                }
                else
                {
                    functions.processall(verainfo);
                }
            }
        });
    }
]);
