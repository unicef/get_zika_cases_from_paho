  cp config_sample.js config.js


Download excel files with international cases by epi week to raw_dir (config.js). files are saved as json since had difficulty saving as xls.

  node save_cases.js

Read raw files and transform to usable json objects useful for running models.

  node summarize_cases.js
