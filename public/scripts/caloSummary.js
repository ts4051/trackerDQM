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

    var caloNum = parseInt($('caloNum').text());

    var ampHist = document.getElementById('histAmpl');
    Plotly.newPlot('histAmpl', [
        { y: [], mode: 'markers' }, { y: [], mode: 'markers' }
    ], {
        title: 'sync pulse amplitudes',
        titlefont: { size: 20 },
        xaxis: { title: 'xtal num', zeroline: false, titlefont: { size: 20 } },
        yaxis: { title: 'amplitude', titlefont: { size: 20 } },
        legend: { orientation: 'h', font: { size: 15 } }
    });

    var pedHist = document.getElementById('histPed');
    Plotly.newPlot('histPed', [
        { y: [], mode: 'markers' }, { y: [], mode: 'markers' }
    ], {
        title: 'pedestals',
        titlefont: { size: 20 },
        xaxis: { title: 'xtal num', zeroline: false, titlefont: { size: 20 } },
        yaxis: { title: 'pedestals', titlefont: { size: 20 } },
        legend: { orientation: 'h', font: { size: 15 } }
    });

    socket.on('calo data', function(data) {
        if (data.caloNum === caloNum) {
            Plotly.deleteTraces(ampHist, [0, 1]);
            Plotly.addTraces(ampHist, [
                { y: data.ampl.last, mode: 'markers', name: 'last event' },
                { y: data.ampl.runningAvgs, mode: 'markers', name: '<last 10 events>' }
            ]);
            Plotly.deleteTraces(pedHist, [0, 1]);
            Plotly.addTraces(pedHist, [
                { y: data.ped.last, mode: 'markers', name: 'last event' },
                { y: data.ped.runningAvgs, mode: 'markers', name: '<last 10 events>' }
            ]);
        }
    });

    (function requestPlots() {
    	socket.emit('calo summary plots', caloNum);
        setTimeout(requestPlots, 300);
    })();

});
