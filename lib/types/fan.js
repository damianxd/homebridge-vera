module.exports = function(HAPnode, config, functions)
{
    var Accessory       = HAPnode.Accessory;
    var Service         = HAPnode.Service;
    var Characteristic  = HAPnode.Characteristic;
    var uuid            = HAPnode.uuid;
    var debug           = HAPnode.debug;

    var module  = {};

    module.newDevice = function(device)
    {
        // var VeraController = require("./../vera.js")(HAPnode, config, device);
        var Fan = {
            powerOn: (parseInt(device.status) === 1)?true:false,
            rotationSpeed: 100,
            onproc: false,
            changespeed: false,

            setPowerOn: function(state)
            {
                
                let service = 'urn:upnp-org:serviceId:SwitchPower1',
                    action = 'SetTarget',
                    value = state?1:0;
                
                debug("Fan Power set to %s", value);
                return functions.executeAction({
                  action: action,
                  serviceId: service,
                  newTargetValue: value,
                  DeviceNum: device.id
                }).then(function(response){
                    return state;
                });
                
            },
            setRotationSpeed: function(value)
            {
                // Siri sends 25 for Low, 50 for Mid, and 100 for High
                // On Leviton RZF01 26 is the upper threshold for Low, 66 is the upper threshold of the Mid
                // For safety we'll translate these to 26 for Low, 65 for Mid, and leave 100 for High

                value = Math.floor(value);

                let service = 'urn:upnp-org:serviceId:Dimming1',
                    action = 'SetLoadLevelTarget';

                debug("Rotation Speed set to %s", value);
                if (value < 35) {
                    value = 26;
                } else if (value < 67){
                    value = 65;
                } else{
                    value = 100;
                }
                debug("Converted value to %s", value);

                return functions.executeAction({
                    action: action,
                    serviceId: service,
                    newLoadlevelTarget: value,
                    DeviceNum: device.id
                  }).then(function(response){
                      return value;
                  });
                // if(this.onproc === false)
                // {
                //     this.onproc = true;
                //     this.rotationSpeed = rotationSpeed;
                //     var self = this;

                    // HAPnode.request({method:'GET',uri:"http://"+config.veraIP+":3480/data_request?id=lu_action&output_format=xml&DeviceNum=" + device.id + "&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget=" + this.rotationSpeed, resolveWithFullResponse: true}).then(function (res)
                    // {
                    //     if (res.statusCode === 200)
                    //     {
                    //         debug("The %s rotation speed has been changed to %d%", device.name, rotationSpeed);
                    //     }
                    //     else
                    //     {
                    //         debug("Error while changing %s rotation speed", device.name);
                    //     }
                    //     self.onproc = false;
                    //     if(self.changespeed)
                    //     {
                    //          self.rotationSpeed = self.changespeed;
                    //          self.changespeed = false;
                    //          return self.setRotationSpeed(self.rotationSpeed);
                    //     }
                    // }).catch(function (err) {
                    //     HAPnode.debug("Request error:"+err);
                    // });

                // }
                // else
                // {
                //     this.changespeed = rotationSpeed;
                //     return;
                // }
            },
            getStatus: function()
            {
              debug("Making status request for device %s", device.name);
              var status = functions.getVariable(device.id, 'status', 'number');
              debug("Status is ", status);
              return status;
            },
            getRotationSpeed: function()
            {
                var speed = functions.getVariable(device.id, 'level', 'number');
                return speed;

            },
            identify: function()
            {
                debug("Identify the fan %s", device.name);
            }
        };

        var fanUUID = uuid.generate('device:fan:'+config.cardinality+':'+device.id);

        var fan = new Accessory(device.name, fanUUID);

        fan.username  = functions.genMac('device:'+config.cardinality+':'+device.id);
        fan.pincode   = config.pincode;
        fan.deviceid  = device.id;

        fan
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.Model, device.model)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        fan.on('identify', function(paired, callback) {
            Fan.identify();
            callback(); // success
        });

        fan
            .addService(Service.Fan, device.name)
            .getCharacteristic(Characteristic.On)
            .on('set', function(value, callback) {
                let service = fan.getService(Service.Fan),
                    characteristic = service.getCharacteristic(Characteristic.On);
                
                if(characteristic.value && value)return callback(null);

                characteristic.sending = true;

                Fan
                    .setPowerOn(value)
                    .then( function(value){
                        callback(null);
                    }).finally(function(){
                        // delay reset, as there may already be a check underway
                        setTimeout(function(){ characteristic.sending = false }, 1000)
                    })
            });

        fan
            .getService(Service.Fan)
            .getCharacteristic(Characteristic.On)
            .on('get', function(callback) {
                var err = null;
                callback(err, Fan.getStatus());
                });

        fan
            .getService(Service.Fan)
            .addCharacteristic(Characteristic.RotationSpeed)
            .on('get', function(callback) {
                var err = null;
                callback(err, Fan.getRotationSpeed());
            })
            .on('set', function(value, callback) {
                let service = fan.getService(Service.Fan),
                    characteristic = service.getCharacteristic(Characteristic.RotationSpeed);
                
                characteristic.sending = true;

                Fan
                    .setRotationSpeed(value)
                    .then( function(value){
                        callback(null);
                    }).finally(function(){
                        setTimeout(function(){ characteristic.sending = false }, 1000);
                    })
            });
        
        fan.getService(Service.Fan).getCharacteristic(Characteristic.RotationSpeed).sending = false;
        fan.getService(Service.Fan).getCharacteristic(Characteristic.On).sending = false;

        functions.checkCharacteristics(device, [{
            vera: 'level',
            ios: Characteristic.RotationSpeed,
            type: 'number',
            service: fan.getService(Service.Fan)
            },{
            vera: 'status',
            ios: Characteristic.On,
            type: 'boolean',
            service: fan.getService(Service.Fan)
            }
        ]);

        return fan;

    };

    return module;
};
