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

// links from the species and neighbourhood pages: ?species=<slug> highlights that species,
// ?bounds=<west,south,east,north> frames an area
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

  const speciesIndex = treeData.species.findIndex((s) => s.slug === urlParams.get('species'));
  if (speciesIndex !== -1) {
    highlightSpecies(treeData, speciesIndex);
  }
  const bounds = (urlParams.get('bounds') || '').split(',').map(Number);
  if (bounds.length === 4 && bounds.every(Number.isFinite)) {
    map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 40, animate: false });
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

function addTrees(treeData) {
  const features = treeData.trees.map(function([latitude, longitude, speciesIndex, botanicalIndex]) {
    const species = treeData.species[speciesIndex];
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [longitude, latitude] },
      properties: {
        name: species.common_name || species.name,
        conifer: species.order === 'Pinales',
        species: speciesIndex,
        botanical: botanicalIndex
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
    paint: {
      'circle-color': ['case', ['get', 'conifer'], '#1b5e20', '#43a047'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 2, 17, 4, 19, 7, 21, 12],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 0, 17, 1],
      'circle-opacity': 0.9
    }
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
      'text-color': '#1b3d1b',
      'text-halo-color': '#ffffff',
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
function highlightSpecies(treeData, speciesIndex) {
  const isSpecies = ['==', ['get', 'species'], speciesIndex];
  map.setPaintProperty('trees', 'circle-color', ['case', isSpecies, '#e65100', '#9e9e9e']);
  map.setPaintProperty('trees', 'circle-opacity', ['case', isSpecies, 1, 0.35]);
  map.setLayoutProperty('trees', 'circle-sort-key', ['case', isSpecies, 1, 0]);

  const points = treeData.trees.filter((tree) => tree[2] === speciesIndex);
  if (!urlParams.has('bounds')) {
    const bounds = new maplibregl.LngLatBounds();
    points.forEach(([latitude, longitude]) => bounds.extend([longitude, latitude]));
    map.fitBounds(bounds, { padding: 40, maxZoom: 17, animate: false });
  }

  const species = treeData.species[speciesIndex];
  const name = species.common_name || species.name;
  showFooterMessage(`Showing ${points.length === 1 ? 'the 1' : 'all ' + points.length.toLocaleString()} ${name} ${points.length === 1 ? 'tree' : 'trees'} in orange. `);
  const showAll = document.createElement('a');
  showAll.href = window.location.pathname;
  showAll.textContent = 'Show all trees';
  document.getElementById('footer-text').append(showAll);
}

function showTree(treeData, properties) {
  const species = treeData.species[properties.species];
  const botanicalName = treeData.botanical[properties.botanical];

  let sencotenName = '';
  if (species.sencoten_name) {
    if (species.sencoten_url) {
      sencotenName = `<a href="${species.sencoten_url}">${species.sencoten_name}</a>`;
    } else {
      sencotenName = species.sencoten_name;
    }
  }

  let details = '';
  if (species.native_region) {
    details += `<p>This tree is native to ${species.native_region}${species.native ? ', including Victoria' : ''}.</p>`;
  } else if (species.native) {
    details += '<p>This tree is native to Victoria.</p>';
  }

  const treePercentage = Math.round(((species.tree_count / treeData.total) * 100 * 100) + Number.EPSILON) / 100;
  details += `
    <p>
      The City of Victoria has <b>${species.tree_count}</b> of these trees on record.
      (<b>${treePercentage}%</b>)
    </p>`;

  if (species.description) {
    details += `<p>${species.description.replace(/(?:\r\n|\r|\n)/g, '<br>')}</p>`;
  }

  document.getElementById('tree-modal-content').innerHTML = `
    <div style='margin:10px;padding:10px'>
      <h3>${properties.name}${sencotenName ? ' - ' + sencotenName : ''}</h3>
      <p><b>${botanicalName.includes("'") ? botanicalName : species.name}</b></p>
      ${details}
      <p><b><a href='https://en.m.wikipedia.org/?title=${botanicalName}' target='_blank'>Wikipedia</a></b></p>
    </div>
  `;
  document.getElementById('tree-modal').classList.add('is-active');
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
    paint: { 'fill-color': '#2652F2', 'fill-opacity': 0.12 }
  });
  map.addLayer({
    id: 'city-outline',
    type: 'line',
    source: 'city',
    maxzoom: 14.5,
    paint: { 'line-color': '#1E41AA', 'line-opacity': 0.5, 'line-width': 2 }
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
function showFooterMessage(message) {
  hideHint();
  document.getElementById('footer-text').textContent = message;
  document.getElementById('footer').style.display = 'block';
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

// welcome modal: shown on a first visit and from the ? button
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
document.getElementById('about').addEventListener('click', function() {
  welcomeModal.classList.add('is-active');
});
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
