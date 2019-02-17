#!/usr/bin/env node

'use strict';
var utility = require('./utility');

module.exports = function (logger) {

    function calcCRC(array) {
        let crc = "0x147A";
        // loop over decimal version of hex
        for (let b of array) {
            // rotate 1 bit left
            crc = ((crc << 1) & 0xFFFF) | (crc & 0x8000) >> 15;
            // xOR with 0xFFFF
            crc = crc ^ 0xFFFF;
            // crc + crc.high + b
            crc = (crc + (crc >> 8) + parseInt(b, 16)) & 0xFFFF;
        }
        return utility.dec2hex(crc).match(/.{2}/g); // return array
    }

    function ETHM1AnswerToArray(answer) {
        return Buffer.from(answer.toString('binary'), 'ascii').toString('hex').toUpperCase().match(/.{2}/g);
    }

    function verifyAnswer(answer) {
        const frmHdr = 'FE,FE';
        const frmFtr = 'FE,0D';
        logger.log(answer.slice(-4, -2).toString() + ' == ' + calcCRC(answer.slice(2, -4)).toString());

        if (answer.slice(0, 2).toString() == frmHdr &&
            answer.slice(-2).toString() == frmFtr &&
            answer.slice(-4, -2).toString() == calcCRC(answer.slice(2, -4)).toString()
        ) {
            return true;
        } else {
            return false;
        }
    }

    function createFrameArray(cmd) {
        // cmd must be array
        //	Frame structure
        //	[ 0xFE | 0xFE | cmd | d1 | d2 | ... | dn | crc.high | crc.low | 0xFE | 0x0D ]
        const frmHdr = ['FE', 'FE'];
        const frmFtr = ['FE', '0D'];
        let crc = calcCRC(cmd);
        return frmHdr.concat(cmd).concat(crc).concat(frmFtr);
    }

    function getCommand_ethminfo() {
        return createFrameArray(["7E"]);
    }

    function executeCommand(input, callback) {
        const net = require('net');
        const alarm = new net.Socket();
        alarm.setEncoding('binary');
        // set timeout to 750 ms (for sending & receiving data)
        alarm.setTimeout(750);

        // connect to alarm system
        alarm.connect('7094', '192.168.1.10', () => {
            logger.log("Connected to " + alarm.remoteAddress + ":" + alarm.remotePort);
            logger.log(" * Send command: " + input.join('').match(/.{2}/g));
            // if connected, send command in binary format
            alarm.write(Buffer.from(input.join(''), 'hex'));
        });
        // upon receiving data from the alarm
        // receiving data from a socket is asynchronous, so a return value is not properly set
        alarm.on('data', (data) => {
            logger.log(" * Received data from alarm...");
            let answer = ETHM1AnswerToArray(data);
            if (verifyAnswer(answer)) {
                logger.log("   - valid answer: " + answer);
            } else {
                logger.error("   - incorrect answer:" + answer);
            }
            let payload = answer.slice(2, -4);
            logger.log("   - payload: " + payload);
            alarm.destroy();
            // call the callback function with the payload as parameter
            callback(payload);
        });
        alarm.on('error', (err) => {
            logger.error('Error: ' + err);
            alarm.destroy();
            return [];
        });
        alarm.on('timeout', () => {
            logger.warn('Connection timed out.');
            alarm.destroy();
            alarm.end();
            return [];
        });
        alarm.on('close', () => {
            logger.log('Connection to ' + alarm.remoteAddress + ' closed.');
        });
    }

    function parsePayload(payload) {
        if (!Array.isArray(payload))
            return "";
        const cmd = payload[0];
        const answer = payload.slice(1);
        logger.log("   - command: " + cmd);
        logger.log("   - answer : " + answer);
        switch (cmd) { // check payload field 1 to match command
            case "7E": // Integra version
                // 1 byte for the alarm type
                let atype = null;
                switch (utility.hex2dec(answer[0])) {
                    case 0:
                        atype = "Integra 24";
                        break;
                    case 1:
                        atype = "Integra 32";
                        break;
                    case 2:
                        atype = "Integra 64";
                        break;
                    case 3:
                        atype = "Integra 128";
                        break;
                    case 4:
                        atype = "INTEGRA 128-WRL SIM300";
                        break;
                    case 66:
                        atype = "INTEGRA 64 PLUS";
                        break;
                    case 67:
                        atype = "INTEGRA 128 PLUS";
                        break;
                    case 72:
                        atype = "INTEGRA 256 PLUS";
                        break;
                    case 132:
                        atype = "INTEGRA 128-WRL LEON";
                        break;
                    default:
                        atype = "UNKNOWN Alarm type";
                        break;
                }
                // PLACEHOLDER to store this in settings and show in settings page
                if (debugEnabled) {
                    logger.log("     - Alarm Type: " + atype);
                }
                // this.setSettings({
                //     alarmtype: atype
                // });
                // 11 bytes for the version
                let version_array = utility.byteArrayToDec(answer.slice(1, 12));
                let r = function (p, c) {
                    return p.replace(/%s/, c);
                };
                let avers = version_array.reduce(r, "%s.%s%s %s%s%s%s-%s%s-%s%s");
                logger.log("     - Alarm Version: " + avers);

                // 1 byte for the language
                let alang = '?';
                switch (utility.hex2dec(answer[12])) {
                    case 1:
                        alang = 'English';
                        break;
                    case 6:
                        alang = 'Italian';
                        break;
                    case 9:
                        alang = 'Dutch';
                        break;
                    default:
                        alang = "Unknown (" + utility.hex2dec(answer[12]) + ")";
                        break;
                }
                logger.log("     - Alarm language: " + alang);
                break;

            case "0A":
                // put code here to parse 4 byte answer for active blocks/zones.
                // each byte is a HEX number, convert to binary and count positions
                // starting from the end to find active partitions.
                let activepartitions = [];
                // let firstrun = false;
                // if (this.previousactivepartitions == undefined) {
                //     this.previousactivepartitions = [];
                //     firstrun = true;
                // }
                let p = 0;
                for (let plist of answer) {
                    let binarray = Array.from(utility.hex2bin(plist));
                    for (let i = binarray.length - 1; i >= 0; --i) {
                        p++;
                        if (binarray[i] == 1) {
                            activepartitions.push(p);
                        }
                    }
                }
                // if (firstrun) {
                //     this.previousactivepartitions = activepartitions;
                // }
                if (debugEnabled) {
                    logger.log(" - active partitions (now)   : " + activepartitions);
                    logger.log(" - active partitions (before): " + previousactivepartitions);
                }
                // check number of active partitions => determines current status
                /*
                if (activepartitions.length == 0) {
                    logger.log("No armed partitions found => alarm is not armed.");
                    this.conditionIsArmed = false;
                    // set homealarm_state to current value
                    this.setCapabilityValue('onoff', false).catch((error) => {
                        logger.log("Could not disarm alarm, due to:", error);
                    });

                    if (!compareArrays(activepartitions, this.previousactivepartitions)) {
                        // trigger ACTION triggerGotDisarmed
                        if (debugEnabled) {
                            logger.log(" - Alarm was disarmed");
                        }
                        this.triggerGotDisarmed.trigger().then().catch();
                    }
                } else {
                    logger.log("One or more armed partitions => alarm is armed.");
                    this.conditionIsArmed = true;
                    this.setCapabilityValue('onoff', true);
                    if (!compareArrays(activepartitions, this.previousactivepartitions)) {
                        // trigger ACTION triggerGotArmed
                        if (debugEnabled) {
                            logger.log(" - Alarm was armed.");
                        }
                        this.triggerGotArmed.trigger().then().catch();
                        this.setCapabilityValue('onoff', true);
                    }
                }
                // store for next loop
                this.previousactivepartitions = activepartitions;
                */
                break;
        }
    }
}