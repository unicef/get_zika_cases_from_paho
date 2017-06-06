var fs = require('fs');
var moment = require('moment');
var bluebird = require('bluebird');
var config = require('./config');
var jsonfile = require('jsonfile')
var raw_dir = config.raw_dir;
var json_dir = config.json_dir;
var case_files = fs.readdirSync(raw_dir);
var country_codes = require('./country_codes');
var index = config.index;

var promisifiedRead = bluebird.promisify(jsonfile.readFile);
bluebird.each(case_files.filter(f => { return f.match(/^\d{4}/)}), f => {
  console.log(f);
  var date = moment(f.match(/\d{4}-[a-z]{3}-\d+/)[0]).format('YYYY-MM-DD');
  //return jsonfile.readFile(raw_dir + f, function(err, obj) {
  //  return summarize(obj, date)
  //})
  return promisifiedRead(raw_dir + f).then(function(obj) {
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
    fs.writeFile(json_dir + date + '.json', JSON.stringify(object), err => {
      if (err) {
        console.log(err)
        return reject(err);
      }
      resolve();
    })
  })
}
