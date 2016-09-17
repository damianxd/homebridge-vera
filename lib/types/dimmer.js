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
            changebright: false,

            setPowerOn: function(on, callback)
            {
                if (on)
                {
                    binaryState     = 1;
                    Dimmer.powerOn  = true;
                }
                else
                {
                    binaryState     = 0;
                    Dimmer.powerOn  = false;
                }
                var url = "http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState;
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                    {
                        status = (Dimmer.powerOn === 1)?'On':'Off';
                        debug("The %s has been turned %s", device.name, status);
                        callback();
                    }
                    else
                    {
                        debug("Error while turning the %s on/off %s", device.name);
                        callback();
                    }
                });

            },
            setBrightness: function(brightness, callback)
            {
                this.brightness = brightness;
                var url = "http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget=" + this.brightness;
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                    {
                        debug("The %s brightness has been changed to %d%", device.name, brightness);
                        callback();
                    }
                    else
                    {
                        debug("Error while changing %s brightness", device.name);
                        callback();
                    }
                });
            },
            getStatus: function(callback)
            {
                var that = this;
                var url = 'http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:SwitchPower1&Variable=Status';
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                {
                        data = parseInt(res.body.toString('utf8'));
                        that.powerOn = data === 1;
                        status = (that.powerOn)?'On':'Off';
                        debug("Status for the light %s is %s", device.name, status);
                        callback(null, that.powerOn);
                    }
                    else
                    {
                        debug("Error while getting the status for %s", device.name);
                        callback(null, that.powerOn);
                    }
                });

            },
            getBrightness: function(callback)
            {
                var that = this;
                var url = 'http://'+config.veraIP+':3480/data_request?id=variableget&output_format=xml&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:Dimming1&Variable=LoadLevelStatus';
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                    {
                        data = parseInt(res.body.toString('utf8'));
                        that.brightness = data;

                        debug("Status for the light %s is %s%", device.name, that.brightness);

                        callback(null, that.brightness);
                    }
                    else
                    {
                        debug("Error while getting the status for %s", device.name);
                        callback(null, that.brightness);
                    }
                });

            },
            identify: function(callback)
            {
                debug("Identify the light %s", device.name);
                callback();
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

        light.on('identify', Dimmer.identify.bind(Dimmer));

        light
            .addService(Service.Lightbulb, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', Dimmer.setPowerOn.bind(Dimmer));

        light
            .getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('get', Dimmer.getStatus.bind(Dimmer));

        light
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Brightness)
            .on('get', Dimmer.getBrightness.bind(Dimmer))
            .on('set', Dimmer.setBrightness.bind(Dimmer));

        return light;

    };

    return module;
};
