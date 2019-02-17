#!/usr/bin/env node

'use strict';
    module.exports = function () {
        function dec2hex(i) {
            return (i + 0x10000).toString(16).substr(-4).toUpperCase();
        }

        function hex2dec(i) {
            return parseInt(i, 16);
        }

        function hex2bin(hex) {
            return (parseInt(hex, 16).toString(2)).padStart(8, '0');
        }

        function byteArrayToDec(ary) {
            let bytes = [];
            for (let c = 0; c < ary.length; c += 1) {
                bytes.push(String.fromCharCode("0x" + ary[c]));
            }
            return bytes;
        }
    }
