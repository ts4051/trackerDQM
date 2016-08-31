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

    // dawing line shapes ripped from http://community.plot.ly/t/gridlines-over-heatmap/970
    function makeLineVert(x) {
        return {
            type: 'line',
            xref: 'x',
            yref: 'paper',
            x0: x,
            y0: 0,
            x1: x,
            y1: 0.85,
        };
    }

    function makeLineHoriz(y) {
        return {
            type: 'line',
            xref: 'paper',
            yref: 'y',
            x0: 0,
            y0: y,
            x1: 0.85,
            y1: y,
        };
    }

    var posPlot = document.getElementById('positionPlot');
    Plotly.newPlot('positionPlot', [
        { z: [], type: 'heatmap' }, { y: [], type: 'bar' }, { y: [], type: 'bar' },
    ], {
        title: 'hit positions',
        showlegend: false,
        margin: { t: 50 },
        bargap: 0,
        titlefont: { size: 20 },
        xaxis: { title: 'column number', titlefont: { size: 20 }, domain: [0, 0.85], showgrid: true },
        yaxis: { title: 'row number', titlefont: { size: 20 }, domain: [0, 0.85], showgrid: true },
        xaxis2: { domain: [0.85, 1], showgrid: false, showticklabels: false },
        yaxis2: { domain: [0.85, 1], showgrid: false, showticklabels: false },
        shapes: [0, 1, 2, 3, 4, 5, 6, 7, 8]
            .map(makeLineVert)
            .concat([0, 1, 2, 3, 4, 5]
                .map(makeLineHoriz)
            ),
    });

    socket.on('position plots', function(data) {
        Plotly.deleteTraces(posPlot, [0, 1, 2]);
        Plotly.addTraces(posPlot, [
            { z: data.z, x: data.xBinCenters, y: data.yBinCenters, type: 'heatmap' },
            { y: data.xBinContents, x: data.xBinCenters, type: 'bar', yaxis: 'y2', marker: { color: 'black' } },
            { y: data.yBinCenters, x: data.yBinContents, type: 'bar', xaxis: 'x2', orientation: 'h', marker: { color: 'black' } }
        ]);
    });


    (function requestPlots() {
        socket.emit('position plots');
        setTimeout(requestPlots, 1000);
    })();
});
