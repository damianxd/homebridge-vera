/* 
 * VeraLink config file
 * Damian Alarcon
 * Dec 2015
 * damian@laerit.dk
 */

module.exports = {
    // Global config (Standalone and Homebridge)
    veraIP:  '10.0.1.5',
    includesensor: false, //Include temp sensors on the devices list
    dimmertest: false, //Set this to true to test test a dimmer device
    
    // Standalone only
    cardinality: 0, //Add +1 to this in case you find any trouble while adding your device, all the other devices will have to be re-added too 
    happort: 6200,
    bridged: true, //Set to false to use single server for each device instead of one for each room
    pincode: '031-45-154', //Keep the format ###-##-### and use complex numbers, eg 111-11-111 or 123-45-678 are invalid
    mainHNpath: './node_modules/hap-nodejs' // Do not edit unless you know what you're doing
};