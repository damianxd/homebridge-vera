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
            powerOn: false,
            brightness: 100,
            onproc: false,
            changebright: false,

            setPowerOn: function(on)
            { 
                if (on)
                {
                    binaryState     = 1;
                    Dimmer.powerOn  = 'on';
                }
                else
                {
                    binaryState     = 0;
                    Dimmer.powerOn  = 'off';
                }

                res = HAPnode.request('GET',"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:DimmerPower1&action=SetTarget&newTargetValue=" + binaryState);

                if (res.statusCode === 200)
                {
                    debug("The %s has been turned %s", device.name, Dimmer.powerOn);
                }
                else
                {
                    debug("Error while turning the %s on/off %s", device.name);
                }
            },
            setBrightness: function(brightness)
            {
                if(this.onproc === false)
                {
                    this.onproc = true;
                    this.brightness = brightness;
                    
                    res = HAPnode.request('GET',"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget=" + this.brightness);
                    if (res.statusCode === 200)
                    {
                        debug("The %s brightness has been changed to %d%", device.name, brightness);
                    }
                    else
                    {
                        debug("Error while changing %s brightness", device.name);
                    }
                    
                    this.onproc = false;
                    
                    if(this.changebright)
                    {
                        this.brightness = this.changebright;
                        this.changebright = false;
                        return this.setBrightness(this.brightness);
                    }
                }
                else
                {
                    this.changebright = brightness;
                    return;
                }
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

                debug("Status for the light %s is %s", device.name, Dimmer.powerOn);
                if (Dimmer.powerOn)
                {
                    callback(err, true);
                }
                else
                {
                    callback(err, false);
                }
            });
                  
        light
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Brightness)
            .on('get', function(callback) {
                callback(null, Dimmer.brightness);
            })
            .on('set', function(value, callback) {
                Dimmer.setBrightness(value);
                callback();
            });
            
        return light;

    };
    
    return module;
};