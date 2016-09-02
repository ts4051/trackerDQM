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
    // Hit channel histograms (1 per layer)
    //

    //M0 U0
    Plotly.newPlot(
      'M0U0HitChannels', 
      [ { y: [], type: 'bar' } ] ,
      { 
        title: "Module 0 U0 Hit Channels",
        titlefont: { size: 20 },
        xaxis: { title: 'Wire', titlefont: { size: 15 } },
        yaxis: { title: 'Counts', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('hit channels M0 U0', function(data) {

        Plotly.deleteTraces(M0U0HitChannels, 0);
        Plotly.addTraces(M0U0HitChannels, { 
          x: data.binCenters, 
          y: data.binContents, 
          marker: { color: 'black' },
          type: 'bar' }
        );

    });

    //M0 U1
    Plotly.newPlot(
      'M0U1HitChannels', 
      [ { y: [], type: 'bar' } ] ,
      { 
        title: "Module 0 U1 Hit Channels",
        titlefont: { size: 20 },
        xaxis: { title: 'Wire', titlefont: { size: 15 } },
        yaxis: { title: 'Counts', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('hit channels M0 U1', function(data) {

        Plotly.deleteTraces(M0U1HitChannels, 0);
        Plotly.addTraces(M0U1HitChannels, {
          x: data.binCenters, 
          y: data.binContents, 
          marker: { color: 'black' },
          type: 'bar' }
        );

    });


    //M0 V0
    Plotly.newPlot(
      'M0V0HitChannels', 
      [ { y: [], type: 'bar' } ] ,
      { 
        title: "Module 0 V0 Hit Channels",
        titlefont: { size: 20 },
        xaxis: { title: 'Wire', titlefont: { size: 15 } },
        yaxis: { title: 'Counts', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('hit channels M0 V0', function(data) {

        Plotly.deleteTraces(M0V0HitChannels, 0);
        Plotly.addTraces(M0V0HitChannels,  {
          x: data.binCenters, 
          y: data.binContents, 
          marker: { color: 'black' },
          type: 'bar' }
        );

    });


    //M0 V1
    Plotly.newPlot(
      'M0V1HitChannels', 
      [ { y: [], type: 'bar' } ] ,
      { 
        title: "Module 0 V1 Hit Channels",
        titlefont: { size: 20 },
        xaxis: { title: 'Wire', titlefont: { size: 15 } },
        yaxis: { title: 'Counts', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('hit channels M0 V1', function(data) {

        Plotly.deleteTraces(M0V1HitChannels, 0);
        Plotly.addTraces(M0V1HitChannels, {
          x: data.binCenters, 
          y: data.binContents, 
          marker: { color: 'black' },
          type: 'bar' }
        );

    });

    //M1 U0
    Plotly.newPlot(
      'M1U0HitChannels', 
      [ { y: [], type: 'bar' } ] ,
      { 
        title: "Module 1 U0 Hit Channels",
        titlefont: { size: 20 },
        xaxis: { title: 'Wire', titlefont: { size: 15 } },
        yaxis: { title: 'Counts', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('hit channels M1 U0', function(data) {

        Plotly.deleteTraces(M1U0HitChannels, 0);
        Plotly.addTraces(M1U0HitChannels, {
          x: data.binCenters, 
          y: data.binContents, 
          marker: { color: 'black' },
          type: 'bar' }
        );

    });

    //M1 U1
    Plotly.newPlot(
      'M1U1HitChannels', 
      [ { y: [], type: 'bar' } ] ,
      { 
        title: "Module 1 U1 Hit Channels",
        titlefont: { size: 20 },
        xaxis: { title: 'Wire', titlefont: { size: 15 } },
        yaxis: { title: 'Counts', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('hit channels M1 U1', function(data) {

        Plotly.deleteTraces(M1U1HitChannels, 0);
        Plotly.addTraces(M1U1HitChannels, {
          x: data.binCenters, 
          y: data.binContents, 
          marker: { color: 'black' },
          type: 'bar' }
        );

    });


    //M1 V0
    Plotly.newPlot(
      'M1V0HitChannels', 
      [ { y: [], type: 'bar' } ] ,
      { 
        title: "Module 1 V0 Hit Channels",
        titlefont: { size: 20 },
        xaxis: { title: 'Wire', titlefont: { size: 15 } },
        yaxis: { title: 'Counts', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('hit channels M1 V0', function(data) {

        Plotly.deleteTraces(M1V0HitChannels, 0);
        Plotly.addTraces(M1V0HitChannels, {
          x: data.binCenters, 
          y: data.binContents, 
          marker: { color: 'black' },
          type: 'bar' }
        );

    });


    //M1 V1
    Plotly.newPlot(
      'M1V1HitChannels', 
      [ { y: [], type: 'bar' } ] ,
      { 
        title: "Module 1 V1 Hit Channels",
        titlefont: { size: 20 },
        xaxis: { title: 'Wire', titlefont: { size: 15 } },
        yaxis: { title: 'Counts', titlefont: { size: 15 } }
      }
    );

    //Update plots when receive new data
    socket.on('hit channels M1 V1', function(data) {

        Plotly.deleteTraces(M1V1HitChannels, 0);
        Plotly.addTraces(M1V1HitChannels, {
          x: data.binCenters, 
          y: data.binContents, 
          marker: { color: 'black' },
          type: 'bar' }
        );

    });


    //
    // Update loop
    //

    (function requestPlots() {
        socket.emit('channels plots');
        setTimeout(requestPlots, 1000); //[ms]
    })();

});
