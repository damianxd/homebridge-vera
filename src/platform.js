'use strict';

const { PLATFORM_NAME, PLUGIN_NAME } = require('./settings');
const { VeraClient, fahrenheitToCelsius } = require('./vera-client');
const sensor = require('./accessories/sensor');

/**
 * Map of plan "type" -> accessory configurator module. Each module exposes a
 * `configure(platform, accessory, plan)` function that wires up the accessory's
 * services and characteristic handlers.
 */
const ACCESSORY_TYPES = {
  switch: require('./accessories/switch'),
  dimmer: require('./accessories/dimmer'),
  fan: require('./accessories/fan'),
  'color-light': require('./accessories/color-light'),
  thermostat: require('./accessories/thermostat'),
  lock: require('./accessories/lock'),
  'garage-door': require('./accessories/garage-door'),
  'window-covering': require('./accessories/window-covering'),
  sensor,
  'temperature-sensor': require('./accessories/temperature-sensor'),
  scene: require('./accessories/scene'),
  'house-modes': require('./accessories/house-modes'),
};

class VeraPlatform {
  /**
   * @param {import('homebridge').Logging} log
   * @param {import('homebridge').PlatformConfig} config
   * @param {import('homebridge').API} api
   */
  constructor(log, config, api) {
    this.log = log;
    this.config = config || {};
    this.api = api;
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    /** uuid -> PlatformAccessory restored from the Homebridge cache. */
    this.accessories = new Map();
    /** uuids configured during the current launch. */
    this.handled = new Set();
    /** Callbacks invoked after each poll to push live Vera state into HomeKit. */
    this.refreshers = [];
    this.pollTimer = null;

    if (!this.config.veraIP) {
      this.log.error('No "veraIP" configured for the Vera platform; the plugin will not start.');
      return;
    }

    this.client = new VeraClient(this.config.veraIP, this.log, this.Characteristic);

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices().catch((err) => {
        this.log.error(`Failed to initialise Vera platform: ${err && err.stack ? err.stack : err}`);
      });
    });

    this.api.on('shutdown', () => {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    });
  }

  /**
   * Homebridge calls this once for every accessory restored from disk cache.
   */
  configureAccessory(accessory) {
    this.log.debug(`Loading cached accessory: ${accessory.displayName}`);
    this.accessories.set(accessory.UUID, accessory);
  }

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  async discoverDevices() {
    // Warm the status cache so getVariable() works during initial configuration.
    await this.client.refreshCache();

    const verainfo = await this.client.getVeraInfo();
    if (!verainfo || typeof verainfo !== 'object') {
      this.log.error('Could not read device information from the Vera controller.');
      return;
    }
    this.client.temperatureDisplayUnit = verainfo.temperature;

    const plans = this.buildPlans(verainfo);
    for (const plan of plans) {
      try {
        this.configurePlan(plan);
      } catch (err) {
        this.log.error(`Failed to configure ${plan.name}: ${err && err.stack ? err.stack : err}`);
      }
    }

    // Remove cached accessories that are no longer reported by the controller.
    for (const [uuid, accessory] of this.accessories) {
      if (!this.handled.has(uuid)) {
        this.log.info(`Removing accessory no longer present in Vera: ${accessory.displayName}`);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        this.accessories.delete(uuid);
      }
    }

    this.startPolling();
  }

  /**
   * Translate the Vera inventory into a flat list of accessory "plans".
   * Mirrors the original `processall` / `processdevices` / `processscenes`
   * category routing and filtering.
   */
  buildPlans(verainfo) {
    const config = this.config;
    const plans = [];

    const devices = verainfo.devices_full_list.filter((device) => {
      const found = !config.ignoredevices || config.ignoredevices.indexOf(device.id) < 0;

      if (found && Array.isArray(config.ignoreplugins)) {
        const shouldIgnore = config.ignoreplugins.filter((plugin) => {
          const deviceTypeMatch =
            device.device_type && device.device_type.toLowerCase().indexOf(plugin.toLowerCase()) > -1;
          const altIdMatch = device.altid && device.altid.toLowerCase().indexOf(plugin.toLowerCase()) > -1;
          return deviceTypeMatch || altIdMatch;
        });
        if (shouldIgnore.length) {
          this.log.debug(`Ignore Device (via plugin ${shouldIgnore.join(', ')}): ${device.id} - ${device.name}`);
          return false;
        }
      }

      // ignorerooms historically only applied to the standalone bridge mode;
      // honour it here so the documented option works under Homebridge too.
      if (found && Array.isArray(config.ignorerooms) && config.ignorerooms.indexOf(parseInt(device.room, 10)) >= 0) {
        this.log.debug(`Ignore Device (room ${device.room}): ${device.id} - ${device.name}`);
        return false;
      }

      if (!found) {
        this.log.debug(`Ignore Device: ${device.id} - ${device.name}`);
      }
      return found;
    });

    for (const device of devices) {
      const plan = this.planForDevice(device, verainfo);
      if (plan) {
        plans.push(plan);
      }
    }

    if (config.houseModes) {
      plans.push({ type: 'house-modes', uuid: this.uuid('house-modes:0'), name: 'House Modes' });
    }

    for (const scene of this.enabledScenes(verainfo)) {
      plans.push({ type: 'scene', uuid: this.uuid(`scene:${scene.id}`), name: scene.name, scene });
    }

    return plans;
  }

  planForDevice(device, verainfo) {
    if (device.name === '') {
      return null;
    }

    device.category = parseInt(device.category_num, 10);
    device.subcategory = parseInt(device.subcategory_num, 10);

    const config = this.config;
    let type = null;

    switch (device.category) {
      case 2: // Dimmable light
        if (config.includeRGB && device.subcategory === 4) {
          type = 'color-light';
        } else if (typeof device.name === 'string' && device.name.toLowerCase().includes('fan')) {
          type = 'fan';
        } else {
          type = 'dimmer';
        }
        break;
      case 3: // Switch
        type = 'switch';
        break;
      case 4: // Security sensors
      case 16: // Humidity sensor
      case 18: // Light sensor
        if (config.includesensor && sensor.match(this.Service, device.category, device.subcategory)) {
          type = 'sensor';
        }
        break;
      case 5: // Thermostat
        if (config.includethermostat) {
          type = 'thermostat';
        }
        break;
      case 7: // Door lock
        type = 'lock';
        break;
      case 8: // Window covering
        type = 'window-covering';
        break;
      case 17: // Temperature sensor
        if (config.includesensor) {
          type = 'temperature-sensor';
        }
        break;
      case 32: // Garage door
        type = 'garage-door';
        break;
      default:
        type = null;
    }

    if (!type) {
      return null;
    }

    return {
      type,
      uuid: this.uuid(`device:${type}:${device.id}`),
      name: device.name,
      device,
      temperatureUnit: verainfo.temperature,
    };
  }

  enabledScenes(verainfo) {
    const config = this.config;
    return (verainfo.scenes || [])
      .filter((scene) => {
        const found =
          !config.ignorescenes ||
          (Array.isArray(config.ignorescenes) && config.ignorescenes.indexOf(scene.id) < 0 && config.ignorescenes !== true);
        if (!found) {
          this.log.debug(`Ignore Scene: ${scene.id} - ${scene.name}`);
        }
        return found;
      })
      .filter((scene) => !scene.invisible || scene.invisible !== 1);
  }

  configurePlan(plan) {
    const factory = ACCESSORY_TYPES[plan.type];
    if (!factory) {
      this.log.warn(`No configurator for accessory type "${plan.type}"`);
      return;
    }

    let accessory = this.accessories.get(plan.uuid);
    let isNew = false;
    if (!accessory) {
      accessory = new this.api.platformAccessory(plan.name, plan.uuid);
      isNew = true;
    }
    accessory.context.plan = { type: plan.type, name: plan.name };

    factory.configure(this, accessory, plan);

    if (isNew) {
      this.log.info(`Adding ${plan.type}: ${plan.name}`);
      this.accessories.set(plan.uuid, accessory);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    } else {
      this.log.debug(`Restored ${plan.type}: ${plan.name}`);
      this.api.updatePlatformAccessories([accessory]);
    }
    this.handled.add(plan.uuid);
  }

  // ---------------------------------------------------------------------------
  // Helpers for accessory modules
  // ---------------------------------------------------------------------------

  uuid(seed) {
    return this.api.hap.uuid.generate(`${PLUGIN_NAME}:${seed}`);
  }

  /** Get an existing service or add it, keeping the displayed name in sync. */
  getService(accessory, type, name, subtype) {
    let service =
      subtype != null ? accessory.getServiceById(type, subtype) : accessory.getService(type);
    if (!service) {
      service = subtype != null ? accessory.addService(type, name, subtype) : accessory.addService(type, name);
    }
    if (name) {
      service.setCharacteristic(this.Characteristic.Name, name);
    }
    return service;
  }

  configureInformation(accessory, { manufacturer, model, serialNumber } = {}) {
    const info =
      accessory.getService(this.Service.AccessoryInformation) ||
      accessory.addService(this.Service.AccessoryInformation);
    if (manufacturer) {
      info.setCharacteristic(this.Characteristic.Manufacturer, String(manufacturer));
    }
    if (model) {
      info.setCharacteristic(this.Characteristic.Model, String(model));
    }
    if (serialNumber != null) {
      info.setCharacteristic(this.Characteristic.SerialNumber, String(serialNumber));
    }
    return info;
  }

  registerRefresh(fn) {
    this.refreshers.push(fn);
  }

  removeRefresh(fn) {
    this.refreshers = this.refreshers.filter((f) => f !== fn);
  }

  /**
   * Port of the original `checkCharacteristics`: registers a poll callback that
   * pushes the latest cached Vera values into the supplied characteristics.
   * @param {object} device
   * @param {Array<{vera:string, ios:object, type:string, service:object}>} chars
   */
  pollCharacteristics(device, chars) {
    const refresh = () => {
      chars.forEach((property) => {
        const characteristic = property.service.getCharacteristic(property.ios);
        const sending = characteristic.sending;
        const charName = characteristic.displayName;
        let latest = this.client.getVariable(device.id, property.vera, property.type);
        const current = characteristic.value;

        if (property.vera === 'hvacstate' && isNaN(latest)) {
          this.log.debug('Nest Vera plugin detected, removing thermostat poll. Please use homebridge-nest.');
          this.removeRefresh(refresh);
          return;
        }
        if (property.vera === 'setpoint' || property.vera === 'temperature') {
          latest =
            this.client.temperatureDisplayUnit === 'F'
              ? parseFloat(fahrenheitToCelsius(latest).toFixed(1))
              : parseFloat(parseFloat(latest).toFixed(1));
        }

        // If level is zero the device is off; keep HomeKit's remembered level.
        if (!latest && property.vera === 'level' && latest !== current) {
          return;
        }
        if (sending) {
          this.log.debug(`${charName} is being set by HomeKit; skipping poll update.`);
          return;
        }
        if (latest !== current && !isNaN(latest) && !sending) {
          this.log.debug(`${device.name} ${charName} changed: ${current} -> ${latest}`);
          characteristic.updateValue(latest);
        }
      });
    };
    this.registerRefresh(refresh);
  }

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  startPolling() {
    if (this.pollTimer) {
      return;
    }
    const interval = Math.max(500, Number(this.config.pollInterval) || 2000);
    this.log.debug(`Starting Vera poll loop every ${interval}ms`);
    this.pollTimer = setInterval(() => {
      this.client
        .refreshCache()
        .then(() => {
          for (const refresh of this.refreshers.slice()) {
            try {
              refresh();
            } catch (err) {
              this.log.debug(`Refresh error: ${err.message}`);
            }
          }
        })
        .catch((err) => {
          this.log.debug(`Poll failed: ${err.message}`);
        });
    }, interval);
    // Don't keep the event loop alive solely for polling.
    if (this.pollTimer.unref) {
      this.pollTimer.unref();
    }
  }
}

module.exports = { VeraPlatform };
