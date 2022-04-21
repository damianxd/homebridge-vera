module.exports = function(HAPnode, config, functions)
{
    var Accessory       = HAPnode.Accessory;
    var Service         = HAPnode.Service;
    var Characteristic  = HAPnode.Characteristic;
    var uuid            = HAPnode.uuid;
    var debug           = HAPnode.debug;

    var module  = {};
    var debug = HAPnode.debug;
    module.newDevice = function(device)
    {
        var Dimmer = {

            setPowerOn: function(state)
            {
                state = state ? 1:0;
                var service = 'urn:upnp-org:serviceId:SwitchPower1',
                    action = 'SetTarget',
                    value = state?1:0;

                return functions.executeAction({
                  action: action,
                  serviceId: service,
                  newTargetValue: value,
                  DeviceNum: device.id
                }).then(function(response){
                  return state;
                });
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
                });
            },
            getStatus: function()
            {
                var status = functions.getVariable(device.id, 'status', 'number');
                debug('got status', status)
                return status;
            },
            getBrightness: function()
            {
              level = functions.getVariable(device.id, 'level', 'number');
              debug('got brightness', level)
              return level;
            },
            identify: function()
            {
                debug("Identify the light %s", device.name);
            }
        };

        var lightUUID = uuid.generate('device:dimmer:'+config.cardinality+':'+device.id);

        var light = new Accessory(device.name, lightUUID);

        light.deviceid  = device.id;

        light
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        if (device.model) {
            light
              .getService(Service.AccessoryInformation)
              .setCharacteristic(Characteristic.Model, device.model);
        }

        light.on('identify', function(paired, callback) {
            Dimmer.identify();
            callback(); // success
        });


        light
            .addService(Service.Lightbulb, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(state, callback) {
                let service = light.getService(Service.Lightbulb);
                debug("%s Power state changed to %s", device.name, state);

                var characteristic = service.getCharacteristic(Characteristic.On);
                    
                
                if(characteristic.value && state)return callback(null);
                
                characteristic.sending = true;

                Dimmer
                  .setPowerOn(state)
                  .then(function(state){
                    callback(null);
                  }).finally( function(){
                    // delay reset, as there may already be a check underway
                    setTimeout(function(){ characteristic.sending = false }, 1500)
                  })
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
                let service = light.getService(Service.Lightbulb),
                    characteristic = service.getCharacteristic(Characteristic.Brightness);
                
                debug("[Set called for dimmer]: %s", value);
                characteristic.sending = true;

                // if(device.preventRequest){
                //   debug("prevent request!!!!");
                //   device.preventRequest = false;
                //   return callback(null);
                // }
                // debug("Dimming set called.");
                debug("%s \x1b[36m%s\x1b[0m called: %s", device.name, characteristic.displayName, value);
                Dimmer
                  .setBrightness(value)
                  .then(function(value){
                    debug('success!');
                    callback(null);
                  }).catch(function(){
                    debug("error on brightness!");
                    callback(null);
                  }).finally(function(){
                    // delay reset, as there may already be a check underway
                    setTimeout(function(){ characteristic.sending = false }, 2000);
                  })

            });

        light.getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).sending = false;
        light.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).sending = false;
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
