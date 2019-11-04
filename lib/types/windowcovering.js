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
        const VERA_REF = "urn:upnp-org:serviceId:WindowCovering1";
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
        self.currentPositionState = VERA_ACTION.STOP.state; //// STOP by default
        self.currentTargetPosition = VERA_ACTION.DOWN.state; //// DOWN by default

        self.formatUrl = (action) =>  { return `http://${config.veraIP}:3480/data_request?id=lu_action&output_format=xml&DeviceNum=${device.id}&serviceId=${VERA_REF}&action=${action}` };

        self.setAction = (pos, callback) =>
        {
            self.currentTargetPosition = pos;
            const action = (pos === -1 ? VERA_ACTION.STOP : (pos >= self.lastPosition ? VERA_ACTION.UP : VERA_ACTION.DOWN)).ref;
            self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, action.state);

            return HAPnode.request(
                {
                    method:'GET',
                    uri : self.formatUrl(action),
                    resolveWithFullResponse: true}
                )
                .then(function (res)
                {
                    self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.CurrentPosition, (action === VERA_ACTION.UP.ref ? 100 : 0));
                    self.component.getService(Service.WindowCovering).setCharacteristic(Characteristic.PositionState, 2); //// Stop state
                    self.lastPosition = (action == VERA_ACTION.UP.ref ? 100 : 0);
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
            .on('get', (callback) => { debug(`Position State ${self.lastPosition}`); callback(null, self.lastPosition); });

        // the position state
        // 0 = DECREASING; 1 = INCREASING; 2 = STOPPED;
        // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1138
        self.component
            .getService(Service.WindowCovering)
            .getCharacteristic(Characteristic.PositionState)
            .on('get', (callback) => { debug(`Position State ${self.currentPositionState}`); callback(null, self.currentPositionState); });

        // the target position (0-100%)
        // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1564
        self.component
            .getService(Service.WindowCovering)
            .getCharacteristic(Characteristic.TargetPosition)
            .on('get', (callback) => { callback(null, self.currentTargetPosition); })
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
