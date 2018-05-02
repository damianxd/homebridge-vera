module.exports = function(HAPnode, config, functions)
{
    var Accessory       = HAPnode.Accessory;
    var Service         = HAPnode.Service;
    var Characteristic  = HAPnode.Characteristic;
    var uuid            = HAPnode.uuid;
    var debug           = HAPnode.debug;

    var module  = {};

    module.newDevice = function()
    {
        var Methods = {

            setHouseMode: function(mode)
            {
                switch(mode)
                {
                    case 0:
                        veramode = 1;
                        break;
                    
                    case 1:
                        veramode = 2;
                        break;
                        
                    case 2:
                        veramode = 3;
                        break;
                        
                    case 3:
                        veramode = 1;
                        break;
                }
                
                var payload = {
                  action: 'SetHouseMode',
                  serviceId: 'urn:micasaverde-com:serviceId:HomeAutomationGateway1',
                  Mode: veramode,
                  DeviceNum: 0
                };
                
                return functions
                  .executeAction(payload)
                  .then(function(response){
                    debug("House Mode: request complete", response, mode);
                    return mode;
                  });
            },
            getHouseMode: function()
            {
                // zero-base house mode for homekit
                switch(parseInt(functions.getVariable(0, 'mode')))
                {
                    case 1:
                        mode = 0;
                        break;
                    
                    case 2:
                        mode = 1;
                        break;
                        
                    case 3:
                        mode = 2;
                        break;
                        
                    case 4:
                        mode = 1;
                        break;
                }
                return mode;
            },
            identify: function()
            {
                debug("Identify the house mode %s", "House Modes");
            }
        };

        var accessoryUUID = uuid.generate('device:SecuritySystem:'+config.cardinality+':'+0);

        var accessory = new Accessory('House Modes', accessoryUUID);

        accessory.deviceid  = 0;

        accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Oltica")
            .setCharacteristic(Characteristic.Model, "Rev-1")
            .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

        accessory.on('identify', function(paired, callback) {
            Methods.identify();
            callback(); // success
        });


        accessory
            .addService(Service.SecuritySystem, 'House Mode')
            .getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .on('get', function(callback) {
                debug("House Mode: getting current state")
                var err = null;
                callback(err, Methods.getHouseMode());
              });

        accessory
            .getService(Service.SecuritySystem)
            .getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on('set', function(value, callback) {
              debug("House Mode: Setting target state")
              Methods
                .setHouseMode(value)
                .then(function(value){
                  debug("House Mode: target state returned", value);
                  accessory
                    .getService(Service.SecuritySystem)
                    .setCharacteristic(Characteristic.SecuritySystemCurrentState, value);
                  callback(null, value);
                }).catch(function(error){
                  debug("House Mode: ERROR setting target state", error);
                  callback(null, value);
                });
            }).on('get', function(callback){
              debug("House Mode: getting target state")
              var err = null;
              callback(err, Methods.getHouseMode());
            });

        return accessory;

    };

    return module;
};
