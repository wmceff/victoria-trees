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

## Data

The site loads a single static file, `docs/data/trees.json`. To rebuild it from the
City of Victoria's latest open data:

```
cd pipeline
npm install
npm run build
```

The build joins the City's trees with the curated data in `data/`:

- `species.yml` - species details (descriptions, native range, SENĆOŦEN names). Edit this to change what the site shows.
- `botanical-overrides.yml` - corrections for City names that don't map to a species automatically.
- `non-tree-records.yml` - City records that aren't trees (stumps, private trees) and are skipped.
- `extra-trees.yml` - trees from other surveys that aren't in the City's data.

The build lists any species it finds that aren't in `species.yml` yet.
