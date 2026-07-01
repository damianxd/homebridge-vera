'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');

const hap = require('@homebridge/hap-nodejs');
const { VeraPlatform } = require('../src/platform');
const { VeraClient } = require('../src/vera-client');

// ---------------------------------------------------------------------------
// Minimal fakes for the Homebridge runtime, backed by the real HAP classes.
// ---------------------------------------------------------------------------

class FakeAccessory extends EventEmitter {
  constructor(displayName, uuid) {
    super();
    this.displayName = displayName;
    this.UUID = uuid;
    this.context = {};
    this.services = [];
  }

  addService(type, name, subtype) {
    const service = typeof type === 'function' ? new type(name, subtype) : type;
    this.services.push(service);
    return service;
  }

  getService(type) {
    const uuid = typeof type === 'function' ? type.UUID : type.UUID;
    return this.services.find((s) => s.UUID === uuid && (s.subtype === undefined || s.subtype === ''));
  }

  getServiceById(type, subtype) {
    return this.services.find((s) => s.UUID === type.UUID && s.subtype === String(subtype));
  }
}

function makeApi() {
  const api = new EventEmitter();
  const registered = [];
  const unregistered = [];
  api.hap = hap;
  api.platformAccessory = FakeAccessory;
  api.registerPlatform = () => {};
  api.registerPlatformAccessories = (_plugin, _platform, accessories) => registered.push(...accessories);
  api.unregisterPlatformAccessories = (_plugin, _platform, accessories) => unregistered.push(...accessories);
  api.updatePlatformAccessories = () => {};
  return { api, registered, unregistered };
}

function makeLog() {
  const errors = [];
  const log = {
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: (...args) => errors.push(args.join(' ')),
  };
  return { log, errors };
}

// ---------------------------------------------------------------------------
// Synthetic Vera controller responses.
// ---------------------------------------------------------------------------

const USER_DATA = {
  TemperatureFormat: 'F',
  rooms: [{ id: 1, name: 'Living Room' }],
  scenes: [
    { id: 101, name: 'Movie' },
    { id: 102, name: 'Goodnight' },
  ],
  devices: [
    { id: 11, name: 'Living Switch', room: 1, category_num: 3, subcategory_num: 0, manufacturer: 'Acme', model: 'S1' },
    { id: 12, name: 'Dining Dimmer', room: 1, category_num: 2, subcategory_num: 1, manufacturer: 'Acme', model: 'D1' },
    { id: 13, name: 'Ceiling Fan', room: 1, category_num: 2, subcategory_num: 1, manufacturer: 'Acme', model: 'F1' },
    { id: 14, name: 'Color Strip', room: 1, category_num: 2, subcategory_num: 4, manufacturer: 'Acme', model: 'C1' },
    { id: 15, name: 'Front Door', room: 1, category_num: 7, subcategory_num: 0, manufacturer: 'Acme', model: 'L1' },
    { id: 16, name: 'Garage', room: 1, category_num: 32, subcategory_num: 0, manufacturer: 'Acme', model: 'G1' },
    { id: 17, name: 'Blinds', room: 1, category_num: 8, subcategory_num: 0, manufacturer: 'Acme', model: 'W1' },
    { id: 18, name: 'Hallway Motion', room: 1, category_num: 4, subcategory_num: 3, manufacturer: 'Acme', model: 'M1' },
    { id: 19, name: 'Thermostat', room: 1, category_num: 5, subcategory_num: 0, manufacturer: 'Acme', model: 'T1' },
    { id: 20, name: 'Outside Temp', room: 1, category_num: 17, subcategory_num: 0, manufacturer: 'Acme', model: 'TS1' },
    { id: 23, name: 'Side Door', room: 1, category_num: 4, subcategory_num: 1, manufacturer: 'Acme', model: 'C1' },
    { id: 21, name: '', room: 1, category_num: 3, subcategory_num: 0 },
    {
      id: 22,
      name: 'Nest Thermostat',
      room: 1,
      category_num: 5,
      subcategory_num: 0,
      device_type: 'urn:schemas-nest-com:device:Nest:1',
    },
  ],
};

const LIVE_DEVICES = [
  { id: 11, status: 1 },
  { id: 12, status: 1, level: 75 },
  { id: 13, status: 1, level: 65 },
  { id: 14, status: 1, level: 100 },
  { id: 15, locked: 1 },
  { id: 16, status: 0 },
  { id: 17, status: 1, level: 50 },
  { id: 18, tripped: 0, armed: 1, commFailure: 0, batterylevel: 90 },
  { id: 19, temperature: 70, setpoint: 68, mode: 'HeatOn', hvacstate: 'Heating', heat: 68, cool: 75, batterylevel: 80 },
  { id: 20, temperature: 72 },
  { id: 23, batterylevel: 95 },
  { id: 22, temperature: 71 },
];

function installFetchMock() {
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    let body;
    if (url.includes('id=user_data')) {
      body = JSON.stringify(USER_DATA);
    } else if (url.includes('id=lu_sdata')) {
      body = JSON.stringify({ devices: LIVE_DEVICES, temperature: 'F', mode: 1 });
    } else if (url.includes('id=sdata')) {
      body = JSON.stringify({ devices: LIVE_DEVICES, mode: 1 });
    } else if (url.includes('id=variableget') && url.includes('SupportedColors')) {
      body = '0=0,1=0,2=255,3=255,4=255,5=255'; // contains W support
    } else if (url.includes('id=variableget') && url.includes('CurrentColor')) {
      body = '0=0,2=255,3=0,4=0';
    } else if (url.includes('id=lu_action')) {
      body = 'OK';
    } else {
      body = '';
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => body,
    };
  };
  return calls;
}

const baseConfig = {
  name: 'Vera',
  veraIP: '10.0.0.9',
  includesensor: true,
  includethermostat: true,
  includeRGB: true,
  houseModes: true,
  ignoreplugins: ['Nest'],
  ignorescenes: [102],
  pollInterval: 10_000_000, // effectively disable polling during the test
};

test('discoverDevices registers the expected accessories without errors', async () => {
  const calls = installFetchMock();
  const { api, registered } = makeApi();
  const { log, errors } = makeLog();

  const platform = new VeraPlatform(log, { ...baseConfig }, api);
  await platform.discoverDevices();
  api.emit('shutdown');

  assert.deepStrictEqual(errors, [], `unexpected error logs: ${errors.join('\n')}`);

  const names = registered.map((a) => a.displayName).sort();
  // 11 supported devices + 1 scene + house modes; empty-named and Nest skipped.
  assert.strictEqual(registered.length, 13, `registered: ${names.join(', ')}`);
  assert.ok(names.includes('House Modes'));
  assert.ok(names.includes('Movie'));
  assert.ok(!names.includes('Goodnight'), 'ignored scene must not be registered');
  assert.ok(!names.includes('Nest Thermostat'), 'ignored plugin device must not be registered');

  assert.ok(calls.some((u) => u.includes('id=user_data')));
  assert.ok(calls.some((u) => u.includes('id=lu_sdata')));
});

test('characteristic get/set handlers round-trip through the Vera client', async () => {
  const calls = installFetchMock();
  const { api, registered } = makeApi();
  const { log } = makeLog();

  const platform = new VeraPlatform(log, { ...baseConfig }, api);
  await platform.discoverDevices();

  const byName = (name) => registered.find((a) => a.displayName === name);

  // Switch reports its cached "on" state.
  const sw = byName('Living Switch');
  const onChar = sw.getService(hap.Service.Switch).getCharacteristic(hap.Characteristic.On);
  assert.strictEqual(await onChar.handleGetRequest(), true);

  // Setting the switch off issues a SetTarget action to the controller.
  const before = calls.length;
  await onChar.handleSetRequest(false);
  const actionCall = calls.slice(before).find((u) => u.includes('id=lu_action'));
  assert.ok(actionCall, 'expected an lu_action request on set');
  assert.ok(actionCall.includes('action=SetTarget'));
  assert.ok(actionCall.includes('newTargetValue=0'));
  assert.ok(actionCall.includes('DeviceNum=11'));

  // Dimmer exposes brightness and reports the cached level.
  const dimmer = byName('Dining Dimmer').getService(hap.Service.Lightbulb);
  const brightness = dimmer.getCharacteristic(hap.Characteristic.Brightness);
  assert.strictEqual(await brightness.handleGetRequest(), 75);

  // Thermostat converts Fahrenheit to Celsius for the current temperature.
  const thermostat = byName('Thermostat').getService(hap.Service.Thermostat);
  const currentTemp = await thermostat
    .getCharacteristic(hap.Characteristic.CurrentTemperature)
    .handleGetRequest();
  assert.ok(Math.abs(currentTemp - (70 - 32) / 1.8) < 0.05, `got ${currentTemp}`);
  const hvacState = await thermostat
    .getCharacteristic(hap.Characteristic.CurrentHeatingCoolingState)
    .handleGetRequest();
  assert.strictEqual(hvacState, hap.Characteristic.CurrentHeatingCoolingState.HEAT);

  // Thermostat uses the renamed Battery service (HAP v1/Homebridge v2).
  assert.ok(byName('Thermostat').getService(hap.Service.Battery), 'thermostat should expose a Battery service');

  api.emit('shutdown');
});

test('VeraClient.getVariable translates thermostat strings to HomeKit states', () => {
  const client = new VeraClient('10.0.0.9', { debug: () => {} }, hap.Characteristic);
  client.cache = { devices: [{ id: 5, hvacstate: 'Heating', mode: 'CoolOn', status: '1', level: '42' }] };

  assert.strictEqual(client.getVariable(5, 'hvacstate', 'string'), hap.Characteristic.CurrentHeatingCoolingState.HEAT);
  assert.strictEqual(client.getVariable(5, 'mode', 'string'), hap.Characteristic.TargetHeatingCoolingState.COOL);
  assert.strictEqual(client.getVariable(5, 'level', 'number'), 42);
  assert.strictEqual(client.getVariable(5, 'status', 'boolean'), true);
  assert.strictEqual(client.getVariable(999, 'status', 'number'), undefined);
});

test('sensor handlers return finite fallback values when Vera omits optional status fields', async () => {
  installFetchMock();
  const { api, registered } = makeApi();
  const { log } = makeLog();

  const platform = new VeraPlatform(log, { ...baseConfig }, api);
  await platform.discoverDevices();

  const contact = registered.find((a) => a.displayName === 'Side Door');
  const service = contact.getService(hap.Service.ContactSensor);
  const contactState = await service.getCharacteristic(hap.Characteristic.ContactSensorState).handleGetRequest();
  const statusFault = await service.getCharacteristic(hap.Characteristic.StatusFault).handleGetRequest();

  assert.strictEqual(contactState, hap.Characteristic.ContactSensorState.CONTACT_DETECTED);
  assert.strictEqual(statusFault, hap.Characteristic.StatusFault.NO_FAULT);

  api.emit('shutdown');
});
