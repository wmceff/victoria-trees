# Victoria Trees

Identify the trees near you in Victoria: https://victoriatrees.ca/

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
  A species' `bloom` (`from`/`to` like `mid March`, between November and May, plus `colour` and an optional
  `note`) puts it on the blossom calendar at `docs/blossoms/`. Its `hue` (white, pale pink, pink or deep pink)
  colours its trees on the map, and `varieties` gives a variety its own hue (`Kwanzan: deep pink`), matched
  against the City's botanical names.
- `botanical-overrides.yml` - corrections for City names that don't map to a species automatically.
- `non-tree-records.yml` - City records that aren't trees (stumps, private trees) and are skipped.
- `extra-trees.yml` - trees from other surveys and municipalities that aren't in the City's data.

The build lists any species it finds that aren't in `species.yml` yet.

It also generates the search-indexable pages, so they stay in sync with the data:
`docs/species/`, `docs/neighbourhoods/`, `docs/blossoms/`, `docs/about/`, `docs/sitemap.xml`, `docs/robots.txt`, and the
links between the `home-links` markers in `docs/index.html` (in the map's menu), and the `?v=` version stamps on the CSS and JS links.
Don't edit these by hand; change `pipeline/pages.mjs` and rebuild. Species pages with no
description and fewer than 10 trees are marked `noindex` and left out of the sitemap, so
search engines don't see them as thin pages; adding a description in `species.yml` gets one
indexed. The map takes
`?species=<slug>` (or several, comma-separated) to highlight species and `?bounds=<west,south,east,north>` to frame an area.
