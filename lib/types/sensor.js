var inherits = require('util').inherits;
var DeviceMap = require('../device-map');
var Armed;

module.exports = function (HAPnode, config, functions) {
    var Accessory = HAPnode.Accessory;
    var Service = HAPnode.Service;
    var Characteristic = HAPnode.Characteristic;
    var uuid = HAPnode.uuid;
    var debug = HAPnode.debug;

    var module = {};

    module.newDevice = function (device) {

        var hapuuid = uuid.generate('device:sensor:' + config.cardinality + ':' + device.id),
            accessory = new Accessory(device.name, hapuuid),
            serviceMap = DeviceMap.find(function(service, index){
              console.log(service.name);
              return (service.category == device.category)&&(service.subcategory == device.subcategory);
            }),
            service = new Service[serviceMap.name](device.name);

        accessory.username = functions.genMac('device:' + config.cardinality + ':' + device.id);
        accessory.deviceid = device.id;

        Object.keys(serviceMap.characteristics).forEach(function(key){
          var map = serviceMap.characteristics[key],
          characteristic = Characteristic[key];
          // is characteristic read-write?
          if(map.setMethod){
            service.getCharacetristic(characteristic)
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
          service.getCharacteristic(Characteristic[key])
            .on('get', function(callback){
              var value = parseInt(functions.getVariable(device.id, map.getVariable));
              if(map.type == 'boolean'){
                value = Boolean(value);
              }
              callback(null, value);
            });

          // Update Loop, regular polling for updates.
          setInterval(function() {
            var value = parseInt(functions.getVariable(device.id, map.getVariable));
            if(map.type == 'boolean'){
              value = Boolean(value);
            }
            if (value !== service.getCharacteristic(characteristic)){
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

    return module;
};
