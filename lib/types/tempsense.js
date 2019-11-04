module.exports = function(HAPnode, config, functions)
{
    var Accessory       = HAPnode.Accessory;
    var Service         = HAPnode.Service;
    var Characteristic  = HAPnode.Characteristic;
    var uuid            = HAPnode.uuid;
    var debug           = HAPnode.debug;

    var module  = {};

    module.newDevice = function(device, tempDisplayUnit)
    {
        var temperatureDisplayUnit = tempDisplayUnit;
        var Sensor = {
            getTemperature: function() {
                temperature = functions.getVariable(device.id, 'temperature','number');
                if (this.veraIsUsingFahrenheit()){
                    temperature = this.fahrenheitToCelsius(temperature);
                }
                return temperature;
            },
            veraIsUsingFahrenheit: function(){
                return this.getTemperatureDisplayUnits() == Characteristic.TemperatureDisplayUnits.FAHRENHEIT
            },

            fahrenheitToCelsius: function(temperature) {
                return (temperature - 32) / 1.8;
            },

            celsiusToFahrenheit: function(temperature) {
                return (temperature * 1.8) + 32;
            },
            getTemperatureDisplayUnits: function(){
                if (temperatureDisplayUnit == "C"){
                    return Characteristic.TemperatureDisplayUnits.CELSIUS
                }else{
                    return Characteristic.TemperatureDisplayUnits.FAHRENHEIT
                }
            }
        };

        var sensorUUID = uuid.generate('device:tempsense:'+config.cardinality+':'+device.id);

        var sensor = new Accessory(device.name, sensorUUID);

        sensor.username   = functions.genMac('device:'+config.cardinality+':'+device.id);
        sensor.pincode    = config.pincode;
        sensor.deviceid   = device.id;

        sensor
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.Model, device.model)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        sensor
            .addService(Service.TemperatureSensor)
            .getCharacteristic(Characteristic.CurrentTemperature)
            .setProps({
                minValue: -100,
                maxValue: 100
            })
            .on('get', function(callback)
            {
                debug('Getting latest value for %s', device.name);
                callback(null, Sensor.getTemperature());
            });

        return sensor;
    };
    return module;
};
