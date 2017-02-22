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
        var Dimmer = {

            setPowerOn: function(state)
            {
                debug("Making POWER request for device %s", device.name);
                state = state ? 1:0;
                var service = 'urn:upnp-org:serviceId:SwitchPower1',
                    action = 'SetTarget',
                    value = state;
                return functions.executeAction({
                  action: action,
                  serviceId: service,
                  newTargetValue: value,
                  DeviceNum: device.id
                }).then(function(response){
                  debug("Light Power set");
                  var index = functions.cache.devices.findIndex(function(cacheDevice, index){
                    return (device.id === cacheDevice.id);
                  });
                  functions.cache.devices[index].status = value;
                })
            },
            setBrightness: function(brightness)
            {
                debug("Making BRIGHTNESS request for device %s", device.name, brightness, parseInt(brightness));
                var service = 'urn:upnp-org:serviceId:Dimming1',
                    action = 'SetLoadLevelTarget',
                    value = parseInt(brightness);
                return functions.executeAction({
                  action: action,
                  serviceId: service,
                  newLoadlevelTarget: value,
                  DeviceNum: device.id
                }).then(function(response){
                  debug("Light Brightness set");
                  var index = functions.cache.devices.findIndex(function(cacheDevice, index){
                    return (device.id === cacheDevice.id);
                  });
                  functions.cache.devices[index].level = value;
                  // debug(response['u:SetTargetResponse']);
                });
            },
            getStatus: function()
            {
                debug("Making status request for device %s", device.name);
                var status = parseInt(functions.getVariable(device.id, 'status'));
                debug("Status is ", status);
                return status;
            },
            getBrightness: function()
            {
              debug("Making level request for device %s", device.name);
              level = parseInt(functions.getVariable(device.id, 'level'));
              debug("Level is ", level);
              return level;
            },
            identify: function()
            {
                debug("Identify the light %s", device.name);
            }
        };

        var lightUUID = uuid.generate('device:dimmer:'+config.cardinality+':'+device.id);

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
            Dimmer.identify();
            callback(); // success
        });

        light
            .addService(Service.Lightbulb, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                if(value){
                  var bulb = light.getService(Service.Lightbulb),
                      brightness = bulb.getCharacteristic(Characteristic.Brightness),
                      value = brightness.value;
                  Dimmer.setBrightness(value).then(function(value){
                    callback(null, value);
                  })
                }else{
                  Dimmer.setPowerOn(value).then(function(value){
                    callback(null, value);
                  })
                }
            });

        light
            .getService(Service.Lightbulb)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var err = null;
                callback(err, Dimmer.getStatus());
                });

        light
            .getService(Service.Lightbulb)
            .addCharacteristic(Characteristic.Brightness)
            .on('get', function(callback) {
                var err = null;
                callback(err, Dimmer.getBrightness());
            })
            .on('set', function(value, callback) {
                Dimmer.setBrightness(value).then(function(value){
                  callback(null, value);
                }).catch(function(){
                  callback(null, value);
                })

            });

        return light;

    };

    return module;
};
