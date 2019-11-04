var inherits = require('util').inherits;
var fahrenheitToCelsius = function(temperature) { return (temperature - 32) / 1.8; };
var celsiusToFahrenheit = function(temperature) { return (temperature * 1.8) + 32; };

module.exports = function (HAPnode, config, functions) {
    var Accessory = HAPnode.Accessory;
    var Service = HAPnode.Service;
    var Characteristic = HAPnode.Characteristic;
    var uuid = HAPnode.uuid;
    var debug = HAPnode.debug;

    var module = {};

    module.newDevice = function (device, tempDisplayUnit) {
        var temperatureDisplayUnit = tempDisplayUnit;
        var Thermostat = {

            veraIsUsingFahrenheit: function(){
                return this.getTemperatureDisplayUnits() == Characteristic.TemperatureDisplayUnits.FAHRENHEIT
            },

            getHVACState: function(){
                var hvacstate, temperature, heat, cool;
                debug("Making hvacstate request for device %s", device.name);
                hvacstate = functions.getVariable(device.id, 'hvacstate', 'string');
                temperature = functions.getVariable(device.id, 'temperature', 'number');
                heat = functions.getVariable(device.id, 'heat', 'number', 'number');
                cool = functions.getVariable(device.id, 'cool', 'number');
                debug("HVAC State returned as: ", hvacstate);
                if (hvacstate){
                  switch(hvacstate){
                      case "Idle":
                      case "PendingHeat":
                      case "PendingCool":
                      case "FanOnly":
                      case "Vent":
                          return Characteristic.CurrentHeatingCoolingState.OFF;
                          break;
                      case "Heating":
                          return Characteristic.CurrentHeatingCoolingState.HEAT;
                          break;
                      case "Cooling":
                          return Characteristic.CurrentHeatingCoolingState.COOL;
                          break;
                      default:
                          null;
                  }
                }else{
                    debug("WARNING: NEST ")
                    mode = functions.getVariable(device.id, 'mode', 'string');
                    switch(mode){
                        case "Off":
                        case "InDeadBand":
                        case "Idle":
                        case "eco": // Nest Plugin
                          return Characteristic.CurrentHeatingCoolingState.OFF;
                          break;
                        case "HeatOn":
                        case "AuxHeatOn":
                        case "EconomyHeatOn":
                        case "EmergencyHeatOn":
                        case "EnergySavingsHeating":
                        case "BuildingProtection":
                            if (heat<temperature){
                              return Characteristic.CurrentHeatingCoolingState.OFF;
                            }else{
                              return Characteristic.CurrentHeatingCoolingState.HEAT;
                            }
                            break;
                        case "CoolOn":
                        case "AuxCoolOn":
                        case "EconomyCoolOn":
                            if (cool>temperature){
                              return Characteristic.CurrentHeatingCoolingState.OFF;
                            }else{
                              return Characteristic.CurrentHeatingCoolingState.COOL;
                            }
                            break;
                        default:
                            null;
                  }
                }
            },

            getMode: function(){
                return functions.getVariable(device.id, 'mode', 'string');
                // switch(mode){
                //     case "Off":
                //     case "eco": // Nest Plugin
                //         return Characteristic.TargetHeatingCoolingState.OFF;
                //         break;
                //     case "HeatOn":
                //     case "AuxHeatOn":
                //     case "EconomyHeatOn":
                //     case "EmergencyHeatOn":
                //     case "BuildingProtection":
                //         return Characteristic.TargetHeatingCoolingState.HEAT;
                //         break;
                //     case "CoolOn":
                //     case "AuxCoolOn":
                //     case "EconomyCoolOn":
                //         return Characteristic.TargetHeatingCoolingState.COOL;
                //         break;
                //     case "AutoChangeOver":
                //     case "EnergySavingsMode":
                //         return Characteristic.TargetHeatingCoolingState.AUTO;
                //         break;
                //     default:
                //         null;
              // }
            },

            setMode: function(value){
                var serviceId = 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1';
                var action_name = 'SetModeTarget';
                var action_param = 'NewModeTarget';
                var params = {
                  action: action_name,
                  serviceId: serviceId,
                  DeviceNum: device.id
                }
                var vera_value;

                switch(value){
                    case Characteristic.TargetHeatingCoolingState.OFF:
                        vera_value = "Off";
                        break;
                    case Characteristic.TargetHeatingCoolingState.HEAT:
                        vera_value = "HeatOn";
                        break;
                    case Characteristic.TargetHeatingCoolingState.COOL:
                        vera_value = "CoolOn";
                        break;
                    case Characteristic.TargetHeatingCoolingState.AUTO:
                        vera_value = "AutoChangeOver";
                        break;
                }
                params[action_param] = vera_value
                return functions.executeAction(params);
            },

            getCurrentTemperature: function(){
                debug("Making temperature request for device %s", device.name);
                temperature = functions.getVariable(device.id, 'temperature', 'number');
                debug("[Before Conversion] Current Temperature for Thermostat #%s is %s", device.name, temperature);
                if (this.veraIsUsingFahrenheit()){
                    temperature = fahrenheitToCelsius(temperature);
                }
                temperature = Math.round( temperature * 1e1 ) / 1e1;
                debug("Current Temperature for Thermostat #%s is %s", device.name, temperature);
                return temperature;
            },

            getTargetTemperature: function(){
                debug("Making setpoint request for device %s", device.name);
                setpoint = functions.getVariable(device.id, 'setpoint', 'number');
                debug("[Before Conversion] Current Temperature for Thermostat #%s is %s", device.name, setpoint);
                if (this.veraIsUsingFahrenheit()){
                    setpoint = fahrenheitToCelsius(setpoint);
                }
                //setpoint = parseInt(setpoint);
                debug("Current Temperature for Thermostat #%s is %s", device.name, setpoint);
                return setpoint;
            },

            setTargetTemperature: function(value){
                var services, action_name, action_param, mode;
                mode = Thermostat.getMode();
                switch(mode){
                  case 1:
                    services = ['urn:upnp-org:serviceId:TemperatureSetpoint1_Heat'];
                    break;
                  case 2:
                    services = ['urn:upnp-org:serviceId:TemperatureSetpoint1_Cool'];
                    break;
                  default:
                    services = ['urn:upnp-org:serviceId:TemperatureSetpoint1_Heat','urn:upnp-org:serviceId:TemperatureSetpoint1_Cool'];
                    break;
                }
                if (this.veraIsUsingFahrenheit()){
                    value = Math.round(celsiusToFahrenheit(value));
                };

                action_name = 'SetCurrentSetpoint';
                requests = services.map(function(service){
                  functions.executeAction({
                    action: 'SetCurrentSetpoint',
                    serviceId: service,
                    DeviceNum: device.id,
                    NewCurrentSetpoint: value
                  }).then(function(response){

                  }).catch(function(response){
                    console.log("response was:", typeof(response));
                    // Dirty Hack For WWN Plugin. Uses wrong serviceId
                    if(typeof(response) === 'string' && response.match(/ERROR/)){
                      functions.executeAction({
                        action: 'SetCurrentSetpoint',
                        serviceId: service.match(/(^.+)_/)[1],
                        DeviceNum: device.id,
                        NewCurrentSetpoint: value
                      });
                    }
                  })
                });
                debug("[After Conversion] Set Target Temperature for Thermostat #%s is %s", device.name, value);
                //
                return Promise.all(requests);
            },

            getTemperatureDisplayUnits: function(){
                if (temperatureDisplayUnit == "C"){
                    return Characteristic.TemperatureDisplayUnits.CELSIUS
                }else{
                    return Characteristic.TemperatureDisplayUnits.FAHRENHEIT
                }
            },

            getBatteryLevel: function () {
                var level = functions.getVariable(device.id, 'batterylevel', 'number');
                debug("current battery level: %s", level);
                return level;
            },

            getIsLowBattery: function () {
                var level = this.getBatteryLevel();
                debug("Checking low battery for level %s: ", level);
                if (level && level < 20) {
                    return Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW;
                }
                return Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
            },

            identify: function () {
                debug("Identity of the thermostat is %s", device.name);
            }
        };

        var thermostatUUID = uuid.generate('device:thermostat:' + config.cardinality + ':' + device.id);
        var thermostat = new Accessory(device.name, thermostatUUID);
        thermostat.username = functions.genMac('device:' + config.cardinality + ':' + device.id);
        thermostat.pincode = config.pincode;
        thermostat.deviceid = device.id;
        
        thermostat
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.Model, device.model)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        thermostat.on('identify', function (paired, callback) {
            Thermostat.identify();
            callback(); // success
        });

        var service = new Service.Thermostat(device.name);

        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', function (callback) {
                debug('Getting current heating/cooling state for %s', device.name);
                callback(null, Thermostat.getHVACState());
            });

        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('get', function (callback) {
                debug('Getting target heating/cooling value for %s', device.name);
                callback(null, Thermostat.getMode());
            });

        service
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('set', function (value, callback) {
                if(device.preventRequest){
                  device.preventRequest = false;
                  return callback(null, value);
                }
                debug('Setting target heating/cooling value for %s', device.name);
                Thermostat.setMode(value).then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service
          .getCharacteristic(Characteristic.CurrentTemperature)
          .setProps({
              minValue: fahrenheitToCelsius(-100),
              maxValue: fahrenheitToCelsius(100)
          })
          .on('get', function (callback) {
              debug('Getting current temp. value for %s', device.name);
              callback(null, Thermostat.getCurrentTemperature());
          });

        service
          .getCharacteristic(Characteristic.TargetTemperature)
          .setProps({
              minValue: fahrenheitToCelsius(60),
              maxValue: fahrenheitToCelsius(80)
          })
          .on('get', function (callback) {
              debug('Getting target temp value for %s', device.name);
              callback(null, Thermostat.getTargetTemperature());
          });

        service
            .getCharacteristic(Characteristic.TargetTemperature)
            .on('set', function (value, callback) {
                if(device.preventRequest){
                  device.preventRequest = false;
                  return callback(null, value);
                }
                debug('Setting target temp value for %s to %s', device.name, value);
                Thermostat.setTargetTemperature(value).then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', function (callback) {
                unit = Thermostat.getTemperatureDisplayUnits();
                debug('Temperature display unit for %s is %s', device.name, unit);
                callback(null, unit);
            });

        service
            .getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('set', function (value, callback) {
                if(device.preventRequest){
                  device.preventRequest = false;
                  return callback(null, value);
                }
                debug('Setting temp display units value for %s', device.name);
                    // return our current value
                    callback(null, value);
            });

        thermostat.addService(service);

        var batteryService = new Service.BatteryService(device.name);
        batteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on('get', function (callback) {
          		callback(null, Thermostat.getBatteryLevel());
            });

        batteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', function (callback) {
		callback(null, Thermostat.getIsLowBattery());
            });

        thermostat.addService(batteryService);

        // Update Loop, regular polling for updates.
        functions.checkCharacteristics(device, [{
          vera: 'setpoint',
          ios: Characteristic.TargetTemperature,
          type: 'number',
          service: thermostat.getService(Service.Thermostat)
        },{
          vera: 'temperature',
          ios: Characteristic.CurrentTemperature,
          type: 'number',
          service: thermostat.getService(Service.Thermostat)
        },{
          vera: 'hvacstate',
          ios: Characteristic.CurrentHeatingCoolingState,
          type: 'string',
          service: thermostat.getService(Service.Thermostat)
        },{
          vera: 'mode',
          ios: Characteristic.TargetHeatingCoolingState,
          type: 'string',
          service: thermostat.getService(Service.Thermostat)
        }
        ]);

        return thermostat;
    };

    return module;
};
