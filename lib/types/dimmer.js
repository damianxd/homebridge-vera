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
                  var index = functions.cache.devices.findIndex(function(cacheDevice, index){
                    return (device.id === cacheDevice.id);
                  });
                  return state;
                })
            },
            setBrightness: function(brightness)
            {
                var service = 'urn:upnp-org:serviceId:Dimming1',
                    action = 'SetLoadLevelTarget',
                    value = parseInt(brightness);
                return functions.executeAction({
                  action: action,
                  serviceId: service,
                  newLoadlevelTarget: value,
                  DeviceNum: device.id
                }).then(function(response){
                  var index = functions.cache.devices.findIndex(function(cacheDevice, index){
                    return (device.id === cacheDevice.id);
                  });
                  functions.cache.devices[index].level = value;
                  return value;
                  // debug(response['u:SetTargetResponse']);
                });
            },
            getStatus: function()
            {
                var status = parseInt(functions.getVariable(device.id, 'status'));
                return status;
            },
            getBrightness: function()
            {
              level = parseInt(functions.getVariable(device.id, 'level'));
              return level;
            },
            identify: function()
            {
                debug("Identify the light %s", device.name);
            }
        };

        var lightUUID = uuid.generate('device:dimmer:'+config.cardinality+':'+device.id);

        var light = new Accessory(device.name, lightUUID);

        // light.username  = functions.genMac('device:'+config.cardinality+':'+device.id);
        // light.pincode   = config.pincode;
        light.deviceid  = device.id;

        light
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.Model, device.model)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        light.on('identify', function(paired, callback) {
            Dimmer.identify();
            callback(); // success
        });


        light
            .addService(Service.Lightbulb, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(state, callback) {
                debug("Power state called:", device.dimming, state);
                if(device.preventRequest){
                  device.preventRequest = false;
                  return callback(null, state);
                }
                setTimeout(function(){
                  debug("Power state continued");
                  if(device.dimming){
                    debug('Cancelling extraneous Power request.');
                    return callback(null, state);
                  }
                  if(state && config.saveBrightness){
                    var bulb = light.getService(Service.Lightbulb),
                        brightness = bulb.getCharacteristic(Characteristic.Brightness),
                        level = brightness.value || 100;
                    Dimmer.setBrightness(level).then(function(level){
                      state = level?true:false;
                      callback(null, state);
                    })
                  }else{
                    Dimmer.setPowerOn(state).then(function(state){
                      device.level = state?100:0;
                      callback(null, state);
                    })
                  }
                }, 500);
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
                if(device.preventRequest){
                  device.preventRequest = false;
                  return callback(null, value);
                }
                device.dimming = true;
                setTimeout(function(){
                  device.dimming = false;
                }, 3000);
                debug("Dimming set called.");
                Dimmer.setBrightness(value).then(function(value){
                  callback(null, value);
                }).catch(function(){
                  callback(null, value);
                })

            });

        // Update Loop, regular polling for updates.
        functions.checkCharacteristics(device, [{
            vera: 'level',
            ios: Characteristic.Brightness,
            type: 'number',
            service: light.getService(Service.Lightbulb)
          },{
            vera: 'status',
            ios: Characteristic.On,
            type: 'boolean',
            service: light.getService(Service.Lightbulb)
          }
        ]);



        return light;

    };

    return module;
};
