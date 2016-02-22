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
            getIsTripped: function () {
                var url = "http://" + config.veraIP + ":3480/data_request?id=status&output_format=json&DeviceNum=" + device.id;
                var res = HAPnode.request('GET', url);

                if (res.statusCode === 200) {
                    var data = JSON.parse(res.body.toString())["Device_Num_" + device.id].states;
                    this.states = {};
                    for (var i = 0; i < data.length; i++) {
                        this.states[data[i].variable] = data[i].value;
                    }
                    if (this.states && this.states['Tripped']) {
                        if (parseInt(this.states['Tripped']) === 1) {
                            return Characteristic.ContactSensorState.CONTACT_NOT_DETECTED
                        }
                    }
                } else {
                    debug("Error while getting the status for %s", device.name);
                }
                return Characteristic.ContactSensorState.CONTACT_DETECTED;
            },
            getIsArmed: function () {
                if (this.states && this.states['Armed']) {
                    if (parseInt(this.states['Armed']) === 0) {
                        return false;
                    } else {
                        return true;
                    }
                }
                return false;
            },
            setIsArmed: function (state, callback) {
                var url = 'http://' + config.veraIP + ':3480/data_request?id=variableset&DeviceNum=' + device.id + '&serviceId=urn:micasaverde-com:serviceId:SecuritySensor1&Variable=Tripped&value=';
                url += state ? '1' : '0';
                var res = HAPnode.request('GET', url);

                if (res.statusCode === 200) {
                    debug("Value for armed set successfully to " + state);
                    callback(null, state);
                } else {
                    var message = "Error while setting armed to " + state + " for " + device.name;
                    debug(message);
                    callback(message, state);
                }
            },
            getBatteryLevel: function () {
                if (this.states && this.states['BatteryLevel']) {
                    return parseInt(this.states['BatteryLevel']);
                }
                return null;
            },
            getIsLowBattery: function () {
                var level = this.getBatteryLevel();
                if (level && level < 20) {
                    return Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
                }
                return Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
            },
            identify: function () {
                debug("Identity of the security sensor is %s", device.name);
            }
        };

        var sensorUUID = uuid.generate('device:switch:' + config.cardinality + ':' + device.id);
        var sensor = new Accessory(device.name, sensorUUID);
        sensor.username = functions.genMac('device:' + config.cardinality + ':' + device.id);
        sensor.deviceid = device.id;

        sensor.on('identify', function (paired, callback) {
            SecuritySensor.identify();
            callback(); // success
        });
        var service = new Service.ContactSensor(device.name);
        service.getCharacteristic(Characteristic.ContactSensorState)
            .on('get', function (callback) {
                var err = null;
                callback(err, SecuritySensor.getIsTripped());
            });
        service.addCharacteristic(Armed)
            .on('get', function (callback) {
                var err = null;
                callback(err, SecuritySensor.getIsArmed());
            })
            .on('set', SecuritySensor.setIsArmed.bind(this));
        sensor.addService(service);

        var batteryService = new Service.BatteryService(device.name);
        batteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on('get', function (callback) {
                var err = null;
                callback(err, SecuritySensor.getBatteryLevel());
            });
        batteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', function (callback) {
                var err = null;
                callback(err, SecuritySensor.getIsLowBattery());
            });
        sensor.addService(batteryService);

        setInterval(function() {
             var sensorstate = SecuritySensor.getIsTripped() == 0 ? 
                Characteristic.ContactSensorState.CONTACT_DETECTED :
                Characteristic.ContactSensorState.CONTACT_NOT_DETECTED;

             service.getCharacteristic(Characteristic.ContactSensorState).setValue(sensorstate)
        }, config.securitypoll);

        return sensor;
    };

    return module;
};