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
                debug("Making request on device %s",device.name);
                return HAPnode.request({method:'GET',uri:"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:micasaverde-com:serviceId:DoorLock1&action=SetTarget&newTargetValue=" + binaryState, resolveWithFullResponse: true}).then(function (res)
                {
                    if (res.statusCode === 200)
                    {
                        status = (this.locked)?'Locked':'Unlocked';
                        debug("The %s has been %s",device.name, status);
                    }
                    else
                    {
                        debug("Error while turning the %s lock/locked:  %s", device.name);
                    }
                }).catch(function (err) {
                    HAPnode.debug("Request error:"+err);
                });
            },
            getLockstatus: function()
            {
                debug("Making request on device %s",device.name);
                return HAPnode.request({method:'GET',uri:'http://'+config.veraIP+':3480/data_request?id=variableget&DeviceNum='+device.id+'&serviceId=urn:micasaverde-com:serviceId:DoorLock1&Variable=Status', resolveWithFullResponse: true}).then(function (res)
                {
                    if (res.statusCode === 200)
                    {
                        data = parseInt(res.body.toString('utf8'));
                        this.locked = (data == 1)?true:false;
                        status = (this.locked)?'Locked':'Unlocked';
                        debug("Status for the lock %s is %s", device.name, status);
                        return this.locked;
                    }
                    else
                    {
                        debug("Error while getting the status for %s", device.name);
                        return this.locked;
                    }
                }).catch(function (err) {
                    HAPnode.debug("Request error:"+err);
                });
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

                if (value === Characteristic.LockTargetState.UNSECURED) {
                    Lock.lockchange(value);
                    callback();

                    lock
                        .getService(Service.LockMechanism)
                        .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
                }
                else if (value === Characteristic.LockTargetState.SECURED)
                {
                    Lock.lockchange(value);
                    callback();

                    lock
                        .getService(Service.LockMechanism)
                        .setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
                }
            });

        lock
            .getService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockCurrentState)
            .on('get', function(callback) {
                var err = null;
                Lock.getLockstatus().then(function(val){
                    if(val)
                    {
                        callback(err, Characteristic.LockCurrentState.SECURED);
                    }
                    else
                    {
                        callback(err, Characteristic.LockCurrentState.UNSECURED);
                    }
                });
            });
            
        lock
            .getService(Service.LockMechanism)
            .getCharacteristic(Characteristic.LockTargetState)
            .on('get', function(callback) {
                var err = null;
                Lock.getLockstatus().then(function(val){
                    if(val)
                    {
                        callback(err, Characteristic.LockCurrentState.SECURED);
                    }
                    else
                    {
                        callback(err, Characteristic.LockCurrentState.UNSECURED);
                    }
                });
            });
        
        
        setInterval(function() {

            Lock.getLockstatus().then(function(val){
                if(val)
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
                }
            });

        }, 3000);
          
        return lock;
    };
    
    return module;
};