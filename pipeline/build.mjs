// Builds docs/data/trees.json, the only data the site loads.
// Pulls every tree from the City of Victoria's open data layer and joins it with the
// curated species details in data/species.yml.
import fs from "node:fs";
import yaml from "js-yaml";
import { cleanBotanicalName, speciesNameFor } from "./species-name.mjs";

const root = new URL("..", import.meta.url).pathname;
const cityLayer = "https://maps.victoria.ca/server/rest/services/OpenData/OpenData_Parks/MapServer/15";
const pageSize = 2000; // the layer's maxRecordCount

async function fetchCityTrees() {
  const trees = [];
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "OBJECTID,Species,CommonName",
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
function addTree(latitude, longitude, rawBotanicalName, commonName) {
  const botanicalName = cleanBotanicalName(rawBotanicalName);
  const derivedName = speciesNameFor(botanicalName);
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
}

const cityTrees = await fetchCityTrees();
for (const { attributes, geometry } of cityTrees) {
  if (!geometry || !attributes.Species || nonTreeRecords.has(attributes.Species.trim())) continue;
  addTree(geometry.y, geometry.x, attributes.Species, attributes.CommonName);
}
const cityTreeCount = trees.length;

const extraTrees = readYaml("data/extra-trees.yml");
for (const t of extraTrees) {
  addTree(t.latitude, t.longitude, t.botanical_name, t.common_name);
}

// Only the fields the site displays
const siteFields = ["name", "common_name", "order", "native", "native_region", "description", "sencoten_name", "sencoten_url", "tree_count"];
const output = {
  source: cityLayer,
  total: trees.length,
  species: species.map((s) => Object.fromEntries(siteFields.filter((f) => s[f] !== undefined).map((f) => [f, s[f]]))),
  botanical,
  // [latitude, longitude, species index, botanical name index]
  trees,
};

fs.mkdirSync(root + "docs/data", { recursive: true });
fs.writeFileSync(root + "docs/data/trees.json", JSON.stringify(output));

console.log(
  `${cityTreeCount} City trees (${cityTrees.length - cityTreeCount} skipped: no location, no species, or not a tree), ` +
    `${extraTrees.length} extra trees, ${species.length} species`
);
if (newSpecies.size) {
  console.log(`\n${newSpecies.size} species not in data/species.yml (add them, or map them in data/botanical-overrides.yml):`);
  for (const name of [...newSpecies].sort()) console.log(`  ${name} (${species[speciesIndex.get(name)].tree_count})`);
}
