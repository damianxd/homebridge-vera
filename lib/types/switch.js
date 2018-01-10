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
        var Switch = {
            powerOn: (parseInt(device.status) === 1)?true:false,

            setPower: function(on)
            {
                if (on)
                {
                    binaryState     = 1;
                    Switch.powerOn  = true;
                }
                else
                {
                    binaryState     = 0;
                    Switch.powerOn  = false;
                }

                debug("Making request for device %s", device.name);

                return HAPnode.request({method:'GET',uri:"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState, resolveWithFullResponse: true}).then(function (res)
                {
                    if (res.statusCode === 200)
                    {
                        status = (Switch.powerOn)?'On':'Off';
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
                debug("Status for ", device.name, " is ", status);
                return status;
            },
            identify: function()
            {
                debug("Identify the switch %s", device.name);
            }
        };

        var switchac = new Accessory(device.name, uuid.generate('device:switch:'+config.cardinality+':'+device.id));

        switchac.username  = functions.genMac('device:'+config.cardinality+':'+device.id);
        switchac.pincode   = config.pincode;
        switchac.deviceid  = device.id;

        switchac
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Oltica")
            .setCharacteristic(Characteristic.Model, "Rev-1")
            .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

        switchac.on('identify', function(paired, callback) {
            Switch.identify();
            callback(); // success
        });

        switchac
            .addService(Service.Switch, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                Switch.setPower(value);
                callback();
            });

        switchac
            .getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var err = null;
                callback(err, Switch.getStatus());

            });

        return switchac;
    };

    return module;
};
