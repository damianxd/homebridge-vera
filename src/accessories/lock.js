'use strict';

const { bindIdentify } = require('./util');

/**
 * Door lock (Vera category 7). Devices listed in `config.garageLocks` are
 * presented as garage door openers instead of lock mechanisms.
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;

  const asGarage = Array.isArray(platform.config.garageLocks) && platform.config.garageLocks.indexOf(device.id) >= 0;

  let serviceType;
  let targetState;
  let currentState;
  let securedValue;
  let unsecuredValue;

  if (asGarage) {
    serviceType = Service.GarageDoorOpener;
    targetState = Characteristic.TargetDoorState;
    currentState = Characteristic.CurrentDoorState;
    securedValue = Characteristic.CurrentDoorState.CLOSED;
    unsecuredValue = Characteristic.CurrentDoorState.OPEN;
  } else {
    serviceType = Service.LockMechanism;
    targetState = Characteristic.LockTargetState;
    currentState = Characteristic.LockCurrentState;
    securedValue = Characteristic.LockCurrentState.SECURED;
    unsecuredValue = Characteristic.LockCurrentState.UNSECURED;
  }

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `lock ${device.name}`);

  const service = platform.getService(accessory, serviceType, device.name);

  const isLocked = () => Boolean(client.getVariable(device.id, 'locked', 'number'));

  const targetChar = service.getCharacteristic(targetState);
  const currentChar = service.getCharacteristic(currentState);
  targetChar.sending = false;
  currentChar.sending = false;

  targetChar
    .onGet(() => (isLocked() ? securedValue : unsecuredValue))
    .onSet(async (value) => {
      if (device.preventRequest) {
        device.preventRequest = false;
        return;
      }
      targetChar.sending = true;
      const lock = value === securedValue;
      log.debug(`Setting lock ${device.name} to ${lock ? 'secured' : 'unsecured'}`);
      try {
        await client.executeAction({
          action: 'SetTarget',
          serviceId: 'urn:micasaverde-com:serviceId:DoorLock1',
          newTargetValue: lock ? 1 : 0,
          DeviceNum: device.id,
        });
      } finally {
        setTimeout(() => {
          targetChar.sending = false;
        }, 5000);
      }
    });

  currentChar.onGet(() => (isLocked() ? securedValue : unsecuredValue));

  platform.pollCharacteristics(device, [
    { vera: 'locked', ios: targetState, type: 'number', service },
    { vera: 'locked', ios: currentState, type: 'number', service },
  ]);
}

module.exports = { configure };
