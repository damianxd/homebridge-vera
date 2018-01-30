SensorMap = [
  {
    name: 'MotionSensor',
    subcategory: 3,
    category: 4,
    battery: true,
    characteristics: {
        MotionDetected: {
          service: 'urn:micasaverde-com:serviceId:SecuritySensor1',
          getVariable: 'tripped',
          type: 'boolean'
        },
        StatusActive: {
          service: 'urn:micasaverde-com:serviceId:SecuritySensor1',
          getVariable: 'armed',
          type: 'boolean'
        },
        StatusFault: {
          service: 'urn:micasaverde-com:serviceId:SecuritySensor1',
          getVariable: 'commFailure',
          type: 'boolean'
        }
    }
  },
  {
    name: 'ContactSensor',
    subcategory: 1,
    category: 4,
    battery: true,
    characteristics: {
        ContactSensorState: {
          service: 'urn:micasaverde-com:serviceId:SecuritySensor1',
          getVariable: 'tripped',
          type: 'boolean'
        },
        StatusFault: {
          service: 'urn:micasaverde-com:serviceId:SecuritySensor1',
          getVariable: 'commFailure',
          type: 'boolean'
        }
    }
  },
  {
    name: 'HumiditySensor',
    category: 16,
    subcategory: 0,
    battery: true,
    characteristics: {
        CurrentRelativeHumidity: {
          service: 'urn:micasaverde-com:serviceId:HumiditySensor1',
          getVariable: 'humidity'
        }
    }
  },
  {
    name: 'LightSensor',
    category: 18,
    subcategory: 0,
    battery: true,
    characteristics: {
        CurrentAmbientLightLevel: {
          service: 'urn:micasaverde-com:serviceId:LightSensor1',
          getVariable: 'light'
        }
    }
  },
  {
    name: 'CarbonMonoxideSensor',
    category: 4,
    subcategory: 5,
    battery: true,
    characteristics: {
        CarbonMonoxideDetected: {
          service: 'urn:schemas-micasaverde-com:device:SmokeSensor:1',
          getVariable: 'armedtripped'
        }
    }
  },
  {
    name: 'SmokeSensor',
    category: 4,
    subcategory: 4,
    battery: true,
    characteristics: {
        SmokeDetected: {
          service: 'urn:schemas-micasaverde-com:device:SmokeSensor:1',
          getVariable: 'armedtripped',
          type: 'boolean'
        }
    }
  },
  {
    name: 'ContactSensor',
    subcategory: 6,
    category: 4,
    battery: true,
    characteristics: {
        ContactSensorState: {
          service: 'urn:micasaverde-com:serviceId:SecuritySensor1',
          getVariable: 'armedtripped',
          type: 'boolean'
        },
        StatusActive: {
          service: 'urn:micasaverde-com:serviceId:SecuritySensor1',
          getVariable: 'armed',
          type: 'boolean'
        },
        StatusFault: {
          service: 'urn:micasaverde-com:serviceId:SecuritySensor1',
          getVariable: 'commFailure',
          type: 'boolean'
        }
    }
  }
];

module.exports = function (HAPnode, config, functions) {
    var Accessory = HAPnode.Accessory,
        Service = HAPnode.Service,
        Characteristic = HAPnode.Characteristic,
        uuid = HAPnode.uuid,
        debug = HAPnode.debug,
        module = {};

    return function (device) {
        var hapuuid = uuid.generate('device:sensor:' + config.cardinality + ':' + device.id),
            accessory = new Accessory(device.name, hapuuid),
            serviceMap = SensorMap.find(function(service, index){
              return (service.category == device.category)&&(service.subcategory == device.subcategory);
            }),
            service = serviceMap && new Service[serviceMap.name](device.name);
        if (!service){
          return false;
        }
        accessory.username = functions.genMac('device:' + config.cardinality + ':' + device.id);
        accessory.deviceid = device.id;

        accessory
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, device.manufacturer)
            .setCharacteristic(Characteristic.Model, device.model)
            .setCharacteristic(Characteristic.SerialNumber, "Vera ID: "+device.id);

        Object.keys(serviceMap.characteristics).forEach(function(key){

          var map = serviceMap.characteristics[key],
              characteristic = Characteristic[key];

          // is Characteristic read-write?
          if(map.setMethod){
            service
              .getCharacetristic(characteristic)
              .on('set', function(value, callback){
                var request = {
                  action: map.setMethod,
                  serviceId: map.service,
                  DeviceNum: device.id
                };
                request[setVariable] = value;
                functions
                  .executeAction(request)
                  .then(function(response){
                    debug("Armed set");
                    debug(response);
                    callback(response);
                  })
              });
          }

          service
            .getCharacteristic(Characteristic[key])
            .on('get', function(callback){
              var value = parseInt(functions.getVariable(device.id, map.getVariable));
              if(map.type == 'boolean'){
                value = Boolean(value);
                value = Number(value);
              }
              callback(null, value);
            });

          // Update Loop, regular polling for updates.
          setInterval(function() {
            var value = parseInt(functions.getVariable(device.id, map.getVariable));
            if(map.type == 'boolean'){
              value = Boolean(value);
              value = Number(value);
            }
            if (value !== service.getCharacteristic(characteristic).value){
              service.setCharacteristic(characteristic,value);
            }
          }, 1000);

        });

        accessory.addService(service);

        accessory.on('identify', function (paired, callback) {
            debug("Identity of the sensor is %s", device.name);
            callback(); // success
          });

        if(serviceMap.battery){
          var batteryService = new Service.BatteryService(device.name);
          var batteryid = (device.parent>1)?device.parent:device.id;
          batteryService
              .getCharacteristic(Characteristic.BatteryLevel)
              .on('get', function (callback) {
                  debug('Getting battery level for', device.name);
                  callback(null, parseInt(functions.getVariable(batteryid, 'batterylevel')));
              });
          batteryService
              .getCharacteristic(Characteristic.StatusLowBattery)
              .on('get', function (callback) {
                  callback(null, functions.getVariable(batteryid, 'batterylevel') < 20);
              });
          accessory.addService(batteryService);
        }

        return accessory;
    };
};
