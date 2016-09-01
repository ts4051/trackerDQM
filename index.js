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
var Deque = require('collections/deque');
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
// Handle "UnpackerInfo" message
//

// hists and histories
var eventNumsDeque = new Deque();
var unpackingSuccessDeque = new Deque();
var numUnpackingErrorsDeque = new Deque();

var unpackingData = null;


function handleUnpackerInfoMessage(messageInfo) {

    //console.log('called handleUnpackerInfoMessage')

    var historyLength = 1000 //TODO User can modify //TODO Clear button

    //Clear deques at new run
    if ( messageInfo.run !== currentRunNum ) {
      currentRunNum = messageInfo.run;
      console.log('New run');
      unpackingSuccessDeque.clear();
      eventNumsDeque.clear();
      numUnpackingErrorsDeque.clear();
    }

    // let all clients know current event and run number //TODO Move to something generic
    //nFills += 1; //TODO Move to something generic
    io.emit('e num', { 'run': messageInfo.run, 'event': messageInfo.event });

    //Unpack message
    var unpackingSuccess = messageInfo.data.readUInt32LE(0);
    var numUnpackingErrors = messageInfo.data.readUInt32LE(4); //Each unsigned int is 4 bits

    //Update deques (using deque to only keep most recent N events, otherwise memory usage increases over time)
    eventNumsDeque.push(messageInfo.event);
    if (eventNumsDeque.length > historyLength) {
        eventNumsDeque.shift();
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



//
// Hit channels histo message handling
//

var M0U0HitChannelsHist = new HistRecord();
M0U0HitChannelsHist.bins.length = 32;
M0U0HitChannelsHist.clear();

var M0U1HitChannelsHist = new HistRecord();
M0U1HitChannelsHist.bins.length = 32;
M0U1HitChannelsHist.clear();

var M0V0HitChannelsHist = new HistRecord();
M0V0HitChannelsHist.bins.length = 32;
M0V0HitChannelsHist.clear();

var M0V1HitChannelsHist = new HistRecord();
M0V1HitChannelsHist.bins.length = 32;
M0V1HitChannelsHist.clear();

var M1U0HitChannelsHist = new HistRecord();
M1U0HitChannelsHist.bins.length = 32;
M1U0HitChannelsHist.clear();

var M1U1HitChannelsHist = new HistRecord();
M1U1HitChannelsHist.bins.length = 32;
M1U1HitChannelsHist.clear();

var M1V0HitChannelsHist = new HistRecord();
M1V0HitChannelsHist.bins.length = 32;
M1V0HitChannelsHist.clear();

var M1V1HitChannelsHist = new HistRecord();
M1V1HitChannelsHist.bins.length = 32;
M1V1HitChannelsHist.clear();

function handleM0U0HitChannelsMessage(messageInfo) {
    M0U0HitChannelsHist.fill(messageInfo, 'uint32');
}

function handleM0U1HitChannelsMessage(messageInfo) {
    M0U1HitChannelsHist.fill(messageInfo, 'uint32');
}

function handleM0V0HitChannelsMessage(messageInfo) {
    M0V0HitChannelsHist.fill(messageInfo, 'uint32');
}

function handleM0V1HitChannelsMessage(messageInfo) {
    M0V1HitChannelsHist.fill(messageInfo, 'uint32');
}

function handleM1U0HitChannelsMessage(messageInfo) {
    M1U0HitChannelsHist.fill(messageInfo, 'uint32');
}

function handleM1U1HitChannelsMessage(messageInfo) {
    M1U1HitChannelsHist.fill(messageInfo, 'uint32');
}

function handleM1V0HitChannelsMessage(messageInfo) {
    M1V0HitChannelsHist.fill(messageInfo, 'uint32');
}

function handleM1V1HitChannelsMessage(messageInfo) {
    M1V1HitChannelsHist.fill(messageInfo, 'uint32');
}

//
// Handle "StrawHitChannel" message
//

var positionData = null; //TODO Change name from "position" to "hitChannel"

/*

//TODO Turn into an external helper function/class
var posXBins = new Array(32);
posXBins.fill(0);
var xBinCenters = [];
for (var i = 0; i < posXBins.length; ++i) {
    xBinCenters.push(i / 10.0 + 0.05);
}
var posYBins = new Array(60);
posYBins.fill(0);
var yBinCenters = [];
for (var i = 0; i < posYBins.length; ++i) {
    yBinCenters.push(i / 10.0 + 0.05);
}
var posZBins = [];
for (var rowIndex = 0; rowIndex < posYBins.length; ++rowIndex) {
    posZBins.push([]);
    for (var colIndex = 0; colIndex < posXBins.length; ++colIndex) {
        posZBins[posZBins.length - 1].push(0);
    }
}

*/
function handleStrawHitChannelMessage(messageInfo) {

    //console.log('called handleStrawHitChannelMessage')

    //Clear at new run
    //TODO

    //Unpack message
    var station = messageInfo.data.readUInt32LE(0);
    var module = messageInfo.data.readUInt32LE(4); //Each unsigned int is 4 bits
    var globalModule = messageInfo.data.readUInt32LE(8);
    var view = messageInfo.data.readUInt32LE(12);
    var globalView = messageInfo.data.readUInt32LE(16);
    var layer = messageInfo.data.readUInt32LE(20);
    var globalLayer = messageInfo.data.readUInt32LE(24);
    var wire = messageInfo.data.readUInt32LE(28);
    var globalView = messageInfo.data.readUInt32LE(32);

    //Fill data struct
    positionData = {
      wire: wire,
      globalLayer: globalLayer
    }

}


//
// Define callbacks
//

var subCallbacks = {
    'UnpackerInfo': handleUnpackerInfoMessage,
    'StrawHitChannel': handleStrawHitChannelMessage,
    'M0U0HitChannels': handleM0U0HitChannelsMessage,
    'M0U1HitChannels': handleM0U1HitChannelsMessage,
    'M0V0HitChannels': handleM0V0HitChannelsMessage,
    'M0V1HitChannels': handleM0V1HitChannelsMessage,
    'M1U0HitChannels': handleM1U0HitChannelsMessage,
    'M1U1HitChannels': handleM1U1HitChannelsMessage,
    'M1V0HitChannels': handleM1V0HitChannelsMessage,
    'M1V1HitChannels': handleM1V1HitChannelsMessage //,
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

    ioSocket.on('position plots', function() {
        if (positionData !== null) {
          ioSocket.emit('position data', positionData);
        }
    });

    ioSocket.on('channels plots', function() {
        ioSocket.emit('hit channels M0 U0', M0U0HitChannelsHist); //TODO Only if changed?
        ioSocket.emit('hit channels M0 U1', M0U1HitChannelsHist);
        ioSocket.emit('hit channels M0 V0', M0V0HitChannelsHist);
        ioSocket.emit('hit channels M0 V1', M0V1HitChannelsHist);
        ioSocket.emit('hit channels M1 U0', M1U0HitChannelsHist);
        ioSocket.emit('hit channels M1 U1', M1U1HitChannelsHist);
        ioSocket.emit('hit channels M1 V0', M1V0HitChannelsHist);
        ioSocket.emit('hit channels M1 V1', M1V1HitChannelsHist);
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


//
// Define public pages
//

//Choose top-level page (summary/overview page)
app.get('/', function(req, res) {
    res.render('overview');
});

app.get('/positions', function(req, res) {
    res.render('positions', 
      { numTrackers: 1,
        numModulesPerTracker: 1 }
    );
});

app.get('/channels', function(req, res) {
    res.render('channels');
});

//
// Start webserver
//

http.listen(3000, function() {
    console.log('dqm app listening on port 3000!');
});

