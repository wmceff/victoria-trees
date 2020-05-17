# Victoria Trees

Identify the near you in Victoria. Inspired by
[James Clowater](http://naturevictoria.com/)'s
[Trees of Victoria](http://treesofvictoria.com/).

Uses the
[victoria trees dataset](http://opendata.victoria.ca/datasets/tree-species)
provided by the City of Victoria.

## Development

To test the page, visit the docs directory and run
`python -m SimpleHTTPServer 8081`

## Export

To get the CSV data into a database, in `psql` do something like
`\COPY trees(object_id,common_name,botanical_name,latitude,longitude,data,source) FROM 'trees.csv' DELIMITER ',' CSV;`

## Structure

- [`/api`] - basic serverless api functions (Lambda)
- [`/docs`] - the website
- [`/data_scripts`] - some scripts to import data from various sources(City of Victoria, GBIF species)
- [`/export`] - a script to export the Victoria Trees dataset to CSV with lat &
  long
