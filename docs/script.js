let openInfoWindow;
let markers = [];
let currentPositionMarker;
let lastPos = { lat: 0, lng: 0 };
let lastFetchPos;
let dragging = false;
let map;
let victoriaShape, beaconHillParkShape;
let locating = false; // used to allow drag without moving center when relocating
let watchingPosition = false;

const apiDeployment = "https://sb2tcoq1of.execute-api.us-west-2.amazonaws.com/production";

// set map height
const navbarHeight = 0; // 56;
document.getElementById('map-container').setAttribute('style', 'height:'+(window.innerHeight - navbarHeight)+'px');

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 48.426867, lng: -123.36059},
    zoom: 13,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    tilt: 0,
    disableDefaultUI: true
  });

  document.getElementById('geolocate').addEventListener('click', function() {
    centerOnCurrentLocationAndFetch();
  });

  const findTreesForCurrentPosition = function() {
    // get bounding box
    // use those co-ords
    const box = {
      xmin: map.getBounds().getNorthEast().lng(),
      xmax: map.getBounds().getSouthWest().lng(),
      ymin: map.getBounds().getSouthWest().lat(),
      ymax: map.getBounds().getNorthEast().lat()
    }
    fetchTrees(box);
  };

  // document.getElementById('search-button').addEventListener('click', findTreesForCurrentPosition);

  // add the map & park sections
  addShapes();

  const fetchTreesForCurrentBox = () => {
    const box = {
      xmin: map.getBounds().getNorthEast().lng(),
      xmax: map.getBounds().getSouthWest().lng(),
      ymin: map.getBounds().getSouthWest().lat(),
      ymax: map.getBounds().getNorthEast().lat()
    }

    // fetch trees depending on zoom level
    if (map.getZoom() > 17) {
      fetchTrees(box);
    }
  }

  const zoomLimit = 16;

  map.addListener('zoom_changed', () => {
    // only show header when zoomed out
    const header = document.getElementById('header');
    if (map.getZoom() > 14) {
      header.style.display = 'none';
    } else {
      header.style.display = 'block';
    }

    // show different text at diff zoom levels
    const footerText = document.getElementById('footer-text');
    const zoom = map.getZoom();
    if (zoom < 18) {
      footerText.style.display = 'block';
      footerText.innerHTML = 'zoom in to see the trees, or press the button on the right to zoom to your position';
    } else {
      // make some real estate for the trees
      footerText.style.display = 'none';
    }
    // TODO: show a tooltip if no trees in this area

    // only display city of vic less than 14 zoom
    cityOfVictoriaPoly.setVisible(map.getZoom() <= 14);  

    // highlight the shapes when at different zoom levels
    if (map.getZoom() <= zoomLimit) {
      beaconHillParkPoly.setVisible(true);
      markers.forEach((marker) => {
        marker.setVisible(false);
      });
    } else {
      beaconHillParkPoly.setVisible(false);
      markers.forEach((marker) => {
        marker.setVisible(true);
      });
    }

    if (!locating) {
      console.log('zoomchangefetch');
      fetchTreesForCurrentBox();
    }
  });

  map.addListener('dragstart', () => {
    dragging = true;
  });

  // fetch when drag end (factoring in inertia)
  map.addListener('idle', () => {
    if (dragging) { // prevent this firing every position update
      dragging = false;
      console.log('idle fetch');
      fetchTreesForCurrentBox();
    }
  })
} // initMap

function centerOnCurrentLocationAndFetch() {
  if (navigator.geolocation) {
    locating = false;
    navigator.geolocation.getCurrentPosition(function(position) {
      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      map.setCenter(pos);

      updateCurrentPositionMarker(pos);

      console.log('fetching from here');
      fetchTreesForPosition(pos);
      
      watchAndUpdatePosition();
    });

  } // if navigator.geolocation
}

// watch for position updates, update and fetch, but dont re-center
function watchAndUpdatePosition() {
  if (!watchingPosition) {
    watchingPosition = true;
    navigator.geolocation.watchPosition(function(position) {
      console.log('position updated');
      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      updateCurrentPositionMarker(pos);

      // fetch if the last fetch was far away
      const lastFetchDiff = Math.abs(pos.lat - lastFetchPos.lat) + Math.abs(pos.lng - lastFetchPos.lng)
      console.log(lastFetchDiff);
      if (lastFetchDiff > 0.0005) {
        console.log('last fetch diff is big, fetching');
        fetchTreesForPosition(pos);
      };
    }, function() {
      console.log("Error watching geolocation position");
    }, {
      enableHighAccuracy: true,
      // maximumAge: 0 // no location caching
    })
  }
};


function updateCurrentPositionMarker(pos) {
  if (currentPositionMarker) {
    currentPositionMarker.setPosition(pos);
  } else {
    currentPositionMarker = new google.maps.Marker({
      position: pos,
      map: map,
      title: 'You are here',
      icon: {
        path: "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z",
        fillColor: '#4285F4',
        fillOpacity: .7,
        strokeWeight: 5,
        strokeColor: '#FFFFFF',
        strokeOpacity: 0.9,
        scale: 0.1,
        anchor: new google.maps.Point(250, 250),
      }
    });
  }

  // set zoom according to diff in last position (less diff = closer zoom)
  error = Math.abs(pos.lat - lastPos.lat) + Math.abs(pos.lng - lastPos.lng);
  let zoom;
  if (error < 0.0002) {
    zoom = 20;
  } else if(error < 0.0008) {
    zoom = 19;
  } else {
    zoom = 18;
  }
  if (map.getZoom() != zoom) { // prevent zoom_changed from firing unnecessarily
    map.setZoom(zoom);
  }

  lastPos.lat = pos.lat;
  lastPos.lng = pos.lng;
}

function fetchTreesForPosition(pos) {
  const radius = 0.0008 // roughly 2km around current position
  const boundingBox = {
    xmin: pos.lng + radius,
    xmax: pos.lng - radius,
    ymin: pos.lat - radius,
    ymax: pos.lat + radius
  }

  lastFetchPos = pos;

  fetchTrees(boundingBox);
}


function displayError() {
  alert('Whoops, something went wrong on our end. The database might be waking up - try refreshing in a minute.');
};

// fetch trees from API within box
function fetchTrees({ xmin, xmax, ymin, ymax }) {
  let params = '';
  if (xmin) {
    params = `?xmin=${xmin}&xmax=${xmax}&ymin=${ymin}&ymax=${ymax}`
  }

  // mark button
  const geolocateButton = document.getElementById('geolocate');
  geolocateButton.classList.add('is-loading');

  const treesEndpoint = apiDeployment + '/trees' + params;

  fetch(treesEndpoint).then(function(response) {
    if (response.status > 300) {
      displayError();
    }
    geolocateButton.classList.remove('is-loading');
    return response.json();
  }).then(function(response) {
    const trees = response; // .slice(0, 10);

    trees.forEach(function(feature) {
      const lat = feature.latitude;
      const lng = feature.longitude;
      const commonName = feature.species_common_name;

      let label = '';
      if (map.getZoom() >= 19){ 
        label = {
          color: 'white',
          fontWeight: 'bold',
          text: (commonName) ? commonName : feature.common_name,
        }
      }

      if (markers.find(function(marker) { return (marker.id === feature.id) })) {
        return //continue 
      }

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        label: label,
        icon: { 
          url: (feature.species_order == 'Pinales') ? 'img/conifer.png' : 'img/hardwood.png',
          labelOrigin: new google.maps.Point(10, 20),
          scaledSize: new google.maps.Size(10, 10),
        },
        /*, SVG
        icon: ({
          path: "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z",
          fillColor: (feature.species_order == 'Pinales') ? '#0a6402' : '#1dd70d',
          fillOpacity: 1,
          anchor: new google.maps.Point(600,600),
          labelOrigin: new google.maps.Point(300,900),
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          scale: 0.02
        },
        */
        name: commonName,
        id: feature.id
      });

      // TODO: handle botanical name when contains cultivar
      let infoWindowTemplate = `
        <div style='margin:10px;padding:10px'>
          <h1>${feature.species_common_name}</h1>
          <p><b>${(feature.botanical_name.includes("'")) ? feature.botanical_name : feature.species_name}</b></p>
          <p id="tree-content-custom"></p>
          <p><b><a href='https://en.m.wikipedia.org/?title=${feature.botanical_name}' target='_blank'>Wikipedia</a></b></p>

      `;

      if (window.location.href.indexOf("admin") > -1) {
        infoWindowTemplate += '<p><a href="https://victoria-trees-admin.herokuapp.com/admin/trees/'+feature.id+'" target="_blank">Edit Tree</a></p>';
      }
      infoWindowTemplate += '</div>';

      marker.addListener('click', function() {
        document.getElementById('tree-modal').classList.add('is-active');
        document.getElementById('tree-modal-content').innerHTML = infoWindowTemplate;
        console.log(feature.id);
        if (feature.id) {
          fetchTree(feature.id).then(function(tree) {
            const species = tree.species;
            if (!species){
              return;
            }
            let treeDetailsHTML = '';

            if (species.native_region) {
              treeDetailsHTML += `<p>This tree is native to `;
              treeDetailsHTML += species.native_region;
              if (species.native) {
                treeDetailsHTML += ', including Victoria'
              }
              treeDetailsHTML += '.</p>';
            } else if (species.native) {
              treeDetailsHTML += '<p>This tree is native to Victoria.</p>';
            }
            
            // This is jank, could do a DB query for this if we REALY want to is 32284
            const totalVicTrees = 33081;
            const treePercentage = Math.round(((species.tree_count / totalVicTrees) * 100 * 100) + Number.EPSILON) / 100;
            treeDetailsHTML += `
              <p>
                The City of Victoria has <b>${species.tree_count}</b> of these trees on record.
                (<b>${treePercentage}%</b>)
              </p>`;

            if (species.description) {
              // thanks stack overflow
              const description = species.description.replace(/(?:\r\n|\r|\n)/g, '<br>');
              treeDetailsHTML += `<p>${description}</p>`;
            }
            document.getElementById('tree-content-custom').innerHTML = treeDetailsHTML;
          });
        }
      });

      markers.push(marker);
    });

    /*
    const markerCluster = new MarkerClusterer(map, markers, {
      imagePath: 'images/m',
      // gridSize: 40,
      maxZoom: 18
    });
    */
  }).catch((error) => {
    console.log(error);
    displayError();
  });
} // fetchTrees

// override geolocation to simuluate being outside
let testMode = false;
if (testMode) {
  let i = 0;
  navigator.geolocation.getCurrentPosition = function(callback) {
    coords = [
      {
        latitude: 48.414222,
        longitude: -123.360474
      },
      {
        latitude: 48.414136,
        longitude: -123.362073
      },
      {
        latitude: 48.414378,
        longitude: -123.361644
      },
      {
        latitude: 48.414434,
        longitude: -123.361819
      },
      {
        latitude: 48.414324,
        longitude: -123.361846
      },
      {
        latitude: 48.414334,
        longitude: -123.361846
      },
      {
        latitude: 48.414324,
        longitude: -123.361746
      },
      {
        latitude: 48.414334,
        longitude: -123.361746
      },
    ];

    const return_value = {
      coords: coords[i]
    }

    i += 1;

    setTimeout(callback(return_value), 200);
  }
}

const aboutModal = document.getElementById('about-modal');
document.getElementById('about').addEventListener('click', function() {
  aboutModal.classList.add('is-active');
});

const closeModal = () => {
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

// fetch detailed tree information
function fetchTree(id) {
  const treesEndpoint = 'https://victoria-trees-admin.herokuapp.com/trees/' + id;

  return fetch(treesEndpoint).then(function(response) {
    if (response.status > 300) {
      displayError();
    }
    return response.json();
  }).catch((error) => {
    console.log(error);
    displayError();
  });
}

function addShapes() {
  const cityOfVictoriaPoints = [
    [48.428566, -123.394325],
    [48.441922, -123.392759],
    [48.44942, -123.384637],
    [48.447012, -123.379627],
    [48.450026,  -123.35258],
    [48.44813, -123.332635],
    [48.43896, -123.332517],
    [48.438752, -123.328112],
    [48.433631, -123.329164],
    [48.433466, -123.322335],
    [48.405497, -123.326932],
    [48.402186, -123.350042],
    [48.412265, -123.396069]
  ];

  const beaconHillParkPoints = [
    [48.409197, -123.367862], // mile 0
    [48.410091, -123.368837],
    [48.410726, -123.368720], 
    [48.415891, -123.365847], //toronto st
    [48.418512, -123.365675], //southgate st
    [48.418362, -123.364718],
    [48.417881, -123.364015],
    [48.417774, -123.363780],
    [48.417543, -123.362423],
    [48.417529, -123.362271],
    [48.416735, -123.360421], // southgate heywood
    [48.416539, -123.360533],
    [48.412843, -123.360614],
    [48.412786, -123.357268],
    [48.407915, -123.357888],
    [48.407730, -123.358831],
    [48.408528, -123.362026],
  ];

  cityOfVictoriaPoly = new google.maps.Polygon({
    strokeColor: "#1E41AA",
    strokeOpacity: 0.5,
    strokeWeight: 2,
    map: map,
    fillColor: "#2652F2",
    fillOpacity: 0.3,
    paths: cityOfVictoriaPoints.map((p) => ({ lat: p[0], lng: p[1] }))
  });

  beaconHillParkPoly = new google.maps.Polygon({
    strokeColor: "#1E41AA",
    strokeOpacity: 1.0,
    strokeWeight: 3,
    map: map,
    fillColor: "#2652F2",
    fillOpacity: 0.6,
    paths: beaconHillParkPoints.map((p) => ({ lat: p[0], lng: p[1] }))
  });
}

// wake up the free heroku dyno (takes about 10sec)
fetch('https://victoria-trees-admin.herokuapp.com/').catch(() => {});
