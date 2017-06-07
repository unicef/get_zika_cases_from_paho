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
var jsonfile = require('jsonfile')
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
  bluebird.reduce(ordered_dates, (h, e, i) => {

    return sum_units_per_week_date(e, i, ordered_dates, h)
    .then(updated_hash => {
      h = updated_hash;
      return h;
    })
  }, {})
  .then(daily_country_cases_hash => {
    // var bucket_dates = get_bucket_dates(daily_country_cases_hash);
    var bucket_hash = get_bucket_dates_hash(daily_country_cases_hash);
    bluebird.each(Object.keys(bucket_hash), date => {
      var file = config.dir_save + date + '.json';
      console.log('Printing to', file);
      return jsonfile.writeFileSync(file, bucket_hash[date] )
    }, {concurrency: 1})
    .then(process.exit)

  })
});

function get_bucket_dates_hash(daily_country_cases_hash) {
  return Object.keys(daily_country_cases_hash).reduce((h, date) => {
    var bucket_date = get_bucket_date(date);
    if (h[bucket_date]) {
      // Iterate through days of iso week, and summing total new cases for week
      Object.keys(daily_country_cases_hash[date]).forEach(c => {
        var epi_week = daily_country_cases_hash[date][c].epi_week;
        if (h[bucket_date][c].epi_weeks) {
          if (h[bucket_date][c].epi_weeks) {
            if (h[bucket_date][c].epi_weeks[epi_week]) {
              h[bucket_date][c].epi_weeks[epi_week] += 1;
            } else {
              h[bucket_date][c].epi_weeks[epi_week] = 1;
            }
          }
        } else {
          h[bucket_date][c].epi_weeks = {};
        }

        if (h[bucket_date][c]) {
          // If first record of iso week, set to 0.
          h[bucket_date][c].new_cases_this_week = h[bucket_date][c].new_cases_this_week || 0;
          h[bucket_date][c].new_cases_this_week += daily_country_cases_hash[date][c].new_cases_per_day
        } else {
          console.log(c, 'not found', bucket_date, date);
        }
      })

    } else {
      h[bucket_date] = daily_country_cases_hash[date];

    }
    return h
  }, {});
}

function get_bucket_date(date) {
  var week_num = moment(String(date), 'YYYY-MM-DD').week();
  var year = moment(date, 'YYYY').format('YYYY');
  return moment(String(year), 'YYYY').week(week_num).day(0).add(1, 'days').format('YYYY-MM-DD');
}

// function get_bucket_dates(hash) {
//   return Object.keys(hash).reduce((h, d) => {
//     var week_num = moment(String(d), 'YYYY-MM-DD').week();
//     var year = moment(d, 'YYYY').format('YYYY');
//     var bucket_date = moment(String(year), 'YYYY').week(week_num).day(0).add(1, 'days').format('YYYY-MM-DD');
//     h[bucket_date] = 1;
//     return h;
//   }, {});
// }

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
        var new_and_total = {};
        if (provider === 'paho') {
          azure_utils.get_file(fileSvc, dir, path, ordered_dates[i-1], format)
          .then(obj_past => {
            new_and_total = new_and_total_all_countries_per_date(filename_date, diff_in_days, obj_current, obj_past);
            console.log(new_and_total, diff_in_days)
            return callback(new_and_total, diff_in_days);
          });
        } else {
          var new_and_total = new_and_total_all_countries_per_date(filename_date, diff_in_days, obj_current);
          return callback(new_and_total, diff_in_days);
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
    // return map_amadeus(diff_in_days, obj_current);
  }
}

// function map_amadeus(diff_in_days, obj_current) {
//   Object.keys(obj_current.trips).forEach(k => {
//     obj_current.trips[k] = obj_current.trips[k] / diff_in_days;
//   });
//   return obj_current;
// }

function map_paho(filename_date, diff_in_days, obj_current, obj_past) {
  return Object.keys(obj_current.countries).reduce((h, c) => {
    console.log(c)
    // All cases in country to date.
    var cases_cumulative = obj_current.countries[c].autochthonous_cases_confirmed;
    // If country is in previous week file, assign confirmed cases to cases_old
    // so you can determine growth since last week.
    var cases_old = obj_past.countries[c] ? obj_past.countries[c].autochthonous_cases_confirmed : 0;
    var cases_new = cases_cumulative - cases_old;

    if (cases_new < 0) {
      // If we notice a negative value, warn about it, and set cases_new to 0.
      // From Paho doc: As of 6 October, suspected Zika cases were adjusted by the Dominican
      // Republic Ministry of Public Health after retrospective review. As of 20 October,
      // confirmed Zika cases were adjusted by the Dominican Republic Ministry of Public
      // Health after retrospective review
      console.error('Found negative new cases for', c, 'on', filename_date, cases_new);
      cases_new = 0;
    }

    // Divide total new cases by number of days since last file date name.
    var new_cases_per_day = cases_new / diff_in_days;

    h[c] = {
              country: c,
              epi_week: filename_date,
              // Cases to date
              cases_cumulative: cases_cumulative,
              new_cases_per_day: Math.round(new_cases_per_day) //Math.ceil(new_cases_per_day * 100) / 100,
            };
    return h;
  }, {});
}
