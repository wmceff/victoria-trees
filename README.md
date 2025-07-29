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

## Structure

- [`/docs`] - the website
- [`/data_scripts`] - some scripts to import data from various sources(City of Victoria, GBIF species)
- [`/export`] - a script to export the Victoria Trees dataset to CSV with lat &
  long

## Export / Import Data Sources

### City of Victoria
- Run `node export/index.js` to export trees to CSV
- Run `[PG ENVS] ruby data_scripts/import_victoria.rb` to import that CSV
- Run the queries in `data_scripts/assign_species.sql` to clean up
