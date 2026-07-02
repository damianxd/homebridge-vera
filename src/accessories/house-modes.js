'use strict';

const { bindIdentify } = require('./util');

/**
 * Vera house modes exposed as a HomeKit Security System.
 * HomeKit states: 0 STAY_ARM, 1 AWAY_ARM, 2 NIGHT_ARM, 3 DISARM.
 * Vera modes:     1 Home, 2 Away, 3 Night, 4 Vacation.
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;

  platform.configureInformation(accessory, {
    manufacturer: 'Oltica',
    model: 'Rev-1',
    serialNumber: 'Vera House Modes',
  });
  bindIdentify(accessory, log, 'house modes');

  const service = platform.getService(accessory, Service.SecuritySystem, plan.name);

  const getHouseMode = () => {
    switch (parseInt(client.getVariable(0, 'mode', 'number'), 10)) {
      case 1:
        return 0;
      case 2:
        return 1;
      case 3:
        return 2;
      case 4:
        return 1;
      default:
        return 0;
    }
  };

  const setHouseMode = async (mode) => {
    let veramode;
    switch (mode) {
      case 0:
        veramode = 1;
        break;
      case 1:
        veramode = 2;
        break;
      case 2:
        veramode = 3;
        break;
      case 3:
      default:
        veramode = 1;
        break;
    }
    await client.executeAction({
      action: 'SetHouseMode',
      serviceId: 'urn:micasaverde-com:serviceId:HomeAutomationGateway1',
      Mode: veramode,
      DeviceNum: 0,
    });
    return mode;
  };

  service.getCharacteristic(Characteristic.SecuritySystemCurrentState).onGet(() => getHouseMode());

  service
    .getCharacteristic(Characteristic.SecuritySystemTargetState)
    .onGet(() => getHouseMode())
    .onSet(async (value) => {
      const mode = await setHouseMode(value);
      service.updateCharacteristic(Characteristic.SecuritySystemCurrentState, mode);
    });
}

module.exports = { configure };
