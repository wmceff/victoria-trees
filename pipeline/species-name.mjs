// Maps a City botanical name to the species name we curate under.
// Same rules the original Postgres import used (data_scripts/assign_species.sql + Tree.import_species).

export function cleanBotanicalName(botanicalName) {
  return botanicalName
    .replace(/ spp\./g, "")
    .replace(/ species/g, "")
    .replace(/"/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function speciesNameFor(botanicalName) {
  const words = botanicalName.split(" ");
  if (words.length <= 1) return botanicalName;

  // cultivar straight after the genus, eg. "Malus 'Golden Apple'"
  if (words[1].includes("'")) return words[0];

  // hybrids get the proper × symbol
  if (botanicalName.includes(" x ") || botanicalName.includes(" X ")) {
    const hybrid = words.slice(0, 3);
    hybrid[1] = "×";
    return hybrid.join(" ");
  }

  return words.slice(0, 2).join(" ");
}
