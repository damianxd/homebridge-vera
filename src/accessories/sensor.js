'use strict';

const { bindIdentify } = require('./util');

/**
 * Mapping of Vera (category, subcategory) pairs to HomeKit sensor services and
 * the device variables that feed each characteristic. Preserved from the
 * original plugin.
 */
const SENSOR_MAP = [
  {
    name: 'MotionSensor',
    category: 4,
    subcategory: 3,
    battery: true,
    characteristics: {
      MotionDetected: { getVariable: 'tripped', type: 'number' },
      StatusActive: { getVariable: 'armed', type: 'number' },
      StatusFault: { getVariable: 'commFailure', type: 'number' },
    },
  },
  {
    name: 'ContactSensor',
    category: 4,
    subcategory: 1,
    battery: true,
    characteristics: {
      ContactSensorState: { getVariable: 'tripped', type: 'number' },
      StatusFault: { getVariable: 'commFailure', type: 'number' },
    },
  },
  {
    name: 'HumiditySensor',
    category: 16,
    subcategory: 0,
    battery: true,
    characteristics: {
      CurrentRelativeHumidity: { getVariable: 'humidity', type: 'number' },
    },
  },
  {
    name: 'LightSensor',
    category: 18,
    subcategory: 0,
    battery: true,
    characteristics: {
      CurrentAmbientLightLevel: { getVariable: 'light', type: 'number' },
    },
  },
  {
    name: 'CarbonMonoxideSensor',
    category: 4,
    subcategory: 5,
    battery: true,
    characteristics: {
      CarbonMonoxideDetected: { getVariable: 'armedtripped', type: 'number' },
    },
  },
  {
    name: 'SmokeSensor',
    category: 4,
    subcategory: 4,
    battery: true,
    characteristics: {
      SmokeDetected: { getVariable: 'armedtripped', type: 'number' },
    },
  },
  {
    name: 'ContactSensor',
    category: 4,
    subcategory: 6,
    battery: true,
    characteristics: {
      ContactSensorState: { getVariable: 'armedtripped', type: 'number' },
      StatusActive: { getVariable: 'armed', type: 'number' },
      StatusFault: { getVariable: 'commFailure', type: 'number' },
    },
  },
];

/**
 * Find the sensor mapping for a device, if its HomeKit service exists.
 * @returns {object|undefined}
 */
function match(Service, category, subcategory) {
  return SENSOR_MAP.find(
    (entry) => entry.category === category && entry.subcategory === subcategory && Service[entry.name],
  );
}

function fallbackValue(Characteristic, key) {
  switch (key) {
    case 'ContactSensorState':
      return Characteristic.ContactSensorState.CONTACT_DETECTED;
    case 'StatusFault':
      return Characteristic.StatusFault.NO_FAULT;
    case 'MotionDetected':
      return false;
    case 'StatusActive':
      return true;
    case 'CarbonMonoxideDetected':
      return Characteristic.CarbonMonoxideDetected.CO_LEVELS_NORMAL;
    case 'SmokeDetected':
      return Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
    case 'CurrentRelativeHumidity':
    case 'CurrentAmbientLightLevel':
      return 0;
    default:
      return undefined;
  }
}

function getValidValue(client, device, map, service, characteristic, fallback) {
  const value = client.getVariable(device.id, map.getVariable, map.type);
  if (Number.isFinite(value) || typeof value === 'boolean') {
    return value;
  }

  const current = service.getCharacteristic(characteristic).value;
  if (Number.isFinite(current) || typeof current === 'boolean') {
    return current;
  }

  return fallback;
}

function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;

  const entry = match(Service, device.category, device.subcategory);
  if (!entry) {
    return;
  }

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `sensor ${device.name}`);

  const service = platform.getService(accessory, Service[entry.name], device.name);

  Object.keys(entry.characteristics).forEach((key) => {
    const map = entry.characteristics[key];
    const characteristic = Characteristic[key];
    const fallback = fallbackValue(Characteristic, key);

    service
      .getCharacteristic(characteristic)
      .onGet(() => getValidValue(client, device, map, service, characteristic, fallback));

    platform.registerRefresh(() => {
      const value = getValidValue(client, device, map, service, characteristic, fallback);
      if (typeof value === 'undefined') {
        return;
      }
      if (value !== service.getCharacteristic(characteristic).value) {
        service.updateCharacteristic(characteristic, value);
      }
    });
  });

  if (entry.battery) {
    const batteryId = device.parent > 1 ? device.parent : device.id;
    const battery = platform.getService(accessory, Service.Battery, device.name);
    battery
      .getCharacteristic(Characteristic.BatteryLevel)
      .onGet(() => parseInt(client.getVariable(batteryId, 'batterylevel', 'number'), 10));
    battery
      .getCharacteristic(Characteristic.StatusLowBattery)
      .onGet(() => client.getVariable(batteryId, 'batterylevel', 'number') < 20);
  }
}

module.exports = { configure, match };
