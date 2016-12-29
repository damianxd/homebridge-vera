module.exports = function(HAPnode, config, functions)
{
    var Accessory       = HAPnode.Accessory;
    var Service         = HAPnode.Service;
    var Characteristic  = HAPnode.Characteristic;
    var uuid            = HAPnode.uuid;
    var debug           = HAPnode.debug;

    var module  = {};

    module.newDevice = function(device)
    {
        var Dimmer = {
            powerOn: (parseInt(device.status) === 1)?true:false,
            brightness: 100,
            onproc: false,
            changebright: false,

            setPowerOn: function(on)
            {
                if (on === Dimmer.powerOn)
                   return;

                Dimmer.powerOn = on;
                if (on)
                {
                    binaryState     = 1;
      	   	         return this.setBrightness(this.brightness);
                }
                else
                {
                    binaryState     = 0;
                }
                return HAPnode.request({method:'GET',uri:"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState, resolveWithFullResponse: true}).then(function (res)
                {
                    if (res.statusCode === 200)
                    {
                        status = (Dimmer.powerOn === 1)?'On':'Off';
                        debug("The %s has been turned %s", device.name, status);
                    }
                    else
                    {
                        debug("Error while turning the %s on/off %s", device.name);
                    }
                }).catch(function (err) {
                    HAPnode.debug("Request error:"+err);
                });
            },
            setBrightness: function(brightness)
            {
                if(this.onproc === false)
                {
                    this.onproc = true;
                    this.brightness = brightness;
                    var self = this;

                    HAPnode.request({method:'GET',uri:"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget=" + this.brightness, resolveWithFullResponse: true}).then(function (res)
                    {
                        if (res.statusCode === 200)
                        {
                            debug("The %s brightness has been changed to %d%", device.name, brightness);
                        }
                        else
                        {
                            debug("Error while changing %s brightness", device.name);
                        }
                        self.onproc = false;
                        if(self.changebright)
                        {
                            self.brightness = self.changebright;
                            self.changebright = false;
                            return self.setBrightness(self.brightness);
                        }
                    }).catch(function (err) {
                        HAPnode.debug("Request error:"+err);
                    });
                    
                }
                else
                {
                    this.changebright = brightness;
                    return;
                }
            },
            getStatus: function()
            {
                var self = this;
                return HAPnode.request({method:'GET',uri:'http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:SwitchPower1&Variable=Status', resolveWithFullResponse: true}).then(function (res)
                {
                    if (res.statusCode === 200)
                    {
                        data = parseInt(res.body.toString('utf8'));
                        self.powerOn = (data === 1)?true:false;
                        status = (self.powerOn)?'On':'Off';

                        debug("Status for the light %s is %s", device.name, status);
                        return self.powerOn;
                    }
                    else
                    {
                        debug("Error while getting the status for %s", device.name);
                        return self.powerOn;
                    }
                }).catch(function (err) {
                    HAPnode.debug("Request error:"+err);
                    return self.powerOn;
                });
            },
            getBrightness: function()
            {
                var self = this;
                return HAPnode.request({method:'GET',uri:'http://'+config.veraIP+':3480/data_request?id=variableget&output_format=xml&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:Dimming1&Variable=LoadLevelStatus', resolveWithFullResponse: true}).then(function (res)
                {
                    if (res.statusCode === 200)
                    {
                        data = parseInt(res.body.toString('utf8'));
                        self.brightness = data;

                        debug("Status for the light %s is %s%", device.name, self.brightness);

                        return self.brightness;
                    }
                    else
                    {
                        debug("Error while getting the status for %s", device.name);
                        return self.brightness;
                    }
                }).catch(function (err) {
                    HAPnode.debug("Request error:"+err);
                    return self.brightness;
                });
            },
            identify: function()
            {
                debug("Identify the light %s", device.name);
            }
        };

        var lightUUID = uuid.generate('device:dimmer:'+config.cardinality+':'+device.id);

        var light = new Accessory(device.name, lightUUID);

        light.username  = functions.genMac('device:'+config.cardinality+':'+device.id);
        light.pincode   = config.pincode;
        light.deviceid  = device.id;

        light
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Oltica")
            .setCharacteristic(Characteristic.Model, "Rev-1")
            .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

        light.on('identify', function(paired, callback) {
            Dimmer.identify();
            callback(); // success
        });

        light
            .addService(Service.Lightbulb, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                Dimmer.setPowerOn(value);
                callback();
            });

        light
            .getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var err = null;
                Dimmer.getStatus().then(function(val){
                    callback(err, val);
                });
            });

        light
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Brightness)
            .on('get', function(callback) {
                var err = null;
                Dimmer.getBrightness().then(function(val){
                    callback(err, val);
                });
            })
            .on('set', function(value, callback) {
                Dimmer.setBrightness(value);
                callback();
            });

        return light;

    };

    return module;
};
