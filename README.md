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
 
Once all the libraries are set, you can download the actual program with:

`git clone https://github.com/damianxd/VeraLink`
 
Next you need to get all the node dependencies with:

`cd Veralink` 
 
`npm install`
 
Edit your **config.js** file with your own configuration, at first try just set the VeraIP and then go for the rest of the settings 
 
Finally, you can start the app with this command:
 
`node VeraLink.js`
 
Run it on the background 
=== 
If you want to use it as a service, you can run it with **forever**
`https://github.com/foreverjs/forever`

Options
===
You can change all the current options on the **config.js** file and it include:
- VeraIP: The current Vera IP for your Vera device
- happort: The starting port of HAP, the program will increase this number for each device to make each individual server
- cardinality: This variable is to change all the names of the devices at the same time, this will for iOS to forget them
- bridged: It will turn on or off the room bridged mode, if it set to off, each device will be individually broadcast
- includesensor: Allow the use temp sensor as devices.
- pincode: The global pincode for all the devices, keep the format ###-##-### and use complex numbers, eg 111-11-111 or 123-45-678 are invalid


Recomendation
===
Use [**Insteon+** app](https://itunes.apple.com/us/app/insteon+/id919270334?mt=8), you can edit the Siri name of each device with it so it can be easier to trigger any accessory with a voice command.

Debug 
=== 
VeraLink and The HAP-NodeJS library support the debug library for log output. You can print some or all logs by setting the DEBUG environment variable. 
For instance, to see all debug logs while running the server: 
`DEBUG=* node BridgedCore.js`
 
Notes 
=== 
Special thanks to Albeebe for all his work and his original idea to get Vera to work with HAP, [Alex Skalozub](https://twitter.com/pieceofsummer) who reverse engineered the server side HAP and the biggest of thanks to [Khaos Tian](http://tz.is) who made the awesome HAP-NodeJS implementation.
 
Known issues 
=== 
- Currently dimmer lights are not working with this version of the app because I don't have one to test, I will be releasing a new version with it shortly, but it will be untested. 
- You can change the password on the config.js file, but you can't use simple passwords like 111-11-1111 or 123-45-678 
- Sometimes it takes a long time to load the prompt that ask for the password of the device, please DON'T close the device adding screen during that time or the device will no longer work, to reset all, just change the **cardinality** setting on the **config.js** file. 
- A lot of other bug may happen, so please try to debug the application and post your log on the [issues tab](https://github.com/damianxd/VeraLink/issues) 
- The status is a problem right now, because I know how to get the data from the Vera API but the real problem is the HAP-Nodejs part because I'm using the get callback, but it isn't being trigger when the homekit ask for a status change. Maybe I'm missing something on the documentation, so for now this script is remembering only its own action and not seeing what you manually do with the actual switch. I will try to fix this on a next release.
- I forgot to change the description on each device to be the name of the Vera accessory, so all the items will be called the same for Siri. It wasn't intended to be like that, so I will fix that sometime today, but for now, you should use "Insteon+" and use the "Edit device" option, there you can change the name Siri use to control each item. The name need to be all in lowercase and write it exactly like you would tell Siri to start it, like if you would say "Turn on the [b]small office[/b] light".


Donations 
=== 
I don't have all the possible device types HAP support, like dimmer lights, so I can't fully test every accessory file of this program. You can help me out buying those with your donation. 
https://pledgie.com/campaigns/30716