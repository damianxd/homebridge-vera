/* 
 * VeraLink v0.1
 * Damian Alarcon
 * Dec 2015
 * damian@laerit.dk
 */

var async          = require('async');
var prompt          = require('prompt');
var fs              = require('fs');
var request         = require("request-promise");

async.series([
    function(callback)
    {
        if(!fs.existsSync('./config.js'))
        {
            var listsrooms;
            var lookup = {};
            var roomvar = '';

            schema = {
                properties: {
                  VeraIP: {
                    description: 'IP address for your Vera device',
                    pattern: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
                    message: 'VeraIP must be a valid IP number',
                    required: true,
                    conform: function(value) {
                        url = "http://" + value + ":3480/data_request?id=lu_sdata";
                        try
                        {
                            return request({method:'GET', uri:url, json:true, timeout:1500}).then(function(data){
                                if(typeof data === 'object' && data !== null)
                                {
                                    listsrooms = data.rooms;

                                    return true;
                                }
                                else
                                {
                                    console.log('Your VeraIP ('+value+') has no connection, please check that it is a correct one')
                                    return false;
                                }
                            });
                        }
                        catch (ex)
                        {
                            data = null;
                        }

                        
                    }
                  },
                  happort: {
                    description: 'Port for your Vera device (hit enter to use default)',
                    pattern: /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/,
                    message: 'happort must be a valid port number',
                    default: '6200',
                    required: true
                  },
                  bridged: {
                    description: 'Bridged mode (Set to false to use single server for each device instead of one for each room)',
                    type: 'boolean', 
                    message: 'Enter "true" or "false"',
                    default: 'true',
                    required: true,
                    conform: function(){
                        listsrooms.sort(function(a,b) {return (a.id > b.id) ? 1 : ((b.id > a.id) ? -1 : 0);} );
                            
                        for(var i = 0; i < listsrooms.length;i++)
                        {
                            roomvar += listsrooms[i].id+' - '+listsrooms[i].name+"\n";
                            lookup[listsrooms[i].id] = listsrooms[i];
                        }
                        
                        console.log('Room list: \n'+roomvar);
                        return true;
                    }
                  },
                  Rooms: {
                    description: "List of rooms to ignore, comma separated (default is empty)",
                    default: '',
                    allowEmpty: true,
                    message: 'Only numbers and comma allowed',
                    conform: function(response) {
                        found = [];
                        if(response !== '')
                        {
                            if ( response.match( /^[0-9, ]+$/ ) )
                            {
                                response = response.split(' ').join('');
                                value = response.split(",");
                                for(var i = 0; i < value.length;i++)
                                {
                                    if(typeof lookup[value[i]] !== 'undefined')
                                    {
                                        found.push(value[i]);
                                    }

                                    if(i+1 >= value.length)
                                    {
                                        if(found.length > 0)
                                        {
                                            return true;
                                        }
                                        else
                                        {
                                            console.log('Please check your list of items');
                                            return false;
                                        }
                                    }
                                }
                            }
                            else
                            {
                                return false;
                            }
                        }
                        else
                        {
                            return true;
                        }
                    }
                }
                }
              };

            prompt.start();

            prompt.get(schema, function (err, result)
            {
                console.log('Command-line input received:');
                console.log('\tVeraIP: ' + result.VeraIP);
                console.log('\thapport: ' + result.happort);
                console.log('\tbridged: ' + result.bridged);
                roomarr = '';
                if(result.Rooms.length > 0)
                {
                    found = [];

                    if ( result.Rooms.match( /^[0-9, ]+$/ ) )
                    {
                        result.Rooms = result.Rooms.split(' ').join('');
                        value = result.Rooms.split(",");
                        for(var i = 0; i < value.length;i++)
                        {
                            if(typeof lookup[value[i]]  !== "undefined")
                            {
                                found.push(value[i]);
                            }

                            if(i+1 >= value.length && found.length > 0)
                            {
                                roomarr = found.join(',');
                            }
                        }
                    }
                }
                console.log('\tignorerooms: ' + roomarr);

                data = "module.exports = {\n\tveraIP:  '"+result.VeraIP+"',\n\thapport: "+result.happort+",\n\tcardinality: 0,\n\tbridged: "+result.bridged+",\n\tignorerooms: ["+roomarr+"],\n\tincludesensor: true,\n\tpincode: '031-45-154',\n\tdimmertest: false,\n\tmainHNpath: './node_modules/hap-nodejs'\n};";

                fs.writeFile('./config.js', data, { flag: 'wx' }, function (err) {
                    if (err) throw err;
                    console.log("Configuration saved!");
                    callback();
                });
            });
        }
        else
        {
            callback();
        }
    },
    function(callback){
        callback();
        var config          = require('./config.js');
        var path            = require('path');
        var Accessory       = require(config.mainHNpath+'/lib/Accessory.js').Accessory;
        var Bridge          = require(config.mainHNpath+'/lib/Bridge.js').Bridge;
        var Service         = require(config.mainHNpath+'/lib/Service.js').Service;
        var Characteristic  = require(config.mainHNpath+'/lib/Characteristic.js').Characteristic;
        var uuid            = require(config.mainHNpath+'/lib/util/uuid');
        var AccessoryLoader = require(config.mainHNpath+'/lib/AccessoryLoader.js');
        var storage         = require(config.mainHNpath+'/node_modules/node-persist/node-persist.js');
        var hashing         = require("create-hash");
        var debug           = require("debug")('VeraLink');
        
        var HAPNode = {'request':request, 'storage':storage, 'uuid':uuid, 'Bridge':Bridge, 'Accessory':Accessory, 'accessoryLoader':AccessoryLoader, 'hashing':hashing, 'Service':Service, 'Characteristic':Characteristic, 'debug':debug};
        var functions       = require('./lib/functions.js')(HAPNode,config); 
        console.log("HAP-NodeJS starting...");

        // Initialize our storage system
        storage.initSync();

        // Load Vera info from the data_request URL
        functions.getVeraInfo().then(function(verainfo)
        {
            if(typeof verainfo === 'object')
            {
                if(config.bridged === true)
                {
                    functions.processrooms(verainfo);
                }
                else
                {
                    functions.processall(verainfo);
                }
            }
        });
    }
]);