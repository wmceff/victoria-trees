# Victoria Trees

Identify the trees near you in Victoria: https://wmceff.github.io/victoria-trees/

Inspired by [James Clowater](http://naturevictoria.com/)'s
[Trees of Victoria](http://treesofvictoria.com/). Uses the
[tree species dataset](https://opendata.victoria.ca/datasets/tree-species)
provided by the City of Victoria.

## Structure

- `docs/` - the website, served by GitHub Pages from the `main` branch
- `pipeline/` - builds the site's tree data
- `data/` - curated species and tree data the pipeline joins with the City's data

## Development

Serve the site locally:

```
python3 -m http.server 8081 --directory docs
```

Then open http://localhost:8081. Pushing to `main` deploys it.

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
- `extra-trees.yml` - trees from other surveys and municipalities that aren't in the City's data.

The build lists any species it finds that aren't in `species.yml` yet.

It also generates the search-indexable pages, so they stay in sync with the data:
`docs/species/`, `docs/neighbourhoods/`, `docs/sitemap.xml` and `docs/robots.txt`.
Don't edit these by hand; change `pipeline/pages.mjs` and rebuild. The map takes
`?species=<slug>` to highlight a species and `?bounds=<west,south,east,north>` to frame an area.
