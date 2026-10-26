// Writes the static, search-indexable pages: one per species and neighbourhood, their
// index pages, sitemap.xml and robots.txt. The map page (docs/index.html) is hand-written.
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
const formatCount = (n) => n.toLocaleString("en-CA");
const percentOf = (count, total) => `${(Math.round((count / total) * 10000) / 100).toLocaleString("en-CA")}%`;
const displayName = (s) => s.common_name || s.name;

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

function layout({ path, title, description, body }) {
  const depth = path.split("/").filter(Boolean).length;
  const home = depth ? "../".repeat(depth) : "./";
  const canonical = siteUrl + path;
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
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Victoria Trees">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${canonical}">
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
  </footer>
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
  return layout({ path: `species/${s.slug}/`, title, description, body });
}

function speciesIndexPage(species, ctx) {
  const rows = [...species]
    .sort((a, b) => displayName(a).localeCompare(displayName(b), "en"))
    .map(
      (s) =>
        `<tr><td><a href="${s.slug}/">${escapeHtml(displayName(s))}</a></td><td><i>${escapeHtml(s.name)}</i></td><td>${formatCount(s.tree_count)}</td></tr>`
    )
    .join("\n");
  const body = `<h1>Tree species in Victoria, BC</h1>
<p>The ${formatCount(species.length)} species of tree on public land in the City of Victoria, with how many of each the City has on record.</p>
<div class="table-container"><table class="table is-narrow is-hoverable">
<thead><tr><th>Common name</th><th>Botanical name</th><th>Trees</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`;
  return layout({
    path: "species/",
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
    title: "Trees by neighbourhood in Victoria, BC",
    description: `Tree species and counts for each of Victoria's ${areas.length} neighbourhoods, from James Bay and Fairfield to Fernwood and Oaklands.`,
    body,
  });
}

// species: every species with its slug and tree_count; trees: [lat, lng, speciesIndex, ...];
// treeAreas: each tree's City neighbourhood (or null), in the same order as trees
export function writePages(docsDir, { species, trees, treeAreas, total }) {
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
  const ctx = { species, total, areas };

  // both folders are fully generated, so clear out pages for species that are gone
  for (const dir of ["species", "neighbourhoods"]) fs.rmSync(`${docsDir}/${dir}`, { recursive: true, force: true });
  const write = (path, html) => {
    fs.mkdirSync(`${docsDir}/${path}`, { recursive: true });
    fs.writeFileSync(`${docsDir}/${path}index.html`, html);
    return path;
  };

  const paths = [
    "",
    write("species/", speciesIndexPage(listed, ctx)),
    ...listed.map((s) => write(`species/${s.slug}/`, speciesPage(s, ctx))),
    write("neighbourhoods/", areaIndexPage(areas)),
    ...areas.map((a) => write(`neighbourhoods/${a.slug}/`, areaPage(a, ctx))),
  ];

  const urls = paths.map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join("\n");
  fs.writeFileSync(
    `${docsDir}/sitemap.xml`,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
  fs.writeFileSync(`${docsDir}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`);

  return { species: listed.length, neighbourhoods: areas.length, urls: paths.length };
}
