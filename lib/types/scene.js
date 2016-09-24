module.exports = function(HAPnode, config, functions)
{
    var Accessory       = HAPnode.Accessory;
    var Service         = HAPnode.Service;
    var Characteristic  = HAPnode.Characteristic;
    var uuid            = HAPnode.uuid;
    var debug           = HAPnode.debug;

    var module  = {};
    
    module.newScene = function(scene)
    {
        var Switch = {
            powerOn: (parseInt(scene.active) === 1)?true:false,
            
            setPower: function(on)
            { 
                if (on)
                {
                    Switch.powerOn  = true;
                }
                else
                {
                    Switch.powerOn  = false;
                }
                
                debug("Making request for scene %s", scene.name);

                return HAPnode.request({method:'GET',uri:"http://"+config.veraIP+":3480/data_request?id=action&serviceId=urn:micasaverde-com:serviceId:HomeAutomationGateway1&action=RunScene&SceneNum=" + scene.id, resolveWithFullResponse: true}).then(function (res)
                {
                    if (res.statusCode === 200)
                    {
                        status = (Switch.powerOn)?'On':'Off';
                        debug("The scene %s has been turned %s", scene.name, status);
                    }
                    else
                    {
                        debug("Error while turning the %s on/off %s", scene.name);
                    }
                });
            },
            getStatus: function()
            {
                return Switch.powerOn;
            },
            identify: function()
            {
                debug("Identify the light %s", scene.name);
            }
        };

        var switchac = new Accessory(scene.name, uuid.generate('scene:switch:'+config.cardinality+':'+scene.id));

        switchac.username  = functions.genMac('scene:'+config.cardinality+':'+scene.id);
        switchac.pincode   = config.pincode;
        switchac.deviceid  = scene.id;

        switchac
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Oltica")
            .setCharacteristic(Characteristic.Model, "Rev-1")
            .setCharacteristic(Characteristic.SerialNumber, "A1S2NASF88EW");

        switchac.on('identify', function(paired, callback) {
            Switch.identify();
            callback(); // success
        });

        switchac
            .addService(Service.Switch, scene.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                Switch.setPower(value);
                callback();
            });
            
        switchac
            .getService(Service.Switch)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                callback(null, Switch.getStatus());
            });
          
        return switchac;
    };
    
    return module;
};