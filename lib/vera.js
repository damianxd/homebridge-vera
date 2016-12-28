module.exports = function(HAPnode,config, device){
  var debug = HAPnode.debug;
  var module = {};
  var cache;
  function cacheStatus(){
    HAPnode.request({
        method:'GET',
        uri: 'http://'+config.veraIP+':3480/data_request?id=sdata'
    }).then(function(status){
      cache = JSON.parse(status);
    })
  }

    module.device_url = function(request_type){
        host = 'http://'+config.veraIP+':3480/data_request'
        return host+'?id='+request_type+'&DeviceNum='+device.id
    },
    module.getStatus = function(id, property){
      device = cache.devices.find(function(device, index){
        return device.id === id;
      });
      return device[property];
    },
    module.remoteRequest = function(url, params, callback){
        debug("Requesting: %s", url);
        //HAPnode.request.debug = true
        return HAPnode.request({
            method:'GET',
            uri: url,
            qs: params,
            resolveWithFullResponse: true
        }).then(callback.bind(this)).catch(function(e){
            debug(e.error);
            debug(e.options);
            debug(e.response);
        });
    },

    module.getVariable = function(serviceId, variable, callback){
        var url = this.device_url('variableget');
        var params = {serviceId: serviceId, Variable: variable}
        return this.remoteRequest(url, params, callback);
    },

    module.executeAction = function(params){
        var url = this.device_url('action');
        var callback = function(){};
        return this.remoteRequest(url, params, callback);
    }

  setInterval(function() {

      cacheStatus();

  }, 3000);

  return module;
}
