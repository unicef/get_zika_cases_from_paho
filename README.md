##### Get zika case files from Paho
Each Epi week, the Pan American Health Organization posts a new excel file containing the number of new cases per country. Code in this repository fetches that data to store in JSON, and also aggregates by ISO week in order to compare with other data sets.

### Setup
```
git clone git@github.com:unicef/get_zika_cases_from_paho.git
cd get_zika_cases_from_paho
cp config-sample.js config.js
npm install

// Download excel files to local storage
node fetch_cases.js

// Create copies in JSON
node summarize_cases.js

// Aggregate by iso week
node group_paho_by_iso.js --provider paho
```
    cp config_sample.js config.js

##### Download
Download excel files with international cases by epi week to raw_dir (config.js). files are saved as json since had difficulty saving as xls.

    node fetch_cases.js

##### Convert to key value format

Read raw files and transform to usable json objects useful for running models.

    node summarize_cases.js

##### Transform epi week to ISO week
The goal is to overlay new zika cases per epi week with other types of data that are grouped by ISO week. Global travel, for instance, is available on an iso weekly basis.

Paho's files contain a running cumulative count of zika cases per country. The number of days in between Paho files is usually 7 (ending on a Thursday), though sometimes 6. (ISO weeks begin on a Monday.) Subtracting this week's cumulative cases from last week's cumulative cases leaves you with that country's total number of new cases.  

This script uses a "week to day" algorithm to group new epi week cases by ISO week - i.e., take the total number of new cases, divide it by the number of days since the publication of the last file, and assign that value to each day leading up to the end of that epi week.

For example, look at the file for the epi week lasting Jan 6, 2017 to the twelfth. It lists 1,649 total cases in Costa Rica. The previous file for the week ending on the 5th lists 1,614 confirmed cases. This means there were around 35 new cases.

Based on the "week 2 day" model, we divide 35 by 7 and assign 5 cases per date:

2017-01-12_zika_cumulative_cases.csv
date, new cases
2017-01-06, 5
2017-01-07, 5
2017-01-08, 5
2017-01-09, 5
2017-01-10, 5
2017-01-11, 5
2017-01-12, 5

Now group by ISO week:
Friday the 6th, Saturday the 7th, and Sunday the 8th of January, 2017 all fall within the ISO week starting Monday, January 2. The remaining days including the 9th, 10th, 11th, and 12th, fall within the ISO week of Monday, January 9.

###### test
    mocha ./lib/epi2iso_test.js
