var inherits = require('util').inherits;
var Armed;

module.exports = function (HAPnode, config, functions) {
    var Accessory = HAPnode.Accessory;
    var Service = HAPnode.Service;
    var Characteristic = HAPnode.Characteristic;
    var uuid = HAPnode.uuid;
    var debug = HAPnode.debug;

    Armed = function () {
        Characteristic.call(this, 'Armed', '00000067-0000-1000-8000-0026BB816241');
        this.setProps({
            format: Characteristic.Formats.BOOL,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(Armed, Characteristic);

    var module = {};

    module.newDevice = function (device) {
        var SecuritySensor = {
            states: {},
            getIsTripped: function (callback) {
                var that = this;
                var url = "http://" + config.veraIP + ":3480/data_request?id=status&output_format=json&DeviceNum=" + device.id;
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200) {
                        var data = JSON.parse(res.body.toString())["Device_Num_" + device.id].states;
                        var newstates = {};
                        for (var i = 0; i < data.length; i++) {
                            newstates[data[i].variable] = data[i].value;
                        }
                        that.states = newstates;
                        if (that.states && that.states['Tripped']) {
                            if (parseInt(that.states['Tripped']) === 1) {
                                callback(null, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
                                return;
                            }
                        }
                    } else {
                        debug("Error while getting the status for %s", device.name);
                    }
                    callback(null, Characteristic.ContactSensorState.CONTACT_DETECTED);
                });

            },
            getIsArmed: function (callback) {
                if (this.states && this.states['Armed']) {
                    callback(null, !(parseInt(this.states['Armed']) === 0))
                } else {
                    callback(null, false)
                }
            },
            setIsArmed: function (state, callback) {
                var url = 'http://' + config.veraIP + ':3480/data_request?id=variableset&DeviceNum=' + device.id + '&serviceId=urn:micasaverde-com:serviceId:SecuritySensor1&Variable=Tripped&value=';
                url += state ? '1' : '0';
                HAPnode.request('GET', url).done(function(res) {
                    if (res.statusCode === 200) {
                        debug("Value for armed set successfully to " + state);
                        callback(null, state);
                    } else {
                        var message = "Error while setting armed to " + state + " for " + device.name;
                        debug(message);
                        callback(message, state);
                    }
                });
            },
            getBatteryLevel: function (callback) {
                if (this.states && this.states['BatteryLevel']) {
                    callback(null, parseInt(this.states['BatteryLevel']));
                } else {
                    callback(null, null);
                }
            },
            getIsLowBattery: function (callback) {
                this.getBatteryLevel(function(level) {
                    if (level && level < 20) {
                        callback(Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
                    } else {
                        callback(Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
                    }
                });
            },
            identify: function () {
                debug("Identity of the security sensor is %s", device.name);
                callback();
            }
        };

        var sensorUUID = uuid.generate('device:switch:' + config.cardinality + ':' + device.id);
        var sensor = new Accessory(device.name, sensorUUID);
        sensor.username = functions.genMac('device:' + config.cardinality + ':' + device.id);
        sensor.deviceid = device.id;

        sensor.on('identify', SecuritySensor.identify.bind(SecuritySensor));

        var service = new Service.ContactSensor(device.name);
        service.getCharacteristic(Characteristic.ContactSensorState)
            .on('get', SecuritySensor.getIsTripped.bind(SecuritySensor));
        service.addCharacteristic(Armed)
            .on('get', SecuritySensor.getIsArmed.bind(SecuritySensor))
            .on('set', SecuritySensor.setIsArmed.bind(SecuritySensor));
        sensor.addService(service);

        var batteryService = new Service.BatteryService(device.name);
        batteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on('get', SecuritySensor.getBatteryLevel.bind(SecuritySensor));
        batteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', SecuritySensor.getIsLowBattery.bind(SecuritySensor));
        sensor.addService(batteryService);

        setInterval(function() {
            SecuritySensor.getIsTripped(function(istripped) {
                var sensorstate = istripped == 0 ?
                    Characteristic.ContactSensorState.CONTACT_DETECTED :
                    Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;
                service.getCharacteristic(Characteristic.ContactSensorState).setValue(sensorstate)
            })
        }, config.securitypoll);

        return sensor;
    };

    return module;
};
