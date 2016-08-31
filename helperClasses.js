/*jslint node: true */
/*
        Some helper classes for the node online server
        Aaron Fienberg
*/
var Deque = require('collections/deque');

var exports = module.exports = {};

// basic histogram
exports.HistRecord = function() {
    this.runNum = null;
    this.eventNum = null;
    this.nFills = 0;
    this.bins = [];
};
exports.HistRecord.prototype = {
    clear: function() {
        this.nFills = 0;
        this.bins.fill(0);
    },
    preFill: function(messageInfo, dtype) {
        this.runNum = messageInfo.run;
        this.eventNum = messageInfo.event;

        var datasize = this.dtypetable[dtype];
        var nSamples = messageInfo.data.length / datasize;
        if (this.bins.length !== nSamples) {
            this.bins.length = nSamples;
            this.clear();
        }
        return nSamples;
    },
    fill: function(messageInfo, dtype) {
        var nSamples = this.preFill(messageInfo, dtype);
        this.nFills += 1;
        if (dtype === 'int16') {
            for (var i = 0; i < nSamples; ++i) {
                this.bins[i] += messageInfo.data.readInt16LE(2 * i);
            }
        } else if (dtype === 'uint32') {
            for (var j = 0; j < nSamples; ++j) {
                this.bins[j] += messageInfo.data.readUInt32LE(4 * j);
            }
        } else if (dtype === 'int32') {
            for (var k = 0; k < nSamples; ++k) {
                this.bins[k] += messageInfo.data.readInt32LE(4 * k);
            }
        }
    },
    add: function(hist) {
        this.runNum = hist.runNum;
        this.eventNum = hist.eventNum;
        var nSamples = hist.bins.length;
        if (this.bins.length !== nSamples) {
            this.bins.length = nSamples;
            this.clear();
        }
        this.nFills += 1;
        for (var i = 0; i < nSamples; ++i) {
            this.bins[i] += hist.bins[i];
        }
    },
    setTo: function(messageInfo, dtype) {
        var nSamples = this.preFill(messageInfo, dtype);
        this.nFills = 1;
        if (dtype === 'int16') {
            for (var i = 0; i < nSamples; ++i) {
                this.bins[i] = messageInfo.data.readInt16LE(2 * i);
            }
        } else if (dtype === 'uint32') {
            for (var j = 0; j < nSamples; ++j) {
                this.bins[j] = messageInfo.data.readUInt32LE(4 * j);
            }
        } else if (dtype === 'int32') {
            for (var k = 0; k < nSamples; ++k) {
                this.bins[k] = messageInfo.data.readInt32LE(4 * k);
            }
        }
    },
    dtypetable: {
        'int16': 2,
        'int32': 4,
        'uint32': 4
    }
};

// define runningAvgRecord object constructor
// an object to keep track of a running average 
// of the last recordLength values of some variable
exports.RunningAvgRecord = function(recordLength) {
    /*jshint validthis: true */
    this.recordLength = recordLength;
    this.deque = new Deque(); // holds up to last ten values
    this.avg = 0.0; // average of values in deque
};
exports.RunningAvgRecord.prototype = {
    dLength: function() {
        return this.deque.length;
    },
    // adds new value and returns new average
    addValue: function(newValue) {
        if (this.dLength() < this.recordLength) {
            this.avg =
                (this.avg * this.dLength() + newValue) / (this.dLength() + 1.0);
            this.deque.push(newValue);
        } else {
            var length = this.dLength();
            this.avg += 1.0 / length * (newValue - this.deque.shift());
            this.deque.push(newValue);
        }
        return this.avg;
    }
};
