var async = require('async');
var config = require('./config');
var azure_storage = require('azure-storage');
var azure_utils = require('./lib/azure_helper');
var storage_account = config.azure.storage_account;
var azure_key = config.azure.key1;
var fileSvc = azure_storage.createFileService(storage_account, azure_key);
var moment = require('moment');
// var fs = require('fs');
// var moment = require('moment');
var bluebird = require('bluebird');
// var jsonfile = require('jsonfile')
// var json_dir = config.json_dir;
var path = '/zika/paho/json';

azure_utils.get_file_list(fileSvc, path)
.then(files => {
  ordered_dates = files.entries.files.map(e => {
    return e.name.replace(/.json$/, '');
  }).sort();

  bluebird.reduce(ordered_dates, (h, e, i) => {
    return process_file(e, i, ordered_dates, h)
    .then(updated_hash => {
      h = updated_hash;
      return h;
    })
  }, {})
  .then(hash => {
    console.log(Object.keys(hash));
  })
});

function process_file(filename, i, ordered_dates, hash) {
  return new Promise((resolve, reject) => {
    if (i === 0) {
      return resolve(hash);
    }

    async.waterfall([
      // Get this date's data
      function(callback) {
        azure_utils.get_file(fileSvc, path, ordered_dates[i] + '.json')
        .then(obj => {
          callback(null, obj);
        });
      },
      // Get previous week's data
      function(obj_current, callback) {
        azure_utils.get_file(fileSvc, path, ordered_dates[i-1] + '.json')
        .then(obj_past => {
          var new_and_total = new_and_total_all_countries_per_date(filename, obj_current, obj_past);
          callback(new_and_total);
        });
      },

    ], (new_and_total) => {
      console.log(new_and_total.bra.date)
        // console.log('Done with', filename);
        hash[filename] = new_and_total
        resolve(hash);
      }, 1);
  })
}

function new_and_total_all_countries_per_date(filename, obj_current, obj_past) {
  return Object.keys(obj_current.countries).reduce((h, c) => {
    var cases_current = obj_current.countries[c].autochthonous_cases_confirmed;
    var cases_old = obj_past.countries[c] ? obj_past.countries[c].autochthonous_cases_confirmed : 0;
    var cases_new = cases_current - cases_old;
    var new_cases_per_day = cases_new / 7;
    h[c] = {
              country: c,
              date: filename,
              current: cases_current,
              new_cases: cases_new,
              new_cases_per_day: Math.ceil(new_cases_per_day * 100) / 100,
            };
    return h;
  }, {});
}
