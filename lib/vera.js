module.exports = function(HAPnode,config,device){
  var debug = HAPnode.debug;
  var module = {};

    module.device_url = function(request_type){
        host = 'http://'+config.veraIP+'/port_3480/data_request'
        return host+'?id='+request_type+'&DeviceNum='+device.id
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

  return module;
}
