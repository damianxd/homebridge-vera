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
                //value = value ? 1:0;
                
                //Revert value because garage door in Vera has is on when open and off when closed
                value = value ? 0:1;
                console.log('Sending value:', value);
                debug("Sending %s to garage door %s", value, device.name);
                
                //Garage door is BinaryLight in Vera
                return HAPnode.request({method:'GET',uri:"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue=" + value, resolveWithFullResponse: true}).then(function (res)
                    {
                        if (res.statusCode === 200) {
                            var checkState = value?'opened':'closed';
                            console.log('The %s is being %s', device.name, checkState);
                            debug("The %s has been turned %s", device.name, checkState);
                        } else {
                            debug("Error while turning the %s on/off %s", device.name);
                        }
                        return value;
                    }).catch(function (err) {
                        HAPnode.debug("Request error:"+err);
                    });
            },
            getLockStatus: function()
            {
                // debug("Making request on device %s",device.name);
                status = parseInt(functions.getVariable(device.id, 'status'));
                // debug("Status for ", device.name, " is ", status?"locked":"unlocked");
                
                //Revert value because garage door in Vera has is on when open and off when closed
                status = status ? 0:1;
                return status;
            },
            identify: function()
            {
                debug("Identify the accessory!");
            }
        };

        debug("LOCK INDEX:", config.garageLocks.indexOf(device.id));
        var hapuuid = uuid.generate('device:garage:'+config.cardinality+':'+device.id);
        var service = Service.GarageDoorOpener;
        var targetState = Characteristic.TargetDoorState;
        var currentState = Characteristic.CurrentDoorState;
        var currentStateSecured = currentState.CLOSED;
        var currentStateUnsecured = currentState.OPEN;
        var accessory = new Accessory(device.name, hapuuid);

        accessory.username   = functions.genMac('device:'+config.cardinality+':'+device.id);
        accessory.pincode    = config.pincode;
        accessory.deviceid   = device.id;

        accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.Model, device.model)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        accessory.on('identify', function(paired, callback) {
            Lock.identify();
            callback(); // success
        });

        accessory
            .addService(service, device.name)
            .getCharacteristic(targetState)
            .on('set', function(value, callback) {

                debug('Start set process for %s with the setting %s', device.name, value);
                Lock.lockchange(value).then(function(locked){
                  console.log('complete:', locked);
                  var state = locked?currentStateSecured:currentStateUnsecured;
                  callback();
                  accessory
                    .getService(service)
                    .setCharacteristic(currentState, state);

                })
            });

        accessory
            .getService(service)
            .getCharacteristic(currentState)
            .on('get', function(callback) {
                var err = null;
                var locked = Lock.getLockStatus();
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
                if(locked)
                {
                    callback(err, currentStateSecured);
                }
                else
                {
                    callback(err, currentStateUnsecured);
                };
            });


        setInterval(function() {
            var locked = Lock.getLockStatus();
            if(locked)
            {
                accessory
                .getService(service)
                .setCharacteristic(currentState, currentStateSecured);
            }
            else
            {
                accessory
                .getService(service)
                  .setCharacteristic(currentState, currentStateUnsecured);
            };

        }, 3000);

        return accessory;
    };

    return module;
};
