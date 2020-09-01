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
        const VERA_ACTION =
        {
            DOWN : { ref: "Down", state : 0},
            UP : { ref: "Up", state : 1},
            STOP : { ref: "Stop", state : 2},
        };

        //// Initializing accessory
        self.component = new Accessory(device.name, uuid.generate(`device:windowcovering:${config.cardinality}:${device.id}`));
        self.component.username  = functions.genMac(`device:${config.cardinality}:${device.id}`);
        self.component.pincode   = config.pincode;
        self.component.deviceid  = device.id;

        //// Runtime states
        self.lastPosition = 0; //// Closed by default
        self.currentTargetPosition = undefined;
        self.currentPositionState = VERA_ACTION.STOP.state; //// STOP by default

        self.formatUrl = (targetPosition, action) =>  {
            const base = `http://${config.veraIP}:3480/data_request?id=lu_action&output_format=xml&DeviceNum=${device.id}`;
            // If an absolute position is provided, always send that to vera and let it decide what to do.
            if (typeof targetPosition === 'number' && targetPosition >= 0) {
                return `${base}&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget=${targetPosition}`;
            } else if (action === VERA_ACTION.STOP) {
                return `${base}&serviceId=urn:upnp-org:serviceId:WindowCovering1&action=${action.ref}`;
            } else {
                throw new Error(`Invalid input targetPosition=${targetPosition}, action=${action}`);
            }
        };

        self.getLastPosition = () => {
            // Prefer the latest cached value (we poll Vera every ~1s). Fall back to our last-set value.
            const level = functions.getVariable(device.id, 'level', 'number');
            if (typeof level === 'number') {
                return level;
            } else {
                return self.lastPosition;
            }
        };

        self.getTargetPosition = () => {
            if (typeof self.currentTargetPosition === 'number') {
                return self.currentTargetPosition;
            } else {
                return self.getLastPosition();
            }
        };

        self.setAction = (pos, callback) =>
        {
            const lastPosition = self.getLastPosition();
            self.currentTargetPosition = pos;
            let action;
            if (pos === -1 || pos === lastPosition) {
                action = VERA_ACTION.STOP;
            } else if (pos < lastPosition) {
                action = VERA_ACTION.DOWN;
            } else if (pos > lastPosition) {
                action = VERA_ACTION.UP;
            } else {
                throw new Error(`Comparison logic error.`);
            }

            self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, action.state);
            debug("Setting position for %s: %s (%s)", device.name, pos, action);

            return HAPnode.request(
                {
                    method:'GET',
                    uri : self.formatUrl(pos, action),
                    resolveWithFullResponse: true}
                )
                .then(function (res)
                {
                    self.currentPositionState = VERA_ACTION.STOP.state
                    self.currentTargetPosition = undefined;
                    self.lastPosition = pos;
                    self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.CurrentPosition, pos);
                    self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, self.currentPositionState);
                    callback(false);
                }).catch(function (err) {
                    self.currentPositionState = VERA_ACTION.STOP.state
                    self.currentTargetPosition = undefined;
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
            status = functions.getVariable(device.id, 'status','number');
            debug("Status for ", device.name, " is ", status);
            return status;
        };

        self.identify = () =>
        {
            debug("I'm the fucking window covering.");
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
            .on('get', (callback) => { debug(`${device.name} Position ${self.getLastPosition()}`); callback(null, self.getLastPosition()); });

        // the position state
        // 0 = DECREASING; 1 = INCREASING; 2 = STOPPED;
        // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1138
        self.component
            .getService(Service.WindowCovering)
            .getCharacteristic(Characteristic.PositionState)
            .on('get', (callback) => { debug(`${device.name} Position State ${self.currentPositionState}`); callback(null, self.currentPositionState); });

        // the target position (0-100%)
        // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1564
        self.component
            .getService(Service.WindowCovering)
            .getCharacteristic(Characteristic.TargetPosition)
            .on('get', (callback) => { debug(`${device.name} Target Position ${self.getTargetPosition()}`);callback(null, self.getTargetPosition()); })
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
