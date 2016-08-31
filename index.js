/*jslint node: true */
/*
        Server for receiving messages from art in online mode
        Aaron Fienberg
*/
'use strict';

// info about n calos and nxtals per calo
var nCalos = 0;
var nXtalsArray = null;

// initialize stuff we need
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

// helper function to read messages coming from the online server
// they always have header, run number, event number, and then data
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
                // established new connection
                connected = true;
                // ask for n xtals / calos for new connection
                heartbeatSock.send(['', 'nXtals?:']);
            }
            io.emit('connected');

            // if it's not an empty message, it must contain xtal/calo info
            if (message.length > 0) {
                updateNCalosandXtals(splitMessage(message).data);
            }
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

// hists and histories
var Deque = require('collections/deque');
var historyDeque = new Deque();
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

function handleIslandMessage(messageInfo) {
    counter++;

    io.emit('e num', { 'run': messageInfo.run, 'event': messageInfo.event });
    var energySum = 0;
    var numValues = messageInfo.data.length / 4;
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

    // modify history deque
    historyDeque.push(energySum);
    if (historyDeque.length > 100) {
        historyDeque.shift();
    }

    caloIslandData = {
        caloNums: caloNums,
        lastIslands: lastNumIslands,
        lastAvgs: runningAvgs,
        history: historyDeque.toArray()
    };
}

function handleTimeMessage(messageInfo) {
    timesHist.fill(messageInfo, 'uint32');
}

// q method stuff, just hold room for 24 for now
var qMethodRecords = new Array(24);
for (var i = 0; i < 24; ++i) {
    qMethodRecords[i] = [new HistRecord(), new HistRecord()];
}

function createQCallback(index) {
    return function(messageInfo) {
        // save last CQ bank
        qMethodRecords[index][0].setTo(messageInfo, 'int16');
        // add to running hist
        qMethodRecords[index][1].add(qMethodRecords[index][0]);

    };
}

// calo summary stuff, room for 24 for now
var caloAmplRecord = new Array(24);
var caloPedRecord = new Array(24);
// room for 60 segments for now
for (var i = 0; i < caloAmplRecord.length; ++i) {
    caloAmplRecord[i] = { data: null, averageRecords: new Array(60) };
    for (var j = 0; j < caloAmplRecord[i].averageRecords.length; ++j) {
        caloAmplRecord[i].averageRecords[j] = new RunningAvgRecord(10);
    }
}
for (var i = 0; i < caloPedRecord.length; ++i) {
    caloPedRecord[i] = { data: null, averageRecords: new Array(60) };
    for (var j = 0; j < caloPedRecord[i].averageRecords.length; ++j) {
        caloPedRecord[i].averageRecords[j] = new RunningAvgRecord(10);
    }
}

function updateCaloInfo(messageInfo, caloRecord) {
    var datalength = messageInfo.data.length / 2;
    caloRecord.data = { last: [], runningAvgs: [] };
    for (var i = 0; i < datalength; ++i) {
        var thisValue = messageInfo.data.readInt16LE(2 * i);
        caloRecord.data.last.push(thisValue);
        caloRecord.data.runningAvgs.push(caloRecord.averageRecords[i].addValue(thisValue));
    }
}

function createAmplCallback(index) {
    return function(messageInfo) {
        updateCaloInfo(messageInfo, caloAmplRecord[index]);
    };
}

function createPedestalCallback(index) {
    return function(messageInfo) {
        updateCaloInfo(messageInfo, caloPedRecord[index]);
    };
}

// temporary hist structure to see if plot can work
var posXBins = new Array(90);
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

function handlePosMessage(messageInfo) {
    var x = messageInfo.data.readDoubleLE(0);
    var y = messageInfo.data.readDoubleLE(8);
    var xIndex = Math.floor(x * 10);
    var yIndex = Math.floor(y * 10);

    posXBins[xIndex] += 1;
    posYBins[yIndex] += 1;
    posZBins[yIndex][xIndex] += 1;
}

var subCallbacks = {
    'islands': handleIslandMessage,
    'times': handleTimeMessage,
    'hitpos': handlePosMessage,
    'nXtals': function(msgInfo) { updateNCalosandXtals(msgInfo.data); }
};
for (var i = 0; i < 24; ++i) {
    subCallbacks['CQ' + (i + 1).toString()] = createQCallback(i);
    subCallbacks['AMP' + (i + 1).toString()] = createAmplCallback(i);
    subCallbacks['CP' + (i + 1).toString()] = createPedestalCallback(i);
}

//define subsock callback
subSock.on('message', function(message) {
    var messageInfo = splitMessage(message);
    if (messageInfo.header in subCallbacks) {
        subCallbacks[messageInfo.header](messageInfo);
    }
});

// function for handling messages coming in on trace socket
function handleTraceMessage(traceSock, ioSocket, messageInfo) {
    // message should come in form <caloNum>_<xtalNum>:<data>
    var splitHeader = messageInfo.header.split('_');
    if (splitHeader.length != 2) {
        // invalid message
        return;
    }

    var caloNum = parseInt(splitHeader[0]);
    var xtalNum = parseInt(splitHeader[1]);
    // sending single trace is not used right now, only all at once
    if (xtalNum == -1) {
        // send all traces for plotting
        var nXtals = nXtalsArray[caloNum - 1];
        var samplesPerTrace = (messageInfo.data.length / 2) / nXtals;
        var xtalTraces = [];
        var maxXtal = 0;
        var minSample = 3000;
        for (var xtal = 0; xtal < nXtals; ++xtal) {
            xtalTraces.push([]);
            // calculate where the trace for this xtal begins
            var startOffset = 2 * xtal * samplesPerTrace;
            for (var sampleNum = 0; sampleNum < samplesPerTrace; ++sampleNum) {
                var newSample =
                    messageInfo.data.readInt16LE(startOffset + 2 * sampleNum);
                xtalTraces[xtalTraces.length - 1].push(newSample);
                if (newSample < minSample) {
                    maxXtal = xtal;
                    minSample = newSample;
                }
            }
        }

        ioSocket.emit('all traces', {
            'traces': xtalTraces,
            'event': messageInfo.event,
            'run': messageInfo.run,
            'maxXtal': maxXtal,
            'caloNum': caloNum
        });
    }
}

// define socket.io callbacks
io.on('connection', function(ioSocket) {
    // new dealer socket for each client to handle routing correctly
    // dealer will act as req socket, but won't get stuck if server crashes without response
    var traceSock = zmq.socket('dealer');
    traceSock.setsockopt(zmq.ZMQ_LINGER, 0);
    traceSock.connect('tcp://127.0.0.1:9875');

    // have to grab blank frame manually because we're emulating req socket
    traceSock.on('message', function(blank, message) {
        // if we request before server is ready, we'll get an empty reply.
        // these messages must be ignored
        if (message.length === 0) {
            return;
        }
        var messageInfo = splitMessage(message);

        handleTraceMessage(traceSock, ioSocket, messageInfo);
    });

    if (connected) {
        ioSocket.emit('connected');
    } else {
        ioSocket.emit('not connected');
    }

    ioSocket.on('deliver trace', function(message) {
        // request trace from server if it's running
        if (connected) {
            // blank frame required to emulate request socket
            traceSock.send(['', 'trace:' + message.caloNum + '_' + message.num.toString()]);
        }
    });

    ioSocket.on('deliver all sync traces', function(msg) {
        if (connected) {
            // -1 indicates all traces for now
            // blank frame required to emulate request socket 
            traceSock.send(['', 'syncTrace:' + msg.caloNum + '_' + '-1']);
        }
    });

    ioSocket.on('deliver all phys traces', function(msg) {
        if (connected) {
            // -1 indicates all traces for now
            // blank frame required to emulate request socket 
            traceSock.send(['', 'physTrace:' + msg.caloNum + '_' + '-1']);
        }
    });

    ioSocket.on('clear time hist', function() { timesHist.clear(); });

    ioSocket.on('nXtals?', function(caloNum) {
        if (nXtalsArray !== null) {
            ioSocket.emit('nXtals', nXtalsArray[caloNum - 1]);
        }
    });

    ioSocket.on('clear q hist', function(data) {
        qMethodRecords[data.caloNum - 1][1].clear();
        ioSocket.emit('q hist', qMethodRecords[data.caloNum - 1][1]);
    });

    ioSocket.on('deliver q hist', function(data) {
        if (qMethodRecords[data.caloNum - 1][1].bins.length > 0) {
            ioSocket.emit('q hist', qMethodRecords[data.caloNum - 1][1]);
        }
    });

    ioSocket.on('deliver q bank', function(data) {
        if (qMethodRecords[data.caloNum - 1][0].bins.length > 0) {
            ioSocket.emit('q bank', qMethodRecords[data.caloNum - 1][0]);
        }
    });

    ioSocket.on('overview plots', function() {
        if (caloIslandData !== null) {
            ioSocket.emit('calo island data', caloIslandData);
            ioSocket.emit('time hist', timesHist);
        }
    });

    ioSocket.on('position plots', function() {
        ioSocket.emit('position plots', {
            z: posZBins,
            xBinCenters: xBinCenters,
            xBinContents: posXBins,
            yBinCenters: yBinCenters,
            yBinContents: posYBins
        });
    });

    ioSocket.on('calo summary plots', function(caloNum) {
        if (caloAmplRecord[caloNum - 1].data !== null && caloPedRecord[caloNum - 1].data !== null) {
            ioSocket.emit('calo data', {
                caloNum: caloNum,
                ampl: caloAmplRecord[caloNum - 1].data,
                ped: caloPedRecord[caloNum - 1].data
            });
        }
    });

    ioSocket.on('disconnect', function() {
        traceSock.close();
    });
});

app.get('/', function(req, res) {
    res.render('overview', { nCalos: nCalos });
});

app.get('/q:caloNum', function(req, res) {
    var caloNum = parseInt(req.params.caloNum);
    if (caloNum > 0 && caloNum < nCalos + 1) {
        res.render('qPlot', { nCalos: nCalos, caloNum: caloNum });
    } else {
        res.status(404)
            .send('<h1><font color="red">Invalid calo number!</font></h1>');
    }
});

app.get('/traces:caloNum', function(req, res) {
    var caloNum = parseInt(req.params.caloNum);
    if (caloNum > 0 && caloNum < nCalos + 1) {
        res.render('traceGrid', { nCalos: nCalos, caloNum: caloNum });
    } else {
        res.status(404)
            .send('<h1><font color="red">Invalid calo number!</font></h1>');
    }
});

app.get('/calo:caloNum', function(req, res) {
    var caloNum = parseInt(req.params.caloNum);
    if (caloNum > 0 && caloNum < nCalos + 1) {
        res.render('caloSummary', { nCalos: nCalos, caloNum: caloNum });
    } else {
        res.status(404)
            .send('<h1><font color="red">Invalid calo number!</font></h1>');
    }
});

app.get('/positions', function(req, res) {
    res.render('positions', {nCalos: nCalos});
});

http.listen(3333, function() {
    console.log('dqm app listening on port 3333!');
});
