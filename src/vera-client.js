'use strict';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fahrenheitToCelsius = (temperature) => (temperature - 32) / 1.8;

/**
 * Thin client for the Vera (MiOS/Ezlo) Luup `data_request` HTTP API.
 *
 * It owns the polled status cache (`sdata`) and the value translation logic
 * that the accessory modules rely on. The HTTP wire format, endpoints, service
 * IDs and value translations are preserved verbatim from the original plugin so
 * that controller behaviour is unchanged.
 */
class VeraClient {
  /**
   * @param {string} host           IP address or hostname of the Vera controller.
   * @param {import('homebridge').Logging} log
   * @param {typeof import('hap-nodejs').Characteristic} Characteristic
   */
  constructor(host, log, Characteristic) {
    this.host = host;
    this.log = log;
    this.Characteristic = Characteristic;
    this.cache = null;
    /** Display unit reported by the controller ("C" or "F"). */
    this.temperatureDisplayUnit = null;
  }

  baseUrl() {
    return `http://${this.host}/port_3480/data_request`;
  }

  /**
   * Perform a GET request against the controller with a timeout and retries.
   * @returns {Promise<string|object>} parsed JSON when `parseJson`, else raw text.
   */
  async _get(url, { parseJson = false, timeoutMs = 15000, retries = 2 } = {}) {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const text = await res.text();
        return parseJson ? JSON.parse(text) : text;
      } catch (err) {
        if (attempt >= retries) {
          throw err;
        }
        const backoff = 500 * 2 ** attempt;
        this.log.debug(`Vera request failed (${err.message}); retrying in ${backoff}ms`);
        await delay(backoff);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  /**
   * Run a `lu_action` against the controller. Returns parsed JSON when the
   * response is valid JSON, otherwise the raw response text.
   * @param {Record<string, string|number>} params
   */
  async executeAction(params) {
    const usp = new URLSearchParams({ id: 'lu_action', output_format: 'json' });
    for (const [key, value] of Object.entries(params)) {
      usp.set(key, String(value));
    }
    const url = `${this.baseUrl()}?${usp.toString()}`;
    this.log.debug(`Requesting: ${url}`);
    try {
      const body = await this._get(url);
      try {
        return JSON.parse(body);
      } catch {
        return body;
      }
    } catch (err) {
      this.log.debug(`Action request error: ${err.message}`);
      return undefined;
    }
  }

  /**
   * Read a single device variable (`variableget`) as raw text.
   * @param {number} deviceId
   * @param {string} serviceId
   * @param {string} variable
   */
  async variableGet(deviceId, serviceId, variable) {
    const usp = new URLSearchParams({
      id: 'variableget',
      DeviceNum: String(deviceId),
      serviceId,
      Variable: variable,
    });
    const url = `${this.baseUrl()}?${usp.toString()}`;
    this.log.debug(`Requesting: ${url}`);
    try {
      const body = await this._get(url);
      return String(body).trim();
    } catch (err) {
      this.log.debug(`variableget error: ${err.message}`);
      return undefined;
    }
  }

  /**
   * Refresh the cached `sdata` snapshot used by `getVariable`.
   */
  async refreshCache() {
    const url = `${this.baseUrl()}?id=sdata`;
    const status = await this._get(url, { parseJson: true });
    status.devices.push({
      id: 0,
      name: 'House Mode',
      mode: status.mode,
    });
    this.cache = status;
    return this.cache;
  }

  /**
   * Translate a cached device variable into the value HomeKit expects.
   * Behaviour (including the original thermostat string mapping) is preserved.
   * @param {number} id
   * @param {string} property
   * @param {'string'|'number'|'boolean'} [type]
   */
  getVariable(id, property, type) {
    if (!this.cache) {
      return false;
    }
    const device = this.cache.devices.find((d) => d.id === id);
    if (!device) {
      return undefined;
    }

    const Characteristic = this.Characteristic;
    const translateProperty = (value) => {
      switch (type) {
        case 'string':
          switch (property) {
            case 'hvacstate':
              switch (value) {
                case 'Idle':
                case 'PendingHeat':
                case 'PendingCool':
                case 'FanOnly':
                case 'Vent':
                  return Characteristic.CurrentHeatingCoolingState.OFF;
                case 'Heating':
                  return Characteristic.CurrentHeatingCoolingState.HEAT;
                case 'Cooling':
                  return Characteristic.CurrentHeatingCoolingState.COOL;
                default:
                  null;
              }
            // falls through (preserved from original)
            case 'mode':
              switch (value) {
                case 'Off':
                case 'eco': // Nest Plugin
                  return Characteristic.TargetHeatingCoolingState.OFF;
                case 'HeatOn':
                case 'AuxHeatOn':
                case 'EconomyHeatOn':
                case 'EmergencyHeatOn':
                case 'BuildingProtection':
                  return Characteristic.TargetHeatingCoolingState.HEAT;
                case 'CoolOn':
                case 'AuxCoolOn':
                case 'EconomyCoolOn':
                  return Characteristic.TargetHeatingCoolingState.COOL;
                case 'AutoChangeOver':
                case 'EnergySavingsMode':
                  return Characteristic.TargetHeatingCoolingState.AUTO;
                default:
                  null;
              }
            // falls through (preserved from original)
            default:
              null;
          }
          return undefined;
        case 'number':
          return parseInt(value, 10);
        case 'boolean':
          return Boolean(parseInt(value, 10));
        default:
          return undefined;
      }
    };

    return translateProperty(device[property]);
  }

  /**
   * Fetch and assemble the full controller inventory (devices, rooms, scenes).
   * Mirrors the original `getVeraInfo` shape exactly.
   */
  async getVeraInfo() {
    const userData = await this._get(`${this.baseUrl()}?id=user_data`, { parseJson: true });
    const sdata = await this._get(`${this.baseUrl()}?id=lu_sdata`, { parseJson: true });

    this.log.debug('lu_sdata received');

    userData.devices.forEach((device) => {
      const match = sdata.devices.find((sdevice) => parseInt(device.id, 10) === parseInt(sdevice.id, 10));
      Object.assign(device, match);
    });

    const devicesByRoom = {};
    userData.devices.forEach((device) => {
      if (typeof devicesByRoom[device.room] === 'undefined') {
        devicesByRoom[device.room] = [];
      }
      devicesByRoom[device.room].push(device);
    });

    const devicesFullList = userData.devices.filter(
      (device) => !device.invisible || device.invisible !== '1' || device.invisible !== 1,
    );

    return {
      rooms: userData.rooms,
      devices_by_room: devicesByRoom,
      devices_full_list: devicesFullList,
      scenes: userData.scenes,
      // Read from user_data (matches original); should be configurable perhaps
      // if Vera does not provide a format.
      temperature: userData.temperature
        ? userData.temperature
        : userData.TemperatureFormat
          ? userData.TemperatureFormat
          : 'F',
    };
  }
}

module.exports = { VeraClient, fahrenheitToCelsius };
