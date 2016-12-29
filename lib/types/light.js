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
        var Lightbulb = {
            powerOn: (parseInt(device.status) === 1)?true:false,

            setPower: function(on)
            {
                if (on)
                {
                    binaryState     = 1;
                    Lightbulb.powerOn  = true;
                }
                else
                {
                    binaryState     = 0;
                    Lightbulb.powerOn  = false;
                }

                debug("Making request for device %s", device.name);

                return HAPnode.request({method:'GET',uri:"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState, resolveWithFullResponse: true}).then(function (res)
                {
                    if (res.statusCode === 200)
                    {
                        status = (Lightbulb.powerOn)?'On':'Off';
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
            getStatus: function()
            {
                debug("Making request for device %s", device.name);
                status = parseInt(functions.getVariable(device.id, 'status'));
                debug("LEVEL IS ", status)
                return status;
            },
            identify: function()
            {
                debug("Identify the light %s", device.name);
            }
        };

        var light = new Accessory(device.name, uuid.generate('device:Lightbulb:'+config.cardinality+':'+device.id));

        light.username  = functions.genMac('device:'+config.cardinality+':'+device.id);
        light.pincode   = config.pincode;
        light.deviceid  = device.id;

        light
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Oltica")
            .setCharacteristic(Characteristic.Model, "Rev-1")
            .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

        light.on('identify', function(paired, callback) {
            Lightbulb.identify();
            callback(); // success
        });

        light
            .addService(Service.Lightbulb, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                Lightbulb.setPower(value);
                callback();
            });

        light
            .getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var err = null;
                callback(err, Lightbulb.getStatus());

            });

        return light;
    };

    return module;
};
