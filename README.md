# Looking for adoption

We are searching for some developer who's willing to take this project. None of the original developers is active any more, if you want to be in charge, please contact me thru the issues section.

# homebridge-vera

[![homebridge](https://img.shields.io/badge/homebridge-v1.8%20%7C%20v2-blue)](https://homebridge.io)
[![node](https://img.shields.io/badge/node-20%20%7C%2022%20%7C%2024-brightgreen)](https://nodejs.org)

A [Homebridge](https://homebridge.io) platform plugin that exposes
[Vera](https://getvera.com) (MiOS / Ezlo) Z-Wave devices and scenes to HomeKit,
so they can be controlled from the Home app and Siri.

It talks to the controller's local Luup `data_request` HTTP API — no cloud
account is required.

## Requirements

- Homebridge `>= 1.8` (including Homebridge v2)
- Node.js `20`, `22`, or `24`
- A Vera/MiOS controller reachable on your local network

## Installation

Install through the **Homebridge UI** (search for `homebridge-vera`) or from the
command line:

```sh
npm install -g homebridge-vera
```

## Configuration

Add a platform block to your Homebridge `config.json`, or configure it through
the Homebridge UI (a settings form is provided via `config.schema.json`):

```json
{
  "platforms": [
    {
      "platform": "Vera",
      "name": "Vera",
      "veraIP": "10.0.1.5",
      "pollInterval": 2000,
      "includesensor": true,
      "includethermostat": true,
      "includeRGB": true,
      "houseModes": false,
      "ignorerooms": [],
      "ignoredevices": [34, 47],
      "ignorescenes": [2, 3],
      "ignoreplugins": ["Nest", "PhilipsHue", "Wemo"],
      "garageLocks": [23]
    }
  ]
}
```

### Options

| Option              | Type       | Default | Description                                                                 |
| ------------------- | ---------- | ------- | --------------------------------------------------------------------------- |
| `platform`          | string     | —       | Must be `"Vera"`.                                                            |
| `name`              | string     | `Vera`  | Name shown in the Homebridge log.                                            |
| `veraIP`            | string     | —       | **Required.** IP address or hostname of the Vera controller.                |
| `pollInterval`      | number     | `2000`  | How often (ms) to poll the controller for live device state.                |
| `includesensor`     | boolean    | `false` | Expose motion, contact, light, humidity, smoke, CO and temperature sensors. |
| `includethermostat` | boolean    | `false` | Expose thermostats.                                                         |
| `includeRGB`        | boolean    | `false` | Expose RGB(W) colour lights.                                                |
| `saveBrightness`    | boolean    | `false` | Restore the last brightness when a colour light is switched on.             |
| `houseModes`        | boolean    | `false` | Expose Vera house modes as a HomeKit Security System.                        |
| `ignorerooms`       | number[]   | `[]`    | Room IDs whose devices should be skipped.                                    |
| `ignoredevices`     | number[]   | `[]`    | Device IDs to skip.                                                         |
| `ignorescenes`      | number[]   | `[]`    | Scene IDs to skip.                                                         |
| `ignoreplugins`     | string[]   | `[]`    | Skip devices whose device type or altid contains any of these strings.      |
| `garageLocks`       | number[]   | `[]`    | Lock device IDs that should appear as garage doors in HomeKit.              |

> House modes map HomeKit's four security states (Stay / Away / Night / Disarm)
> onto Vera's Home / Away / Night modes. This is not a perfect 1:1 mapping.

## Supported devices

| Vera category            | HomeKit accessory                          |
| ------------------------ | ------------------------------------------ |
| Dimmable light           | Lightbulb (brightness), or Fan / Colour light |
| Switch                   | Switch                                     |
| Door lock                | Lock (or Garage door via `garageLocks`)    |
| Garage door              | Garage door opener                         |
| Window covering          | Window covering (position)                 |
| Thermostat               | Thermostat + Battery                       |
| Security / light / humidity / smoke / CO sensors | Matching HomeKit sensor + Battery |
| Temperature sensor       | Temperature sensor                         |
| Scene                    | Stateless switch                           |
| House modes              | Security system                            |

## How it works

The plugin is a Homebridge **dynamic platform**. On launch it reads the
controller inventory (`user_data` + `lu_sdata`), creates/updates/removes cached
HomeKit accessories accordingly, and then polls `sdata` on `pollInterval` to keep
HomeKit in sync with changes made elsewhere (wall switches, the Vera app, etc.).

## Development

```sh
npm install      # install dev dependencies
npm run lint     # ESLint (flat config)
npm test         # mocked unit/smoke tests (node:test)
```

The source lives in `src/`:

- `src/platform.js` — dynamic platform: discovery, accessory caching, polling.
- `src/vera-client.js` — Vera HTTP client, status cache and value translation.
- `src/accessories/*.js` — one configurator per HomeKit accessory type.

## Credits

Originally created by Damian Alarcon as **VeraLink**, building on the work of
Albeebe, [Alex Skalozub](https://twitter.com/pieceofsummer) and
[Khaos Tian](https://github.com/KhaosT) (HAP-NodeJS).

## License

ISC — see [LICENSE](LICENSE).
