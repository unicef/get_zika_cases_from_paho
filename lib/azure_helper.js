var config = require('../config');
var jsonfile = require('jsonfile');
var output = 'output.txt';
/**
 * Gets list of country population aggregation blobs
 * Just in case we want to only process files that we don't already have
 * @param{String} container_name - Name of blob container
 * @return{Promise} Fulfilled list of blobs
 */
exports.get_file_list = (fileSrv, path) => {
  return new Promise(function(resolve, reject) {
    fileSrv.listFilesAndDirectoriesSegmented('cases', path, null, function(err, result, response) {
      if (err) {
        return reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

exports.get_file = (fileSrv, path, file) => {
  return new Promise((resolve, reject) => {
    fileSrv.getFileToText('cases', path, file, function(err, fileContent, file) {
      if (!err) {
        resolve(JSON.parse(fileContent));
      }
    });
  })
}
