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
        var self = this;
        
        // The former version of this acted like a toggle and "blindly" sent WindowCovering1 commands to raise or lower,
        // but Vera will present a dimmer in addition to the WindowCovering1 that can read position and move blinds more closely
        // to what HomeKit expects.  

        // const VERA_REF = "urn:upnp-org:serviceId:WindowCovering1";
        // const VERA_ACTION =
        // {
        //    DOWN : { ref: "Down", state : Characteristic.PositionState.DECREASING},
        //    UP : { ref: "Up", state : Characteristic.PositionState.INCREASING},
        //    STOP : { ref: "Stop", state : Characteristic.PositionState.STOPPED},
        //};

        //// Initializing accessory
        self.component = new Accessory(device.name, uuid.generate(`device:windowcovering:${config.cardinality}:${device.id}`));
        self.component.username  = functions.genMac(`device:${config.cardinality}:${device.id}`);
        self.component.pincode   = config.pincode;
        self.component.deviceid  = device.id;

        //// Runtime states
        self.currentPositionState = Characteristic.PositionState.STOPPED;
        self.currentTargetPosition = 100;

        self.setAction = (pos, callback) =>
        {
            debug(`Set window covering ${device.id} Current Position is ${pos}`);
            self.currentPositionState = (pos > parseInt(functions.getVariable(device.id, 'level')) ? Characteristic.PositionState.INCREASING : Characteristic.PositionState.DECREASING);
            self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, self.currentPositionState);

            return functions.executeAction({
                action: 'SetLoadLevelTarget',
                serviceId: 'urn:upnp-org:serviceId:Dimming1',
                newLoadlevelTarget: pos,
                DeviceNum: device.id
            }).then(function (res)
                {
                    // In my testing homekit needs a delay otherwise it will show "opening..." or "closing..." indefinitely
                    // TODO: Might be possible to ask Vera for the actual motor status as it is shown in UI?
                    // but this seems good enough for now.
                    setTimeout(function(){
                        debug("Setting stop state")
                        self.currentPositionState =  Characteristic.PositionState.STOPPED;
                        self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, self.currentPositionState);
                        self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.CurrentPosition, pos);                
                      }, 5000);
                    callback(false);
                }).catch(function (err) {
                    HAPnode.debug("Request error:"+err);
                    callback(false);
                });
        };

        self.holdAction = (level, callback) => {
            return self.setAction(-1, callback);
        };

        self.getStatus = () =>
        {
            debug("Making request for device %s", device.name);
            status = parseInt(functions.getVariable(device.id, 'status'));
            debug("Status for ", device.name, " is ", status);
            return status;
        };

        self.identify = () =>
        {
            debug("Window covering.");
        };

        //// Starting initilization
        self.component
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.Model, device.model)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        //// Runtime Events
        self.component.on('identify', function(paired, callback) {
            self.identify();
            callback(); // success
        });

        // the current position (0-100%)
        // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L493
        self.component
            .addService(Service.WindowCovering, device.name)
            .getCharacteristic(Characteristic.CurrentPosition)
            .on('get', (callback) => { 
                var pos = parseInt(functions.getVariable(device.id, 'level'));
                debug(`Window covering ${device.id} Current Position is ${pos}`);
                callback(null, pos);
             });

        // the position state
        // 0 = DECREASING; 1 = INCREASING; 2 = STOPPED;
        // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1138
        self.component
            .getService(Service.WindowCovering)
            .getCharacteristic(Characteristic.PositionState)
            .on('get', (callback) => { 
                debug(`Window Covering ${device.id} Position State`); 
                callback(null, self.currentPositionState); 
            });

        // the target position (0-100%)
        // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1564
        self.component
            .getService(Service.WindowCovering)
            .getCharacteristic(Characteristic.TargetPosition)
            .on('get', (callback) => { callback(null,  parseInt(functions.getVariable(device.id, 'level'))); })
            .on('set', self.setAction.bind(this));

        self.component
            .getService(Service.WindowCovering)
            .getCharacteristic(Characteristic.HoldPosition)
            .on('get', (callback) => { callback(false, null); })
            .on('set', self.holdAction.bind(this));

        return self.component;
    };

    return module;
};
