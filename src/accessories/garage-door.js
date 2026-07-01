'use strict';

const { bindIdentify } = require('./util');

/**
 * Garage door opener (Vera category 32).
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `garage door ${device.name}`);

  const service = platform.getService(accessory, Service.GarageDoorOpener, device.name);

  const isOpen = () => client.getVariable(device.id, 'status', 'number') === 1;

  service
    .getCharacteristic(Characteristic.CurrentDoorState)
    .onGet(() => (isOpen() ? Characteristic.CurrentDoorState.OPEN : Characteristic.CurrentDoorState.CLOSED));

  service
    .getCharacteristic(Characteristic.TargetDoorState)
    .onGet(() => (isOpen() ? Characteristic.TargetDoorState.OPEN : Characteristic.TargetDoorState.CLOSED))
    .onSet(async (value) => {
      const opened = value === Characteristic.TargetDoorState.OPEN;
      log.debug(`Setting garage door ${device.name} to ${opened ? 'open' : 'closed'}`);
      await client.executeAction({
        action: 'SetTarget',
        serviceId: 'urn:upnp-org:serviceId:SwitchPower1',
        newTargetValue: opened ? 1 : 0,
        DeviceNum: device.id,
      });
      service.updateCharacteristic(
        Characteristic.CurrentDoorState,
        opened ? Characteristic.CurrentDoorState.OPEN : Characteristic.CurrentDoorState.CLOSED,
      );
    });

  // Push the live door state on each poll (original used a dedicated 3s timer).
  platform.registerRefresh(() => {
    service.updateCharacteristic(
      Characteristic.CurrentDoorState,
      isOpen() ? Characteristic.CurrentDoorState.OPEN : Characteristic.CurrentDoorState.CLOSED,
    );
  });
}

module.exports = { configure };
