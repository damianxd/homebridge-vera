'use strict';

const { bindIdentify } = require('./util');

const fahrenheitToCelsius = (temperature) => (temperature - 32) / 1.8;
const celsiusToFahrenheit = (temperature) => temperature * 1.8 + 32;

/**
 * Thermostat (Vera category 5). Heating/cooling state translation preserves the
 * original behaviour, including the Nest-plugin fallbacks.
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;
  const temperatureDisplayUnit = plan.temperatureUnit;

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `thermostat ${device.name}`);

  const getTemperatureDisplayUnits = () =>
    temperatureDisplayUnit === 'C'
      ? Characteristic.TemperatureDisplayUnits.CELSIUS
      : Characteristic.TemperatureDisplayUnits.FAHRENHEIT;

  const veraIsUsingFahrenheit = () =>
    getTemperatureDisplayUnits() === Characteristic.TemperatureDisplayUnits.FAHRENHEIT;

  const getHVACState = () => {
    const hvacstate = client.getVariable(device.id, 'hvacstate', 'string');
    if (Number.isFinite(hvacstate)) {
      return hvacstate;
    }
    const temperature = client.getVariable(device.id, 'temperature', 'number');
    const heat = client.getVariable(device.id, 'heat', 'number');
    const cool = client.getVariable(device.id, 'cool', 'number');
    if (hvacstate) {
      switch (hvacstate) {
        case 'Idle':
        case 'PendingHeat':
        case 'PendingCool':
        case 'FanOnly':
        case 'Vent':
          return Characteristic.CurrentHeatingCoolingState.OFF;
        case 'Heating':
          return Characteristic.CurrentHeatingCoolingState.HEAT;
        case 'Cooling':
          return Characteristic.CurrentHeatingCoolingState.COOL;
        default:
          return undefined;
      }
    }
    const mode = client.getVariable(device.id, 'mode', 'string');
    switch (mode) {
      case 'Off':
      case 'InDeadBand':
      case 'Idle':
      case 'eco': // Nest Plugin
        return Characteristic.CurrentHeatingCoolingState.OFF;
      case 'HeatOn':
      case 'AuxHeatOn':
      case 'EconomyHeatOn':
      case 'EmergencyHeatOn':
      case 'EnergySavingsHeating':
      case 'BuildingProtection':
        return heat < temperature
          ? Characteristic.CurrentHeatingCoolingState.OFF
          : Characteristic.CurrentHeatingCoolingState.HEAT;
      case 'CoolOn':
      case 'AuxCoolOn':
      case 'EconomyCoolOn':
        return cool > temperature
          ? Characteristic.CurrentHeatingCoolingState.OFF
          : Characteristic.CurrentHeatingCoolingState.COOL;
      default:
        return undefined;
    }
  };

  const getMode = () => client.getVariable(device.id, 'mode', 'string');

  const setMode = async (value) => {
    let veraValue;
    switch (value) {
      case Characteristic.TargetHeatingCoolingState.OFF:
        veraValue = 'Off';
        break;
      case Characteristic.TargetHeatingCoolingState.HEAT:
        veraValue = 'HeatOn';
        break;
      case Characteristic.TargetHeatingCoolingState.COOL:
        veraValue = 'CoolOn';
        break;
      case Characteristic.TargetHeatingCoolingState.AUTO:
        veraValue = 'AutoChangeOver';
        break;
      default:
        veraValue = 'Off';
    }
    return client.executeAction({
      action: 'SetModeTarget',
      serviceId: 'urn:upnp-org:serviceId:HVAC_UserOperatingMode1',
      NewModeTarget: veraValue,
      DeviceNum: device.id,
    });
  };

  const getCurrentTemperature = () => {
    let temperature = client.getVariable(device.id, 'temperature', 'number');
    if (veraIsUsingFahrenheit()) {
      temperature = fahrenheitToCelsius(temperature);
    }
    return Math.round(temperature * 10) / 10;
  };

  const getTargetTemperature = () => {
    let setpoint = client.getVariable(device.id, 'setpoint', 'number');
    if (veraIsUsingFahrenheit()) {
      setpoint = fahrenheitToCelsius(setpoint);
    }
    return setpoint;
  };

  const setTargetTemperature = async (value) => {
    let services;
    switch (getMode()) {
      case 1:
        services = ['urn:upnp-org:serviceId:TemperatureSetpoint1_Heat'];
        break;
      case 2:
        services = ['urn:upnp-org:serviceId:TemperatureSetpoint1_Cool'];
        break;
      default:
        services = [
          'urn:upnp-org:serviceId:TemperatureSetpoint1_Heat',
          'urn:upnp-org:serviceId:TemperatureSetpoint1_Cool',
        ];
        break;
    }
    let setpoint = value;
    if (veraIsUsingFahrenheit()) {
      setpoint = Math.round(celsiusToFahrenheit(value));
    }

    const requests = services.map((serviceId) =>
      client
        .executeAction({
          action: 'SetCurrentSetpoint',
          serviceId,
          DeviceNum: device.id,
          NewCurrentSetpoint: setpoint,
        })
        .then((response) => {
          // Dirty hack for the WWN plugin, which uses the wrong serviceId.
          if (typeof response === 'string' && response.match(/ERROR/)) {
            return client.executeAction({
              action: 'SetCurrentSetpoint',
              serviceId: serviceId.match(/(^.+)_/)[1],
              DeviceNum: device.id,
              NewCurrentSetpoint: setpoint,
            });
          }
          return response;
        }),
    );
    return Promise.all(requests);
  };

  const getBatteryLevel = () => client.getVariable(device.id, 'batterylevel', 'number');

  const getIsLowBattery = () => {
    const level = getBatteryLevel();
    return level && level < 20
      ? Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
      : Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
  };

  const service = platform.getService(accessory, Service.Thermostat, device.name);

  service.getCharacteristic(Characteristic.CurrentHeatingCoolingState).onGet(() => getHVACState());

  service
    .getCharacteristic(Characteristic.TargetHeatingCoolingState)
    .onGet(() => getMode())
    .onSet(async (value) => {
      if (device.preventRequest) {
        device.preventRequest = false;
        return;
      }
      await setMode(value);
    });

  service
    .getCharacteristic(Characteristic.CurrentTemperature)
    .setProps({ minValue: fahrenheitToCelsius(-100), maxValue: fahrenheitToCelsius(100) })
    .onGet(() => getCurrentTemperature());

  service
    .getCharacteristic(Characteristic.TargetTemperature)
    .setProps({ minValue: fahrenheitToCelsius(50), maxValue: fahrenheitToCelsius(90) })
    .onGet(() => getTargetTemperature())
    .onSet(async (value) => {
      if (device.preventRequest) {
        device.preventRequest = false;
        return;
      }
      await setTargetTemperature(value);
    });

  service
    .getCharacteristic(Characteristic.TemperatureDisplayUnits)
    .onGet(() => getTemperatureDisplayUnits())
    .onSet(async () => {
      // Display unit is dictated by the Vera controller; ignore HomeKit writes.
    });

  const battery = platform.getService(accessory, Service.Battery, device.name);
  battery.getCharacteristic(Characteristic.BatteryLevel).onGet(() => getBatteryLevel());
  battery.getCharacteristic(Characteristic.StatusLowBattery).onGet(() => getIsLowBattery());

  platform.pollCharacteristics(device, [
    { vera: 'setpoint', ios: Characteristic.TargetTemperature, type: 'number', service },
    { vera: 'temperature', ios: Characteristic.CurrentTemperature, type: 'number', service },
    { vera: 'hvacstate', ios: Characteristic.CurrentHeatingCoolingState, type: 'string', service },
    { vera: 'mode', ios: Characteristic.TargetHeatingCoolingState, type: 'string', service },
  ]);
}

module.exports = { configure };
