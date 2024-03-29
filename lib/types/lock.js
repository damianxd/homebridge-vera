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
        var Lock = {
            locked: (device.locked === '1')?true:false,
            lockchange: function(value)
            {
              value = value ? 1:0;
              return functions.executeAction({
                action: 'SetTarget',
                serviceId: 'urn:micasaverde-com:serviceId:DoorLock1',
                newTargetValue: value,
                DeviceNum: device.id
              }).then(function(response){
                return value;
              })
            },
            getLockStatus: function()
            {
                // debug("Making request on device %s",device.name);
                status = functions.getVariable(device.id, 'locked', 'number');
                // console.log(status);
                debug("Status for ", device.id, " is ", status ? "locked":"unlocked");
                return status;
            },
            identify: function()
            {
                debug("Identify the accessory!");
            }
        };

        if(config.garageLocks && (config.garageLocks.indexOf(device.id)>=0)) {
            debug("LOCK INDEX:", config.garageLocks.indexOf(device.id));
            var hapuuid = uuid.generate('device:garage:'+config.cardinality+':'+device.id);
            var service = Service.GarageDoorOpener;
            var targetState = Characteristic.TargetDoorState;
            var currentState = Characteristic.CurrentDoorState;
            var currentStateSecured = currentState.CLOSED;
            var currentStateUnsecured = currentState.OPEN;
        }else{
            var hapuuid = uuid.generate('device:lock:'+config.cardinality+':'+device.id);
            var service = Service.LockMechanism;
            var targetState = Characteristic.LockTargetState;
            var currentState = Characteristic.LockCurrentState;
            var currentStateSecured = currentState.SECURED;
            var currentStateUnsecured = currentState.UNSECURED;
        }
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

        accessory
          .on('identify', function(paired, callback) {
            Lock.identify();
            callback(); // success
        });

        accessory
            .addService(service, device.name)
            .getCharacteristic(targetState)
            .on('set', function(value, callback) {
                let accessoryService = accessory.getService(service),
                    characteristic = accessoryService.getCharacteristic(targetState);
                debug('setting lock, preventRequest? %s', device.preventRequest);
                if(device.preventRequest){
                  device.preventRequest = false;
                  return callback(null);
                }
                characteristic.sending = true;
                debug('Start set process for %s with the setting %s', device.name, value);
                Lock
                  .lockchange(value)
                  .then(function(locked){
                    setTimeout( function(){
                      characteristic.sending = false;
                    }, 5000);
                    var state = locked?currentStateSecured:currentStateUnsecured;
                    callback(null);


                })
            });

        accessory.getService(service).getCharacteristic(targetState).sending = false;
        accessory.getService(service).getCharacteristic(currentState).sending = false;

        accessory
            .getService(service)
            .getCharacteristic(currentState)
            .on('get', function(callback) {
                var err = null;
                var locked = Lock.getLockStatus();
                debug('getting current state %s', locked);
                if(locked)
                {
                    callback(err, currentStateSecured);
                }
                else
                {
                    callback(err, currentStateUnsecured);
                };
            });

        accessory
            .getService(service)
            .getCharacteristic(targetState)
            .on('get', function(callback) {
                var err = null;
                var locked = Lock.getLockStatus();
                debug('getting target state %s', locked);
                if(locked)
                {
                    callback(err, currentStateSecured);
                }
                else
                {
                    callback(err, currentStateUnsecured);
                };
            });


        functions.checkCharacteristics(device, [{
            vera: 'locked',
            ios: targetState,
            type: 'number',
            service: accessory.getService(service)
          },
          {
            vera: 'locked',
            ios: currentState,
            type: 'number',
            unblock: true,
            service: accessory.getService(service)
          }
        ]);
        return accessory;
    };

    return module;
};
