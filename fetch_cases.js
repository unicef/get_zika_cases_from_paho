var bluebird = require('bluebird');
var request = require('request');
var getHrefs = require('get-hrefs');
var fs = require('fs');
var base_url = 'http://www.paho.org';
var config = require('./config');
var request = require('request');
var XLSX = require('xlsx');

request('http://www.paho.org/hq/index.php?option=com_content&view=article&id=12390&Itemid=42090&lang=en', function (error, response, body) {
 var urls = getHrefs(body).filter(l => {
   return l.match('doc_view')
 })
 bluebird.each(urls, url => {
   console.log(url)
   return fetch_doc(url);
 }, {concurrency: 1})
 .then(() => {
   console.log('Done!');
   process.exit();
 })
});

function fetch_doc(url) {
  return new Promise((resolve, reject) => {
    var options = {
      url: base_url + url,
      headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      encoding: null
    };
    request.get(options, (err, res, body) => {
      var title = res.headers['content-disposition'].match(/filename="(.+?)";/)[1];
      if (title.match(/xls$/)) {
        var arraybuffer = body;
        /* convert data to binary string */
        var data = arraybuffer;
        //var data = new Uint8Array(arraybuffer);
        var arr = new Array();
        for (var i = 0; i != data.length; ++i) arr[i] = String.fromCharCode(data[i]);
        var bstr = arr.join("");
        var workbook = XLSX.read(bstr, { type: "binary" });
        var worksheet = workbook.Sheets['2015 ENG'];
        fs.writeFile(config.raw_dir + title.replace('xls', 'json'), JSON.stringify(worksheet), (err, response) => {
          return resolve();
        });
      } else {
        return resolve();
      }
    });

  })
}
