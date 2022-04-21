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
        var GarageDoor = {
            opened: (parseInt(device.status) === 1) ? true : false,
            setTarget: function(opened)
            {
              var value = opened ? 1 : 0;

              return functions.executeAction({
                action: 'SetTarget',
                serviceId: 'urn:upnp-org:serviceId:SwitchPower1',
                newTargetValue: value,
                DeviceNum: device.id
              }).then(function(response){
                GarageDoor.opened = !!opened;
                return opened;
              })
            },
            getGarageDoorStatus: function()
            {
                // debug("Making request on device %s",device.name);
                status = parseInt(functions.getVariable(device.id, 'status'));
                // debug("Status for ", device.name, " is ", status?"openned":"closed");
                return status;
            },
            identify: function()
            {
                debug("Identify the accessory!");
            }
        };

        var hapuuid = uuid.generate('device:garage:'+config.cardinality+':'+device.id);
        var service = Service.GarageDoorOpener;

        var accessory = new Accessory(device.name, hapuuid);

        accessory.username   = functions.genMac('device:'+config.cardinality+':'+device.id);
        accessory.pincode    = config.pincode;
        accessory.deviceid   = device.id;

        accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        if (device.model) {
            accessory
                .getService(Service.AccessoryInformation)
                .setCharacteristic(Characteristic.Model, device.model);
        }
        accessory.on('identify', function(paired, callback) {
            GarageDoor.identify();
            callback(); // success
        });

        accessory
            .addService(service, device.name)
            .getCharacteristic(Characteristic.TargetDoorState)
            .on('set', function(value, callback) {
                debug('Start set process for %s with the setting %s', device.name, value);
                var opened = value === Characteristic.TargetDoorState.OPEN;
                GarageDoor.setTarget(opened).then(function(opened){
                  debug('GarageDoor.setTarget complete:', opened);
                  var state = opened ? Characteristic.CurrentDoorState.OPEN : Characteristic.CurrentDoorState.CLOSED;
                  callback();
                  accessory
                    .getService(service)
                    .setCharacteristic(Characteristic.CurrentDoorState, state);

                })
            });

        accessory
            .getService(service)
            .getCharacteristic(Characteristic.CurrentDoorState)
            .on('get', function(callback) {
                var err = null;
                var opened = GarageDoor.getGarageDoorStatus();
                if(opened)
                {
                    callback(err, Characteristic.CurrentDoorState.OPEN);
                }
                else
                {
                    callback(err, Characteristic.CurrentDoorState.CLOSED);
                };
            });

        accessory
            .getService(service)
            .getCharacteristic(Characteristic.TargetDoorState)
            .on('get', function(callback) {
                var err = null;
                var opened = GarageDoor.getGarageDoorStatus();
                if(opened)
                {
                    callback(err, Characteristic.CurrentDoorState.OPEN);
                }
                else
                {
                    callback(err, Characteristic.CurrentDoorState.CLOSED);
                };
            });


        setInterval(function() {
            var opened = GarageDoor.getGarageDoorStatus();
            if(opened)
            {
                accessory
                .getService(service)
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
            }
            else
            {
                accessory
                .getService(service)
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
            };

        }, 3000);

        return accessory;
    };

    return module;
};
