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

    $('#clear').click(function() {
        socket.emit('clear time hist');
        socket.emit('overview plots');
    });


    var trace1 = {
      x: [1, 2, 3, 4],
      y: [10, 15, 13, 17],
      type: 'scatter'
    };

    var trace2 = {
      x: [1, 2, 3, 4],
      y: [16, 5, 11, 9],
      type: 'scatter'
    };

    var data = [trace1, trace2];

    Plotly.newPlot('myDiv', data);

    var data2 = [trace2, trace1];






    Plotly.newPlot(
      'tom', 
      [ { x: [], y: [], type: 'scatter' } ] ,
      { 
        title: "Tom's test plot",
        titlefont: { size: 20 },
        xaxis: { title: 'Event number', titlefont: { size: 10 } },
        yaxis: { title: 'Num unpacking errors', titlefont: { size: 10 } }
      }
    );

    socket.on('unpacking data', function(data) {
      console.log('"unpacking data" signal received');

        Plotly.deleteTraces(tom, 0);
        Plotly.addTraces(tom, [{
            x: data.eventNums,
            y: data.numUnpackingErrors,
            type: 'scatter',
            name: 'last event'
        }]);

/*
        Plotly.deleteTraces(tom, 0);
        Plotly.addTraces(tom, { y: data.numUnpackingErrors, mode: 'lines' });
*/
    });





    (function requestPlots() {
        socket.emit('overview plots');
        setTimeout(requestPlots, 300);
    })();
});
