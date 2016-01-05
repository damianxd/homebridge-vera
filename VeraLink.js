/* 
 * VeraLink v0.1
 * Damian Alarcon
 * Dec 2015
 * damian@laerit.dk
 */

// Remember to edit the config.js file with your Vera information

var config          = require('./config.js');
var request         = require("sync-request");
var fs              = require('fs');
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

var HAPNode = {'request':request, 'storage':storage, 'uuid':uuid, 'Bridge':Bridge, 'Accessory':Accessory, 'accessoryLoader':AccessoryLoader, 'hashing':hashing, 'Service':Service, 'Characteristic':Characteristic, 'debug':debug};

var functions       = require('./lib/functions.js')(HAPNode,config); 

console.log("HAP-NodeJS starting...");

// Initialize our storage system
storage.initSync();

// Load Vera info from the data_request URL
var verainfo = functions.getVeraInfo(config.veraIP);

if(typeof verainfo === 'object')
{
    if(config.bridged === true)
    {
        functions.processrooms(verainfo);
    }
    else
    {
        functions.processall(verainfo);
    }
}