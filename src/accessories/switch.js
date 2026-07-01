'use strict';

const { bindIdentify } = require('./util');

/**
 * Binary switch (Vera category 3).
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `switch ${device.name}`);

  const service = platform.getService(accessory, Service.Switch, device.name);

  service
    .getCharacteristic(Characteristic.On)
    .onGet(() => Boolean(client.getVariable(device.id, 'status', 'number')))
    .onSet(async (value) => {
      log.debug(`Setting power for ${device.name} to ${value}`);
      await client.executeAction({
        action: 'SetTarget',
        serviceId: 'urn:upnp-org:serviceId:SwitchPower1',
        newTargetValue: value ? 1 : 0,
        DeviceNum: device.id,
      });
    });

  platform.pollCharacteristics(device, [
    { vera: 'status', ios: Characteristic.On, type: 'boolean', service },
  ]);
}

module.exports = { configure };
