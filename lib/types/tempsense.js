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
                debug('Making request on device %s', device.name);
                return HAPnode.request({method:'GET', uri:'http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:upnp-org:serviceId:TemperatureSensor1&Variable=CurrentTemperature',json: true}).then(function (data)
                {
                    debug('Current temp is %s on device %s', data, device.name);
                    return data;
                });
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
                Sensor.getTemperature().then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        return sensor;
    };
    return module;
};