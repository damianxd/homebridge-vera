'use strict';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attach a simple identify handler that logs at debug level. Idempotent across
 * re-configuration of a cached accessory.
 */
function bindIdentify(accessory, log, label) {
  accessory.removeAllListeners('identify');
  accessory.on('identify', () => log.debug(`Identify requested: ${label}`));
}

module.exports = { delay, bindIdentify };
