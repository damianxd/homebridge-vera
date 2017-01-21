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
                status = parseInt(functions.getVariable(device.id, 'locked'));
                // debug("Status for ", device.name, " is ", status?"locked":"unlocked");
                return status;
            },
            identify: function()
            {
                debug("Identify the lock!");
            }
        };

        var lockUUID = uuid.generate('device:lock:'+config.cardinality+':'+device.id);

        var lock = new Accessory(device.name, lockUUID);

        lock.username   = functions.genMac('device:'+config.cardinality+':'+device.id);
        lock.pincode    = config.pincode;
        lock.deviceid   = device.id;

        lock
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Oltica")
            .setCharacteristic(Characteristic.Model, "Rev-1")
            .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

        lock.on('identify', function(paired, callback) {
            Lock.identify();
            callback(); // success
        });

        lock
            .addService(Service.LockMechanism, device.name)
            .getCharacteristic(Characteristic.LockTargetState)
            .on('set', function(value, callback) {

                debug('Start set process for %s with the setting %s', device.name, value);
                Lock.lockchange(value).then(function(locked){
                  console.log('complete:', locked);
                  var state = locked?Characteristic.LockCurrentState.SECURED:Characteristic.LockCurrentState.UNSECURED;
                  callback();
                  lock
                    .getService(Service.LockMechanism)
                    .setCharacteristic(Characteristic.LockCurrentState, state);

                })
            });

        lock
            .getService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockCurrentState)
            .on('get', function(callback) {
                var err = null;
                var locked = Lock.getLockStatus();
                if(locked)
                {
                    callback(err, Characteristic.LockCurrentState.SECURED);
                }
                else
                {
                    callback(err, Characteristic.LockCurrentState.UNSECURED);
                };
            });

        lock
            .getService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockTargetState)
            .on('get', function(callback) {
                var err = null;
                var locked = Lock.getLockStatus();
                if(locked)
                {
                    callback(err, Characteristic.LockCurrentState.SECURED);
                }
                else
                {
                    callback(err, Characteristic.LockCurrentState.UNSECURED);
                };
            });


        setInterval(function() {
            var locked = Lock.getLockStatus();
            if(locked)
            {
                lock
                .getService(Service.LockMechanism)
                .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
            }
            else
            {
                lock
                .getService(Service.LockMechanism)
                .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
            };

        }, 3000);

        return lock;
    };

    return module;
};
