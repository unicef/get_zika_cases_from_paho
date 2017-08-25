var fs = require('fs');
var moment = require('moment');
var bluebird = require('bluebird');
var config = require('./config');
var jsonfile = require('jsonfile')
var dir_raw = config.dir_raw;
var dir_epi = config.dir_epi;
var case_files = fs.readdirSync(dir_raw);
var country_codes = require('./country_codes');
var index = config.index;

var promisifiedRead = bluebird.promisify(jsonfile.readFile);
bluebird.each(case_files.filter(f => { return f.match(/^\d{4}/)}), f => {
  console.log(f);
  file_name_copy = f.replace('-ago-', '-aug-')
  var date = moment(file_name_copy.match(/\d{4}-[A-Za-z]{3,4}-\d+/)[0]).format('YYYY-MM-DD');
  //return jsonfile.readFile(dir_raw + f, function(err, obj) {
  //  return summarize(obj, date)
  //})
  return promisifiedRead(dir_raw + f).then(obj => {
    return summarize(obj, date)
  });
}, {concurrency: 1}).then(() => {console.log('done');process.exit();});

function summarize(worksheet, date) {
  console.log(date);
  return new Promise((resolve, reject) => {
    var numbers = {};
    Object.keys(worksheet).forEach(k => {

      var letter = k.match(/[A-Z]/);
      if (letter) {
        letter = letter[0]; // A B C..
        var number = k.match(/\d+/)[0];
        if (!numbers[number]) {
          numbers[number] = {};
        }
        numbers[number][letter] = worksheet[k];
      }
    })
    var countries = {};
    var object = Object.keys(numbers).reduce((h, n) => {
      h.date = date;
      if (numbers[n]['A']) {
        // Remove pesky numbers from country names
        var value = numbers[n]['A'].v.replace(/\d+/, '');
        if(country_codes[value]) {
          var stats = Object.keys(index).reduce((h2, i) => {
            h2.country = value;
            if (numbers[n][i]) {
              h2[index[i]] = numbers[n][i].v;
            }
            return h2;
          }, {});
          //h.countries[country_codes[value]] = stats;
          countries[country_codes[value]] = stats;
        }
      }
          h.countries = countries;
          return h;
    }, {})
    fs.writeFile(dir_epi + date + '.json', JSON.stringify(object), err => {
      if (err) {
        console.log(err)
        return reject(err);
      }
      resolve();
    })
  })
}
