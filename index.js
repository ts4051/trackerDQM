/*jslint node: true */
/*
        Server for receiving messages from art in online mode
        Aaron Fienberg
*/
'use strict';

//
// Define variables
//

var nCalos = 0;
var nXtalsArray = null;
var currentRunNum = 0

//
// Initialise external packages
//

var express = require('express');
var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
var favicon = require('serve-favicon');
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(express.static('public'));
var http = require('http').Server(app);
var io = require('socket.io')(http);

var zmq = require('zmq');

//pull in helper classes
var helperClasses = require('./helperClasses.js');
var RunningAvgRecord = helperClasses.RunningAvgRecord;
var HistRecord = helperClasses.HistRecord;


//
// Define local helper classes/functions
//

// helper function to read messages coming from the online server
// they always have header, run number, event number, and then data
//TODO Should this be in something external like helperClasses.js?
function splitMessage(message) {
    var runNumIndex = message.indexOf(':') + 1;
    return {
        // drop colon from the header
        header: message.toString('ascii', 0, runNumIndex - 1),
        run: message.readUInt32LE(runNumIndex),
        event: message.readUInt32LE(runNumIndex + 4),
        data: message.slice(runNumIndex + 8)
    };
}

//TODO REMOVE
function updateNCalosandXtals(messageData) {
    var newNCalos = messageData.length / 4;
    var nCalosChanged = newNCalos !== nCalos;
    nCalos = newNCalos;
    nXtalsArray = new Array(nCalos);
    for (var i = 0; i < nCalos; ++i) {
        nXtalsArray[i] = messageData.readUInt32LE(4 * i);
    }

    if (nCalosChanged) {
        io.emit('refresh');
    }
}


//
// Initialise connections to art-based online server
//

// start heartbeat socket immediately
var connected = false;
var pingReturned = false;
var heartbeatSock = zmq.socket('dealer');

// heartbeat
(function heartbeat() {
    if (pingReturned === false) {
        // this will always execute on first call to heartbeat
        connected = false;
        io.emit('not connected');
        heartbeatSock.close();
        heartbeatSock = zmq.socket('dealer');
        heartbeatSock.setsockopt(zmq.ZMQ_LINGER, 0);
        heartbeatSock.connect('tcp://127.0.0.1:9875');
        // register callback
        heartbeatSock.on('message', function(blank, message) {
            pingReturned = true;
            if (!connected) {
                connected = true;
            }
            io.emit('connected');
        });
    }
    heartbeatSock.send(['', '']);
    pingReturned = false;
    setTimeout(heartbeat, 1000);
})();

// subscribe socket
var subSock = zmq.socket('sub');
subSock.connect('tcp://127.0.0.1:9876');
// subscribe to all messages
subSock.subscribe('');


//
// Published data handling
//

// hists and histories
var Deque = require('collections/deque');
var eventNumsDeque = new Deque();
var unpackingSuccessDeque = new Deque();
var numUnpackingErrorsDeque = new Deque();
var counter = 0;

// just make this large enough to hold more calos than we'll ever need for now
var lastTenIslands = new Array(50);
for (var i = 0; i < lastTenIslands.length; ++i) {
    // last 10, running avg
    lastTenIslands[i] = new RunningAvgRecord(10);
}

var timesHist = new HistRecord();
timesHist.bins.length = 200;
timesHist.clear();

// functions for handling messages coming in on subscribe socket]
var caloIslandData = null;
var unpackingData = null;

function handleUnpackerInfo(messageInfo) {

    counter++;

    //Clear deques at new run
    if ( messageInfo.run !== currentRunNum ) {
      currentRunNum = messageInfo.run;
      console.log('New run');
      unpackingSuccessDeque.clear();
      eventNumsDeque.clear();
      numUnpackingErrorsDeque.clear();
    }

    //nFills += 1; //TODO Move to something generic

    // let all clients know current event and run number //TODO Move to something generic
    io.emit('run&event', { run: messageInfo.run, event: messageInfo.event });
/*
        // unpack data buffer and add to histgram bins
        var numBins = messageInfo.data.length / 4;
        for (var i = 0; i < numBins; ++i) {
            binContents[i] += messageInfo.data.readUInt32LE(4 * i);
        }
        io.emit('time hist', {y: binContents, nFills: nFills });
*/
    io.emit('e num', { 'run': messageInfo.run, 'event': messageInfo.event });
    //console.log('Emitting run/event num');
//    var energySum = 0;
    var numValues = messageInfo.data.length; //TODO Check one value only
    var unpackingSuccess = messageInfo.data.readUInt32LE(0);
    var numUnpackingErrors = messageInfo.data.readUInt32LE(4); //Each unsigned int is 4 bits

    console.log('called handleUnpackerInfo')
/*
    var caloNums = new Array(numValues);
    var lastNumIslands = new Array(numValues);
    var runningAvgs = new Array(numValues);
    for (var i = 0; i < numValues; ++i) {
        var thisValue = messageInfo.data.readUInt32LE(4 * i);
        caloNums[i] = i + 1;
        lastNumIslands[i] = thisValue;
        runningAvgs[i] = lastTenIslands[i].addValue(thisValue);
        energySum += thisValue;
    }
*/

    var historyLength = 1000

    // Update deques
    eventNumsDeque.push(messageInfo.event);
    if (eventNumsDeque.length > historyLength) {
        eventNumsDeque.shift();
    }

    if ( messageInfo.event % 2 == 0 ) {
      unpackingSuccess = 0;
    }

    unpackingSuccessDeque.push(unpackingSuccess);
    if (unpackingSuccessDeque.length > historyLength) {
        unpackingSuccessDeque.shift();
    }

    numUnpackingErrorsDeque.push(numUnpackingErrors);
    if (numUnpackingErrorsDeque.length > historyLength) {
        numUnpackingErrorsDeque.shift();
    }

    //Fill data struct
    unpackingData = {
      eventNums: eventNumsDeque.toArray(),
      unpackingSuccessVals: unpackingSuccessDeque.toArray(),
      numUnpackingErrors: numUnpackingErrorsDeque.toArray()
    }

}


var subCallbacks = {
    'UnpackerInfo': handleUnpackerInfo //,
    //'nXtals': function(msgInfo) { updateNCalosandXtals(msgInfo.data); }
};

//define subsock callback
subSock.on('message', function(message) {
    var messageInfo = splitMessage(message);
    if (messageInfo.header in subCallbacks) {
        subCallbacks[messageInfo.header](messageInfo);
    }
});

// define socket.io callbacks
io.on('connection', function(ioSocket) {

    //Connected status
    if (connected) {
        ioSocket.emit('connected');
    } else {
        ioSocket.emit('not connected');
    }

    ioSocket.on('overview plots', function() {
        if (unpackingData !== null) {
          ioSocket.emit('unpacking data', unpackingData);
        }
    });
/*
    ioSocket.on('position plots', function() {
        ioSocket.emit('position plots', {
            z: posZBins,
            xBinCenters: xBinCenters,
            xBinContents: posXBins,
            yBinCenters: yBinCenters,
            yBinContents: posYBins
        });
    });
*/

    ioSocket.on('disconnect', function() { //TODO REQUIRED?
        //traceSock.close();
    });
});

//Choose top-level page
app.get('/', function(req, res) {
    res.render('overview', { nCalos: nCalos }); //TODO nCalos?
});

/*
app.get('/positions', function(req, res) {
    res.render('positions', {nCalos: nCalos});
});
*/

//
// Start webserver
//

http.listen(3000, function() {
    console.log('dqm app listening on port 3000!');
});

