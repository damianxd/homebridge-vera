module.exports = [
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
        StatusActive: true,
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
  },
  {
    name: 'Lightbulb',
    subcategory: 1,
    category: 2,
    battery: true,
    characteristics: {
        Brightness: {
          service: 'urn:upnp-org:serviceId:Dimming1',
          getVariable: 'level',
          setMethod: 'SetLoadLevelTarget',
          setVariable: 'newLoadlevelTarget',
          type: 'interger'
        },
        Status: {
          service: 'urn:upnp-org:serviceId:SwitchPower1',
          getVariable: 'status',
          type: 'boolean',
          setMethod: 'SetTarget',
          setVariable: 'newTargetValue'
        },
        StatusFault: {
          getVariable: 'commFailure',
          type: 'boolean'
        }
    }
  }
]
