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

  // yScale maps mg/dl straight to pixels so the row offset is easy to read.
  function rowTops (treatments) {
    var svg = d3.select(env.document.body).append('svg');
    var client = {
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
    require('../lib/client/renderer')(client, d3).addTreatmentCircles(new Date());
    var tops = {};
    svg.selectAll('.g-duration').each(function (d) {
      var match = /translate\([^,]+,([-0-9.]+)\)/.exec(this.getAttribute('transform'));
      tops[d.eventType] = Number(match[1]);
    });
    return tops;
  }

  it('draws a Note duration bar one bar height below an Exercise bar', function () {
    var mills = Date.now();
    var tops = rowTops([
      { eventType: 'Exercise', duration: 60, notes: 'Activity mode', mills: mills }
      , { eventType: 'Note', duration: 60, notes: 'Automated delivery', mills: mills }
    ]);
    tops.Exercise.should.equal(50);
    tops.Note.should.equal(70);
  });
});
