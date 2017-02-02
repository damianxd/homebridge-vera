# VeraLink

VeraLink is an application for Z-Wave accessories from Vera to run as HomeKit Accessory Servers, allowing the devices to connect to iOS devices and be controlled by Siri.

This application use HAP-NodeJS (https://github.com/KhaosT/HAP-NodeJS) to create the HAP servers while connecting to the Luup Requests service from Vera to control the devices.

Installation
===
VeraLink requires the following libraries and applications to run:
- **nodejs**
- **npm**
- **git-core**
- **libnss-mdns**
- **libavahi-compat-libdnssd-dev**

In Ubuntu/Debian system you can install the requirements with the following:

`sudo apt-get update`

`sudo apt-get install nodejs npm git-core libnss-mdns libavahi-compat-libdnssd-dev`

`sudo npm config set registry http://registry.npmjs.org/ `

`sudo npm install -g node-gyp`

Once all the libraries are set, you can download the actual program:

**For Standalone version:**

`npm install homebridge-vera`

**For homebridge version:**

`npm install -g homebridge`

`npm install -g homebridge-vera`

Starting the APP
===
**For Standalone version:**

Execute with:

`node VeraLink.js`

The first run will prompt you with some variables about your Vera device to generate the proper config.js file

**For homebridge version:**

Edit your homebridge config.json file located on **~/.homebridge/config.json** and add the platform for Vera, example:

````
{
    "bridge": {
        "name": "Homebridge",
        "pin": "987-65-432",
        "username": "CC:22:3D:E3:CE:30"
    },
    "platforms": [
        {
            "platform": "Vera",
            "name": "Vera",
            "veraIP": "10.0.1.5",
            "includesensor": false,
            "ignorerooms": [20,21,22],
            "securitypoll": 2000,
            "includethermostat": false,
            "includeRGB": false,
            "garageLock": [23]
        }
    ]
}
````

then you can run the app with the following command:

`homebridge`

Run it on the background
===
If you want to use it as a service, you can run it with **forever**
`https://github.com/foreverjs/forever`

Options
===
You can change all the current options on the **config.js** file and it include:
- veraIP: The current Vera IP for your Vera device
- happort: The starting port of HAP, the program will increase this number for each device to make each individual server
- cardinality: This variable is to change all the names of the devices at the same time, this will make iOS forget them
- bridged: It will turn on or off the room bridged mode, if it set to off, each device will be individually broadcast
- includesensor: Allow the use temp sensor as devices.
- pincode: The global pincode for all the devices, keep the format ###-##-### and use complex numbers, eg 111-11-111 or 123-45-678 are invalid
- securitypoll: Time in milliseconds to poll security sensors to get most recent state (live updates)
- garageLock: Add support for MiOS Garage App (https://apps.mios.com/plugin.php?id=2998) which operates under the hood as a lock, but appears as a garage door in HomeKit.

Recomendation
===
Use [**Insteon+** app](https://itunes.apple.com/us/app/insteon+/id919270334?mt=8) to add sections, rooms and devices; you can also edit the Siri name of each device with it so it can be easier to trigger any accessory with a voice command.

Debug
===
VeraLink and The HAP-NodeJS library support the debug library for log output. You can print some or all logs by setting the DEBUG environment variable.
For instance, to see all debug logs while running the server:

`DEBUG=* node VeraLink.js`

Notes
===
Special thanks to Albeebe for all his work and his original idea to get Vera to work with HAP, [Alex Skalozub](https://twitter.com/pieceofsummer) who reverse engineered the server side HAP and the biggest of thanks to [Khaos Tian](http://tz.is) who made the awesome HAP-NodeJS implementation.

Known issues
===
- Currently dimmer lights are not working with this version of the app because I don't have one to test, I will be releasing a new version with it shortly, but it will be untested.
- You can change the password on the config.js file, but you can't use simple passwords like 111-11-1111 or 123-45-678
- Sometimes it takes a long time to load the prompt that ask for the password of the device, please DON'T close the device adding screen during that time or the device will no longer work, to reset all, just change the **cardinality** setting on the **config.js** file.
- A lot of other bugs may happen, so please try to debug the application and post your log on the [issues tab](https://github.com/damianxd/VeraLink/issues)
- The status is a problem right now, because I know how to get the data from the Vera API but the real problem is the HAP-Nodejs part because I'm using the get callback, but it isn't being trigger when the homekit ask for a status change. Maybe I'm missing something on the documentation, so for now this script is remembering only its own action and not seeing what you manually do with the actual switch. I will try to fix this on a next release.
