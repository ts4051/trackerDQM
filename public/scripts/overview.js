$(document).ready(function() {
    'use strict';

    var socket = io();

    socket.on('refresh', function() { document.location.reload(true); });

    socket.on('connected', function() {
        $('#connected').show();
        $('#notConnected').hide();
    });

    socket.on('not connected', function() {
        $('#notConnected').show();
        $('#connected').hide();
    });

    socket.on('e num', function(data) {
        $('#eventNum').text(data.event.toString());
        $('#runNum').text(data.run.toString());
    });

/*
    $('#clear').click(function() {
        socket.emit('clear time hist');
        socket.emit('overview plots');
    });
*/

    //
    // Unpacker data plots
    //

    //Define unpacking success plot
    Plotly.newPlot(
      'unpackingSuccess', 
      [ { x: [], y: [], type: 'scatter' } ] ,
      { 
        title: "Event unpacking successful or not",
        titlefont: { size: 20 },
        xaxis: { title: 'Event number', titlefont: { size: 15 } },
        yaxis: { title: 'Unpacking successful', titlefont: { size: 15 } }
      }
    );

    //Define num unpacking errors plot
    Plotly.newPlot(
      'numUnpackingErrors', 
      [ { x: [], y: [], type: 'scatter' } ] ,
      { 
        title: "Num unpacking errors in event",
        titlefont: { size: 20 },
        xaxis: { title: 'Event number', titlefont: { size: 15 } },
        yaxis: { title: 'Num unpacking errors', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('unpacking data', function(data) {

        Plotly.deleteTraces(unpackingSuccess, 0);
        Plotly.addTraces(unpackingSuccess, [{
            x: data.eventNums,
            y: data.unpackingSuccessVals,
            type: 'scatter',
            //name: 'last event'
            line: {shape: 'hvh'},
        }]);

        Plotly.deleteTraces(numUnpackingErrors, 0);
        Plotly.addTraces(numUnpackingErrors, [{
            x: data.eventNums,
            y: data.numUnpackingErrors,
            type: 'scatter',
            //name: 'last event'
        }]);

    });


    //
    // Update loop
    //

    (function requestPlots() {
        socket.emit('overview plots');
        setTimeout(requestPlots, 300); //[ms]
    })();

});
