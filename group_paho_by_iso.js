var config = require('./config');
var epi2iso = require('./lib/epi2iso');
// Use argument parser to to identity data source
// currently only use case data from pago.org
var ArgumentParser = require('argparse').ArgumentParser;
var parser = new ArgumentParser({
  version: '0.0.1',
  addHelp: true,
  description: 'Aggregate a csv of airport by admin 1 and 2'
});

parser.addArgument(
  ['-p', '--provider'],
  {help: 'Name of provider'}
);

parser.addArgument(
  ['-d', '--dir'],
  {help: 'Name of directory to find and save files to'}
);

var args = parser.parseArgs();
var provider = args.provider;
var dir = args.dir || config.dir;

epi2iso.epi_2_iso(dir, provider)
.then(response => {
  console.log(response);
  process.exit();
})
