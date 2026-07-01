'use strict';

const { bindIdentify } = require('./util');

/**
 * Window covering / blind (Vera category 8) backed by a Vera dimmer that
 * reports and accepts a position level (0-100).
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `window covering ${device.name}`);

  const service = platform.getService(accessory, Service.WindowCovering, device.name);

  // Runtime state held in the accessory context so it survives reconfiguration.
  let currentPositionState = Characteristic.PositionState.STOPPED;

  const level = () => client.getVariable(device.id, 'level', 'number');

  const setPosition = async (pos) => {
    log.debug(`Set window covering ${device.id} to ${pos}`);
    currentPositionState =
      pos > level() ? Characteristic.PositionState.INCREASING : Characteristic.PositionState.DECREASING;
    service.updateCharacteristic(Characteristic.PositionState, currentPositionState);

    await client.executeAction({
      action: 'SetLoadLevelTarget',
      serviceId: 'urn:upnp-org:serviceId:Dimming1',
      newLoadlevelTarget: pos,
      DeviceNum: device.id,
    });

    // HomeKit needs a delay before we report STOPPED, otherwise it shows
    // "opening…"/"closing…" indefinitely.
    setTimeout(() => {
      currentPositionState = Characteristic.PositionState.STOPPED;
      service.updateCharacteristic(Characteristic.PositionState, currentPositionState);
      if (pos >= 0) {
        service.updateCharacteristic(Characteristic.CurrentPosition, pos);
      }
    }, 5000);
  };

  service.getCharacteristic(Characteristic.CurrentPosition).onGet(() => level());

  service.getCharacteristic(Characteristic.PositionState).onGet(() => currentPositionState);

  service
    .getCharacteristic(Characteristic.TargetPosition)
    .onGet(() => level())
    .onSet(async (pos) => {
      await setPosition(pos);
    });

  service
    .getCharacteristic(Characteristic.HoldPosition)
    .onSet(async () => {
      await setPosition(-1);
    });
}

module.exports = { configure };
