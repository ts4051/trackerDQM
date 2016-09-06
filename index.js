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
var amc13TriggerNumberDeque = new Deque();
var amc13EventSizeDeque = new Deque();
var numDigitsDeque = new Deque();

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
      amc13TriggerNumberDeque.clear();
      amc13EventSizeDeque.clear();
      numDigitsDeque.clear();
    }

    // let all clients know current event and run number //TODO Move to something generic
    //nFills += 1; //TODO Move to something generic
    io.emit('e num', { 'run': messageInfo.run, 'event': messageInfo.event });

    //Unpack message
    var unpackingSuccess = messageInfo.data.readUInt32LE(0);
    var numUnpackingErrors = messageInfo.data.readUInt32LE(4); //Each unsigned int is 4 bits
    var amc13TriggerNumber = messageInfo.data.readUInt32LE(8); 
    var amc13EventSize = messageInfo.data.readUInt32LE(12); 
    var numDigits = messageInfo.data.readUInt32LE(16); 

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

    amc13TriggerNumberDeque.push(amc13TriggerNumber);
    if (amc13TriggerNumberDeque.length > historyLength) {
        amc13TriggerNumberDeque.shift();
    }

    amc13EventSizeDeque.push(amc13EventSize);
    if (amc13EventSizeDeque.length > historyLength) {
        amc13EventSizeDeque.shift();
    }

    numDigitsDeque.push(numDigits);
    if (numDigitsDeque.length > historyLength) {
        numDigitsDeque.shift();
    }

    //Fill data struct
    unpackingData = {
      eventNums: eventNumsDeque.toArray(),
      unpackingSuccessVals: unpackingSuccessDeque.toArray(),
      numUnpackingErrors: numUnpackingErrorsDeque.toArray(),
      amc13TriggerNumbers: amc13TriggerNumberDeque.toArray(),
      amc13EventSizes: amc13EventSizeDeque.toArray(),
      numDigitsVals: numDigitsDeque.toArray()
    }

}


//
// Hist test TODO REMOVE
//
/*
var histTest = null; 

function handleHistTestMessage(messageInfo) {

  var numBins = messageInfo.data.readUInt32LE(0);

  //Fill data struct
  histTest = {
    binCenters: [],
    binContents: []
  }

  histTest.binCenters.length = numBins;
  histTest.binContents.length = numBins;

  console.log( "Data stream length = " + messageInfo.data.length + " : Array length = " + histTest.binCenters.length + " : Num bins = " + numBins  )

  for (var i = 0 ; i < numBins ; ++i) {
    var index = ( i * 2 ) + 1
    console.log( "i = " + i + " : First index = " + index + " : Byte index = " + (4 * index) )
    histTest.binCenters[i] = messageInfo.data.readFloatLE( 4 * index );
    histTest.binContents[i] = messageInfo.data.readFloatLE( 4 * (index+1) );
  }


}
*/

//
// Hit channels histo message handling
//

var HitChannelsL0Hist = { binCenters: [], binContents: [] };  //TODO Make class
var HitChannelsL1Hist = { binCenters: [], binContents: [] };  //TODO Make class
var HitChannelsL2Hist = { binCenters: [], binContents: [] };  //TODO Make class
var HitChannelsL3Hist = { binCenters: [], binContents: [] };  //TODO Make class
var HitChannelsL4Hist = { binCenters: [], binContents: [] };  //TODO Make class
var HitChannelsL5Hist = { binCenters: [], binContents: [] };  //TODO Make class
var HitChannelsL6Hist = { binCenters: [], binContents: [] };  //TODO Make class
var HitChannelsL7Hist = { binCenters: [], binContents: [] };  //TODO Make class

function unpackTH1F(messageInfo,hist) {

  var numBins = messageInfo.data.readUInt32LE(0);

  hist.binCenters.length = numBins;
  hist.binContents.length = numBins;

  var binDataSize = 8; //Always a double
  var contentDataSize = 4; //TH1F, e.g. float
  var firstBinIndex = 4; //Step past uint first word
  var firstContentIndex = firstBinIndex + ( numBins * binDataSize );
  for (var i_bin = 0 ; i_bin < numBins ; ++i_bin) {
    hist.binCenters[i_bin] = messageInfo.data.readDoubleLE( firstBinIndex + ( i_bin * binDataSize ) );
    hist.binContents[i_bin] = messageInfo.data.readFloatLE( firstContentIndex + ( i_bin * contentDataSize ) );
  }

}

function handleHitChannelsL0Message(messageInfo) { unpackTH1F(messageInfo,HitChannelsL0Hist); }
function handleHitChannelsL1Message(messageInfo) { unpackTH1F(messageInfo,HitChannelsL1Hist); }
function handleHitChannelsL2Message(messageInfo) { unpackTH1F(messageInfo,HitChannelsL2Hist); }
function handleHitChannelsL3Message(messageInfo) { unpackTH1F(messageInfo,HitChannelsL3Hist); }
function handleHitChannelsL4Message(messageInfo) { unpackTH1F(messageInfo,HitChannelsL4Hist); }
function handleHitChannelsL5Message(messageInfo) { unpackTH1F(messageInfo,HitChannelsL5Hist); }
function handleHitChannelsL6Message(messageInfo) { unpackTH1F(messageInfo,HitChannelsL6Hist); }
function handleHitChannelsL7Message(messageInfo) { unpackTH1F(messageInfo,HitChannelsL7Hist); }


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
    'HitChannelsL0': handleHitChannelsL0Message,
    'HitChannelsL1': handleHitChannelsL1Message,
    'HitChannelsL2': handleHitChannelsL2Message,
    'HitChannelsL3': handleHitChannelsL3Message,
    'HitChannelsL4': handleHitChannelsL4Message,
    'HitChannelsL5': handleHitChannelsL5Message,
    'HitChannelsL6': handleHitChannelsL6Message,
    'HitChannelsL7': handleHitChannelsL7Message
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
      //TODO Shouldn't be doing the [global layer] <-> [module,view,layer] mapping here, should send it 
      if( HitChannelsL0Hist != null ) { ioSocket.emit('hit channels M0 U0', HitChannelsL0Hist); } 
      if( HitChannelsL1Hist != null ) { ioSocket.emit('hit channels M0 U1', HitChannelsL1Hist); } 
      if( HitChannelsL2Hist != null ) { ioSocket.emit('hit channels M0 V0', HitChannelsL2Hist); } 
      if( HitChannelsL3Hist != null ) { ioSocket.emit('hit channels M0 V1', HitChannelsL3Hist); } 
      if( HitChannelsL4Hist != null ) { ioSocket.emit('hit channels M1 U0', HitChannelsL4Hist); } 
      if( HitChannelsL5Hist != null ) { ioSocket.emit('hit channels M1 U1', HitChannelsL5Hist); } 
      if( HitChannelsL6Hist != null ) { ioSocket.emit('hit channels M1 V0', HitChannelsL6Hist); } 
      if( HitChannelsL7Hist != null ) { ioSocket.emit('hit channels M1 V1', HitChannelsL7Hist); } 
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

