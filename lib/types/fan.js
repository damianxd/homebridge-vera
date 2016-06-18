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
            onproc: false,
            changespeed: false,

            setPowerOn: function(on)
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

                res = HAPnode.request('GET',"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState);

                if (res.statusCode === 200)
                {
                    status = (Fan.powerOn === 1)?'On':'Off';
                    debug("The %s has been turned %s", device.name, status);
                }
                else
                {
                    debug("Error while turning the %s on/off %s", device.name);
                }
            },
            setRotationSpeed: function(rotationSpeed)
            {
                rotationSpeed = Math.round(rotationSpeed);
                if(this.onproc === false)
                {
                    this.onproc = true;
                    this.rotationSpeed = rotationSpeed;

                    res = HAPnode.request('GET',"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget=" + this.rotationSpeed);
                    if (res.statusCode === 200)
                    {
                        debug("The %s rotation speed has been changed to %d%", device.name, rotationSpeed);
                    }
                    else
                    {
                        debug("Error while changing %s rotation speed", device.name);
                    }

                    this.onproc = false;

                    if(this.changespeed)
                    {
                        this.rotationSpeed = this.changespeed;
                        this.changespeed = false;
                        return this.setRotationSpeed(this.rotationSpeed);
                    }
                }
                else
                {
                    this.changespeed = rotationSpeed;
                    return;
                }
            },
            getStatus: function()
            {
                res = HAPnode.request('GET','http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:SwitchPower1&Variable=Status');

                if (res.statusCode === 200)
                {
                    data = parseInt(res.body.toString('utf8'));
                    this.powerOn = (data === 1)?true:false;
                    status = (this.powerOn)?'On':'Off';

                    debug("Status for the fan %s is %s", device.name, status);
                    return this.powerOn;
                }
                else
                {
                    debug("Error while getting the status for %s", device.name);
                    return this.powerOn;
                }
            },
            getRotationSpeed: function()
            {
                res = HAPnode.request('GET','http://'+config.veraIP+':3480/data_request?id=variableget&output_format=xml&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:Dimming1&Variable=LoadLevelStatus');

                if (res.statusCode === 200)
                {
                    data = parseInt(res.body.toString('utf8'));
                    this.rotationSpeed = data;

                    debug("Status for the fan %s is %s%", device.name, this.rotationSpeed);

                    return this.rotationSpeed;
                }
                else
                {
                    debug("Error while getting the status for %s", device.name);
                    return this.rotationSpeed;
                }
            },
            identify: function()
            {
                debug("Identify the fan %s", device.name);
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

        fan.on('identify', function(paired, callback) {
            Fan.identify();
            callback(); // success
        });

        fan
            .addService(Service.Fan, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                Fan.setPowerOn(value);
                callback();
            });

        fan
            .getService(Service.Fan)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var err = null;

                callback(err, Fan.getStatus());
            });

        fan
            .getService(Service.Fan)
            .addCharacteristic(Characteristic.RotationSpeed)
            .on('get', function(callback) {
                var err = null;

                callback(err, Fan.getRotationSpeed());
            })
            .on('set', function(value, callback) {
                Fan.setRotationSpeed(value);
                callback();
            });

        return fan;

    };

    return module;
};
