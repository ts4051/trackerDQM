$(document).ready(function() {
    'use strict';

    var socket = io();

    var caloNum = parseInt($('caloNum').text());

    // display whether or not we're connected
    socket.on('connected', function() {
        $('#connected').show();
        $('#notConnected').hide();
    });

    socket.on('not connected', function() {
        $('#notConnected').show();
        $('#connected').hide();
    });

    $('#clear').click(function() {
        socket.emit('clear q hist', { caloNum: caloNum });
    });

    var qHist = document.getElementById('qPlot');
    Plotly.newPlot('qPlot', [
        { y: [], type: 'scatter', mode: 'lines' }
    ], {
        title: 'q histogram',
        titlefont: { size: 20 },
        xaxis: { title: 'bin number', titlefont: { size: 20 } },
        yaxis: { title: 'q sum', titlefont: { size: 20 } },
    });
    socket.on('q hist', function(data) {
        var update = { title: 'run ' + data.runNum.toString() + ' event ' + data.eventNum.toString() + ', ' + data.nFills.toString() + ' fills' };
        Plotly.relayout(qHist, update);
        Plotly.deleteTraces(qHist, 0);
        Plotly.addTraces(qHist, { y: data.bins, mode: 'lines', line: { color: 'black' } });
        socket.emit('deliver q bank', { caloNum: caloNum });
    });

    // prepare q bank
    var qBank = document.getElementById('qBank');
    Plotly.newPlot('qBank', [
        { y: [], type: 'scatter', mode: 'lines' }
    ], {
        title: 'last CQ bank',
        titlefont: { size: 20 },
        xaxis: { title: 'bin number', titlefont: { size: 20 } },
        yaxis: { title: 'q sum', titlefont: { size: 20 } },
    });
    socket.on('q bank', function(data) {
        var update = { title: 'run ' + data.runNum.toString() + ' event ' + data.eventNum.toString() + ', CQ bank' };
        Plotly.relayout(qBank, update);
        Plotly.deleteTraces(qBank, 0);
        Plotly.addTraces(qBank, { y: data.bins, mode: 'lines', line: { color: 'black' } });
    });

    (function requestHist() {
        socket.emit('deliver q hist', { caloNum: caloNum });
        setTimeout(requestHist, 30000);
    })();

    $('#update').click(function() {
        socket.emit('deliver q hist', { caloNum: caloNum });
    });
});
