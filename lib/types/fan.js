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
        var Fan = {
            powerOn: (parseInt(device.status) === 1)?true:false,
            rotationSpeed: 100,
            changespeed: false,

            setPowerOn: function(on, callback)
            {
                if (on)
                {
                    binaryState     = 1;
                    Fan.powerOn  = true;
                }
                else
                {
                    binaryState     = 0;
                    Fan.powerOn  = false;
                }
                var url = "http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState;
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                    {
                        status = (Fan.powerOn === 1)?'On':'Off';
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
            setRotationSpeed: function(rotationSpeed, callback)
            {
                // Apple sends 31.4043253660202 for Low, 66.52949452400208 for Mid, and 100 for High
                // On Lutron RZF01 66 is the upper threshold of the Mid level, so 67 results in High speed
                // For safety we'll translate these to 25 for Low, 50 for Mid, and leave 100 for High
                rotationSpeed = Math.floor(rotationSpeed);
                if (rotationSpeed < 50) {
                    rotationSpeed = 25;
                } else if (rotationSpeed < 100){
                    rotationSpeed = 50;
                }

                this.rotationSpeed = rotationSpeed;
                var url = "http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget=" + this.rotationSpeed;
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                    {
                        debug("The %s rotation speed has been changed to %d%", device.name, rotationSpeed);
                        callback();
                    }
                    else
                    {
                        debug("Error while changing %s rotation speed", device.name);
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

                        debug("Status for the fan %s is %s", device.name, status);
                        callback(null, that.powerOn);
                    }
                    else
                    {
                        debug("Error while getting the status for %s", device.name);
                        callback(null, that.powerOn);
                    }
                });

            },
            getRotationSpeed: function(callback)
            {
                var that = this;
                var url = 'http://'+config.veraIP+':3480/data_request?id=variableget&output_format=xml&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:Dimming1&Variable=LoadLevelStatus';
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                    {
                        data = parseInt(res.body.toString('utf8'));
                        that.rotationSpeed = data;

                        debug("Status for the fan %s is %s%", device.name, that.rotationSpeed);

                        callback(null, that.rotationSpeed);
                    }
                    else
                    {
                        debug("Error while getting the status for %s", device.name);
                        callback(null, that.rotationSpeed);
                    }
                });

            },
            identify: function(callback)
            {
                debug("Identify the fan %s", device.name);
                callback();
            }
        };

        var fanUUID = uuid.generate('device:fan:'+config.cardinality+':'+device.id);

        var fan = new Accessory(device.name, fanUUID);

        fan.username  = functions.genMac('device:'+config.cardinality+':'+device.id);
        fan.pincode   = config.pincode;
        fan.deviceid  = device.id;

        fan
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Leviton")
            .setCharacteristic(Characteristic.Model, "RZF01")
            .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

        fan.on('identify', Fan.identify.bind(Fan));

        fan
            .addService(Service.Fan, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', Fan.setPowerOn.bind(Fan));

        fan
            .getService(Service.Fan)
            .getCharacteristic(Characteristic.On)
            .on('get', Fan.getStatus.bind(Fan));

        fan
            .getService(Service.Fan)
            .addCharacteristic(Characteristic.RotationSpeed)
            .on('get', Fan.getRotationSpeed.bind(Fan))
            .on('set', Fan.setRotationSpeed.bind(Fan));

        return fan;

    };

    return module;
};
