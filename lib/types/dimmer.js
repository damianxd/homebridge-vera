var request = require("request");

var settingBrightness = false;
var nextBrightnessLevel = null;

function DimmableLight(config, device) 
{
    this.device = device;
    this.veraIP = config.veraIP;
    this.name = device.name;
    var types = require('../../'+config.mainHNpath+"/accessories/types.js");
}

DimmableLight.prototype =
{
    /**
     *  This method is called when the brightness level changes
     */
    onSetBrightness: function(brightness)
    {
        if (settingBrightness)
        {
            nextBrightnessLevel = brightness;
            return;
        }
        else
        {
            settingBrightness = true;

        }

        console.log("Setting the " + this.device.name + " brightness to " + brightness + "%");

        var self = this;
        request.get({url: "http://"+this.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + this.device.id + "&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget=" + brightness},
            function(err, response, body)
            {		
                if (!err && response.statusCode == 200)
                {
                    console.log("The " + self.device.name + " brightness has been changed to " + brightness + "%");
                }
                else
                {
                    console.log("Error '" + err + "' changing the " + self.device.name + " brightness:  " + body);
                }

                settingBrightness = false;
                if (nextBrightnessLevel)
                {
                    var brightness = nextBrightnessLevel;
                    nextBrightnessLevel = null;
                    self.onSetBrightness(brightness);
                }
            }
        );	

    },

    /**
     *  This method is called when the light is turned on or off
     */
    onSetPowerState: function(powerOn)
    {

        if (powerOn)
        {
            console.log("Turning on the " + this.device.name);
        }
        else
        {
            console.log("Turning off the " + this.device.name);
        }

        var binaryState = powerOn ? 1 : 0;
        var self = this;
        request.get({url: "http://"+this.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + this.device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState},
            function(err, response, body)
            {		
                if (!err && response.statusCode == 200)
                {
                        if (powerOn)
                        {
                            console.log("The " + self.device.name + " has been turned on");
                        }
                        else
                        {
                            console.log("The " + self.device.name + " has been turned off");
                        }
                }
                else
                {
                    console.log("Error '" + err + "' turning the " + self.device.name + " on/off:  " + body);
                }
            }
        );	
    },

    /**
     *  This method is called when the user tries to identify this accessory
     */
    onIdentify: function(identify)
    {
        if(identify)
        {
            console.log("User wants to identify this accessory");
        }
        else
        {
            console.log("User is finished identifying this accessory");
        }
    },

    getServices: function()
    {
        var that = this;
        return [{
          sType: types.ACCESSORY_INFORMATION_STYPE,
          characteristics: [{
            cType: types.NAME_CTYPE,
            onUpdate: null,
            perms: ["pr"],
            format: "string",
            initialValue: this.name,
            supportEvents: false,
            supportBonjour: false,
            manfDescription: "Name of the accessory",
            designedMaxLength: 255
          },{
            cType: types.MANUFACTURER_CTYPE,
            onUpdate: null,
            perms: ["pr"],
            format: "string",
            initialValue: "Z-Wave",
            supportEvents: false,
            supportBonjour: false,
            manfDescription: "Manufacturer",
            designedMaxLength: 255
          },{
            cType: types.MODEL_CTYPE,
            onUpdate: null,
            perms: ["pr"],
            format: "string",
            initialValue: "DimmableLight",
            supportEvents: false,
            supportBonjour: false,
            manfDescription: "Model",
            designedMaxLength: 255
          },{
            cType: types.SERIAL_NUMBER_CTYPE,
            onUpdate: null,
            perms: ["pr"],
            format: "string",
            initialValue: "" + this.device.id,
            supportEvents: false,
            supportBonjour: false,
            manfDescription: "SN",
            designedMaxLength: 255
          },{
            cType: types.IDENTIFY_CTYPE,
            onUpdate: function(value) { that.onIdentify(value); },
            perms: ["pw"],
            format: "bool",
            initialValue: false,
            supportEvents: false,
            supportBonjour: false,
            manfDescription: "Identify Accessory",
            designedMaxLength: 1
          }]
        },{
          sType: types.SWITCH_STYPE,
          characteristics: [{
            cType: types.NAME_CTYPE,
            onUpdate: null,
            perms: ["pr"],
            format: "string",
            initialValue: this.name,
            supportEvents: false,
            supportBonjour: false,
            manfDescription: "Name of service",
            designedMaxLength: 255
          },
          {
            cType: types.BRIGHTNESS_CTYPE,
            onUpdate: function(value) { that.onSetBrightness(value); },
            perms: ["pw","pr","ev"],
                    format: "int",
                    initialValue: 0,
                    supportEvents: false,
                    supportBonjour: false,
                    manfDescription: "Adjust the brightness",
                    designedMinValue: 0,
                    designedMaxValue: 100,
                    designedMinStep: 1,
                    unit: "%"
        },
          {
            cType: types.POWER_STATE_CTYPE,
            onUpdate: function(value) { that.onSetPowerState(value); },
            perms: ["pw","pr","ev"],
            format: "bool",
            initialValue: false,
            supportEvents: false,
            supportBonjour: false,
            manfDescription: "Change the power state",
            designedMaxLength: 1
          }]
        }];
    }
};

module.exports.initializeWithDevice = DimmableLight;
