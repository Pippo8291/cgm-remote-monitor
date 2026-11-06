'use strict';

require('should');
var createSecureDOM = require('./fixtures/secure-jsdom').createSecureDOM;
var domGlobals = require('./fixtures/dom-globals');

// Exercise bars and other duration bars (e.g. the "Automated delivery" notes
// imported by nightscout-connect) used to share one row at 50 mg/dl and drew
// on top of each other. Exercise keeps its row; the other bars sit right below.
describe('renderer duration bar rows', function () {
  var env;
  var state;
  var priorD3;
  var d3;

  beforeEach(function () {
    priorD3 = global.d3;
    d3 = global.d3 = require('./fixtures/d3');
    delete global.window;
    delete global.document;
    env = createSecureDOM('<!DOCTYPE html><html><body></body></html>');
    state = domGlobals.installDomGlobals(env);
  });

  afterEach(function () {
    delete require.cache[require.resolve('../lib/client/renderer')];
    if (priorD3 === undefined) delete global.d3;
    else global.d3 = priorD3;
    domGlobals.restoreDomGlobals(state);
  });

  function makeClient (svg, treatments) {
    return {
      careportal: { resolveEventName: function (value) { return value; } }
      , chart: {
        focus: svg.append('g')
        , prevChartWidth: 900
        , xScale: function () { return 0; }
        , yScale: function (value) { return value; }
      }
      , ddata: { treatments: treatments, tempTargetTreatments: [] }
      , focusRangeMS: 1
      , settings: { units: 'mg/dl' }
      , translate: function (value) { return value; }
      , utils: { scaleMgdl: function (value) { return value; } }
    };
  }

  // yScale maps mg/dl straight to pixels so the row offset is easy to read.
  function rowTops (svg) {
    var tops = {};
    svg.selectAll('.g-duration').each(function (d) {
      var match = /translate\([^,]+,([-0-9.]+)\)/.exec(this.getAttribute('transform'));
      tops[d.eventType] = Number(match[1]);
    });
    return tops;
  }

  function render (treatments) {
    var svg = d3.select(env.document.body).append('svg');
    var client = makeClient(svg, treatments);
    var renderer = require('../lib/client/renderer')(client, d3);
    renderer.addTreatmentCircles(new Date());
    return {
      svg: svg
      , redraw: function (next) {
        client.ddata.treatments = next;
        renderer.addTreatmentCircles(new Date());
      }
    };
  }

  var mills = Date.now();
  var exercise = { eventType: 'Exercise', duration: 60, notes: '1 h', mills: mills };
  var note = { eventType: 'Note', duration: 60, notes: 'Automated delivery', mills: mills };

  it('draws a Note duration bar one bar height below an Exercise bar', function () {
    var tops = rowTops(render([exercise, note]).svg);
    tops.Exercise.should.equal(50);
    tops.Note.should.equal(70);
  });

  // The bars are joined by index, so a data refresh can hand an existing bar
  // a treatment of another type; its colour must follow the new treatment.
  it('recolours reused bars when a refresh reorders the treatments', function () {
    var chart = render([exercise, note]);
    chart.redraw([note, exercise]);
    var fills = {};
    chart.svg.selectAll('.g-duration').each(function (d) {
      fills[d.eventType] = d3.select(this).select('rect').attr('fill');
    });
    fills.should.eql({ Exercise: 'Violet', Note: 'Salmon' });
  });

  it('resizes a reused bar that changes from a temp target to a note', function () {
    var target = { eventType: 'Temporary Target', duration: 60, targetTop: 140, targetBottom: 100, mills: mills };
    var svg = d3.select(env.document.body).append('svg');
    var client = makeClient(svg, []);
    client.ddata.tempTargetTreatments = [target];
    var renderer = require('../lib/client/renderer')(client, d3);
    renderer.addTreatmentCircles(new Date());
    client.ddata.tempTargetTreatments = [];
    client.ddata.treatments = [note];
    renderer.addTreatmentCircles(new Date());
    svg.select('.g-duration rect').attr('height').should.equal('20');
  });
});
