'use strict';

const { delay, bindIdentify } = require('./util');

const COLOR_SERVICE = 'urn:micasaverde-com:serviceId:Color1';
const DIMMING_SERVICE = 'urn:upnp-org:serviceId:Dimming1';

// ---------------------------------------------------------------------------
// Colour conversion helpers (ported verbatim from the original plugin).
// ---------------------------------------------------------------------------

function rgbw2hsv(obj) {
  const r = obj.r;
  const g = obj.g;
  const b = obj.b;
  const w = obj.w;
  const rr = Math.pow(r, 2);
  const gg = Math.pow(g, 2);
  const bb = Math.pow(b, 2);

  const ratio = (r - 0.5 * g - 0.5 * b) / Math.sqrt(rr + bb + gg - r * g - r * b - g * b);
  let h = g >= b ? (Math.acos(ratio) * 180) / Math.PI : 360 - (Math.acos(ratio) * 180) / Math.PI;
  h = parseInt(h, 10);

  const rN = r / 255;
  const gN = g / 255;
  const bN = b / 255;
  const wN = w / 255;
  const v = parseInt(Math.max(rN, Math.max(gN, Math.max(bN, wN))) * 100, 10);
  const s = parseInt((1 - (3 * Math.min(rN, Math.min(gN, bN)) + wN) / (rN + gN + bN + wN)) * 100, 10);
  return { h, s, v };
}

function hsv2rgbw(obj) {
  let r;
  let g;
  let b;
  let w;
  let h = obj.h;
  let s = obj.s / 100;
  let v = obj.v / 100;
  let cosH;
  let cos1047H;
  h = h % 360; // cycle h around to 0-360 degrees
  h = (3.14159 * h) / 180; // convert to radians
  s = s > 0 ? (s < 1 ? s : 1) : 0; // clamp s and v to [0,1]
  v = v > 0 ? (v < 1 ? v : 1) : 0;
  if (h < 2.09439) {
    cosH = Math.cos(h);
    cos1047H = Math.cos(1.047196667 - h);
    r = ((s * 255 * v) / 3) * (1 + cosH / cos1047H);
    g = ((s * 255 * v) / 3) * (1 + (1 - cosH / cos1047H));
    b = 0;
    w = 255 * (1 - s) * v;
  } else if (h < 4.188787) {
    h = h - 2.09439;
    cosH = Math.cos(h);
    cos1047H = Math.cos(1.047196667 - h);
    g = ((s * 255 * v) / 3) * (1 + cosH / cos1047H);
    b = ((s * 255 * v) / 3) * (1 + (1 - cosH / cos1047H));
    r = 0;
    w = 255 * (1 - s) * v;
  } else {
    h = h - 4.188787;
    cosH = Math.cos(h);
    cos1047H = Math.cos(1.047196667 - h);
    b = ((s * 255 * v) / 3) * (1 + cosH / cos1047H);
    r = ((s * 255 * v) / 3) * (1 + (1 - cosH / cos1047H));
    g = 0;
    w = 255 * (1 - s) * v;
  }
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), w: Math.round(w) };
}

function rgb2hsv(obj) {
  const r = obj.r / 255;
  const g = obj.g / 255;
  const b = obj.b / 255;
  const min = Math.min(r, Math.min(g, b));
  const max = Math.max(r, Math.max(g, b));

  if (min === max) {
    return { h: 0, s: 0, v: r * 100 };
  }

  const d = r === min ? g - b : b === min ? r - g : b - r;
  const hBase = r === min ? 3 : b === min ? 1 : 5;
  const h = 60 * (hBase - d / (max - min));
  const s = (max - min) / max;
  const v = max;
  return { h, s: s * 100, v: v * 100 };
}

function hsv2rgb(obj) {
  let r;
  let g;
  let b;
  const sfrac = obj.s / 100;
  const vfrac = obj.v / 100;

  if (sfrac === 0) {
    const vbyte = Math.round(vfrac * 255);
    return { r: vbyte, g: vbyte, b: vbyte };
  }

  const hdb60 = (obj.h % 360) / 60;
  const sector = Math.floor(hdb60);
  const fpart = hdb60 - sector;
  const c = vfrac * (1 - sfrac);
  const x1 = vfrac * (1 - sfrac * fpart);
  const x2 = vfrac * (1 - sfrac * (1 - fpart));
  switch (sector) {
    case 0:
      r = vfrac;
      g = x2;
      b = c;
      break;
    case 1:
      r = x1;
      g = vfrac;
      b = c;
      break;
    case 2:
      r = c;
      g = vfrac;
      b = x2;
      break;
    case 3:
      r = c;
      g = x1;
      b = vfrac;
      break;
    case 4:
      r = x2;
      g = c;
      b = vfrac;
      break;
    case 5:
    default:
      r = vfrac;
      g = c;
      b = x1;
      break;
  }
  return { r: Math.round(255 * r), g: Math.round(255 * g), b: Math.round(255 * b) };
}

/**
 * RGB(W) colour light (Vera category 2, subcategory 4) when `includeRGB` is set.
 */
function configure(platform, accessory, plan) {
  const { Service, Characteristic, client, log } = platform;
  const device = plan.device;

  platform.configureInformation(accessory, {
    manufacturer: device.manufacturer,
    model: device.model,
    serialNumber: `Vera ID: ${device.id}`,
  });
  bindIdentify(accessory, log, `colour light ${device.name}`);

  const service = platform.getService(accessory, Service.Lightbulb, device.name);

  const fromHSV = (hue, saturation, brightness) =>
    device.isRGBW
      ? hsv2rgbw({ h: hue, s: saturation, v: brightness })
      : hsv2rgb({ h: hue, s: saturation, v: brightness });

  const toHSV = (color) => (device.isRGBW ? rgbw2hsv(color) : rgb2hsv(color));

  const getOnState = () => Boolean(client.getVariable(device.id, 'status', 'number'));

  const setOnState = async (state) => {
    await client.executeAction({
      action: 'SetLoadLevelTarget',
      serviceId: DIMMING_SERVICE,
      newLoadlevelTarget: state ? 100 : 0,
      DeviceNum: device.id,
    });
    return state;
  };

  const getColor = async () => {
    const body = await client.variableGet(device.id, COLOR_SERVICE, 'CurrentColor');
    const colorMap = ['W', 'D', 'R', 'G', 'B'];
    const color = {};
    if (!body) {
      return { r: 0, g: 0, b: 0, w: 0 };
    }
    body.split(',').forEach((entry) => {
      const channelMatch = entry.match(/^(\d)=/);
      const valueMatch = entry.match(/=(\d+)/);
      if (!channelMatch || !valueMatch) {
        return;
      }
      const channel = colorMap[channelMatch[1]].toLowerCase();
      color[channel] = parseInt(valueMatch[1], 10);
    });
    return color;
  };

  const setColor = async (color) => {
    const newColorTarget = JSON.stringify(color)
      .replace(/"|:|{|}/g, '')
      .toUpperCase();
    await client.executeAction({
      action: 'SetColor',
      serviceId: COLOR_SERVICE,
      DeviceNum: device.id,
      newColorTarget,
    });
  };

  const getBrightness = async () => toHSV(await getColor()).v;
  const getHue = async () => toHSV(await getColor()).h;
  const getSaturation = async () => toHSV(await getColor()).s;

  const setBrightness = async (value) => {
    const saturation = service.getCharacteristic(Characteristic.Saturation).value || 0;
    const hue = service.getCharacteristic(Characteristic.Hue).value || 0;
    await setColor(fromHSV(hue, saturation, value));
    return value;
  };

  const setHue = async (value) => {
    const saturation = service.getCharacteristic(Characteristic.Saturation).value;
    const brightness = service.getCharacteristic(Characteristic.Brightness).value;
    if (isNaN(saturation)) {
      return setHue(value);
    }
    return setColor(fromHSV(value, saturation, brightness));
  };

  service
    .getCharacteristic(Characteristic.On)
    .onGet(() => getOnState())
    .onSet(async (state) => {
      await delay(500);
      if (device.dimming || device.preventRequest) {
        device.preventRequest = false;
        return;
      }
      if (state && platform.config.saveBrightness) {
        const level = service.getCharacteristic(Characteristic.Brightness).value || 100;
        await setBrightness(level);
      } else {
        await setOnState(state);
        device.level = state ? 100 : 0;
      }
    });

  service
    .getCharacteristic(Characteristic.Brightness)
    .onGet(() => getBrightness())
    .onSet(async (value) => {
      if (device.preventRequest) {
        device.preventRequest = false;
        return;
      }
      device.dimming = true;
      setTimeout(() => {
        device.dimming = false;
      }, 3000);
      await setBrightness(value);
    });

  service
    .getCharacteristic(Characteristic.Hue)
    .onGet(() => getHue())
    .onSet(async (value) => {
      device.dimming = true;
      setTimeout(() => {
        device.dimming = false;
      }, 3000);
      await delay(100);
      await setHue(value);
    });

  service
    .getCharacteristic(Characteristic.Saturation)
    .onGet(() => getSaturation())
    .onSet(async () => {
      // Saturation is applied together with hue/brightness; nothing to send here.
    });

  // Determine whether the fixture has a dedicated white channel.
  client
    .variableGet(device.id, COLOR_SERVICE, 'SupportedColors')
    .then((response) => {
      device.isRGBW = Boolean(response && response.match(/W/));
    })
    .catch((err) => log.debug(`Could not read SupportedColors for ${device.name}: ${err.message}`));

  platform.pollCharacteristics(device, [
    { vera: 'level', ios: Characteristic.Brightness, type: 'number', service },
    { vera: 'status', ios: Characteristic.On, type: 'boolean', service },
  ]);
}

module.exports = { configure };
