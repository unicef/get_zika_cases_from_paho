// node aggregate_by_amadeus_week.js --provider paho
// node aggregate_by_amadeus_week.js --provider amadeus


// This script transforms epi weeks to iso weeks

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
  }).sort()//.filter(e=> {return e.match('2017')});

  // Download each epi week file
  // Determine total new cases for epi week by comparing its cumulative cases with previous week's cumulative cases
  // Use "week 2 day" calculation to assign a number of new cases to each calendar date.
  // (Basically divide the total new cases by number of days since last epi week. (Sometimes 6, not 7.)
  // Build hash with iso week date as key and all country stats for that week.
  // Then write each key value to a file. File name as date (key), content is countries and stats (value).
  bluebird.reduce(ordered_dates, (h, e, i) => {
    return determine_new_cases_per_epi_week_date(e, i, ordered_dates, h)
    // updated_epi_week_hash is the countries object, each country updated with number of new cases per day
    .then(updated_epi_week_hash => {
      h = updated_epi_week_hash;
      return h;
    })
  }, {})
  .then(daily_country_cases_hash => {
    // Create new hash with iso week start date as key
    var isoweek_hash = get_isoweek_dates_hash(daily_country_cases_hash);
    isoweek_hash_updated_cumulative_cases = update_cumulative_cases(isoweek_hash);
    // Iterate through each iso week start date
    bluebird.each(Object.keys(isoweek_hash_updated_cumulative_cases), date => {
      var file = config.dir_save + date + '.json';
      console.log('Printing to', file);
      //console.log(isoweek_hash[date])
      return jsonfile.writeFileSync(file, isoweek_hash_updated_cumulative_cases[date] )
    }, {concurrency: 1})
    .then(process.exit)

  })
});

function update_cumulative_cases(isoweek_hash) {
  Object.keys(isoweek_hash).forEach(d => {
    Object.keys(isoweek_hash[d]).forEach(c => {
      var epi_cases_cumulative = isoweek_hash[d][c].epi_cases_cumulative;
      isoweek_hash[d][c].cases_cumulative = epi_cases_cumulative.reduce((t, n) => {
        t+=n;
        return t;
      }, 0) / epi_cases_cumulative.length
      console.log(isoweek_hash[d][c])
    })
  })
  return isoweek_hash;
}

/**
 * Create hash with iso weeks as key, and country stats as value
 * @param{String} daily_country_cases_hash - keys are daily dates, values are all countries with that day's stats
 * @return{hash} Returns hash with iso_dates as keys
 */
function get_isoweek_dates_hash(daily_country_cases_hash) {
  //console.log(daily_country_cases_hash)
  // Iterate through each day
  var keys = Object.keys(daily_country_cases_hash).sort()

  return Object.keys(daily_country_cases_hash).sort().reduce((h, date, i) => {
    if (i > 0) {
    }

    // get iso week that day belongs to.
    var isoweek_start_date = get_isoweek_start_date(date);

    if (!h[isoweek_start_date]) {
      // This is the first day of iso week
      // Assign it values for all countries
      // After this, remaining days with all countries increment their values
      h[isoweek_start_date] =  daily_country_cases_hash[date] //clone(daily_country_cases_hash[date]);

      h[isoweek_start_date] = add_epi_week_composition(
        h[isoweek_start_date]
      )
    } else {
      // Iterate through days of iso week, and summing total new cases for week
      Object.keys(daily_country_cases_hash[date]).forEach(c => {
        if (h[isoweek_start_date][c]) {
          // If first record of iso week, set to 0.
          h[isoweek_start_date][c].new_cases_this_week = h[isoweek_start_date][c].new_cases_this_week || 0;
          h[isoweek_start_date][c].new_cases_this_week += daily_country_cases_hash[date][c].new_cases_per_day
          var epi_week = daily_country_cases_hash[date][c].epi_week;
          var epi_cases_cumulative = daily_country_cases_hash[date][c].cases_cumulative;

          if (h[isoweek_start_date][c].epi_cases_cumulative) {
            h[isoweek_start_date][c].epi_cases_cumulative.push(epi_cases_cumulative)
          } else {
            h[isoweek_start_date][c].epi_cases_cumulative = [epi_cases_cumulative];
          }

          if (h[isoweek_start_date][c].epi_weeks[epi_week]) {
            h[isoweek_start_date][c].epi_weeks[epi_week] = h[isoweek_start_date][c].epi_weeks[epi_week] + 1;
          } else {
            h[isoweek_start_date][c].epi_weeks[epi_week] = 1;
          }
        } else {
          console.log(c, 'not found', isoweek_start_date, date);
        }
      })
    }
    return h
  }, {});
}

/**
 * Iso week may contain data from up to two epi weeks.
 * Keep track of each epi week portion in iso week
 * in order to aggregate cumulative cases figure
 * @param{Object} bucket_date_hash - Has country to stats for one iso week date
 * @param{Object} day_country_cases_hash - Key for every country and value is country stats
 * @return{hash} Returns bucket_date_hash updated with epi_weeks object:
 * keys are epi week dates and value is number times seen
 */
function add_epi_week_composition(isoweek_start_day_hash) {
  Object.keys(isoweek_start_day_hash).forEach(c => {
    // The epi week start date this country on this day belongs to
    var epi_week = isoweek_start_day_hash[c].epi_week;
    var epi_cases_cumulative = isoweek_start_day_hash[c].cases_cumulative;
    isoweek_start_day_hash[c].epi_weeks = {};
    isoweek_start_day_hash[c].epi_cases_cumulative = [epi_cases_cumulative];
    isoweek_start_day_hash[c].epi_weeks[epi_week] = 1;
  })
  return isoweek_start_day_hash;
}

function get_isoweek_start_date(date) {

  //console.log(date, moment(String(date), 'YYYY-MM-DD').startOf('isoWeek').format('YYYY-MM-DD'))
  return moment(String(date), 'YYYY-MM-DD').startOf('isoWeek').format('YYYY-MM-DD');
}

function determine_new_cases_per_epi_week_date(filename_date, i, ordered_dates, all_dates_hash) {
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
        var new_and_cumulative = {};
        if (provider === 'paho') {
          azure_utils.get_file(fileSvc, dir, path, ordered_dates[i-1], format)
          .then(obj_past => {
            new_and_cumulative = update_country_objects_with_num_new_cases(filename_date, diff_in_days, obj_current, obj_past);
            return callback(new_and_cumulative, diff_in_days);
          });
        } else {
          // // In case we have to do this for amadeus
          // var new_and_cumulative = update_country_objects_with_num_new_cases(filename_date, diff_in_days, obj_current);
          // return callback(new_and_cumulative, diff_in_days);
        }
      },

    ], (new_and_cumulative, diff_in_days) => {
      spread_data_across_week_days(filename_date, new_and_cumulative, all_dates_hash, diff_in_days)
      .then(resolve);
      }, 1);
  })
}

function spread_data_across_week_days(filename_date, new_and_cumulative, all_dates_hash, diff_in_days) {

  return new Promise((resolve, reject) => {
    var range_of_days = Array(diff_in_days).fill().map((_, i) => i++);


    // if (filename_date === '2017-04-27'){
      var this_week = range_of_days.reduce((h, n) => {

        h[moment(filename_date).subtract(n, 'days').format('YYYY-MM-DD')] = clone(new_and_cumulative);
        //   {},
        //   new_and_cumulative
        // );
        return h;
      }, {})

    resolve(Object.assign(all_dates_hash, this_week));
  })
}

function update_country_objects_with_num_new_cases(filename, diff_in_days, obj_current, obj_past) {
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

/**
 * For every country in current object, get total new cases by comparing with
 * last weeks cumulative cases.
 * Update all country objects and return.
 * @param{String} filename_date - epi date file name
 * @param{String} diff_in_days - difference in days between epi date files: 6 or 7.
 * @param{String} obj_current - current epi week's data per country being processed
 * @param{String} obj_past - previous epi week's data per country being processed
 * @return{Promise} Fulfilled when records are returned
 */
function map_paho(filename_date, diff_in_days, obj_current, obj_past) {
   // { date: '2017-01-12',
   //  countries:
   //   { can:
   //      { country: 'Canada',
  return Object.keys(obj_current.countries).reduce((h, c) => {
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

function clone(obj) {
  if (obj === null || typeof(obj) !== 'object' || 'isActiveClone' in obj)
    return obj;

  if (obj instanceof Date)
    var temp = new obj.constructor(); //or new Date(obj);
  else
    var temp = obj.constructor();

  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      obj['isActiveClone'] = null;
      temp[key] = clone(obj[key]);
      delete obj['isActiveClone'];
    }
  }

  return temp;
}
