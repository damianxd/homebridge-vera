'use strict';

const { bindIdentify } = require('./util');

/**
 * Dimmable light (Vera category 2, generic).
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `dimmer ${device.name}`);

  const service = platform.getService(accessory, Service.Lightbulb, device.name);

  const onChar = service.getCharacteristic(Characteristic.On);
  onChar.sending = false;
  onChar
    .onGet(() => Boolean(client.getVariable(device.id, 'status', 'number')))
    .onSet(async (state) => {
      // Ignore a redundant "on" when already on (preserves brightness).
      if (onChar.value && state) {
        return;
      }
      onChar.sending = true;
      try {
        await client.executeAction({
          action: 'SetTarget',
          serviceId: 'urn:upnp-org:serviceId:SwitchPower1',
          newTargetValue: state ? 1 : 0,
          DeviceNum: device.id,
        });
      } finally {
        setTimeout(() => {
          onChar.sending = false;
        }, 1500);
      }
    });

  const brightnessChar = service.getCharacteristic(Characteristic.Brightness);
  brightnessChar.sending = false;
  brightnessChar
    .onGet(() => client.getVariable(device.id, 'level', 'number'))
    .onSet(async (value) => {
      brightnessChar.sending = true;
      const level = parseInt(value, 10);
      try {
        await client.executeAction({
          action: 'SetLoadLevelTarget',
          serviceId: 'urn:upnp-org:serviceId:Dimming1',
          newLoadlevelTarget: level,
          DeviceNum: device.id,
        });
        // Mirror into the cache so the next poll doesn't revert the value.
        if (client.cache) {
          const idx = client.cache.devices.findIndex((d) => d.id === device.id);
          if (idx >= 0) {
            client.cache.devices[idx].level = level;
          }
        }
      } catch (err) {
        log.debug(`Error setting brightness for ${device.name}: ${err.message}`);
      } finally {
        setTimeout(() => {
          brightnessChar.sending = false;
        }, 2000);
      }
    });

  platform.pollCharacteristics(device, [
    { vera: 'level', ios: Characteristic.Brightness, type: 'number', service },
    { vera: 'status', ios: Characteristic.On, type: 'boolean', service },
  ]);
}

module.exports = { configure };
