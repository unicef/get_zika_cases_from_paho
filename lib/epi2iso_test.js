var fs = require('fs');
var epi2iso = require('./epi2iso');
var dir_epi = './test/data/paho/epi/';
var dir_iso = './test/data/paho/iso/';
var provider = 'paho';
var expect = require('chai').expect;
var assert = require('chai').assert;
var jsonfile = require('jsonfile');

describe('testing utility', function() {
    before(function() {
      fs.readdirSync(dir_iso).forEach(file => {
          fs.unlinkSync(dir_iso + file);
      });
    });

    it ("Should be that 'new cases' per iso week match epi week composition", function(done) {
        // calling combine_spark_output method on test data
        epi2iso.epi_2_iso(dir_epi, dir_iso, provider).then(data => {
          jsonfile.readFile(dir_iso + '2017-01-02.json', (err, obj) => {
            console.log(obj.countries.pri)
            // Epi weeks
            // 2016-12-29: 0 cases
            // 2017-01-05: 7 cases
            // 2017-01-12: 7 cases
            // from 01-02 to 01-09

            // ISO weeks
            // 2016-12-26: [26: 0, 27: 0, 28: 0, 29: 0, 30:1, 31: 1, 1: 1]
            // 2017-01-02: [2: 1, 3: 1, 4: 1, 5: 1, 6:1, 7: 1, 8: 1]
            // 7 minus 3 === 4
            assert.equal(obj.countries.pri.new_cases_this_week, 4);
            done();
          })
        });
    });
    // it ('need to wrtie test for cumulative', function(done) {
    //
    // });

});
