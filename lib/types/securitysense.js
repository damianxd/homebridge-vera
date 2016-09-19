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
                callback(err, null);
            });
            
        service.addCharacteristic(Armed)
            .on('get', function (callback) {
                var err = null;
                callback(err, null);
            })
            .on('set', SecuritySensor.setIsArmed.bind(this));
        sensor.addService(service);

        var batteryService = new Service.BatteryService(device.name);
        batteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on('get', function (callback) {
                var err = null;
                callback(err, null);
            });
            
        batteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', function (callback) {
                var err = null;
                callback(err, null);
            });
        sensor.addService(batteryService);


        return sensor;
    };

    return module;
};