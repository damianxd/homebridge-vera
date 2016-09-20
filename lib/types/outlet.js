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
                res = HAPnode.request('GET','http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:SwitchPower1&Variable=Status');

                if (res.statusCode === 200)
                {
                    data = parseInt(res.body.toString('utf8'));
                    this.powerOn = (data === 1)?true:false;
                    status = (this.powerOn)?'On':'Off';
                    
                    debug("Status for the outlet %s is %s", device.name, status);
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
                debug("Identify the outlet %s", device.name);
            }
        };

        var outletUUID = uuid.generate('device:outlet:'+config.cardinality+':'+device.id);

        var outlet = new Accessory(device.name, outletUUID);

        outlet.username  = functions.genMac('device:'+config.cardinality+':'+device.id);
        outlet.pincode   = config.pincode;
        outlet.deviceid  = device.id;

        outlet
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Z-Wave")
            .setCharacteristic(Characteristic.Model, "1.0")
            .setCharacteristic(Characteristic.SerialNumber, "N/A");

        outlet.on('identify', function(paired, callback) {
            Switch.identify();
            callback(); // success
        });

        outlet
            .addService(Service.Outlet, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                Switch.setPowerOn(value);
                callback();
            });

        outlet
            .getService(Service.Outlet)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var err = null;

                callback(err, Switch.getStatus());
            });
          
        return outlet;
    };
    
    return module;
};
