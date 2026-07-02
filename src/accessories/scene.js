'use strict';

const { bindIdentify } = require('./util');

/**
 * Vera scene, exposed as a stateless switch that resets itself after firing.
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const scene = plan.scene;

  platform.configureInformation(accessory, {
    manufacturer: 'Oltica',
    model: 'Rev-1',
    serialNumber: `Vera Scene: ${scene.id}`,
  });
  bindIdentify(accessory, log, `scene ${scene.name}`);

  const service = platform.getService(accessory, Service.Switch, scene.name);

  service
    .getCharacteristic(Characteristic.On)
    .onGet(() => false)
    .onSet(async (value) => {
      if (!value) {
        return;
      }
      log.debug(`Running scene ${scene.name}`);
      await client.executeAction({
        action: 'RunScene',
        serviceId: 'urn:micasaverde-com:serviceId:HomeAutomationGateway1',
        SceneNum: scene.id,
      });
      // Reset the stateless switch shortly after triggering.
      setTimeout(() => {
        service.updateCharacteristic(Characteristic.On, false);
      }, 1000);
    });
}

module.exports = { configure };
