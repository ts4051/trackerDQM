$(document).ready(function() {
    'use strict';

    var socket = io();

    socket.on('refresh', function() { document.location.reload(true); });

    var chosenXtalNum = 0;

    var caloNum = parseInt($('caloNum').text());

    socket.emit('nXtals?', caloNum);

    var islandType = 'sync';

    $('#update').click(function() {
        socket.emit('deliver all ' + islandType + ' traces', { 'caloNum': caloNum.toString() });
    });

    $('#islandType').click(function() {
        if (islandType === 'sync') {
            islandType = 'phys';
        } else {
            islandType = 'sync';
        }
        socket.emit('deliver all ' + islandType + ' traces', { 'caloNum': caloNum.toString() });
    });

    var traceplot = document.getElementById('singleTrace');
    Plotly.newPlot('singleTrace', [{
        y: [],
        type: 'scatter',
        mode: 'lines'
    }], {
        titlefont: { size: 20 },
        xaxis: { title: 'sample #', titlefont: { size: 20 } },
        yaxis: { title: 'adc counts', titlefont: { size: 20 }, zeroline: false }
    });

    function plotXtal(xtalNum) {
        // make the requested single trace
        Plotly.deleteTraces(traceplot, 0);
        Plotly.addTraces(traceplot, { y: lastTraces[xtalNum], mode: 'lines' });
        Plotly.relayout(traceplot, { title: 'xtal ' + xtalNum.toString() });
    }

    var traceplotmax = document.getElementById('maxXtal');
    Plotly.newPlot('maxXtal', [{
        y: [],
        type: 'scatter',
        mode: 'lines',
        line: { color: 'red' },
    }], {
        titlefont: { size: 20 },
        xaxis: { title: 'sample #', titlefont: { size: 20 } },
        yaxis: { title: 'adc counts', titlefont: { size: 20 }, zeroline: false }
    });

    function plotMaxXtal(xtalNum) {
        Plotly.deleteTraces(traceplotmax, 0);
        Plotly.addTraces(traceplotmax, { y: lastTraces[xtalNum], mode: 'lines', line: { color: 'red' } });
        Plotly.relayout(traceplotmax, { title: 'xtal ' + xtalNum.toString() });
    }

    function getTraceClickFunction(xtalNum) {
        return function() {
            if (lastTraces !== null) {
                chosenXtalNum = xtalNum;
                plotXtal(chosenXtalNum);
            }
        };
    }

    socket.on('nXtals', function(nXtals) {
        for (var i = nXtals - 1; i >= 0; --i) {
            $('#traceContainer')
                .append('<div class="tracePlot" id="' +
                    'trace' + i.toString() + '"></div>');
            $('#trace' + i.toString()).click(getTraceClickFunction(i));
        }

        (function getAllTraces() {
            socket.emit('deliver all ' + islandType + ' traces', { 'caloNum': caloNum.toString() });
            setTimeout(getAllTraces, 10000);
        })();
    });

    var gridXtalPlots = [];

    function makeXtalPlotInGrid(xtalNum, data, nXtals, maxXtal) {
        var color = xtalNum === maxXtal ? 'red' : 'blue';
        if (gridXtalPlots.length <= xtalNum) {
            gridXtalPlots.push(document.getElementById('trace' + xtalNum.toString()));
            Plotly.newPlot('trace' + xtalNum.toString(), [{
                y: [],
                type: 'scatter',
                mode: 'lines',
            }], {
                yaxis: { range: [-2000, 2000], showticklabels: false, zeroline: false, },
                xaxis: { showticklabels: false },
                margin: {
                    l: 5,
                    r: 5,
                    b: 5,
                    t: 20
                },
                title: '<b>' + xtalNum.toString() + '</b>',
                titlefont: { size: 8 }
            }, { staticPlot: true });
        }
        Plotly.deleteTraces(gridXtalPlots[xtalNum], 0);
        Plotly.addTraces(gridXtalPlots[xtalNum], { y: data[xtalNum], mode: 'lines', line: { color: color } });
        // yield some control to the browser
        if (xtalNum + 1 < nXtals) {
            setTimeout(function() { makeXtalPlotInGrid(xtalNum + 1, data, nXtals, maxXtal); }, 0);
        }
    }

    var lastTraces = null;

    socket.on('all traces', function(data) {
        if (caloNum == data.caloNum) {
            lastTraces = data.traces;
            plotXtal(chosenXtalNum);
            plotMaxXtal(data.maxXtal);
            makeXtalPlotInGrid(0, lastTraces, data.traces.length, data.maxXtal);
            $('#eventNum').text(data.event.toString());
            $('#runNum').text(data.run.toString());
            if ($('#iTypeString').text().trim() !== islandType) {
                $('#iTypeString').text(islandType + ' ');
            }
        }
    });

    socket.on('connected', function() {
        $('#connected').show();
        $('#notConnected').hide();
    });

    socket.on('not connected', function() {
        $('#notConnected').show();
        $('#connected').hide();
    });
});
