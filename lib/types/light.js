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
                });
            },
            getStatus: function()
            {
                debug("Making request for device %s", device.name);
                return HAPnode.request(
                        {
                            method: 'POST',
                            uri: 'http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:SwitchPower1&Variable=Status',
                            resolveWithFullResponse: true
                        }).then(function (res)
                        {
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
                        }.bind(this));
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
                Lightbulb.getStatus().then(function(val) {
                                    callback(err, val);
                            });
                
            });
          
        return light;
    };
    
    return module;
};