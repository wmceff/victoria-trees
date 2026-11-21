// Writes the static, search-indexable pages: one per species and neighbourhood, their
// index pages, the cherry blossom calendar, sitemap.xml and robots.txt. The map page (docs/index.html) is hand-written.
import fs from "node:fs";

export const siteUrl = "https://victoriatrees.ca/";

// URL slug for a species or neighbourhood name, eg. "Prunus × yedoensis" -> "prunus-x-yedoensis"
export function slugFor(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/\?/g, " unknown")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// JSON for a <script> tag: "<" escaped so a name can never close the tag
const jsonLd = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
const formatCount = (n) => n.toLocaleString("en-CA");
const percentOf = (count, total) => `${(Math.round((count / total) * 10000) / 100).toLocaleString("en-CA")}%`;
const displayName = (s) => s.common_name || s.name;

// Species pages worth a search result: ones with a curated description, or enough trees
// that the neighbourhood table says something. The rest stay up for the map's links but
// are kept out of search results and the sitemap, so they don't read as thin pages.
const minIndexedTrees = 10;
export const isIndexed = (s) => Boolean(s.description) || s.tree_count >= minIndexedTrees;

// How common a species is, in words rather than a percentage. The map's tree modal shows it too.
export function commonnessFact(s, species, total) {
  const count = s.tree_count;
  const rank = 1 + species.filter((other) => other.tree_count > count).length;
  const speciesCount = species.filter((other) => other.tree_count > 0).length;
  const oneIn = Math.round(total / count);
  if (rank === 1) {
    return `Victoria's most common tree: ${formatCount(count)} on the map, about 1 in ${oneIn} trees.`;
  }
  if (count / total >= 0.01) {
    return `One of Victoria's most common trees: ${formatCount(count)} on the map, about 1 in ${oneIn} trees ` +
      `(#${rank} of ${speciesCount} species).`;
  }
  if (count === 1) return "The only one on the map.";
  if (count <= 10) return `A rare one here: only ${count} on the map (#${rank} of ${speciesCount} species).`;
  return `${formatCount(count)} on the map, the #${rank} most common of ${speciesCount} species.`;
}

// curated ranges are written to follow "native to", sometimes as "from X to Y"
const nativeRange = (s) => s.native_region.replace(/^from /, "");

// [west, south, east, north], the format the map's ?bounds= param takes
function boundsOf(points) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [lat, lng] of points) {
    b[0] = Math.min(b[0], lng);
    b[1] = Math.min(b[1], lat);
    b[2] = Math.max(b[2], lng);
    b[3] = Math.max(b[3], lat);
  }
  return b.map((n) => +n.toFixed(5)).join(",");
}

function layout({ path, title, description, body, indexed = true, breadcrumbs = [], script = "" }) {
  const depth = path.split("/").filter(Boolean).length;
  const home = depth ? "../".repeat(depth) : "./";
  const canonical = siteUrl + path;
  const trail = [["Victoria Trees", ""], ...breadcrumbs];
  const breadcrumbList = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, crumbPath], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: siteUrl + crumbPath,
    })),
  };
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-8TL8VBBHK4"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-8TL8VBBHK4');
    </script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${canonical}">${indexed ? "" : `
    <meta name="robots" content="noindex, follow">`}
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Victoria Trees">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${siteUrl}og-image.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">${jsonLd(breadcrumbList)}</script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.8.0/css/bulma.min.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@600&display=swap">
    <link rel="stylesheet" href="${home}theme.css">
  </head>
<body>
  <nav class="navbar is-success" aria-label="main navigation">
    <div class="navbar-brand">
      <a class="navbar-item has-text-weight-bold" href="${home}">Victoria Trees</a>
      <a class="navbar-item" href="${home}species/">Species</a>
      <a class="navbar-item" href="${home}neighbourhoods/">Neighbourhoods</a>
      <a class="navbar-item" href="${home}blossoms/">Blossoms</a>
    </div>
  </nav>
  <section class="section">
    <div class="container content">
${body}
    </div>
  </section>
  <footer class="footer">
    <div class="content has-text-centered is-size-7">
      <p>Tree data from the City of Victoria's <a href="http://opendata.victoria.ca/datasets/tree-species">open trees dataset</a>, amended where necessary. Trees on private property aren't included.</p>
      <p><a href="https://github.com/wmceff/victoria-trees">Source on GitHub</a></p>
    </div>
  </footer>${script ? `
  <script>
${script}
  </script>` : ""}
</body>
</html>
`;
}

function paragraphs(text) {
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function speciesPage(s, ctx) {
  const name = displayName(s);
  const heading = s.common_name ? `${name} <small class="has-text-grey"><i>${escapeHtml(s.name)}</i></small>` : `<i>${escapeHtml(name)}</i>`;
  const title = s.common_name ? `${name} (${s.name}) trees in Victoria, BC` : `${name} trees in Victoria, BC`;
  const treeWord = s.tree_count === 1 ? "tree" : "trees";
  const description =
    `There ${s.tree_count === 1 ? "is" : "are"} ${formatCount(s.tree_count)} ${name} ${treeWord}` +
    `${s.common_name ? ` (${s.name})` : ""} on public land in Victoria, BC` +
    (s.tree_count / ctx.total >= 0.01 ? `, about 1 in ${Math.round(ctx.total / s.tree_count)} of the trees on record. ` : ". ") +
    `See where they are on the map.`;

  let body = `<h1>${heading}</h1>\n`;
  if (s.sencoten_name) {
    const sencoten = s.sencoten_url
      ? `<a href="${escapeHtml(s.sencoten_url)}">${escapeHtml(s.sencoten_name)}</a>`
      : escapeHtml(s.sencoten_name);
    body += `<p>SENĆOŦEN name: <b>${sencoten}</b></p>\n`;
  }
  if (s.native_region) {
    body += `<p>Native to ${escapeHtml(nativeRange(s))}${s.native ? ", including Victoria" : ""}.</p>\n`;
  } else if (s.native) {
    body += `<p>Native to Victoria.</p>\n`;
  }
  body += `<p>${escapeHtml(commonnessFact(s, ctx.species, ctx.total))}</p>\n`;
  if (s.bloom) {
    body += `<p>Usually in flower ${escapeHtml(bloomWindow(s.bloom))}, with ${escapeHtml(s.bloom.colour)} blossoms. ` +
      `<a href="../../blossoms/">See when Victoria's other blossom trees flower</a>.</p>\n`;
  }
  body += `<p><a class="button is-success" href="../../?species=${s.slug}">Show ${escapeHtml(name)} ${treeWord} on the map</a></p>\n`;
  if (s.description) body += paragraphs(s.description) + "\n";

  const areas = ctx.areas
    .map((a) => ({ ...a, count: a.speciesCounts.get(s.index) ?? 0 }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count);
  if (areas.length) {
    body += `<h2>Where to find ${escapeHtml(name)} in Victoria</h2>\n<div class="table-container"><table class="table is-narrow">\n<thead><tr><th>Neighbourhood</th><th>Trees</th><th></th></tr></thead>\n<tbody>\n`;
    for (const a of areas) {
      body += `<tr><td><a href="../../neighbourhoods/${a.slug}/">${escapeHtml(a.name)}</a></td><td>${formatCount(a.count)}</td><td><a href="../../?species=${s.slug}&amp;bounds=${a.bounds}">map</a></td></tr>\n`;
    }
    body += `</tbody>\n</table></div>\n`;
  }

  body += `<p><a href="https://en.wikipedia.org/wiki/${encodeURIComponent(s.name.replace(/ /g, "_"))}">${escapeHtml(s.name)} on Wikipedia</a></p>`;
  return layout({
    path: `species/${s.slug}/`,
    title,
    description,
    body,
    indexed: isIndexed(s),
    breadcrumbs: [["Species", "species/"], [name, `species/${s.slug}/`]],
  });
}

function speciesIndexPage(species, ctx) {
  const rows = [...species]
    .sort((a, b) => b.tree_count - a.tree_count || displayName(a).localeCompare(displayName(b), "en"))
    .map(
      (s) =>
        `<tr><td><a href="${s.slug}/">${escapeHtml(displayName(s))}</a></td><td><i>${escapeHtml(s.name)}</i></td><td>${formatCount(s.tree_count)}</td></tr>`
    )
    .join("\n");
  const body = `<h1>Tree species in Victoria, BC</h1>
<p>The ${formatCount(species.length)} species of tree on public land in the City of Victoria, from most to least common.</p>
<div class="table-container"><table class="table is-narrow is-hoverable">
<thead><tr><th>Common name</th><th>Botanical name</th><th>Trees</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`;
  return layout({
    path: "species/",
    breadcrumbs: [["Species", "species/"]],
    title: "Tree species in Victoria, BC",
    description: `All ${species.length} tree species on public land in Victoria, BC, from Garry oaks to Japanese cherries, with how many of each the City has on record.`,
    body,
  });
}

function areaPage(area, ctx) {
  const species = [...area.speciesCounts]
    .map(([index, count]) => ({ s: ctx.species[index], count }))
    .sort((a, b) => b.count - a.count);
  const top = species.slice(0, 3).map(({ s }) => displayName(s)).join(", ");
  const rows = species
    .map(
      ({ s, count }) =>
        `<tr><td><a href="../../species/${s.slug}/">${escapeHtml(displayName(s))}</a></td><td><i>${escapeHtml(s.name)}</i></td><td>${formatCount(count)}</td><td>${percentOf(count, area.total)}</td><td><a href="../../?species=${s.slug}&amp;bounds=${area.bounds}">map</a></td></tr>`
    )
    .join("\n");
  const body = `<h1>Trees in ${escapeHtml(area.name)}, Victoria</h1>
<p>The City of Victoria has <b>${formatCount(area.total)}</b> trees on record in ${escapeHtml(area.name)}, from ${formatCount(species.length)} species. The most common are ${escapeHtml(top)}.</p>
<p><a class="button is-success" href="../../?bounds=${area.bounds}">Show ${escapeHtml(area.name)} on the map</a></p>
<div class="table-container"><table class="table is-narrow is-hoverable">
<thead><tr><th>Common name</th><th>Botanical name</th><th>Trees</th><th>Share</th><th></th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`;
  return layout({
    path: `neighbourhoods/${area.slug}/`,
    breadcrumbs: [["Neighbourhoods", "neighbourhoods/"], [area.name, `neighbourhoods/${area.slug}/`]],
    title: `Trees in ${area.name}, Victoria BC`,
    description: `${formatCount(area.total)} trees from ${species.length} species line the streets and parks of ${area.name} in Victoria, BC. The most common are ${top}.`,
    body,
  });
}

function areaIndexPage(areas) {
  const rows = areas
    .map((a) => `<tr><td><a href="${a.slug}/">${escapeHtml(a.name)}</a></td><td>${formatCount(a.total)}</td><td>${formatCount(a.speciesCounts.size)}</td></tr>`)
    .join("\n");
  const body = `<h1>Trees by neighbourhood in Victoria, BC</h1>
<p>How many trees the City of Victoria has on record in each neighbourhood, and which species they are.</p>
<div class="table-container"><table class="table is-narrow is-hoverable">
<thead><tr><th>Neighbourhood</th><th>Trees</th><th>Species</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`;
  return layout({
    path: "neighbourhoods/",
    breadcrumbs: [["Neighbourhoods", "neighbourhoods/"]],
    title: "Trees by neighbourhood in Victoria, BC",
    description: `Tree species and counts for each of Victoria's ${areas.length} neighbourhoods, from James Bay and Fairfield to Fernwood and Oaklands.`,
    body,
  });
}

// The blossom calendar. Bloom windows in species.yml are written "early March", "mid April",
// "late May"; they're typical years, and a warm or cold spell moves them a week or two.
// The calendar runs November to May so the winter-flowering cherries fit.
const calendarMonths = ["November", "December", "January", "February", "March", "April", "May"];
const monthParts = ["early", "mid", "late"];
const calendarSlots = calendarMonths.length * monthParts.length;

// "mid March" -> its third-of-a-month slot in the calendar, 0 for early November
export function bloomSlot(text, speciesName) {
  const [part, month] = String(text).trim().split(/\s+/);
  const slot = calendarMonths.indexOf(month) * monthParts.length + monthParts.indexOf(part);
  if (calendarMonths.indexOf(month) === -1 || monthParts.indexOf(part) === -1) {
    throw new Error(`${speciesName}: bloom dates are written like "mid March" (${calendarMonths.join(", ")}), not "${text}"`);
  }
  return slot;
}
const bloomWindow = (bloom) => `from ${bloom.from} to ${bloom.to}`;

// The City's cultivar names, eg. "Prunus serrulata kwanzan" -> "Kwanzan", for the species table
function varietyName(botanicalName, speciesName) {
  const words = botanicalName.replace(/[×'‘’"]/g, " ").split(/\s+/).filter((w) => w && w.toLowerCase() !== "x");
  const speciesWords = speciesName.replace(/[×'‘’"]/g, " ").split(/\s+/).filter((w) => w && w.toLowerCase() !== "x");
  const rest = words.length > 2 ? words.slice(2) : words.slice(1);
  if (!rest.length || rest.join(" ").toLowerCase() === speciesWords.slice(1).join(" ").toLowerCase()) return null;
  return rest.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}
const minVarietyTrees = 10;
const blossomPlaceCount = 12;

function blossomPage(ctx) {
  const blossomSpecies = ctx.listed
    .filter((s) => s.bloom)
    .map((s) => ({ ...s, start: bloomSlot(s.bloom.from, s.name), end: bloomSlot(s.bloom.to, s.name) }));
  for (const s of blossomSpecies) {
    if (s.end < s.start) throw new Error(`${s.name}: bloom "to" (${s.bloom.to}) is before "from" (${s.bloom.from})`);
  }
  blossomSpecies.sort((a, b) => a.start - b.start || a.end - b.end || b.tree_count - a.tree_count);
  const isCherry = (s) => s.name.startsWith("Prunus");
  const bySpecies = new Map(blossomSpecies.map((s) => [s.index, s]));

  const blossomTrees = [];
  const varieties = new Map(blossomSpecies.map((s) => [s.index, new Map()]));
  const topPlace = new Map(blossomSpecies.map((s) => [s.index, new Map()]));
  const placeTrees = new Map();
  const areaCounts = new Map();
  ctx.trees.forEach((tree, i) => {
    const s = bySpecies.get(tree[2]);
    if (!s) return;
    blossomTrees.push(tree);
    const variety = varietyName(ctx.botanical[tree[3]], s.name);
    if (variety) varieties.get(s.index).set(variety, (varieties.get(s.index).get(variety) ?? 0) + 1);
    if (tree[6] !== null) {
      topPlace.get(s.index).set(tree[6], (topPlace.get(s.index).get(tree[6]) ?? 0) + 1);
      if (!placeTrees.has(tree[6])) placeTrees.set(tree[6], []);
      placeTrees.get(tree[6]).push(tree);
    }
    const area = ctx.treeAreas[i];
    if (area) areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1);
  });

  const cherryCount = blossomTrees.filter((t) => isCherry(bySpecies.get(t[2]))).length;
  const slugs = (trees) => [...new Set(trees.map((t) => bySpecies.get(t[2]).slug))].join(",");
  const allSlugs = blossomSpecies.map((s) => s.slug).join(",");
  // The City's place names: "On Moss St", "In Beacon Hill Park"
  const placeLabel = (index) => ctx.places[index].replace(/^(On|In|At) /, "");
  const places = [...placeTrees]
    .map(([index, trees]) => ({ index, trees, place: ctx.places[index] }))
    // named City streets and parks only: not lanes and placeholders ("Lane 080-1", "Z Add 01") or addresses
    .filter((p) => /^(On|In) /.test(p.place) && !/\d/.test(p.place))
    .sort((a, b) => b.trees.length - a.trees.length);

  // the calendar: a bar for each species across November to May
  const monthHeads = calendarMonths
    .map((m, i) => `<span class="bloom-month" style="left:${((i * 3) / calendarSlots) * 100}%">${m.slice(0, 3)}</span>`)
    .join("");
  const rows = blossomSpecies
    .map((s) => {
      const left = (s.start / calendarSlots) * 100;
      const width = ((s.end - s.start + 1) / calendarSlots) * 100;
      const label = `${displayName(s)}: ${bloomWindow(s.bloom)}, ${formatCount(s.tree_count)} trees`;
      return `<li class="bloom-row" data-start="${s.start}" data-end="${s.end}">
<a class="bloom-name" href="../species/${s.slug}/">${escapeHtml(displayName(s))}</a>
<span class="bloom-track"><span class="bloom-bar" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%" title="${escapeHtml(label)}"></span></span>
</li>`;
    })
    .join("\n");
  const calendar = `<figure class="bloom-calendar" aria-label="When each blossom tree usually flowers, November to May">
<div class="bloom-axis"><span class="bloom-name"></span><span class="bloom-track">${monthHeads}<span class="bloom-today" hidden></span></span></div>
<ol>
${rows}
</ol>
</figure>`;

  const tableRows = blossomSpecies
    .map((s) => {
      const top = [...varieties.get(s.index)].filter(([, n]) => n >= minVarietyTrees).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const [bestPlace] = [...topPlace.get(s.index)].sort((a, b) => b[1] - a[1]);
      const placeCell = bestPlace && bestPlace[1] >= 3
        ? `${escapeHtml(placeLabel(bestPlace[0]))} (${formatCount(bestPlace[1])})`
        : "";
      const notes = [
        top.length ? `Varieties on record: ${top.map(([v, n]) => `${v} (${formatCount(n)})`).join(", ")}.` : "",
        s.bloom.note ?? "",
      ].filter(Boolean).join(" ");
      // the notes get a full-width row of their own, so the table stays readable on a phone
      return `<tbody class="bloom-species" data-start="${s.start}" data-end="${s.end}">` +
        `<tr><td><a href="../species/${s.slug}/">${escapeHtml(displayName(s))}</a><br><i class="is-size-7">${escapeHtml(s.name)}</i></td>` +
        `<td>${escapeHtml(s.bloom.from)} to ${escapeHtml(s.bloom.to)}<br><span class="is-size-7">${escapeHtml(s.bloom.colour)}</span></td>` +
        `<td class="bloom-count"><a href="../?species=${s.slug}">${formatCount(s.tree_count)}</a></td><td>${placeCell}</td></tr>` +
        (notes ? `\n<tr class="bloom-notes"><td colspan="4" class="is-size-7">${escapeHtml(notes)}</td></tr>` : "") +
        `</tbody>`;
    })
    .join("\n");

  const placeRows = (list) =>
    list
      .slice(0, blossomPlaceCount)
      .map(
        (p) =>
          `<tr><td>${escapeHtml(placeLabel(p.index))}</td><td>${formatCount(p.trees.length)}</td>` +
          `<td><a href="../?species=${slugs(p.trees)}&amp;bounds=${boundsOf(p.trees)}">map</a></td></tr>`
      )
      .join("\n");
  const placeTable = (list) => `<div class="table-container"><table class="table is-narrow is-hoverable">
<thead><tr><th>Place</th><th>Blossom trees</th><th></th></tr></thead>
<tbody>
${placeRows(list)}
</tbody>
</table></div>`;

  const areaRows = ctx.areas
    .map((a) => ({ ...a, count: areaCounts.get(a.name) ?? 0 }))
    .filter((a) => a.count)
    .sort((a, b) => b.count - a.count)
    .map(
      (a) =>
        `<tr><td><a href="../neighbourhoods/${a.slug}/">${escapeHtml(a.name)}</a></td><td>${formatCount(a.count)}</td>` +
        `<td>${percentOf(a.count, a.total)}</td><td><a href="../?species=${allSlugs}&amp;bounds=${a.bounds}">map</a></td></tr>`
    )
    .join("\n");

  const streets = places.filter((p) => p.place.startsWith("On "));
  const parks = places.filter((p) => p.place.startsWith("In "));
  const body = `<h1>Cherry blossoms in Victoria, BC</h1>
<p>Victoria has <b>${formatCount(cherryCount)}</b> flowering cherry and plum trees on public land, and ${formatCount(blossomTrees.length - cherryCount)} more magnolias, crabapples, pears and serviceberries. Blossom season starts with the winter-flowering cherries, peaks with the cherry plums and Yoshino cherries in March, and ends with the Japanese cherries and crabapples in early May.</p>
<p class="bloom-now box" hidden></p>
<p><a class="button is-success" href="../?species=${allSlugs}">Show all ${formatCount(blossomTrees.length)} blossom trees on the map</a></p>
<h2>When the blossoms are out</h2>
<p>Typical flowering times in Victoria. A warm or cold spell moves them a week or two either way, and trees in sheltered spots flower first.</p>
${calendar}
<div class="table-container"><table class="table is-narrow is-fullwidth bloom-table">
<colgroup><col style="width:32%"><col style="width:27%"><col style="width:15%"><col style="width:26%"></colgroup>
<thead><tr><th>Tree</th><th>Usually in flower</th><th>Trees</th><th>Most on</th></tr></thead>
${tableRows}
</table></div>
<h2>Best streets for cherry blossoms</h2>
<p>The streets with the most blossom trees on record. Each map link shows just the blossom trees on that street.</p>
${placeTable(streets)}
<h2>Parks with the most blossom trees</h2>
${placeTable(parks)}
<h2>Blossom trees by neighbourhood</h2>
<div class="table-container"><table class="table is-narrow is-hoverable">
<thead><tr><th>Neighbourhood</th><th>Blossom trees</th><th>Share of its trees</th><th></th></tr></thead>
<tbody>
${areaRows}
</tbody>
</table></div>
<p class="is-size-7">Counts are the City of Victoria's records for trees on public land; ${formatCount(ctx.speciesByName.get("Prunus")?.tree_count ?? 0)} cherries and plums recorded only as <i>Prunus</i> aren't counted, and trees on private property aren't included.</p>`;

  // which species are usually in flower today, worked out in the visitor's browser
  const script = `    (function () {
      var now = new Date();
      var month = (now.getMonth() + 2) % 12; // November is 0
      var part = now.getDate() <= 10 ? 0 : now.getDate() <= 20 ? 1 : 2;
      var slot = month < ${calendarMonths.length} ? month * 3 + part : -1;
      var flowering = [];
      document.querySelectorAll('[data-start]').forEach(function (row) {
        var on = slot >= +row.dataset.start && slot <= +row.dataset.end;
        row.classList.toggle('is-blooming', on);
        var name = row.querySelector('a').textContent;
        if (on && row.tagName === 'LI') flowering.push(name);
      });
      var message = document.querySelector('.bloom-now');
      if (slot === -1) {
        message.textContent = 'Blossom season is over for this year. The first winter-flowering cherries open in November.';
      } else if (flowering.length) {
        message.textContent = 'Usually in flower around now: ' + flowering.join(', ') + '.';
        var today = document.querySelector('.bloom-today');
        today.style.left = ((slot + 0.5) / ${calendarSlots} * 100) + '%';
        today.hidden = false;
      } else {
        message.textContent = 'Nothing is usually in flower right now.';
      }
      message.hidden = false;
    })();`;

  return {
    count: blossomSpecies.length,
    html: layout({
      path: "blossoms/",
      breadcrumbs: [["Cherry blossoms", "blossoms/"]],
      title: "Cherry blossoms in Victoria, BC: when and where to see them",
      description:
        `When Victoria's ${formatCount(cherryCount)} flowering cherry and plum trees bloom, from the first cherry plums in February ` +
        `to the Japanese cherries in May, and the streets and parks with the most blossoms.`,
      body,
      script,
    }),
  };
}

// species: every species with its slug and tree_count; trees: [lat, lng, speciesIndex, ...];
// treeAreas: each tree's City neighbourhood (or null), in the same order as trees
export function writePages(docsDir, { species, trees, treeAreas, places, botanical, total }) {
  const areasByName = new Map();
  trees.forEach((tree, i) => {
    const name = treeAreas[i];
    if (!name) return;
    if (!areasByName.has(name)) areasByName.set(name, { name, slug: slugFor(name), total: 0, speciesCounts: new Map(), points: [] });
    const area = areasByName.get(name);
    area.total += 1;
    area.speciesCounts.set(tree[2], (area.speciesCounts.get(tree[2]) ?? 0) + 1);
    area.points.push(tree);
  });
  const areas = [...areasByName.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
  for (const a of areas) a.bounds = boundsOf(a.points);

  const listed = species.map((s, index) => ({ ...s, index })).filter((s) => s.tree_count > 0);
  const speciesByName = new Map(listed.map((s) => [s.name, s]));
  const ctx = { species, total, areas, listed, trees, treeAreas, places, botanical, speciesByName };

  // both folders are fully generated, so clear out pages for species that are gone
  for (const dir of ["species", "neighbourhoods", "blossoms"]) fs.rmSync(`${docsDir}/${dir}`, { recursive: true, force: true });
  const write = (path, html) => {
    fs.mkdirSync(`${docsDir}/${path}`, { recursive: true });
    fs.writeFileSync(`${docsDir}/${path}index.html`, html);
    return path;
  };

  for (const s of listed) write(`species/${s.slug}/`, speciesPage(s, ctx));
  const paths = [
    "",
    write("species/", speciesIndexPage(listed, ctx)),
    ...listed.filter(isIndexed).map((s) => `species/${s.slug}/`),
    write("neighbourhoods/", areaIndexPage(areas)),
    ...areas.map((a) => write(`neighbourhoods/${a.slug}/`, areaPage(a, ctx))),
  ];
  const blossoms = blossomPage(ctx);
  paths.push(write("blossoms/", blossoms.html));

  const urls = paths.map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join("\n");
  fs.writeFileSync(
    `${docsDir}/sitemap.xml`,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
  fs.writeFileSync(`${docsDir}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);

  writeHomeLinks(docsDir, listed, areas);

  return { species: listed.length, neighbourhoods: areas.length, blossomSpecies: blossoms.count, urls: paths.length };
}

// The map page is hand-written, but its links to the most common species and every
// neighbourhood come from the data, between these markers in docs/index.html
const homeLinksStart = "<!-- home-links:start (generated by pipeline/pages.mjs) -->";
const homeLinksEnd = "<!-- home-links:end -->";
const homeSpeciesCount = 12;

function writeHomeLinks(docsDir, species, areas) {
  const file = `${docsDir}/index.html`;
  const html = fs.readFileSync(file, "utf8");
  const start = html.indexOf(homeLinksStart);
  const end = html.indexOf(homeLinksEnd);
  if (start === -1 || end === -1) throw new Error(`docs/index.html is missing the ${homeLinksStart} markers`);

  const link = (href, text) => `<a href="${href}">${escapeHtml(text)}</a>`;
  const common = [...species]
    .sort((a, b) => b.tree_count - a.tree_count)
    .slice(0, homeSpeciesCount)
    .map((s) => link(`species/${s.slug}/`, displayName(s)));
  const block = `${homeLinksStart}
          <p>The most common trees in Victoria: ${common.join(", ")}, and <a href="species/">${formatCount(species.length)} more species</a>.</p>
          <p>Trees by neighbourhood: ${areas.map((a) => link(`neighbourhoods/${a.slug}/`, a.name)).join(", ")}.</p>
          <p>Blossom season: <a href="blossoms/">when and where to see cherry blossoms in Victoria</a>.</p>
          `;
  fs.writeFileSync(file, html.slice(0, start) + block + html.slice(end));
}
