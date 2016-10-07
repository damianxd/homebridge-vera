var inherits = require('util').inherits;

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
            device_url: function(request_type){
                host = 'http://'+config.veraIP+':3480/data_request'
                return host+'?id='+request_type+'&DeviceNum='+device.id
            },

            remoteRequest: function(url, params, callback){
                debug("Requesting: %s", url);
                //HAPnode.request.debug = true
                return HAPnode.request({
                    method:'GET',
                    uri: url,
                    qs: params,
                    resolveWithFullResponse: true
                }).then(callback.bind(this)).catch(function(e){
                    debug(e.error);
                    debug(e.options);
                    debug(e.response);
                });
            },

            getVeraVariable: function(serviceId, variable, callback){
                var url = this.device_url('variableget');
                var params = {serviceId: serviceId, Variable: variable}
                return this.remoteRequest(url, params, callback);
            },

            executeVeraAction: function(params){
                var url = this.device_url('action');
                var callback = function(){};
                return this.remoteRequest(url, params, callback);
            },

            getCurrentHeatingCoolingState: function(){
                var serviceId = 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1';
                var variable = 'ModeStatus';
                var callback = function (response){
                    if (response.statusCode === 200){
                        var vera_state = response.body;
                        var state;
                        switch(vera_state){
                            case "Off":
                            case "InDeadBand":
                                state = Characteristic.CurrentHeatingCoolingState.OFF;
                                break;
                            case "HeatOn":
                            case "AuxHeatOn":
                            case "EconomyHeatOn":
                            case "EmergencyHeatOn":
                            case "EnergySavingsHeating":
                            case "BuildingProtection":
                                state = Characteristic.CurrentHeatingCoolingState.HEAT;
                                break;
                            case "CoolOn":
                            case "AuxCoolOn":
                            case "EconomyCoolOn":
                                state = Characteristic.CurrentHeatingCoolingState.COOL;
                                break;
                            default:
                                null;
                        }


                        debug("Current Heating cooling state for Thermostat #%s is %s", device.name, state);
                        return state;
                    }
                    else
                    {
                        debug("Error while getting the current heating cooling state for %s", device.name);
                        return null;
                    }
                }

                return this.getVeraVariable(serviceId, variable, callback);
            },

            getTargetHeatingCoolingState: function(){
                var serviceId = 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1';
                var variable = 'ModeTarget';
                var callback = function (response){
                    if (response.statusCode === 200){

                        var vera_state = response.body;
                        var state;
                        switch(vera_state){
                            case "Off":
                                state = Characteristic.TargetHeatingCoolingState.OFF;
                                break;
                            case "HeatOn":
                            case "AuxHeatOn":
                            case "EconomyHeatOn":
                            case "EmergencyHeatOn":
                            case "BuildingProtection":
                                state = Characteristic.TargetHeatingCoolingState.HEAT;
                                break;
                            case "CoolOn":
                            case "AuxCoolOn":
                            case "EconomyCoolOn":
                                state = Characteristic.TargetHeatingCoolingState.COOL;
                                break;
                            case "AutoChangeOver":
                            case "EnergySavingsMode":
                                state = Characteristic.TargetHeatingCoolingState.AUTO;
                                break;
                            default:
                                null;
                        }


                        debug("Target Heating cooling for Thermostat #%s is %s", device.name, "0");
                        return state;
                    }
                    else
                    {
                        debug("Error while getting the Target Heating cooling for %s", device.name);
                        return null;
                    }
                }

                return this.getVeraVariable(serviceId, variable, callback);
            },

            setTargetHeatingCoolingState: function(value){
                var serviceId = 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1';
                var action_name = 'SetModeTarget';
                var action_param = 'NewModeTarget';
                var params = { action: action_name, serviceId: serviceId }
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
                return this.executeVeraAction(params);
            },

            getCurrentTemperature: function(){
                var serviceId = 'urn:upnp-org:serviceId:TemperatureSensor1';
                var variable = 'CurrentTemperature';
                var callback = function (response){
                    if (response.statusCode === 200){
                        data = parseInt(response.body.toString('utf8'));

                        debug("Current Temperature for Thermostat #%s is %s", device.name, data);
                        return data;
                    }
                    else
                    {
                        debug("Error while getting the current temperature for %s", device.name);
                        return null;
                    }
                }

                return this.getVeraVariable(serviceId, variable, callback);
            },

            getTargetTemperature: function(){
                var serviceId = 'urn:upnp-org:serviceId:TemperatureSetpoint1_Heat';
                var variable = 'CurrentSetpoint';
                var callback = function (response){
                    if (response.statusCode === 200){

                        data = parseInt(response.body.toString('utf8'));

                        debug("Target Temperature for Thermostat #%s is %s", device.name, data);
                        return data;
                    }
                    else
                    {
                        debug("Error while getting the target temperature for %s", device.name);
                        return null;
                    }
                };

                return this.getVeraVariable(serviceId, variable, callback);
            },

            setTargetTemperature: function(value){
                var serviceIdHeat = 'urn:upnp-org:serviceId:TemperatureSetpoint1_Heat';
                var serviceIdCool = 'urn:upnp-org:serviceId:TemperatureSetpoint1_Cool';
                var action_name = 'SetCurrentSetpoint';
                var action_param = 'NewCurrentSetpoint';
                var params = { action: action_name, serviceId: serviceIdHeat }
                params[action_param] = value;
                this.executeVeraAction(params); //Set Heat setpoint
                params["serviceId"] = serviceIdCool;
                return this.executeVeraAction(params); //Set Cool setpoint
            },

            getTemperatureDisplayUnits: function(){
                return temperatureDisplayUnit;
            },

            getBatteryLevel: function () {
                if (this.states && this.states['BatteryLevel']) {
                    return parseInt(this.states['BatteryLevel']);
                }
                return 50;
            },

            getIsLowBattery: function () {
                var level = this.getBatteryLevel();
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
        thermostat.deviceid = device.id;

        thermostat.on('identify', function (paired, callback) {
            Thermostat.identify();
            callback(); // success
        });

        var service = new Service.Thermostat(device.name);

        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on('get', function (callback) {
                debug('Getting current heating/cooling state for %s', device.name);
                Thermostat.getCurrentHeatingCoolingState().then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('get', function (callback) {
                debug('Getting target heating/cooling value for %s', device.name);
                Thermostat.getTargetHeatingCoolingState().then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on('set', function (value, callback) {
                debug('Setting target heating/cooling value for %s', device.name);
                Thermostat.setTargetHeatingCoolingState(value).then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', function (callback) {
                debug('Getting current temp. value for %s', device.name);
                Thermostat.getCurrentTemperature().then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.TargetTemperature)
            .on('get', function (callback) {
                debug('Getting target temp value for %s', device.name);
                Thermostat.getTargetTemperature().then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.TargetTemperature)
            .on('set', function (value, callback) {
                debug('Getting target temp value for %s', device.name);
                Thermostat.setTargetTemperature(value).then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('get', function (callback) {
                debug('Temperature display unit for %s is %s', device.name, Thermostat.getTemperatureDisplayUnits());

                if (Thermostat.getTemperatureDisplayUnits() == "C"){
                    unit = Characteristic.TemperatureDisplayUnits.CELSIUS
                }else{
                    unit = Characteristic.TemperatureDisplayUnits.FAHRENHEIT
                }
                debug('Temperature display unit for %s is %s', device.name, unit);
                callback(null, unit);
            });

        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on('set', function (value, callback) {
                debug('Setting temp display units value for %s', device.name);
                    // return our current value
                    callback(null, value);
            });

        thermostat.addService(service);

        var batteryService = new Service.BatteryService(device.name);
        batteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on('get', function (callback) {
                var err = null;
                callback(err, 50);
            });

        batteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .on('get', function (callback) {
                var err = null;
                callback(err, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
            });

        thermostat.addService(batteryService);

        return thermostat;
    };

    return module;
};
