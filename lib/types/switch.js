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

            setPowerOn: function(on)
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

                res = HAPnode.request('GET',"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + binaryState);

                if (res.statusCode === 200)
                {
                    status = (Switch.powerOn)?'On':'Off';
                    debug("The %s has been turned %s", device.name, status);
                }
                else
                {
                    debug("Error while turning the %s on/off %s", device.name);
                }
            },
            getStatus: function()
            {
                res = HAPnode.request('GET','http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:SwitchPower1=Status');

                if (res.statusCode === 200)
                {
                    data = parseInt(res.body.toString('utf8'));
                    this.powerOn = (data === 1)?true:false;
                    status = (this.powerOn)?'On':'Off';
                    
                    debug("Status for the light %s is %s", device.name, status);
                    return this.powerOn;
                }
                else
                {
                    debug("Error while getting the status for %s", device.name);
                    return this.powerOn;
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
            .on('set', function(value, callback) {
                Switch.setPowerOn(value);
                callback();
            });

        light
            .getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var err = null;

                callback(err, Switch.getStatus());
            });
          
        return light;
    };
    
    return module;
};