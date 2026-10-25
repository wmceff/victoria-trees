// Builds docs/data/trees.json, the only data the site loads.
// Pulls every tree from the City of Victoria's open data layer and joins it with the
// curated species details in data/species.yml.
import fs from "node:fs";
import yaml from "js-yaml";
import { cleanBotanicalName, speciesNameFor } from "./species-name.mjs";
import { slugFor, writePages } from "./pages.mjs";

const root = new URL("..", import.meta.url).pathname;
const cityLayer = "https://maps.victoria.ca/server/rest/services/OpenData/OpenData_Parks/MapServer/15";
const pageSize = 2000; // the layer's maxRecordCount

async function fetchCityTrees() {
  const trees = [];
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,Species,CommonName,Area",
      outSR: "4326",
      orderByFields: "OBJECTID",
      resultOffset: offset,
      resultRecordCount: pageSize,
      f: "json",
    });
    const response = await fetch(`${cityLayer}/query?${params}`);
    if (!response.ok) throw new Error(`City layer returned ${response.status}`);
    const page = await response.json();
    if (page.error) throw new Error(`City layer error: ${JSON.stringify(page.error)}`);

    trees.push(...page.features);
    if (!page.exceededTransferLimit) return trees;
  }
}

const readYaml = (path) => yaml.load(fs.readFileSync(root + path, "utf8"));
const curatedSpecies = readYaml("data/species.yml");
const overrides = readYaml("data/botanical-overrides.yml");
const nonTreeRecords = new Set(readYaml("data/non-tree-records.yml"));

const species = curatedSpecies.map((s) => ({ ...s, tree_count: 0 }));
const speciesIndex = new Map(species.map((s, i) => [s.name, i]));
const botanical = [];
const botanicalIndex = new Map();
const newSpecies = new Set();

const trees = [];
const treeAreas = []; // each tree's City neighbourhood, for the neighbourhood pages
function addTree(latitude, longitude, rawBotanicalName, commonName, assignedSpecies, area) {
  const botanicalName = cleanBotanicalName(rawBotanicalName);
  const derivedName = assignedSpecies ?? speciesNameFor(botanicalName);
  const speciesName = overrides[botanicalName] ?? overrides[derivedName] ?? derivedName;

  if (!speciesIndex.has(speciesName)) {
    speciesIndex.set(speciesName, species.length);
    species.push({ name: speciesName, common_name: commonName?.trim(), tree_count: 0 });
    newSpecies.add(speciesName);
  }
  if (!botanicalIndex.has(botanicalName)) {
    botanicalIndex.set(botanicalName, botanical.length);
    botanical.push(botanicalName);
  }

  const s = speciesIndex.get(speciesName);
  species[s].tree_count += 1;
  trees.push([+latitude.toFixed(6), +longitude.toFixed(6), s, botanicalIndex.get(botanicalName)]);
  treeAreas.push(area?.trim() || null);
}

const cityTrees = await fetchCityTrees();
for (const { attributes, geometry } of cityTrees) {
  if (!geometry || !attributes.Species || nonTreeRecords.has(attributes.Species.trim())) continue;
  addTree(geometry.y, geometry.x, attributes.Species, attributes.CommonName, undefined, attributes.Area);
}
const cityTreeCount = trees.length;

const extraTrees = readYaml("data/extra-trees.yml");
for (const t of extraTrees) {
  addTree(t.latitude, t.longitude, t.botanical_name ?? t.species, t.common_name, t.species);
}

// species page URLs, which the map's ?species= param also takes
const speciesBySlug = new Map();
for (const s of species) {
  s.slug = slugFor(s.name);
  if (s.tree_count && speciesBySlug.has(s.slug)) {
    throw new Error(`"${s.name}" and "${speciesBySlug.get(s.slug).name}" would share the URL species/${s.slug}/`);
  }
  if (s.tree_count) speciesBySlug.set(s.slug, s);
}

// Only the fields the site displays
const siteFields = ["name", "slug", "common_name", "order", "native", "native_region", "description", "sencoten_name", "sencoten_url", "tree_count"];
const output = {
  source: cityLayer,
  updated: new Date().toISOString().slice(0, 10), // when this file was last built from the City's data
  total: trees.length,
  species: species.map((s) => Object.fromEntries(siteFields.filter((f) => s[f] !== undefined).map((f) => [f, s[f]]))),
  botanical,
  // [latitude, longitude, species index, botanical name index]
  trees,
};

fs.mkdirSync(root + "docs/data", { recursive: true });
fs.writeFileSync(root + "docs/data/trees.json", JSON.stringify(output));
const pages = writePages(root + "docs", { species, trees, treeAreas, total: trees.length });

console.log(
  `${cityTreeCount} City trees (${cityTrees.length - cityTreeCount} skipped: no location, no species, or not a tree), ` +
    `${extraTrees.length} extra trees, ${species.length} species`
);
console.log(`${pages.species} species pages, ${pages.neighbourhoods} neighbourhood pages, ${pages.urls} URLs in sitemap.xml`);
if (newSpecies.size) {
  console.log(`\n${newSpecies.size} species not in data/species.yml (add them, or map them in data/botanical-overrides.yml):`);
  for (const name of [...newSpecies].sort()) console.log(`  ${name} (${species[speciesIndex.get(name)].tree_count})`);
}
