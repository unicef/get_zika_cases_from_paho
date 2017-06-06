// node aggregate_by_amadeus_week.js --provider paho
// node aggregate_by_amadeus_week.js --provider amadeus

var ArgumentParser = require('argparse').ArgumentParser;
var async = require('async');
var config = require('./config');
var azure_storage = require('azure-storage');
var azure_utils = require('./lib/azure_helper');
var storage_account = config.azure.storage_account;
var azure_key = config.azure.key1;
var fileSvc = azure_storage.createFileService(storage_account, azure_key);
var moment = require('moment');

var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'Aggregate a csv of airport by admin 1 and 2'
});

parser.addArgument(
  ['-p', '--provider'],
  {help: 'Name of provider'}
);

var args = parser.parseArgs();
var provider = args.provider;

// var fs = require('fs');
// var moment = require('moment');
var bluebird = require('bluebird');
// var jsonfile = require('jsonfile')
// var json_dir = config.json_dir;
var path = config.azure[provider].path;
var format = config.azure[provider].format;
var dir = config.azure[provider].directory;
// Get list of case files.
azure_utils.get_file_list(fileSvc, dir, path)
.then(files => {
  // Make sure list is ordered by date: earliest to latest.
  ordered_dates = files.entries.files.map(e => {
    // return e.name.replace(/.json$/, '');
    return e.name.replace(format, '');
  }).sort();

  // Download each file
  // Sum (cases / travels) per week based on diff with previous week
  // Build hash with week date as key and it's stats as val
  bluebird.reduce(ordered_dates.slice(0, 5), (h, e, i) => {
    return sum_units_per_week_date(e, i, ordered_dates, h)
    .then(updated_hash => {
      h = updated_hash;
      return h;
    })
  }, {})
  .then(hash => {
    console.log(hash);

  })
});

function sum_units_per_week_date(filename_date, i, ordered_dates, all_dates_hash) {
  return new Promise((resolve, reject) => {
    // Ignore first (ealiest) file for now.
    // There's now way to divide it into days
    if (i === 0) {
      return resolve(all_dates_hash);
    }

    async.waterfall([
      // Get this date's data
      function(callback) {
        azure_utils.get_file(fileSvc, dir, path, ordered_dates[i], format)
        .then(obj => {
          callback(null, obj);
        });
      },
      // Get previous week's data
      function(obj_current, callback) {
        var date_previous = ordered_dates[i-1];
        var diff_in_days = moment(filename_date).diff(moment(date_previous), 'days');
        if (provider === 'paho') {
          azure_utils.get_file(fileSvc, dir, path, ordered_dates[i-1], format)
          .then(obj_past => {
            var new_and_total = new_and_total_all_countries_per_date(filename_date, diff_in_days, obj_current, obj_past);
            callback(new_and_total, diff_in_days);
          });
        } else {
          var new_and_total = new_and_total_all_countries_per_date(filename_date, diff_in_days, obj_current);
          callback(new_and_total, diff_in_days);
        }
      },

    ], (new_and_total, diff_in_days) => {
      spread_data_across_week_days(filename_date, new_and_total, all_dates_hash, diff_in_days)
      .then(resolve);
      }, 1);
  })
}

function spread_data_across_week_days(filename_date, new_and_total, all_dates_hash, diff_in_days) {
  return new Promise((resolve, reject) => {
    var range_of_days = Array(diff_in_days).fill().map((_, i) => i++);

    var this_week = range_of_days.reduce((h, n) => {
      h[moment(filename_date).subtract(n, 'days').format('YYYY-MM-DD')] = new_and_total;
      return h;
    }, {})

    resolve(Object.assign(all_dates_hash, this_week));
  })
}

function new_and_total_all_countries_per_date(filename, diff_in_days, obj_current, obj_past) {
  if (provider === 'paho') {
    return map_paho(filename, diff_in_days, obj_current, obj_past);
  } else {
    return map_amadeus(diff_in_days, obj_current);
  }
}

function map_amadeus(diff_in_days, obj_current) {
  Object.keys(obj_current.trips).forEach(k => {
    obj_current.trips[k] = obj_current.trips[k] / diff_in_days;
  });
  return obj_current;
}

function map_paho(filename, diff_in_days, obj_current, obj_past) {
  return Object.keys(obj_current.countries).reduce((h, c) => {
    var cases_current = obj_current.countries[c].autochthonous_cases_confirmed;
    var cases_old = obj_past.countries[c] ? obj_past.countries[c].autochthonous_cases_confirmed : 0;
    var cases_new = cases_current - cases_old;
    var new_cases_per_day = cases_new / diff_in_days;
    h[c] = {
              country: c,
              week_group_date: filename,
              current: cases_current,
              new_cases: cases_new,
              new_cases_per_day: Math.ceil(new_cases_per_day * 100) / 100,
            };
    return h;
  }, {});
}
