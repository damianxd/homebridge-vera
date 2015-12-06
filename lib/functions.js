module.exports = function(HAPnode, config)
{
    var module  = {};

    module.getVeraInfo = function()
    {
        var url = "http://" + config.veraIP + ":3480/data_request?id=lu_sdata"
        res = HAPnode.request('GET', url, {json:true});
        
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
        
        accessories.forEach(function(accessory)
        {
            var Port = config.happort + 100 +(accessory.deviceid*2);

            accessory.publish({
                port: Port,
                username: accessory.username,
                pincode: accessory.pincode
            });
        });
    };

    module.processrooms = function(verainfo)
    {
        verainfo.rooms.forEach(function(room)
        {
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
    //                            var DimmableLight   = require("./types/dimmer.js");
    //                            var accessory       = new DimmableLight.initializeWithDevice(config, device);
                    break;

                case 3: // Switch
                        var Switch          = require("./types/switch.js")(HAPnode,config,module);
                        accessories.push(Switch.newDevice(device));
                        HAPnode.debug('------ Switch Added: %s', device.name);
                    break;

                case 7: // Door lock
                        var Lock            = require("./types/lock.js")(HAPnode,config,module);
                        HAPnode.debug('------ Lock Added: %s', device.name);
                        accessories.push(Lock.newDevice(device));
                    break;

                case 4: // Temp sensor
                        if(config.includesensor)
                        {
                            var Tempsense       = require("./types/tempsense.js")(HAPnode,config,module);
                            HAPnode.debug('------ Temp sensor Added: %s', device.name);
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