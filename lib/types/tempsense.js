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
        var Sensor = {
            getTemperature: function() { 
                res = HAPnode.request('GET', 'http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:TemperatureSensor1&Variable=CurrentTemperature', {json:true});
        
                data = parseInt(res.body.toString('utf8'));
                debug('Current temp is %s on device %s', data, device.name);
                return data;
            }
        };

        var sensorUUID = uuid.generate('device:tempsense:'+config.cardinality+':'+device.id);

        var sensor = new Accessory(device.name, sensorUUID);

        sensor.username   = functions.genMac('device:'+config.cardinality+':'+device.id);
        sensor.pincode    = config.pincode;
        sensor.deviceid   = device.id;
        

        sensor
            .addService(Service.TemperatureSensor)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', function(callback)
            {
                debug('Getting latest value for %s', device.name);
                // return our current value
                callback(null, Sensor.getTemperature());
            });

        return sensor;
    };
    return module;
};