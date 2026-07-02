'use strict';

/**
 * Platform name used in the Homebridge `config.json` (`"platform": "Vera"`).
 * Must match the `pluginAlias` in `config.schema.json`.
 */
const PLATFORM_NAME = 'Vera';

/**
 * The npm package name, used by Homebridge to identify the plugin.
 */
const PLUGIN_NAME = 'homebridge-vera';

module.exports = { PLATFORM_NAME, PLUGIN_NAME };
