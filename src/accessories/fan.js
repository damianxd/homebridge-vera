'use strict';

const { bindIdentify } = require('./util');

/**
 * Fan controlled via a Vera dimmer (category 2 with "fan" in the name).
 * Rotation speed is quantised to the levels supported by typical fan switches.
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `fan ${device.name}`);

  const service = platform.getService(accessory, Service.Fan, device.name);

  const onChar = service.getCharacteristic(Characteristic.On);
  onChar.sending = false;
  onChar
    .onGet(() => Boolean(client.getVariable(device.id, 'status', 'number')))
    .onSet(async (value) => {
      if (onChar.value && value) {
        return;
      }
      onChar.sending = true;
      log.debug(`Fan power set to ${value}`);
      try {
        await client.executeAction({
          action: 'SetTarget',
          serviceId: 'urn:upnp-org:serviceId:SwitchPower1',
          newTargetValue: value ? 1 : 0,
          DeviceNum: device.id,
        });
      } finally {
        setTimeout(() => {
          onChar.sending = false;
        }, 1000);
      }
    });

  const speedChar = service.getCharacteristic(Characteristic.RotationSpeed);
  speedChar.sending = false;
  speedChar
    .onGet(() => client.getVariable(device.id, 'level', 'number'))
    .onSet(async (raw) => {
      speedChar.sending = true;
      // Siri sends 25/50/100 for Low/Mid/High; map to switch thresholds.
      let value = Math.floor(raw);
      if (value < 35) {
        value = 26;
      } else if (value < 67) {
        value = 65;
      } else {
        value = 100;
      }
      log.debug(`Fan rotation speed set to ${value}`);
      try {
        await client.executeAction({
          action: 'SetLoadLevelTarget',
          serviceId: 'urn:upnp-org:serviceId:Dimming1',
          newLoadlevelTarget: value,
          DeviceNum: device.id,
        });
      } finally {
        setTimeout(() => {
          speedChar.sending = false;
        }, 1000);
      }
    });

  platform.pollCharacteristics(device, [
    { vera: 'level', ios: Characteristic.RotationSpeed, type: 'number', service },
    { vera: 'status', ios: Characteristic.On, type: 'boolean', service },
  ]);
}

module.exports = { configure };
