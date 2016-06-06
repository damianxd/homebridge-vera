var Service, Characteristic, Accessory, uuid;

var Veraconfig      = {};
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
    var Veraconfig  = loadconfig();
    this.log        = log;
    this.rooms      = {};
    this.HAPNode     = {'request':request, 'uuid':uuid, 'Accessory':Accessory, 'Service':Service, 'Characteristic':Characteristic, 'debug':debug, 'hashing':hashing, 'return': true};
    
    if(typeof config.veraIP !== "undefined")
    {
        Veraconfig.veraIP = config.veraIP;
    }
    
    if(typeof config.includesensor !== "undefined")
    {
        Veraconfig.includesensor = config.includesensor;
    }
    
    if(typeof config.dimmertest !== "undefined")
    {
        Veraconfig.dimmertest = config.dimmertest;
    }
    
    if(typeof config.ignorerooms !== "undefined")
    {
        Veraconfig.ignorerooms = config.ignorerooms;
    }
    
    if(typeof config.ignoredevices !== "undefined")
    {
        Veraconfig.ignoredevices = config.ignoredevices;
    }
    
    if(typeof config.securitypoll === "undefined")
    {
        Veraconfig.securitypoll = 2000;
    } else {
        Veraconfig.securitypoll = config.securitypoll;
    }

    if(typeof config.veraIP === "undefined")
    {
        console.log("\033[31m No configuration found, please write your configuration on .homebridge/config.json \033[0m");
        console.log("\033[31m or add your configuration file to "+home+"/.veralink/config.js \033[0m");
        process.exit();
    }
    
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
            return {};
        }
    } catch (e) {
        try {
            fs.mkdirSync(home+'/.veralink');
            return {};
        } catch(e) {
            if ( e.code != 'EEXIST' ) throw e;
        }
    }
}