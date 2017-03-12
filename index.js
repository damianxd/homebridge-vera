var Service, Characteristic, Accessory, uuid;

var Veraconfig      = {};
var debug           = require("debug")('VeraLink');
var request         = require("request-promise");
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

VeraLinkPlatform.prototype = {
    accessories: function(callback)
    {
        this
          .functions
          .getVeraInfo()
          .then( (verainfo)=>{
            if(typeof verainfo === 'object'){
              var devices = this.functions.processall(this.verainfo);
              var accessories = devices.map( (device)=>{
                  return this.createAccessory(device,this);
              });
              callback(accessories);
            }
          }
        );
    },
    createAccessory: function(device,platform) {
        var properties = new Object({
          platform: platform,
          name: device.displayName,
          getServices : function(){
            return this.services;
          }
        });

        Object.assign(device, properties);

        return device;
    }
};

function VeraLinkPlatform(log, config)
{
    var Veraconfig  = loadconfig();
    this.log        = log;
    this.rooms      = {};
    this.HAPNode     = {'request':request, 'uuid':uuid, 'Accessory':Accessory, 'Service':Service, 'Characteristic':Characteristic, 'debug':debug, 'hashing':hashing, 'return': true};

    process.on('uncaughtException', function (err) {
        debug(err);
    });

    defaults = {
      bridged: true,
      includesensor: false,
      dimmertest: false,
      ignorerooms: [],
      ignoredevices: [],
      securitypoll: 2000
    };

    Veraconfig = merge_options(defaults, Veraconfig);
    Veraconfig = merge_options(Veraconfig,config);

    if(typeof config.veraIP === "undefined")
    {
        console.log("\033[31m No configuration found, please write your configuration on .homebridge/config.json \033[0m");
        console.log("\033[31m or add your configuration file to "+home+"/.veralink/config.js \033[0m");
        process.exit();
    }

    this.functions = require('./lib/functions.js')(this.HAPNode,Veraconfig);
}

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

function merge_options(obj1,obj2)
{
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}
