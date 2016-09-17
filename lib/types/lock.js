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
            locked: device.locked === '1',
            isSecured: function() {
                return this.locked ?
                    Characteristic.LockCurrentState.SECURED
                    : Characteristic.LockCurrentState.UNSECURED;
            },
            changeLock: function(value, callback)
            {
                var that = this;
                Lock.locked = true;

                if (value)
                {
                    binaryState     = 1;
                    Lock.locked     = true;
                }
                else
                {
                    binaryState     = 0;
                    Lock.locked     = false;
                }
                var url = "http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:micasaverde-com:serviceId:DoorLock1&action=SetTarget&newTargetValue=" + binaryState;
                res = HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                    {
                        status = (that.locked)?'Locked':'Unlocked';
                        debug("The %s has been %s",device.name, status);
                    }
                    else
                    {
                        debug("Error while turning the %s lock/locked:  %s", device.name);
                    }
                });
            },
            getLockStatus: function(callback)
            {
                var that = this;
                var url = 'http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:micasaverde-com:serviceId:DoorLock1&Variable=Status';
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200)
                    {
                        data = parseInt(res.body.toString('utf8'));
                        that.locked = data === 1;
                        status = (that.locked)?'Locked':'Unlocked';

                        debug("Status for the lock %s is %s", device.name, status);
                        callback(that.isSecured());
                    }
                    else
                    {
                        debug("Error while getting the status for %s", device.name);
                        callback(that.isSecured());
                    }
                });

            },
            identify: function(callback)
            {
                debug("Identify the lock!");
                callback();
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

        lock.on('identify', Lock.identify.bind(Lock));

        lock
            .addService(Service.LockMechanism, device.name)
            .getCharacteristic(Characteristic.LockTargetState)
            .on('set', function(value, callback) {

                debug('Start set process for %s with the setting %s', device.name, value);

                if (value === Characteristic.LockTargetState.UNSECURED) {
                    Lock.changeLock(value);
                    callback();

                    lock
                        .getService(Service.LockMechanism)
                        .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
                }
                else if (value === Characteristic.LockTargetState.SECURED)
                {
                    Lock.changeLock(value);
                    callback();

                    lock
                        .getService(Service.LockMechanism)
                        .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
                }
            });

        lock
            .getService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockCurrentState)
            .on('get', Lock.getLockStatus.bind(Lock));

        return lock;
    };

    return module;
};
