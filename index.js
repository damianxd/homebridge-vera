var Service, Characteristic, Accessory, uuid;

var Veraconfig      = loadconfig();
var debug           = require("debug")('VeraLink');
var request         = require("sync-request");
var hashing         = require("create-hash");

module.exports = function (homebridge)
{
    if(typeof homebridge !== "undefined")
    {
        Service         = homebridge.hap.Service;
        Characteristic  = homebridge.hap.Characteristic;
        Accessory       = homebridge.hap.Accessory;
        uuid            = homebridge.hap.uuid;
        console.log("VeraLink initializing");
        homebridge.registerPlatform("homebridge-veralink", "Vera", VeraLinkPlatform);
    }
};

function VeraLinkPlatform(log, config)
{
    this.log        = log;
    this.rooms      = {};
    this.HAPNode     = {'request':request, 'uuid':uuid, 'Accessory':Accessory, 'Service':Service, 'Characteristic':Characteristic, 'debug':debug, 'hashing':hashing, 'return': true};
    this.functions   = require('./lib/functions.js')(this.HAPNode,Veraconfig);
    this.verainfo = this.functions.getVeraInfo(Veraconfig.veraIP);
}

VeraLinkPlatform.prototype = {
    accessories: function(callback)
    {
        var that = this;
        var foundAccessories = [];
        devices = this.functions.processall(this.verainfo);
        devices.forEach(function(device)
        {
            foundAccessories.push(that.createAccessory(device,that));
        });
        callback(foundAccessories);
    },
    createAccessory: function(device,platform) {
        device.getServices = function() {
            return this.services;
        };
        device.platform 	= platform;
        device.name		= device.displayName;
        device.model		= "VeraDevice";
        device.manufacturer     = "IlCato";
        device.serialNumber	= "<unknown>";
        return device;
    }
};

function loadconfig()
{
    var fs = require('fs');
    home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    try {
        fs.accessSync(home+'/.veralink', fs.F_OK);
        
        try {
            fs.accessSync(home+'/.veralink/config.js', fs.F_OK);
            return require('./config.js');
        } catch(e) {
            console.log("\033[31m Please add your configuration file to "+home+"/.veralink/config.js \033[0m");
        }
    } catch (e) {
        try {
            fs.mkdirSync(home+'/.veralink');
            console.log("\033[31m Please add your configuration file to "+home+"/.veralink/config.js \033[0m");
        } catch(e) {
            if ( e.code != 'EEXIST' ) throw e;
        }
    }
}