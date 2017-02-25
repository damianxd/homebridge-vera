var inherits = require('util').inherits;

module.exports = function (HAPnode, config, functions) {
    var Accessory = HAPnode.Accessory;
    var Service = HAPnode.Service;
    var Characteristic = HAPnode.Characteristic;
    var uuid = HAPnode.uuid;
    var debug = HAPnode.debug;

    var module = {};

    module.newDevice = function (device) {
        var VeraController = require("./../vera.js")(HAPnode, config, device);
        var RgbLight = {
            rgbw2hsv: function(obj){
              var r = obj.r,
                  g = obj.g,
                  b = obj.b,
                  w = obj.w,
                  rr = Math.pow(r,2),
                  gg = Math.pow(g,2),
                  bb = Math.pow(b,2);

              // Calculating HUE with raw values
              var ratio = (r - .5*g - .5*b)/Math.sqrt(rr + bb + gg - r*g - r*b - g*b );
              if(g >= b){
                h = Math.acos(ratio) * 180 / Math.PI
              }else{
                h = 360 - Math.acos(ratio) * 180 / Math.PI
              }
              h = parseInt(h);
              // Calculating Value and Saturation with percentages.
              r = r/255, g = g/255, b = b/255, w = w/255;
              v = parseInt(Math.max(r, Math.max(g, Math.max(b,w)))*100);
              s = parseInt((1-(3*Math.min(r, Math.min(g, Math.min(b)))+w)/(r+g+b+w))*100);
              hsv = {
                h: h,
                s: s,
                v: v
              }
              debug("HSV CONVERTED TO: ", hsv);
              return hsv;

            },
            hsv2rgbw: function(obj){
              // This section is modified by the addition of white so that it assumes
              // fully saturated colors, and then scales with white to lower saturation.
              //
              // Next, scale appropriately the pure color by mixing with the white channel.
              // Saturation is defined as "the ratio of colorfulness to brightness" so we will
              // do this by a simple ratio wherein the color values are scaled down by (1-S)
              // while the white LED is placed at S.

              // This will maintain constant brightness because in HSI, R+B+G = I. Thus,
              // S*(R+B+G) = S*I. If we add to this (1-S)*I, where I is the total intensity,
              // the sum intensity stays constant while the ratio of colorfulness to brightness
              // goes down by S linearly relative to total Intensity, which is constant.
                // debug("Transforming: ", obj);
                var r, g, b, w, h = obj.h, s = obj.s / 100, v = obj.v / 100, cos_h, cos_1047_h, rgbw = Array();
                h = h % 360; // cycle h around to 0-360 degrees
                h = 3.14159*h/180; // Convert to radians.
                s = s>0?(s<1?s:1):0; // clamp s and v to interval [0,1]
                v = v>0?(v<1?v:1):0;

                if(h < 2.09439) {
                  cos_h = Math.cos(h);
                  cos_1047_h = Math.cos(1.047196667-h);
                  r = s*255*v/3*(1+cos_h/cos_1047_h);
                  g = s*255*v/3*(1+(1-cos_h/cos_1047_h));
                  b = 0;
                  w = 255*(1-s)*v;
                } else if(h < 4.188787) {
                  h = h - 2.09439;
                  cos_h = Math.cos(h);
                  cos_1047_h = Math.cos(1.047196667-h);
                  g = s*255*v/3*(1+cos_h/cos_1047_h);
                  b = s*255*v/3*(1+(1-cos_h/cos_1047_h));
                  r = 0;
                  w = 255*(1-s)*v;
                } else {
                  h = h - 4.188787;
                  cos_h = Math.cos(h);
                  cos_1047_h = Math.cos(1.047196667-h);
                  b = s*255*v/3*(1+cos_h/cos_1047_h);
                  r = s*255*v/3*(1+(1-cos_h/cos_1047_h));
                  g = 0;
                  w = 255*(1-s)*v;
                }


                return {
                  r: Math.round(r),
                  g: Math.round(g),
                  b: Math.round(b),
                  w: Math.round(w)
                };
            },
            rgb2hsv: function(obj) {
                // RGB: 0-255; H: 0-360, S,V: 0-100
                debug("rgb2hsv: R: %s G: %s B: %s", obj.r, obj.g, obj.b);
                var r = obj.r/255, g = obj.g/255, b = obj.b/255;
                var max, min, d, h, s, v;

                min = Math.min(r, Math.min(g, b));
                max = Math.max(r, Math.max(g, b));

                if (min === max) {
                    // shade of gray
                    return {h: 0, s: 0, v: r * 100};
                }

                var d = (r === min) ? g - b : ((b === min) ? r - g : b - r);
                h = (r === min) ? 3 : ((b === min) ? 1 : 5);
                h = 60 * (h - d/(max - min));
                s = (max - min) / max;
                v = max;
                return {"h": h, "s": s * 100, "v": v * 100};
            },

            hsv2rgb: function(obj) {
                // H: 0-360; S,V: 0-100; RGB: 0-255
                debug("hsv2rgb: h: %s s: %s v: %s", obj.h, obj.s, obj.v);
                var r, g, b;
                var sfrac = obj.s / 100;
                var vfrac = obj.v / 100;

                if(sfrac === 0){
                    var vbyte = Math.round(vfrac*255);
                    return { r: vbyte, g: vbyte, b: vbyte };
                }

                var hdb60 = (obj.h % 360) / 60;
                var sector = Math.floor(hdb60);
                var fpart = hdb60 - sector;
                var c = vfrac * (1 - sfrac);
                var x1 = vfrac * (1 - sfrac * fpart);
                var x2 = vfrac * (1 - sfrac * (1 - fpart));
                switch(sector){
                    case 0:
                        r = vfrac; g = x2;    b = c;      break;
                    case 1:
                        r = x1;    g = vfrac; b = c;      break;
                    case 2:
                        r = c;     g = vfrac; b = x2;     break;
                    case 3:
                        r = c;     g = x1;    b = vfrac;  break;
                    case 4:
                        r = x2;    g = c;     b = vfrac;  break;
                    case 5:
                    default:
                        r = vfrac; g = c;     b = x1;     break;
                }

                return {
                  r: Math.round(255 * r),
                  g: Math.round(255 * g),
                  b: Math.round(255 * b)
                };
            },

            getOnState: function(){
                debug("Making status request for device %s", device.name);
                var status = parseInt(functions.getVariable(device.id, 'status'));
                debug("Status is ", status);
                return status;
                // var serviceId = 'urn:upnp-org:serviceId:Dimming1';
                // var variable = 'LoadLevelStatus';
                // var callback = function (response){
                //     if (response.statusCode === 200){
                //
                //         var vera_state = response;
                //         if (parseInt(vera_state) > 0){
                //             return true;
                //         } else {
                //             return false;
                //         }
                //
                //         debug("State for Lightbulb #%s is %s", device.name, vera_state);
                //     }
                //     else
                //     {
                //         debug("Error while getting 'On' for %s", device.name);
                //         return null;
                //     }
                // }

                return VeraController.getVariable(serviceId, variable, callback);
            },
            setOnState: function(state){
                var serviceId = 'urn:upnp-org:serviceId:Dimming1';
                var action_name = 'SetLoadLevelTarget';
                var action_param = 'newLoadlevelTarget';
                var params = {
                  action: action_name,
                  serviceId: serviceId,
                  DeviceNum: device.id
                };
                value = (state ? 100 : 0);
                params[action_param] = value;
                return functions.executeAction(params);
            },
            getRGB: function(fn){
                if (this.r && this.g && this.b){
                    return fn({ r: this.r, g: this.g, b: this.b })
                }
                return this.getRemoteRGB(fn)
            },
            getColor: function(fn){
                var serviceId = 'urn:micasaverde-com:serviceId:Color1';
                var variable = 'CurrentColor';
                var that = this;
                var r,g,b;
                var url = VeraController.device_url('variableget');
                var params = {serviceId: serviceId, Variable: variable}
                return functions
                    .remoteRequest(url, params)
                    .then(function (response){
                      debug('response was ', response.trim());
                        var map = ['W','D','R','G','B']
                        var body = response.trim();
                        color = {}
                        body.split(",").forEach(function(value){
                          channel = map[value.match(/^(\d)=/)[1]].toLowerCase()
                          value = parseInt(value.match(/=(\d+)/)[1])
                          color[channel] = value;
                        });

                        debug("Color value for Lightbulb", device.name, color);
                        return color;
                });
                // return VeraController.getVariable(serviceId, variable, callback);
            },
            setColor: function(color){
              debug("Setting color using color ", color);
              var serviceId = 'urn:micasaverde-com:serviceId:Color1';
              var action_name = 'SetColor';
              var action_param = 'newColorTarget';
              var params = {
                action: action_name,
                serviceId: serviceId,
                DeviceNum: device.id
              }

              params[action_param] = JSON.stringify(color).replace(/"|:|{|}/g,'').toUpperCase()
              return functions
                .executeAction(params)
                .then(function(response){
                  debug("Light Color set");
                });
            },
            getBrightness: function(){
                var that = this;
                return this.getColor().then(function(color){
                  debug("color we got was:", that.toHSV(color));
                  return that.toHSV(color).v
                })
            },
            fromHSV: function(hue,saturation,brightness){
              if(device.isRGBW){
                return this.hsv2rgbw({h: hue, s: saturation, v: brightness});
              }else{
                return this.hsv2rgb({h: hue, s: saturation, v: brightness});
              }
            },
            toHSV: function(color){
              if(device.isRGBW){
                return this.rgbw2hsv(color);
              }else{
                return this.rgb2hsv(color);
              }
            },
            setBrightness: function(value, service){
                var saturation = service.getCharacteristic(Characteristic.Saturation).value || 0;
                var hue = service.getCharacteristic(Characteristic.Hue).value || 0;
                color = this.fromHSV(hue,saturation,value);
                return this.setColor(color).then(function(color){
                  return value;
                });
            },
            getHue: function(){
                var that = this;
                return this.getColor().then(function(color){
                  return that.toHSV(color).h
                });
            },
            setHue: function(value,service){
                var saturation = service.getCharacteristic(Characteristic.Saturation).value;
                var brightness = service.getCharacteristic(Characteristic.Brightness).value;
                if(isNaN(saturation)){
                  RgbLight.setHue(value, service);
                }else{
                  color = this.fromHSV(value,saturation,brightness);
                  return this.setColor(color);
                }
            },
            getSaturation: function(){
                var that = this;
                return this.getColor().then(function(color){
                  return that.toHSV(color).s
                })
            },
            setSaturation: function(value, service){
                // For Vera we can ignore this, internally the saturation is set
                // but we send all channels in the final call
                var hue = service.getCharacteristic(Characteristic.Hue).value;
                var brightness = service.getCharacteristic(Characteristic.Brightness).value;
                return Promise.resolve(value);
            },
            identify: function () {
              debug("Identity of the RGB Light is %s", device.name, colors);

            }
        };
        function init(){
          var url = VeraController.device_url('variableget');
          functions
              .remoteRequest(url, {
                Variable: 'SupportedColors',
                serviceId: 'urn:micasaverde-com:serviceId:Color1'
              })
              .then(function(response){
                device.isRGBW = Boolean(response.match(/W/));
              });
        }
        var rgbLightUUID = uuid.generate('device:thermostat:' + config.cardinality + ':' + device.id);
        var rgbLight = new Accessory(device.name, rgbLightUUID);
        rgbLight.username = functions.genMac('device:' + config.cardinality + ':' + device.id);
        rgbLight.deviceid = device.id;

        rgbLight.on('identify', function (paired, callback) {
            RgbLight.identify();
            callback(); // success
        });

        rgbLight
            .getService(Service.AccessoryInformation)
            .setCharacteristic(Characteristic.Manufacturer, "Vera")
            .setCharacteristic(Characteristic.Model, "Rev-1")
            .setCharacteristic(Characteristic.SerialNumber, "000-0000");

        var service = new Service.Lightbulb(device.name);



        service.getCharacteristic(Characteristic.On)
            .on('get', function (callback) {
                debug('Getting current "On" state for %s', device.name);
                callback(null, RgbLight.getOnState());
            })
            .on('set', function (state, callback) {
                if(state && device.level){
                  debug('Cancelling PowerOn request after Brightness request.');
                  return callback(null, state);
                }
                if(state){
                  var brightness = service.getCharacteristic(Characteristic.Brightness),
                      level = brightness.value || 100;
                  RgbLight.setBrightness(level, service).then(function(level){
                    state = level ? true:false;
                    callback(null, state);
                  })
                }else{
                  RgbLight.setOnState(state).then(function(state){
                    callback(null, state);
                  })
                }
            });

        service.getCharacteristic(Characteristic.Brightness)
            .on('get', function (callback) {
                debug('Getting "brightness" value for %s', device.name);
                RgbLight.getBrightness().then(function(val){
                    // return our current value
                    debug("brightness was: ", val);
                    callback(null, val);
                });
            })
            .on('set', function (value, callback) {
                debug('Setting "brightness" value for %s', device.name);
                device.level = value;
                RgbLight.setBrightness(value, service).then(function(value){
                  callback(null, value);
                })
            });

        service.getCharacteristic(Characteristic.Hue)
            .on('get', function (callback) {
                debug('Getting "hue" value for %s', device.name);
                RgbLight.getHue().then(function(val){
                    debug("Hue was: ", val);
                    // return our current value
                    callback(null, val);
                });
            })
            .on('set', function (value, callback) {
                debug('Setting "hue" value for %s', device.name);
                RgbLight.setHue(value,service).then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.Saturation)
            .on('get', function (callback) {
                debug('Getting "saturation" value for %s', device.name);

                RgbLight.getSaturation().then(function(val){
                    // return our current value
                    debug("saturation was: ", val);
                    callback(null, val);
                });
            })
            .on('set', function (value, callback) {
                debug('Setting "saturation" value for %s', device.name);
                    // return our current value
                RgbLight.setSaturation(value,service).then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        rgbLight.addService(service);


        init();

        return rgbLight;
    };

    return module;
};
