# VeraLink 
 
VeraLink is an application for Z-Wave accessories from Vera to run as HomeKit Accessory Servers, allowing the devices to connect to iOS devices and be controlled by Siri. 
 
This application use HAP-NodeJS (https://github.com/KhaosT/HAP-NodeJS) to create the HAP servers while connecting to the Luup Requests service from Vera to control the devices. 
 
Installation 
=== 
VeraLink requires the following libraries and applications to run: 
- `nodejs` 
- `npm` 
- `git-core` 
- `libnss-mdns` 
- `libavahi-compat-libdnssd-dev` 
 
In Ubuntu/Debian system you can install the requirements with the following: 
`sudo apt-get update`
 
```sudo apt-get install nodejs npm git-core libnss-mdns libavahi-compat-libdnssd-dev`
 
`sudo npm config set registry http://registry.npmjs.org/ `
 
`sudo npm install -g node-gyp`
 
Once all the libraries are set, you can download the actual program with: 
`git clone https://github.com/damianxd/VeraLink`
 
Next you need to get all the node dependencies with: 
`cd Veralink` 
 
`npm install`
 
Edit your `config.js` file with your own configuration, at first try just set the VeraIP and then go for the rest of the settings 
 
Finally, you can start the app with this command: 
```node VeraLink.js 
``` 
 
Run it on the background 
=== 
If you want to use it as a service, you can run it with `forever` 
`https://github.com/foreverjs/forever`
 
Debug 
=== 
VeraLink and The HAP-NodeJS library support the debug library for log output. You can print some or all logs by setting the DEBUG environment variable. 
For instance, to see all debug logs while running the server: 
`DEBUG=* node BridgedCore.js`
 
Debug 
=== 
Special thanks to Albeebe for all his work and his original idea to get Vera to work with HAP and [Alex Skalozub](https://twitter.com/pieceofsummer) who reverse engineered the server side HAP. 
 
Known issues 
=== 
- Currently dimmer lights are not working with this version of the app because I don't have one to test, I will be releasing a new version with it shortly, but it will be untested. 
- You can change the password on the config.js file, but you can't use simple passwords like 111-11-1111 or 123-45-678 
- Sometimes it takes a long time to load the prompt that ask for the password of the device, please DON'T close the device adding screen during that time or the device will no longer work, to reset all, just change the `cardinality` setting on the `config.js` file. 
- A lot of other bug may happen, so please try to debug the application and post your log on the [issues tab](https://github.com/damianxd/VeraLink/issues) 
 
Donations 
=== 
I don't have all the possible device types HAP support, like dimmer lights, so I can't fully test every accessory file of this program. You can help me out buying those with your donation. 
https://pledgie.com/campaigns/30716