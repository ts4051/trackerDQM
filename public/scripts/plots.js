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

    var hitHist = document.getElementById('hist');
    Plotly.newPlot('hist', [
        { y: [], type: 'bar' }, { y: [], type: 'bar' }
    ], {
        title: 'islands',
        titlefont: { size: 20 },
        xaxis: { title: 'calo num', titlefont: { size: 20 } },
        yaxis: { title: 'num islands', titlefont: { size: 20 }, zeroline: false },
        legend: { orientation: 'h', font: { size: 15 } }
    });
    var linePlot = document.getElementById('line');
    Plotly.newPlot('line', [
        { y: [], type: 'line' }
    ], {
        title: 'island history',
        titlefont: { size: 20 },
        xaxis: { showticklabels: false },
        yaxis: { title: 'num islands', titlefont: { size: 20 } }
    });
    socket.on('calo island data', function(data) {
        Plotly.deleteTraces(hist, [0, 1]);
        Plotly.addTraces(hist, [{
            x: data.caloNums,
            y: data.lastIslands,
            type: 'bar',
            name: 'last event'
        }, {
            x: data.caloNums,
            y: data.lastAvgs,
            type: 'bar',
            name: '<last 10 events>'
        }]);

        Plotly.deleteTraces(line, 0);
        Plotly.addTraces(line, { y: data.history, mode: 'lines' });
    });

    var logScale = false;
    $('#logScale').click(function() {
        if (logScale) {
            logScale = false;
            $('#logScale').text('log scale');
        } else {
            logScale = true;
            $('#logScale').text('linear scale');
        }
    });

    var timeHist = document.getElementById('timesHist');
    Plotly.newPlot('timesHist', [{ y: [], type: 'bar' }], {
        title: 'time spectrum',
        titlefont: { size: 20 },
        xaxis: { title: 'time [clock ticks / 1000]', titlefont: { size: 20 } },
        yaxis: { title: 'num islands', titlefont: { size: 20 } }
    });
    socket.on('time hist', function(data) {
        var update;
        if (!logScale) {
            update = { title: 'time spectrum, ' + data.nFills.toString() + ' fills', yaxis: { type: 'linear' } };
        } else {
            update = { title: 'time spectrum, ' + data.nFills.toString() + ' fills', yaxis: { type: 'log' } };
        }
        Plotly.relayout(timeHist, update);

        Plotly.deleteTraces(timeHist, 0);
        Plotly.addTraces(timeHist, { y: data.bins, marker: { color: 'black' }, type: 'bar' });
    });

    (function requestPlots() {
        socket.emit('overview plots');
        setTimeout(requestPlots, 300);
    })();
});
