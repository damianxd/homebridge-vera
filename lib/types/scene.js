module.exports = function(HAPnode, config, functions)
{
    var Accessory       = HAPnode.Accessory;
    var Service         = HAPnode.Service;
    var Characteristic  = HAPnode.Characteristic;
    var uuid            = HAPnode.uuid;
    var debug           = HAPnode.debug;

    var module  = {};

    module.newScene = function(scene)
    {
        var Switch = {
            powerOn: false,

            setPower: function(state)
            {
                debug("Making request for device %s", scene.name, state);
                if(state){
                  var service = 'urn:micasaverde-com:serviceId:HomeAutomationGateway1',
                      action = 'RunScene';
                  return functions.executeAction({
                    action: action,
                    serviceId: service,
                    SceneNum: scene.id
                  }).then(function(response){
                    debug("Scene Triggered: ", response);
                    return true;
                  })
                }else{
                  return Promise.resolve(false);
                }
            },
            getStatus: function()
            {
                return Switch.powerOn;
            },
            identify: function()
            {
                debug("Identify the light %s", scene.name);
            }
        };

        var switchac = new Accessory(scene.name, uuid.generate('scene:switch:'+config.cardinality+':'+scene.id));

        switchac.username  = functions.genMac('scene:'+config.cardinality+':'+scene.id);
        switchac.pincode   = config.pincode;
        switchac.deviceid  = scene.id;

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
            .addService(Service.Switch, scene.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                debug(value);
                Switch
                  .setPower(value)
                  .then(function(response){
                    debug('Value returned:', response);
                    if(response){
                      setTimeout(function(){
                        switchac
                          .getService(Service.Switch)
                          .setCharacteristic(Characteristic.On, false);
                      }, 1000);
                    }
                    callback(null, value);
                })

            });

        switchac
            .getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                callback(null, 0);
            });

        return switchac;
    };

    return module;
};
