'use strict';

const { bindIdentify } = require('./util');

const fahrenheitToCelsius = (temperature) => (temperature - 32) / 1.8;

/**
 * Temperature sensor (Vera category 17).
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
  bindIdentify(accessory, log, `temperature sensor ${device.name}`);

  const usingFahrenheit = () => temperatureDisplayUnit !== 'C';

  const getTemperature = () => {
    let temperature = client.getVariable(device.id, 'temperature', 'number');
    if (usingFahrenheit()) {
      temperature = fahrenheitToCelsius(temperature);
    }
    return temperature;
  };

  const service = platform.getService(accessory, Service.TemperatureSensor, device.name);
  service
    .getCharacteristic(Characteristic.CurrentTemperature)
    .setProps({ minValue: -100, maxValue: 100 })
    .onGet(() => getTemperature());

  platform.pollCharacteristics(device, [
    { vera: 'temperature', ios: Characteristic.CurrentTemperature, type: 'number', service },
  ]);
}

module.exports = { configure };
