﻿var cylon = require("cylon"),
    request = require("request"),
    fs = require('fs'),
    LCD_ADDRESS = 0x3E,
    RGB_ADDRESS = 0x62,
    ABS_ZERO = 273.15,
    ROOM_TEMPERATURE = 298.15,
    THERMISTOR = 3975;
    // LCD  = require ('jsupm_i2clcd'),
    // myLCD = new LCD.Jhd1313m1(0, 0x3E, 0x62);

cylon.api({
    host: "0.0.0.0",
    port: "3500",
    ssl: false
});

cylon.robot({
    name: "Temperature Sensor",
    connections: {
        edison: { adaptor: "intel-iot" }
    },
    devices: {
        temperature: {
            driver: "analogSensor",
            pin: 0,
            connection: "edison"
        }
        ,
        lcd: {
            driver: 'upm-jhd1313m1',
            connection: 'edison'
        }
    },

    writeMessage: function (message, color) {
        var me = this,
            screen = me.lcd,
            str = ('' + message).trim();

        while (str.length < 16) {
            str = str + " ";
        }
        console.log(message);

        switch (color) {
            case "red":
                screen.setColor(255, 0, 0);
                break;
            case "green":
                screen.setColor(0, 255, 0);
                break;
            case "blue":
                screen.setColor(0, 0, 255);
                break;
            default:
                screen.setColor(255, 255, 255);
                break;
        }

        screen.setCursor(0, 0);
        screen.write(str);
    },

    getTemperature: function () {
        var me = this,
            rawData = me.temperature.analogRead(),
            resistance = (1023 - rawData) * 10000 / rawData,
            temperature = 1 / (Math.log(resistance / 10000) / THERMISTOR + 1 / ROOM_TEMPERATURE) - ABS_ZERO;

        return temperature;
    },

    sendObservation: function () {
        // iotkit-agent credentials needed to connect and submit data
        var temperature = this.getTemperature(),
            deviceSpec = require('/usr/lib/node_modules/iotkit-agent/data/device.json'),
            uname = deviceSpec.device_id,
            accountId = deviceSpec.account_id,
            deviceId = deviceSpec.device_id,
            token = deviceSpec.device_token,
            comp_name = "Temperature",
            cid = deviceSpec.sensor_list.filter(function (obj) {
                return obj.name === comp_name;
            })[0],
            now = (new Date).getTime(),
            observation = {
                "accountId": accountId,
                "did": uname,
                "on": now,
                "count": 1,
                "data": [
                    {
                        "on": now,
                        "value": temperature.toFixed(2),
                        "cid": cid
                    }
                ]
            },
            requestData = {
                url: 'https://dashboard.us.enableiot.com/v1/api/data/' + deviceId,
                method: 'POST',
                json: true,
                headers: {
                    'Authorization': 'Bearer ' + token
                },
                body: observation
            };

        try {
            //request(requestData);
        }
        catch (e) {
            fs.appendFile('./log.txt', JSON.stringify({
                Error: e,
                Date: Date.now()
            }));
        }
    },

    work: function () {
        var me = this;

        me.temperatureBuffer = [];

        every((1).second(), function () {
            var temperature = me.getTemperature(),
                msg = 't = ' + temperature.toFixed(2);

            var color = 'green';
            if (temperature <= 25) {
                color = 'blue';
            }
            else if (temperature >= 30) {
                color = 'red'
            };

            me.writeMessage(msg, color);
            fs.appendFile('./log.txt', JSON.stringify({
                Temperature: temperature.toFixed(2),
                Date: Date.now()
            }));

            try {
                me.sendObservation();
            }
            catch (e) {
                fs.appendFile('./log.txt', JSON.stringify({
                    Error: e,
                    Date: Date.now()
                }));
            }
        });
    }
}).start();
