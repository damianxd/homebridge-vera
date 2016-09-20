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
                    if(config.ignoredevices.indexOf(accessory.deviceid) >= 0)
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
            returnlist = [];
            accessories.forEach(function(accessory)
            {
                if(typeof config.ignoredevices !== 'undefined' && config.ignoredevices && config.ignoredevices.constructor === Array)
                {
                    if(config.ignoredevices.indexOf(accessory.deviceid) >= 0)
                    {
                        console.log("Ignore Device "+accessory.deviceid+": "+ accessory.displayName);
                        return;
                    }
                }
                
                console.log("Process Device "+accessory.deviceid+": "+ accessory.displayName);
                returnlist.push(accessory);
            });
            
            return returnlist;
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
                            if(config.ignoredevices.indexOf(accessory.deviceid) >= 0)
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
        var category;
        
        list.forEach(function(device)
        {
            category = device.category;

            // Override category?
            if(typeof config.Fans !== 'undefined' && config.Fans && config.Fans.constructor === Array)
            {
                if(config.Fans.indexOf(device.id) >= 0)
                {
                    HAPnode.debug('------ Overriding device category to Fan: %s', device.name + ' ID:' +device.id);
                    category = 10000; // Fan
                }
            }
            if(typeof config.Outlets !== 'undefined' && config.Outlets && config.Outlets.constructor === Array)
            {
                if(config.Outlets.indexOf(device.id) >= 0)
                {
                    HAPnode.debug('------ Overriding device category to Outlet: %s', device.name + ' ID:' +device.id);
                    category = 10001; // Outlet
                }
            }
            
            
            switch (category)
            {
                case 2: // Dimmable Light
                        var DimmableLight    = require("./types/dimmer.js")(HAPnode,config,module);
                        accessories.push(DimmableLight.newDevice(device));
                        HAPnode.debug('------ Dimmer Light Added: %s', device.name + ' ID:' +device.id);
                    break;

                case 3: // Light Switch
                        var Switch          = require("./types/switch.js")(HAPnode,config,module);
                        accessories.push(Switch.newDevice(device));
                        HAPnode.debug('------ Light Switch Added: %s', device.name + ' ID:' +device.id);
                    break;

                case 4: // Security Sensor
                        if(config.includesensor)
                        {
                            var SecuritySensor = require("./types/securitysense.js")(HAPnode,config,module);
                            accessories.push(SecuritySensor.newDevice(device));
                            HAPnode.debug('------ Security Sensor Added: %s', device.name + ' ID:' +device.id);
                        }
                    break;

                case 7: // Door Lock
                        var Lock            = require("./types/lock.js")(HAPnode,config,module);
                        accessories.push(Lock.newDevice(device));
                        HAPnode.debug('------ Lock Added: %s', device.name + ' ID:' +device.id);
                    break;

                case 17: // Temp Sensor
                        if(config.includesensor)
                        {
                            var Tempsense       = require("./types/tempsense.js")(HAPnode,config,module);
                            accessories.push(Tempsense.newDevice(device));
                            HAPnode.debug('------ Temp Sensor Added: %s', device.name + ' ID:' +device.id);
                        }
                    break;

                case 10000: // Fan
                        var Fan = require("./types/fan.js")(HAPnode,config,module);
                        HAPnode.debug('------ Fan Added: %s', device.name + ' ID:' +device.id);
                        accessories.push(Fan.newDevice(device));
                    break;

                case 10001: // Outlet
                        var Outlet = require("./types/outlet.js")(HAPnode,config,module);
                        HAPnode.debug('------ Outlet Added: %s', device.name + ' ID:' +device.id);
                        accessories.push(Outlet.newDevice(device));
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
