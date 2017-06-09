var config = require('../config');
const csv=require('csvtojson');
var jsonfile = require('jsonfile');
var output = 'output.txt';
/**
 * Gets list of country population aggregation blobs
 * Just in case we want to only process files that we don't already have
 * @param{String} container_name - Name of blob container
 * @return{Promise} Fulfilled list of blobs
 */
exports.get_file_list = (fileSrv, dir, path) => {
  return new Promise(function(resolve, reject) {
    fileSrv.listFilesAndDirectoriesSegmented(dir, path, null, function(err, result, response) {
      if (err) {
        console.log(err);
        return reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

exports.get_file = (fileSrv, dir, path, file_date, format) => {

  return new Promise((resolve, reject) => {
    fileSrv.getFileToText(dir, path, file_date + format, function(err, fileContent, file) {
      if (!err) {
        if (format === '.json') {
          resolve(JSON.parse(fileContent));
        } else {
          // obj = {};
          // obj.date = file_date;
          // obj.trips = {};
          // csv()
          // .fromString(fileContent)
          // .on('json',(row_obj)=>{ // this func will be called 3 times
          //   obj.trips[row_obj.orig + row_obj.dest] = row_obj.cnt;
          // })
          // .on('done',() => {
          //   resolve(obj);
          // 	//parsing finished
          // })
        }
      }
    });
  })
}
