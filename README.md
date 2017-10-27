##### Get zika case files from Paho
Each [Epi week](http://www.cmmcp.org/epiweek.htm), the Pan American Health Organization posts a new excel file containing the number of new cases per country. Code in this repository fetches that data to store in JSON, and also aggregates by [ISO week](https://en.wikipedia.org/wiki/ISO_week_date) in order to compare with other data sets.

### Setup
```
git clone git@github.com:unicef/get_zika_cases_from_paho.git
cd get_zika_cases_from_paho
cp config-sample.js config.js
npm install
```
##### Download excel files
Download excel files with international cases by epi week to raw_dir (config.js). files are saved as json since had difficulty saving as xls.

    node fetch_cases.js

##### Convert to JSON

Read raw files and transform to usable json objects useful for running models.

    node summarize_cases.js

##### Aggregate by ISO week
To group new Epi week cases by ISO week, we use a simple “week to day” algorithm — i.e., take the total number of new cases, divide it by the number of days since the publication of the last Paho file, and assign that value to each day leading up to the end of that epi week.

Read [here](https://medium.com/@mikefabrikant/epi-week-to-iso-week-overlaying-virus-case-data-with-mobility-b071fe431811) for an indepth explanation.

###### test
    mocha ./lib/epi2iso_test.js
