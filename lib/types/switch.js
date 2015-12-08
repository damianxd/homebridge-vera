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
            powerOn: false,

            setPowerOn: function(on)
            { 
                if (on)
                {
                    binaryState     = 1;
                    Switch.powerOn  = 'on';
                }
                else
                {
                    binaryState     = 0;
                    Switch.powerOn  = 'off';
                }

                res = HAPnode.request('GET',"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState);

                if (res.statusCode === 200)
                {
                    debug("The %s has been turned %s", device.name, Switch.powerOn);
                }
                else
                {
                    debug("Error while turning the %s on/off %s", device.name);
                }
            },
            identify: function()
            {
                debug("Identify the light %s", device.name);
            }
        };

        var lightUUID = uuid.generate('device:switch:'+config.cardinality+':'+device.id);

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
            Switch.identify();
            callback(); // success
        });

        light
            .addService(Service.Lightbulb, device.name)
            .getCharacteristic(Characteristic.On) 
            .on('get',function(callback) {
                debug("Status for the light %s is %s", device.name, Switch.powerOn);
            })
            .on('set', function(value, callback) {
                Switch.setPowerOn(value);
                callback();
            });

        light
            .getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {

                var err = null;

                debug("Status for the light %s is %s", device.name, Switch.powerOn);
                if (Switch.powerOn)
                {
                    callback(err, true);
                }
                else
                {
                    callback(err, false);
                }
            });
          
        return light;
    };
    
    return module;
};