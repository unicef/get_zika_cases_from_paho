// This script transforms epi weeks to iso weeks
// Run: node group_paho_by_iso.js --provider paho
var async = require('async');
var bluebird = require('bluebird');
var fs = bluebird.promisifyAll(require('fs'));
var jsonfile = require('jsonfile');
var jsonread = bluebird.promisify(jsonfile.readFile);
var jsonfile = require('jsonfile')
var moment = require('moment');

// Get list of case files previously fetched from paho and stored in a directory in key value format.
var getFiles = function (dir) {
  return new Promise((resolve, reject) => {
    return fs.readdir(dir, (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  })
};

var getContent = function (dir, filename) {
    return fs.readFileAsync(directory + "/" + filename, "utf8");
};

exports.epi_2_iso = function(dir_epi, dir_iso, provider) {
  console.log(dir_iso)
  return new Promise((resolve, reject) => {
    // Fetch all Epi week files that have been downloaded from paho
    // Each file name is date of the last day of an Epi week
    // Create an ordered list of dates before iterating through each file
    // and keep track of number of new cases per Epi week per country
    // before grouping all days by ISO week.
    getFiles(dir_epi, provider)
    .catch(err => {console.log(err);})
    .then(files => {
      // Ordered by date: earliest to latest.
      // Facilitates fetching previous file for comparison.
      ordered_dates = files.map(e => {
        return e.replace('.json', '');
      }).sort()

      // Download each epi week file
      // Determine total new cases for epi week by comparing its cumulative cases with previous week's cumulative cases
      // Use "week 2 day" calculation to assign a number of new cases to each calendar date.
      // (Basically divide the total new cases by number of days since last epi week. (Sometimes 6, not 7.)
      // Build hash with iso week date as key and all country stats for that week.
      // Then write each key value to a file. File name as date (key), content is countries and stats (value).
      bluebird.reduce(ordered_dates, (h, e, i) => {
        return determine_new_cases_per_epi_week_date(e, i, ordered_dates, h, dir_epi, provider)
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
          var file = dir_iso + date + '.json';
          console.log('Printing to', file);
          //console.log(isoweek_hash[date])
          var content = {
            date: date,
            countries: isoweek_hash_updated_cumulative_cases[date]
          }
          return jsonfile.writeFileSync(file, content)
        }, {concurrency: 1})
        .then(resolve('Done'))
      })
    });
  })
}

/**
 * Determine total each countries total cases that ISO week by adding distribution of epi week new cases.
 * @param{Object} isoweek_hash - Each country and their epi week new cases composition
 * @return{hash} Returns hash with iso_dates as keys
 */
function update_cumulative_cases(isoweek_hash) {
  Object.keys(isoweek_hash).forEach(d => {
    Object.keys(isoweek_hash[d]).forEach(c => {
      var country_stats = isoweek_hash[d][c];
      var pre_average = Object.keys(isoweek_hash[d][c].epi_week_2_cumulative).reduce((n, yyyymmdd) => {
        n += (country_stats.epi_weeks[yyyymmdd] * country_stats.epi_week_2_cumulative[yyyymmdd]);
        return n;
      }, 0);
      var num_days_in_epi_week = Object.keys(isoweek_hash[d][c].epi_weeks).reduce((n, yyyymmdd) => {
        n += country_stats[yyyymmdd];
        return n;
      }, 0);
      isoweek_hash[d][c].cases_cumulative = pre_average / num_days_in_epi_week;
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

  // Iterate through each day
  var keys = Object.keys(daily_country_cases_hash).sort()

  return Object.keys(daily_country_cases_hash).sort().reduce((h, date, i) => {
    if (i > 0) {
    }

    // get iso week that day belongs to.
    var isoweek_start_date = get_isoweek_start_date(date);
    h[isoweek_start_date] = h[isoweek_start_date] || {};
    h[isoweek_start_date] = add_epi_week_composition(
      h,
      isoweek_start_date,
      daily_country_cases_hash[date],
      isoweek_start_date,
      date
    )
    return h
  }, {});
}

/**
 * Iso week may contain data from up to two epi weeks.
 * Keep track of each epi week portion in iso week
 * in order to aggregate cumulative cases figure
 * @param{Object} isow_start_day - Has country to stats for one iso week date
 * @param{Object} day_country_cases_hash - Key for every country and value is country stats
 * @return{hash} Returns bucket_date_hash updated with epi_weeks object:
 * keys are epi week dates and value is number times seen
 */
function add_epi_week_composition(isow_hash, isoweek_start_date, date_country_cases_hash,isoweek_start_date, date) {
  var isow_start_day = isow_hash[isoweek_start_date];
  Object.keys(date_country_cases_hash).forEach(c => {
    var country_obj = date_country_cases_hash[c];
    // New cases per day for this epi week.
    var new_cases_per_day = country_obj.new_cases_per_day;
    // The epi week start date this country on this day belongs to
    var epi_week_date = country_obj.epi_week;

    // If first record of iso week, set to 0.
    isow_start_day[c] = isow_start_day[c] || {
      new_cases_this_week: 0,
    }
    isow_start_day[c].iso_week = isoweek_start_date;
    isow_start_day[c].new_cases_this_week += new_cases_per_day;

    // epi_weeks is a hash of epi week to number of times seen in this ISO week
    if (isow_start_day[c].epi_weeks) {
      isow_start_day[c].epi_week_2_cases_per_day[epi_week_date] = new_cases_per_day;
      var epi_week_cum_val = isow_start_day[c].epi_weeks[epi_week_date];
      if (epi_week_cum_val) {
        isow_start_day[c].epi_weeks[epi_week_date] = epi_week_cum_val + 1;
      } else {
        isow_start_day[c].epi_weeks[epi_week_date] = 1;
      }
    } else {
      isow_start_day[c].epi_weeks = {};
      isow_start_day[c].epi_weeks[epi_week_date] = 1;
      isow_start_day[c].epi_week_2_cumulative = {};
      isow_start_day[c].epi_week_2_cases_per_day = {};
      isow_start_day[c].epi_week_2_cases_per_day[epi_week_date] = new_cases_per_day;
    }
  })

  return isow_start_day;
}

function get_isoweek_start_date(date) {
  return moment(String(date), 'YYYY-MM-DD').startOf('isoWeek').format('YYYY-MM-DD');
}

/**
 * In order to determin total number of new cases for an Epi week
 * We have to subtract last weeks cumulative confirmed cases from this week's.
 * @param{String} filename_date - Name of Epi file for which we're trying to determine new num cases.
 * @param{Integer} i - Index of current Epi week file
 * @param{Array} ordered_dates - Array of Epi dates for which Paho has published a report
 * @param{Object} all_dates_hash - A key for each date of every Epi week
 * @return{hash} Returns bucket_date_hash updated with epi_weeks object:
 */

function determine_new_cases_per_epi_week_date(filename_date, i, ordered_dates, all_dates_hash, dir_epi, provider) {
  return new Promise((resolve, reject) => {
    // Ignore first (ealiest) file for now.
    // There's now way to divide it into days
    if (i === 0) {
      return resolve(all_dates_hash);
    }
    async.waterfall([
      // Get this date's data
      function(callback) {
        jsonread(dir_epi + ordered_dates[i] + '.json')
        .then(obj => {
          callback(null, obj);
        });
      },
      // Get previous week's data
      function(obj_current, callback) {
        // Date of end of previous Epi week
        var date_previous = ordered_dates[i-1];
        // Number of days between Epi weeks. Usually 7, sometimes  6.
        var diff_in_days = moment(filename_date).diff(moment(date_previous), 'days');

        // This is a hash of countries and their cumulative and new cases values.
        // Initializing here because in future might want to group other models besides Paho.
        var each_country_new_and_cumulative = {};
        if (provider === 'paho') {
        jsonread(dir_epi + ordered_dates[i-1] + '.json')
          .then(obj_past => {
            each_country_new_and_cumulative = update_country_objects_with_num_new_cases(filename_date, diff_in_days, obj_current, obj_past, provider);
            return callback(each_country_new_and_cumulative, diff_in_days);
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

/**
 * In order to determin total number of new cases for an Epi week
 * We have to subtract last weeks cumulative confirmed cases from this week's.
 * @param{String} filename_date - Name of Epi file for which we're trying to determine new num cases.
 * @param{Integer} i - Index of current Epi week file
 * @param{Array} ordered_dates - Array of Epi dates for which Paho has published a report
 * @param{Object} all_dates_hash - A key for each date of every Epi week
 * @param{Integer} diff_in_days - Numer of days since last Epi week
 * @return{hash} Returns bucket_date_hash updated with epi_weeks object:
 */
function spread_data_across_week_days(filename_date, new_and_cumulative, all_dates_hash, diff_in_days) {

  return new Promise((resolve, reject) => {
    var range_of_days = Array(diff_in_days).fill().map((_, i) => i++);
      var this_week = range_of_days.reduce((h, n) => {
        h[moment(filename_date).subtract(n, 'days').format('YYYY-MM-DD')] = clone(new_and_cumulative);
        return h;
      }, {})

    resolve(Object.assign(all_dates_hash, this_week));
  })
}

function update_country_objects_with_num_new_cases(filename, diff_in_days, obj_current, obj_past, provider) {
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
