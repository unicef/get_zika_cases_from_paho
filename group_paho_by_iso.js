// node group_paho_by_iso.js -p paho

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
  ['-i', '--dir_iso'],
  {help: 'Name of directory ISO directory to save aggregations to'}
);

parser.addArgument(
  ['-e', '--dir_epi'],
  {help: 'Name of Epi directory with original paho json files'}
);

var args = parser.parseArgs();
var provider = args.provider || 'paho';
var dir_iso = args.dir_iso || config.dir_iso;
var dir_epi = args.dir_epi || config.dir_epi;

epi2iso.epi_2_iso(dir_epi, dir_iso, provider)
.then(response => {
  console.log(response);
  process.exit();
})
