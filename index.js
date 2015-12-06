var config          = require('./config.js');

var Accessory = require(config.mainHNpath+'/lib/Accessory.js').Accessory;
var Bridge = require(config.mainHNpath+'/lib/Bridge.js').Bridge;
var Service = require(config.mainHNpath+'/lib/Service.js').Service;
var Characteristic = require(config.mainHNpath+'/lib/Characteristic.js').Characteristic;
var uuid = require(config.mainHNpath+'/lib/util/uuid');
var AccessoryLoader = require(config.mainHNpath+'/lib/AccessoryLoader.js');
var storage = require(config.mainHNpath+'/node_modules/node-persist/node-persist.js');

// ensure Characteristic subclasses are defined
var HomeKitTypes = require(config.mainHNpath+'/lib/gen/HomeKitTypes');

module.exports = {
  init: init,
  Accessory: Accessory,
  Bridge: Bridge,
  Service: Service,
  Characteristic: Characteristic,
  uuid: uuid,
  AccessoryLoader: AccessoryLoader,
  storage: storage,
  config:config
};

function init(storagePath) {
  // initialize our underlying storage system, passing on the directory if needed
  if (typeof storagePath !== 'undefined')
    storage.initSync({ dir: storagePath });
  else
    storage.initSync(); // use whatever is default
}