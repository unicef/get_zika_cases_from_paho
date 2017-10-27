const bluebird = require('bluebird');
const request = require('request');
const getHrefs = require('get-hrefs');
const fs = require('fs');
const base_url = 'http://www.paho.org';
const config = require('./config');
const XLSX = require('xlsx');

request(
  'http://www.paho.org/hq/index.php?option=com_content&view=article&id=12390&Itemid=42090&lang=en',
  (error, response, body) => {
   let urls = getHrefs(body).filter(l => {
     return l.match('doc_view')
   })

  fs.readdir(config.dir_raw, (err, files) => {
    bluebird.each(urls, url => {
      console.log(url)
      return fetch_doc(url, files);
    }, {concurrency: 1})
    .then(() => {
      console.log('Done!');
      process.exit();
    })
  });
});

/**
 * Verifies if user has required level of authorisation
 * @param  {string} url
 * @param  {array} files auth and security definations from swagger file
 * @return {Promise}
 */
function fetch_doc(url, files) {
  return new Promise((resolve, reject) => {
    let options = {
      url: base_url + url,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.' +
         'spreadsheetml.sheet'
      },
      encoding: null
    };

    request.get(options, (err, res, body) => {
      let title = res.headers['content-disposition'].match(
        /filename="(.+?)";/
      )[1];
      if (title.match(/xls$/)) {
        let arraybuffer = body;
        /* convert data to binary string */
        let data = arraybuffer;
        // var data = new Uint8Array(arraybuffer);
        let arr = [];
        for (let i = 0;
          i != data.length;
          ++i) arr[i] = String.fromCharCode(data[i]);
        let bstr = arr.join('');
        let workbook = XLSX.read(bstr, {type: 'binary'});
        let worksheet = workbook.Sheets['2015 ENG'];
        let file = title.replace('xls', 'json');
        if (files.indexOf(file) === -1) {
          // This file has not been downloaded before
          console.log('download new', file)
          fs.writeFile(config.dir_raw + title.replace('xls', 'json'),
          JSON.stringify(worksheet),
          (error, response) => {
            return resolve();
          });
        } else {
          console.log('already have', file)
          // Already have file, move along.
          resolve();
        }
      } else {
        // Not an xls file, likely pdf.
        return resolve();
      }
    });
  })
}
