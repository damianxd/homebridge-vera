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
        var FakePromise = {
            init: function(value){
                this.value = value;
                return this;
            },
            then: function(Fn){
                return Fn(this.value);
            }
        };
        var RgbLight = {
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

                return { "r": Math.round(255 * r), "g": Math.round(255 * g), "b": Math.round(255 * b) };
            },

            getOnState: function(){
                var serviceId = 'urn:upnp-org:serviceId:Dimming1';
                var variable = 'LoadLevelStatus';
                var callback = function (response){
                    if (response.statusCode === 200){

                        var vera_state = response.body;
                        if (parseInt(vera_state) > 0){
                            return true;
                        } else {
                            return false;
                        }

                        debug("State for Lightbulb #%s is %s", device.name, vera_state);
                    }
                    else
                    {
                        debug("Error while getting 'On' for %s", device.name);
                        return null;
                    }
                }

                return VeraController.getVariable(serviceId, variable, callback);
            },
            setOnState: function(state){
                var serviceId = 'urn:upnp-org:serviceId:Dimming1';
                var action_name = 'SetLoadLevelTarget';
                var action_param = 'newLoadlevelTarget';
                var params = { action: action_name, serviceId: serviceId };
                value = (state ? 100 : 0);
                params[action_param] = value;
                return VeraController.executeAction(params);
            },
            getRGB: function(fn){
                if (this.r && this.g && this.b){
                    return fn({ r: this.r, g: this.g, b: this.b })
                }
                return this.getRemoteRGB(fn)
            },
            getRemoteRGB: function(fn){
                var serviceId = 'urn:micasaverde-com:serviceId:Color1';
                var variable = 'CurrentColor';
                var that = this;
                var r,g,b;
                var callback = function (response){
                    if (response.statusCode === 200){
                        var body = response.body.trim();
                        body.split(",").forEach(function(pair){
                            key_value = pair.trim().split("=");
                            key = key_value[0].trim();
                            value = parseInt(key_value[1].trim());
                            switch(key){
                                case "2":
                                    that.r = value;
                                    break;
                                case "3":
                                    that.g = value;
                                    break;
                                case "4":
                                    that.b = value;
                                    break;
                            }

                        });
                        debug("RGB value for Lightbulb #%s is R:%s G:%s B:%s", device.name, that.r, that.g, that.b);
                        return fn({ r:that.r, g:that.g, b:that.b })
                    }
                    else
                    {
                        debug("Error while getting the RGB value for %s", device.name);
                        return null;
                    }
                }

                return VeraController.getVariable(serviceId, variable, callback);
            },
            setRGB: function(r,g,b){
                var serviceId = 'urn:micasaverde-com:serviceId:Color1';
                var action_name = 'SetColorRGB';
                var action_param = 'newColorRGBTarget';
                var params = { action: action_name, serviceId: serviceId }
                this.r = r;
                this.g = g;
                this.b = b;

                params[action_param] = r+","+g+","+b;
                return VeraController.executeAction(params);
            },
            getBrightness: function(){
                var that = this;
                return this.getRGB(function(rgb){
                    return that.rgb2hsv(rgb).v
                })
            },
            setBrightness: function(value, service){
                var saturation = service.getCharacteristic(Characteristic.Saturation).value;
                var hue = service.getCharacteristic(Characteristic.Hue).value;
                if (hue && saturation){
                    result = this.hsv2rgb({h: hue, s: saturation, v: value});
                    return this.setRGB(result.r, result.g, result.b);
                }else{
                    debug("Hue or Saturation missing. Doing nothing!");
                    return FakePromise.init(value);
                }
            },
            getHue: function(){
                var that = this;
                return this.getRGB(function(rgb){
                    return that.rgb2hsv(rgb).h
                })

            },
            setHue: function(value,service){
                var saturation = service.getCharacteristic(Characteristic.Saturation).value;
                var brightness = service.getCharacteristic(Characteristic.Brightness).value;
                if (brightness && saturation){
                    result = this.hsv2rgb({h: value, s: saturation, v: brightness});
                    return this.setRGB(result.r, result.g, result.b);
                }else{
                    debug("Brightness or Saturation missing. Doing nothing!");
                    return FakePromise.init(value);
                }
            },
            getSaturation: function(){
                var that = this;
                return this.getRGB(function(rgb){
                    return that.rgb2hsv(rgb).s
                })
            },
            setSaturation: function(value){
                var hue = service.getCharacteristic(Characteristic.Hue).value;
                var brightness = service.getCharacteristic(Characteristic.Brightness).value;
                if (brightness && hue){
                    result = this.hsv2rgb({h: hue, s: value, v: brightness});
                    return this.setRGB(result.r, result.g, result.b);
                }else{
                    debug("Brightness or Hue missing. Doing nothing!");
                    return FakePromise.init(value);
                }
            },
            identify: function () {
                debug("Identity of the RGB Light is %s", device.name);
            }
        };

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
                RgbLight.getOnState().then(function(val){
                    // return our current value
                    callback(null, val);
                });
            })
            .on('set', function (value, callback) {
                debug('Setting current "On" state for %s', device.name);
                RgbLight.setOnState(value).then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.Brightness)
            .on('get', function (callback) {
                debug('Getting "brightness" value for %s', device.name);
                RgbLight.getBrightness().then(function(val){
                    // return our current value
                    callback(null, val);
                });
            })
            .on('set', function (value, callback) {
                debug('Setting "brightness" value for %s', device.name);
                res = RgbLight.setBrightness(value, service)
                res.then(function(val){
                    // return our current value
                    callback(null, val);
                });
            });

        service.getCharacteristic(Characteristic.Hue)
            .on('get', function (callback) {
                debug('Getting "hue" value for %s', device.name);
                RgbLight.getHue().then(function(val){
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

        return rgbLight;
    };

    return module;
};
