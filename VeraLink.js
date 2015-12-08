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
var storage         = require('./').storage;
var uuid            = require('./').uuid;
var Bridge          = require('./').Bridge;
var Accessory       = require('./').Accessory;
var accessoryLoader = require('./').AccessoryLoader;
var Service         = require('./').Service;
var Characteristic  = require('./').Characteristic;
var hashing         = require("create-hash");
var debug           = require("debug")('VeraLink');

var HAPNode = {'request':request, 'storage':storage, 'uuid':uuid, 'Bridge':Bridge, 'Accessory':Accessory, 'accessoryLoader':accessoryLoader, 'hashing':hashing, 'Service':Service, 'Characteristic':Characteristic, 'debug':debug};

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