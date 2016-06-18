module.exports = function(HAPnode, config)
{
    var module  = {};

    module.getVeraInfo = function()
    {
        var url = "http://" + config.veraIP + ":3480/data_request?id=lu_sdata";
        res = HAPnode.request('GET', url, {json:true});
        HAPnode.debug('Using url: '+url);
        data = JSON.parse(res.body.toString('utf8'));
        devices = {};
        
        if(typeof data === 'object')
        {
            
            data.devices.forEach(function(device)
            {
                if(typeof devices[device.room] ==='undefined')
                {
                    devices[device.room] = [];
                }
                
                devices[device.room].push(device);
            });

            return {'rooms': data.rooms,'devices_by_room': devices, 'devices_full_list': data.devices};
        }
        else
        {
            return null;
        }
    };
    
    module.processall = function(verainfo)
    {
        accessories = module.processdevices(verainfo.devices_full_list, verainfo);
        
        if(typeof HAPnode.return === 'undefined')
        {
            accessories.forEach(function(accessory)
            {
                if(typeof config.ignoredevices !== 'undefined' && config.ignoredevices && config.ignoredevices.constructor === Array)
                {
                    if(config.ignoredevices.indexOf(accessory.deviceid) > 0)
                    {
                        HAPnode.debug("Ignore Device "+accessory.deviceid+"-"+ accessory.displayName);
                        return;
                    }
                }
                
                var Port = config.happort + 100 +(accessory.deviceid*2);

                accessory.publish({
                    port: Port,
                    username: accessory.username,
                    pincode: accessory.pincode
                });
            });
        }
        else
        {
            return accessories;
        }
    };

    module.processrooms = function(verainfo)
    {
        verainfo.rooms.forEach(function(room)
        {
            if(typeof config.ignorerooms !== 'undefined' && config.ignorerooms && config.ignorerooms.constructor === Array)
            {
                if(typeof config.ignorerooms[room.id] !== 'undefined')
                {
                    HAPnode.debug("Ignore Room "+room.id+"-"+room.name);
                    return;
                }
            }
            
            // Start by creating our Bridge which will host all loaded Accessories
            var bridge = new HAPnode.Bridge(room.name, HAPnode.uuid.generate(room.name));

            // Listen for bridge identification event
            bridge.on('identify', function(paired, callback)
            {
                HAPnode.debug("Node Bridge identify");
                callback(); // success
            });

            HAPnode.debug('Start room: %s', room.name);
            if(typeof verainfo.devices_by_room[room.id] !== "undefined")
            {
                accessories = module.processdevices(verainfo.devices_by_room[room.id], verainfo);
            }

            if(typeof accessories === "object")
            {
                // Add them all to the bridge
                accessories.forEach(function(accessory)
                {
                    if(typeof accessory === 'object')
                    {
                        if(typeof config.ignoredevices !== 'undefined' && config.ignoredevices && config.ignoredevices.constructor === Array)
                        {
                            if(config.ignoredevices.indexOf(accessory.deviceid) > 0)
                            {
                                HAPnode.debug("Ignore Device "+accessory.deviceid+"-"+ accessory.displayName);
                                return;
                            }
                        }
                        bridge.addBridgedAccessory(accessory);
                    }
                });

                var Port = config.happort + (room.id*2);
                HAPnode.debug('------ Pinconde: %s',config.pincode);
                // Publish the Bridge on the local network.

                bridge.publish({
                  username:     module.genMac('roomID:'+config.cardinality+':'+room.id),
                  port:         Port,
                  pincode:      config.pincode,
                  category:     HAPnode.Accessory.Categories.OTHER
                });
            }
        });
    };
    
    module.processdevices = function(list, verainfo)
    {
        var accessories = [];
        
        list.forEach(function(device)
        {
            switch (device.category)
            {
                case 2: // Dimmable Light: 
                        if(config.dimmertest)
                        {
                            // Specifically looking the word "fan" in the device name, very shaky assumption
                            if (device.name.toLowerCase().includes("fan")){
                                var Fan    = require("./types/fan.js")(HAPnode,config,module);
                                HAPnode.debug('------ Fan Added: %s', device.name + ' ID:' +device.id);
                                accessories.push(Fan.newDevice(device));
                            } else {
                                var DimmableLight    = require("./types/dimmer.js")(HAPnode,config,module);
                                HAPnode.debug('------ Dimmer light Added: %s', device.name + ' ID:' +device.id);
                                accessories.push(DimmableLight.newDevice(device));
                            }
                        }
                    break;

                case 3: // Switch
                        var Switch          = require("./types/switch.js")(HAPnode,config,module);
                        accessories.push(Switch.newDevice(device));
                        HAPnode.debug('------ Switch Added: %s', device.name + ' ID:' +device.id);
                    break;

                case 4: // Security Sensor
                    var SecuritySensor = require("./types/securitysense.js")(HAPnode,config,module);
                    accessories.push(SecuritySensor.newDevice(device));
                    HAPnode.debug('------ Security Sensor Added: %s', device.name + ' ID:' +device.id);
                    break;

                case 7: // Door lock
                        var Lock            = require("./types/lock.js")(HAPnode,config,module);
                        HAPnode.debug('------ Lock Added: %s', device.name + ' ID:' +device.id);
                        accessories.push(Lock.newDevice(device));
                    break;

                case 17: // Temp sensor
                        if(config.includesensor)
                        {
                            var Tempsense       = require("./types/tempsense.js")(HAPnode,config,module);
                            HAPnode.debug('------ Temp sensor Added: %s', device.name + ' ID:' +device.id);
                            accessories.push(Tempsense.newDevice(device));
                        }
                    break;
            }
        });    
            
        
        return accessories;
    };
    
    module.genMac = function genMac(str)
    {
        var hash = HAPnode.hashing('md5').update(str).digest("hex").toUpperCase();
        return hash[0] + hash[1] + ":" +
               hash[2] + hash[3] + ":" +
               hash[4] + hash[5] + ":" +
               hash[6] + hash[7] + ":" +
               hash[8] + hash[9] + ":" +
               hash[10] + hash[11];
    };
    
    return module;
};