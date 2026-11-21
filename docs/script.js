// every tree in the city, built by pipeline/build.mjs
const treeDataLoaded = fetch('data/trees.json').then(function(response) {
  if (!response.ok) {
    throw new Error('trees.json returned ' + response.status);
  }
  return response.json();
});

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-123.36059, 48.426867],
  zoom: 13,
  maxZoom: 21,
  attributionControl: false
});
map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

// shows the blue location dot; driven by the #geolocate button rather than its own button
const geolocate = new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  fitBoundsOptions: { maxZoom: 19 }
});
map.addControl(geolocate);

const mapLoaded = new Promise(function(resolve) {
  map.on('load', resolve);
});

// links from the species and neighbourhood pages: ?species=<slug> highlights that species
// (or several, comma-separated, as the blossom page links), ?bounds=<west,south,east,north> frames an area
const urlParams = new URLSearchParams(window.location.search);

const arrivedFromLink = urlParams.has('species') || urlParams.has('bounds');

treeDataLoaded.then(function(treeData) {
  const refreshed = new Date(treeData.updated + 'T12:00:00');
  document.getElementById('data-updated').textContent =
    'Tree data last refreshed from the City of Victoria on ' +
    refreshed.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' }) + '.';
});

Promise.all([treeDataLoaded, mapLoaded]).then(function([treeData]) {
  addCityOutline();
  addTrees(treeData);

  const slugs = (urlParams.get('species') || '').split(',');
  const speciesIndexes = treeData.species.flatMap((s, i) => (s.tree_count && slugs.includes(s.slug) ? [i] : []));
  if (speciesIndexes.length) {
    highlightSpecies(treeData, speciesIndexes);
  }
  const bounds = (urlParams.get('bounds') || '').split(',').map(Number);
  if (bounds.length === 4 && bounds.every(Number.isFinite)) {
    map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: framePadding, animate: false });
  }

  // phones are usually out looking at a tree, so returning visitors who already allowed
  // location start there; everyone else is asked from the welcome modal
  if (!arrivedFromLink && !welcomeModal.classList.contains('is-active') && window.matchMedia('(pointer: coarse)').matches) {
    locationAlreadyAllowed().then(function(allowed) {
      if (allowed) geolocate.trigger();
    });
  }
}).catch(function(error) {
  console.error(error);
  showFooterMessage('Whoops, something went wrong loading the trees. Try refreshing the page.');
});

// blossom trees' flower colours; pages.mjs's blossomHues and theme.css's .hue-* swatches match
const blossomColours = {
  'white': '#ffffff',
  'pale pink': '#f4b6c8',
  'pink': '#e0739a',
  'deep pink': '#b02a62'
};

// a blossom tree's flower colour: its variety's if the City recorded one we know, else its species'
function blossomHue(species, botanicalName) {
  if (!species.blossom) return null;
  const name = (botanicalName || '').toLowerCase();
  const variety = Object.keys(species.blossom.varieties).find((v) => name.includes(v));
  return variety ? species.blossom.varieties[variety] : species.blossom.hue;
}

// a tree's cultivar note, when the City's botanical name names one we've described
function cultivarOf(species, botanicalName) {
  const name = (botanicalName || '').toLowerCase();
  return (species.cultivars || []).find((c) => name.includes(c.match)) || null;
}

// how trees look when nothing is highlighted; clearHighlight() goes back to it
const treePaint = {
  'circle-color': ['case', ['get', 'conifer'], '#35553a', '#8aa65f'],
  'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 2, 17, 4, 19, 7, 21, 12],
  'circle-stroke-color': '#f7f2e3',
  'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 0, 17, 1],
  'circle-opacity': 0.9
};

function addTrees(treeData) {
  const features = treeData.trees.map(function([latitude, longitude, speciesIndex, botanicalIndex], treeIndex) {
    const species = treeData.species[speciesIndex];
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
      properties: {
        name: species.common_name || species.name,
        conifer: species.order === 'Pinales',
        species: speciesIndex,
        hue: blossomHue(species, treeData.botanical[botanicalIndex]),
        tree: treeIndex
      }
    };
  });

  map.addSource('trees', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features }
  });

  map.addLayer({
    id: 'trees',
    type: 'circle',
    source: 'trees',
    paint: { ...treePaint }
  });

  map.addLayer({
    id: 'tree-labels',
    type: 'symbol',
    source: 'trees',
    minzoom: 18,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 0.8]
    },
    paint: {
      'text-color': '#2f3b2c',
      'text-halo-color': '#f7f2e3',
      'text-halo-width': 1.5
    }
  });

  map.on('click', 'trees', function(event) {
    showTree(treeData, event.features[0].properties);
  });
  map.on('mouseenter', 'trees', function() {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'trees', function() {
    map.getCanvas().style.cursor = '';
  });
}

// colours the species' trees and greys out the rest, then frames them unless ?bounds= is set
function highlightSpecies(treeData, speciesIndexes) {
  const isSpecies = ['in', ['get', 'species'], ['literal', speciesIndexes]];
  // highlighted trees keep their usual colours against the grey; blossom trees are coloured by their
  // flowers instead, with a dark ring so white ones show on the map
  const blossoms = speciesIndexes.every((i) => treeData.species[i].blossom);
  const highlight = blossoms
    ? ['match', ['get', 'hue'], ...Object.entries(blossomColours).flat(), treePaint['circle-color']]
    : treePaint['circle-color'];
  map.setPaintProperty('trees', 'circle-color', ['case', isSpecies, highlight, '#b9b4a0']);
  map.setPaintProperty('trees', 'circle-opacity', ['case', isSpecies, 1, 0.35]);
  map.setLayoutProperty('trees', 'circle-sort-key', ['case', isSpecies, 1, 0]);
  if (blossoms) {
    map.setPaintProperty('trees', 'circle-stroke-color', ['case', isSpecies, '#7d2a48', '#f7f2e3']);
    map.setPaintProperty('trees', 'circle-stroke-width', ['case', isSpecies,
      ['interpolate', ['linear'], ['zoom'], 11, 0.5, 17, 1.5],
      ['interpolate', ['linear'], ['zoom'], 14, 0, 17, 1]]);
    map.setPaintProperty('trees', 'circle-radius', ['interpolate', ['linear'], ['zoom'],
      11, ['case', isSpecies, 1.5, 1], 14, ['case', isSpecies, 3, 2], 17, ['case', isSpecies, 5, 4],
      19, 7, 21, 12]);
  }

  const points = treeData.trees.filter((tree) => speciesIndexes.includes(tree[2]));
  if (!urlParams.has('bounds')) {
    const [west, south, east, north] = framingBounds(points);
    map.fitBounds([[west, south], [east, north]], { padding: framePadding, maxZoom: 17, animate: false });
  }

  // links that frame an area (a street, a neighbourhood) count the trees in it, not the whole city's
  const area = (urlParams.get('bounds') || '').split(',').map(Number);
  if (area.length === 4 && area.every(Number.isFinite)) {
    const [west, south, east, north] = area;
    const inArea = points.filter(([lat, lng]) => lat >= south && lat <= north && lng >= west && lng <= east).length;
    const what = speciesIndexes.length === 1
      ? (treeData.species[speciesIndexes[0]].common_name || treeData.species[speciesIndexes[0]].name)
      : blossoms ? 'blossom' : 'highlighted';
    showFooterMessage(`${inArea.toLocaleString()} ${what} ${inArea === 1 ? 'tree' : 'trees'} in this area`);
  } else if (speciesIndexes.length === 1) {
    const species = treeData.species[speciesIndexes[0]];
    const name = species.common_name || species.name;
    showFooterMessage(points.length === 1 ? `The only ${name} tree on the map` : `All ${points.length.toLocaleString()} ${name} trees`);
  } else {
    showFooterMessage(blossoms
      ? `${points.length.toLocaleString()} blossom trees, coloured by flower`
      : `${points.length.toLocaleString()} trees of ${speciesIndexes.length} species`);
  }
  if (blossoms) {
    const legend = document.createElement('span');
    legend.className = 'hue-legend';
    // only the colours these trees use
    const hues = new Set(points.map((tree) => blossomHue(treeData.species[tree[2]], treeData.botanical[tree[3]])));
    Object.keys(blossomColours).filter((hue) => hues.has(hue)).forEach(function(hue) {
      const item = document.createElement('span');
      const swatch = document.createElement('span');
      swatch.className = 'hue-swatch';
      swatch.style.backgroundColor = blossomColours[hue];
      item.append(swatch, hue);
      legend.append(item);
    });
    document.getElementById('footer-text').append(legend);
  }
  footerClear.setAttribute('aria-label', 'Clear the highlight and show all trees');
  footerClear.onclick = clearHighlight;
}

// back to every tree in its usual colours, without reloading the map
function clearHighlight() {
  Object.entries(treePaint).forEach(([property, value]) => map.setPaintProperty('trees', property, value));
  map.setLayoutProperty('trees', 'circle-sort-key', undefined);
  hideFooter();
  history.replaceState(null, '', window.location.pathname);
}

// room at the top for the message card when framing trees
const framePadding = { top: 100, bottom: 40, left: 40, right: 40 };

// [west, south, east, north] around the trees; with many trees, around the middle 98% of them,
// so a few far-off trees (Dominion Brook Park, out on the Saanich Peninsula) don't zoom the map out
function framingBounds(points) {
  const lats = points.map((p) => p[0]).sort((a, b) => a - b);
  const lngs = points.map((p) => p[1]).sort((a, b) => a - b);
  const trim = points.length >= 50 ? Math.floor(points.length * 0.01) : 0;
  const last = points.length - 1 - trim;
  return [lngs[trim], lats[trim], lngs[last], lats[last]];
}

function showTree(treeData, properties) {
  const tree = treeData.trees[properties.tree];
  const [, , speciesIndex, botanicalIndex, , , placeIndex] = tree;
  const species = treeData.species[speciesIndex];
  const botanicalName = treeData.botanical[botanicalIndex];
  const name = properties.name;

  // GA event, so real visitors (who open trees) can be told apart from bots and link previews
  if (typeof gtag === 'function') {
    gtag('event', 'view_tree', { species: species.slug });
  }

  let sencotenName = '';
  if (species.sencoten_name) {
    if (species.sencoten_url) {
      sencotenName = `<a href="${species.sencoten_url}">${species.sencoten_name}</a>`;
    } else {
      sencotenName = species.sencoten_name;
    }
  }

  const origin = species.native
    ? '<span class="tag is-native">Native to Victoria</span>'
    : species.native_region || species.garden_origin
      ? '<span class="tag is-planted">Planted</span>'
      : '';

  let details = '';
  if (placeIndex !== null) {
    details += `<p class="tree-place">${treeData.places[placeIndex]}</p>`;
  }
  if (!species.native && species.native_region) {
    // curated ranges are written to follow "native to", sometimes as "from X to Y"
    details += `<p>Native to ${species.native_region.replace(/^from /, '')}.</p>`;
  } else if (!species.native && species.garden_origin) {
    // hybrids and garden plants that don't grow wild: where and when they were raised
    details += `<p>${species.garden_origin[0].toUpperCase()}${species.garden_origin.slice(1)}.</p>`;
  }
  const size = sizeFacts(treeData, tree, name);
  if (size) {
    details += `<p>${size}</p>`;
  }
  details += `<p>${species.commonness}</p>`;
  if (species.top_area && species.tree_count >= 5) {
    details += `<p>Most are in ${species.top_area.name} (${species.top_area.count.toLocaleString()}). ` +
      `<a href="species/${species.slug}/">See where they grow</a></p>`;
  }
  const cultivar = cultivarOf(species, botanicalName);
  if (cultivar) {
    details += `<p><b>'${cultivar.name}'</b>: ${cultivar.description}</p>`;
  }
  if (species.description) {
    details += `<p>${species.description.replace(/(?:\r\n|\r|\n)/g, '<br>')}</p>`;
  }
  if (species.turner_pages) {
    details += `<p class="is-size-7">Indigenous uses from Nancy Turner, <a href="about/#sources"><i>Ancient Pathways, Ancestral Knowledge</i></a> (2014), ${species.turner_pages}.</p>`;
  }

  const shownName = cultivar ? `${species.name} '${cultivar.name}'` : botanicalName.includes("'") ? botanicalName : species.name;
  document.getElementById('tree-modal-content').innerHTML = `
    <h3>${name}${sencotenName ? ' - ' + sencotenName : ''}</h3>
    <p><b>${shownName}</b> ${origin}</p>
    ${details}
    <p><b><a href='https://en.m.wikipedia.org/?title=${botanicalName}' target='_blank'>Wikipedia</a></b></p>
    <p class="is-size-7">Something wrong with this tree?
      <a href="${treeFeedbackUrl(treeData, tree, name)}" target="_blank" rel="noopener">Let us know</a></p>
  `;
  document.getElementById('tree-modal').classList.add('is-active');
}

// The feedback form, opened with "Wrong data / missing tree" chosen and the tree described in the message
const feedbackForm = 'https://docs.google.com/forms/d/e/1FAIpQLSdNRGWK0oKwgXxuYTQGoDz7d3TIEknw-KqP0TkyjcJsTMIi4Q/viewform';
function treeFeedbackUrl(treeData, tree, name) {
  const [latitude, longitude, speciesIndex, botanicalIndex, , , placeIndex] = tree;
  const lines = [
    `Tree: ${name} (${treeData.botanical[botanicalIndex] || treeData.species[speciesIndex].name})`,
    placeIndex !== null ? treeData.places[placeIndex] : null,
    `Location: ${latitude}, ${longitude}`,
    '',
    ''
  ].filter((line) => line !== null);
  const params = new URLSearchParams({
    usp: 'pp_url',
    'entry.1170232527': 'Wrong data / missing tree',
    'entry.1271914933': lines.join('\n')
  });
  return `${feedbackForm}?${params}`;
}

// "About 16 m tall, roughly a 5-storey building, with a trunk 90 cm across. Taller than 9 in 10 ..."
function sizeFacts(treeData, tree, name) {
  const [, , speciesIndex, , height, diameter] = tree;
  const parts = [];
  if (height !== null) {
    const storeys = Math.round(height / 3);
    parts.push(`About ${height} m tall` + (storeys >= 2 ? `, roughly a ${storeys}-storey building` : ''));
  }
  if (diameter !== null) {
    parts.push(`${parts.length ? 'with a' : 'A'} trunk ${diameter} cm across`);
  }
  if (!parts.length) return '';
  let text = parts.join(', ') + '.';

  // only compare against species with enough measured trees for it to mean something
  const heights = treeData.trees.filter((t) => t[2] === speciesIndex && t[4] !== null).map((t) => t[4]);
  if (height !== null && heights.length >= 5) {
    const shorter = heights.filter((h) => h < height).length / heights.length;
    if (height === Math.max(...heights)) {
      text += ` The tallest ${name} on the map.`;
    } else if (shorter >= 0.6) {
      text += ` Taller than ${Math.floor(shorter * 10)} in 10 ${name} trees on the map.`;
    }
  }
  return text;
}

function addCityOutline() {
  const cityOfVictoriaPoints = [
    [48.428566, -123.394325],
    [48.441922, -123.392759],
    [48.44942, -123.384637],
    [48.447012, -123.379627],
    [48.450026, -123.35258],
    [48.44813, -123.332635],
    [48.43896, -123.332517],
    [48.438752, -123.328112],
    [48.433631, -123.329164],
    [48.433466, -123.322335],
    [48.405497, -123.326932],
    [48.402186, -123.350042],
    [48.412265, -123.396069]
  ];
  const ring = cityOfVictoriaPoints.map(([lat, lng]) => [lng, lat]);
  ring.push(ring[0]);

  map.addSource('city', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } }
  });
  map.addLayer({
    id: 'city-fill',
    type: 'fill',
    source: 'city',
    maxzoom: 14.5,
    paint: { 'fill-color': '#7a5636', 'fill-opacity': 0.06 }
  });
  map.addLayer({
    id: 'city-outline',
    type: 'line',
    source: 'city',
    maxzoom: 14.5,
    paint: { 'line-color': '#7a5636', 'line-opacity': 0.45, 'line-width': 2 }
  });
}

// the hint gets out of the way as soon as someone starts using the map
function hideHint() {
  document.getElementById('hint').style.display = 'none';
}
map.on('dragstart', hideHint);
map.on('zoomstart', function(event) {
  if (event.originalEvent) hideHint();
});
map.on('click', hideHint);

// errors and the species highlight; replaces the hint
// the × closes a message, or clears a highlight (highlightSpecies sets that)
const footerClear = document.getElementById('footer-clear');
function showFooterMessage(message) {
  hideHint();
  document.getElementById('footer-text').textContent = message;
  document.getElementById('footer').hidden = false;
  footerClear.setAttribute('aria-label', 'Close');
  footerClear.onclick = hideFooter;
}
function hideFooter() {
  document.getElementById('footer').hidden = true;
}

function locationAlreadyAllowed() {
  if (!navigator.permissions) return Promise.resolve(false);
  return navigator.permissions.query({ name: 'geolocation' })
    .then((status) => status.state === 'granted')
    .catch(() => false);
}

function locateUser() {
  hideHint();
  mapLoaded.then(function() {
    geolocate.trigger();
  });
}

const geolocateIcon = document.querySelector('#geolocate .icon');
document.getElementById('geolocate').addEventListener('click', locateUser);
geolocate.on('trackuserlocationstart', function() {
  geolocateIcon.classList.add('has-text-info');
});
geolocate.on('trackuserlocationend', function() {
  geolocateIcon.classList.remove('has-text-info');
});
geolocate.on('error', function() {
  geolocateIcon.classList.remove('has-text-info');
  showFooterMessage('We couldn\'t get your location. Check that location permissions are enabled and try again.');
});

// welcome modal: shown on a first visit and from "How it works" in the menu
const welcomeModal = document.getElementById('welcome-modal');
function welcomeSeen() {
  try {
    return localStorage.getItem('welcomeSeen') === 'yes';
  } catch (e) {
    return false;
  }
}
if (!arrivedFromLink && !welcomeSeen()) {
  welcomeModal.classList.add('is-active');
}
function showWelcome(event) {
  event.preventDefault();
  closeMenu();
  welcomeModal.classList.add('is-active');
}
document.getElementById('menu-help').addEventListener('click', showWelcome);
document.getElementById('navbar-help').addEventListener('click', showWelcome);

// the phone menu: a sheet from the bottom with the site's pages
const menuSheet = document.getElementById('menu-sheet');
const menuButton = document.getElementById('menu-button');
function openMenu() {
  hideHint();
  menuSheet.hidden = false;
  menuButton.setAttribute('aria-expanded', 'true');
  menuSheet.querySelector('.menu-links a').focus();
  gtag('event', 'open_menu');
}
function closeMenu() {
  if (menuSheet.hidden) return;
  menuSheet.hidden = true;
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.focus();
}
menuButton.addEventListener('click', openMenu);
document.getElementById('menu-close').addEventListener('click', closeMenu);
menuSheet.querySelector('.menu-backdrop').addEventListener('click', closeMenu);
document.getElementById('menu-locate').addEventListener('click', function(event) {
  event.preventDefault();
  closeMenu();
  locateUser();
});

// February to mid May, when something is usually in flower, the hint and menu point to the blossom calendar
const today = new Date();
if (today.getMonth() >= 1 && (today.getMonth() < 4 || (today.getMonth() === 4 && today.getDate() <= 15))) {
  document.getElementById('hint-season').hidden = false;
  document.getElementById('menu-season').hidden = false;
}
document.getElementById('welcome-locate').addEventListener('click', function() {
  closeModal();
  locateUser();
});
document.getElementById('welcome-explore').addEventListener('click', closeModal);

function closeModal() {
  if (welcomeModal.classList.contains('is-active')) {
    try {
      localStorage.setItem('welcomeSeen', 'yes');
    } catch (e) {
      // private browsing: the welcome shows again next visit
    }
  }
  document.querySelectorAll('.modal').forEach((el) => {
    el.classList.remove('is-active');
  });
}
document.querySelectorAll('.modal-background').forEach((el) => {
  el.addEventListener('click', closeModal);
});
document.querySelectorAll('.modal-close').forEach((el) => {
  el.addEventListener('click', closeModal);
});

document.addEventListener('keydown', function(event) {
  if (event.key !== 'Escape') return;
  closeMenu();
  closeModal();
});
