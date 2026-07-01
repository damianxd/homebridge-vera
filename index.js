'use strict';

const { PLATFORM_NAME } = require('./src/settings');
const { VeraPlatform } = require('./src/platform');

/**
 * Homebridge entry point. Registers the dynamic "Vera" platform.
 * @param {import('homebridge').API} api
 */
module.exports = (api) => {
  api.registerPlatform(PLATFORM_NAME, VeraPlatform);
};
