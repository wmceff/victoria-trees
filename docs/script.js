// show console logs
const DEBUG = false;

let openInfoWindow;
let markers = [];
let currentPositionMarker;
let lastPos = { lat: 0, lng: 0 };
let lastFetchPos;
let map;
let victoriaShape, beaconHillParkShape;
let centerOnLocationUpdate = true;
let dragging = false;
let locating = false; // used to allow drag without moving center when relocating
let watchingPosition = false;

const apiDeployment = "https://victoria-trees-admin.vercel.app";

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

  // fetch trees for current bounding box (only if zoom level is in enough)
  const fetchTreesForCurrentBox = () => {
    const box = {
      xmin: map.getBounds().getNorthEast().lng(),
      xmax: map.getBounds().getSouthWest().lng(),
      ymin: map.getBounds().getSouthWest().lat(),
      ymax: map.getBounds().getNorthEast().lat()
    }

    if (map.getZoom() > 17) {
      fetchTrees(box);
    }
  }

  document.getElementById('geolocate').addEventListener('click', function() {
    centerOnCurrentLocationAndFetch();
  });
  
  // resume from homescreen
  if (isMobile()) {
    window.addEventListener('focus', centerOnCurrentLocationAndFetch);
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
      fetchTreesForCurrentBox();
    }

    // set label for all markers
    markers.forEach(function(m) {
      if(map.getZoom() >= 19) {
        if (m.getLabel() == '') { 
          m.setLabel(labelForTree({}, m.name));
        }
      } else {
        if (m.getLabel != '') {
          m.setLabel('');
        }
      }
    });
  });

  map.addListener('dragstart', () => {
    dragging = true;
    centerOnLocationUpdate = false;
    document.querySelector('#geolocate .icon').classList.remove('has-text-info');
  });

  // fetch when drag end (factoring in inertia)
  map.addListener('idle', () => {
    if (dragging) { // prevent this firing every position update
      dragging = false;
      fetchTreesForCurrentBox();
    }
  })

  // if on mobile, attempt geolocation right away
  if (isMobile()) {
    centerOnCurrentLocationAndFetch();
  }
} // initMap

function centerOnCurrentLocationAndFetch() {
  let fetches = 0;
  if (navigator.geolocation) {
    centerOnLocationUpdate = true;
    document.querySelector('#geolocate .icon').classList.add('has-text-info');

    locating = true;
    navigator.geolocation.getAccurateCurrentPosition(function(position) {
      l('final position accuracy:');
      l(position.coords.accuracy);

      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      if(centerOnLocationUpdate) {
        map.panTo(pos);
      }

      updateCurrentPositionMarker(pos);
      fetchTreesForPosition(pos);

      locating = false;
    }, function(error) {
      alert('Sorry, we had a problem fetching your location. Check that you have location permissions enabled, refresh and try again!');
      console.log(error);
      locating = false;
    }, function(position) { // progress updates
      fetches += 1;

      l('location updated. accuracy:');
      l(position.coords.accuracy);

      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      if (centerOnLocationUpdate) {
        map.panTo(pos);
      }

      updateCurrentPositionMarker(pos);
      if (fetches % 3 == 0) {
        fetchTreesForPosition(pos);
      }
    }, {
      desiredAccuracy: 5 // meters 
    });
  }
}

// watch for position updates, update and fetch, but dont re-center
function watchAndUpdatePosition() {
  if (!watchingPosition) {
    watchingPosition = true;

    navigator.geolocation.watchPosition(function(position) {
      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      updateCurrentPositionMarker(pos);

      // fetch if the last fetch was far away
      const lastFetchDiff = Math.abs(pos.lat - lastFetchPos.lat) + Math.abs(pos.lng - lastFetchPos.lng)
      if (lastFetchDiff > 0.0005) {
        l('last fetch diff is big, fetching');
        fetchTreesForPosition(pos);
      };
    }, function() {
      l("Error watching geolocation position");
    }, {
      enableHighAccuracy: true,
      // maximumAge: 0 // no location caching
    })
  }
  locating = false;
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
        scale: 0.1, // TODO: adjust scale based on pos accuracy
        anchor: new google.maps.Point(250, 250),
      }
    });
  }

  // set zoom and center according to potential location accuracy, based on last known position
  // (if there's big difference between last position, zoom out) 
  if (map.getBounds().contains(currentPositionMarker.getPosition())) { // only if we're looking at the marker
    if (centerOnLocationUpdate) {
      // TODO: just use accuracy
      locating = true; //dont trigger zoom fetch while zooming
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
      locating = false;

      map.panTo(pos);
    }
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

    //remove any offscreen markers for performance
    l('marker length: ' + markers.length);
    const mapBounds = map.getBounds();
    const newMarkers = [];
    for (let x=0;x<markers.length;x+=1) {
      const m = markers[x];
      if (!mapBounds.contains(m.getPosition())) { // only if we're looking at the marker
        m.setMap(null);
      } else {
        newMarkers.push(m);
      }
    }
    markers = newMarkers;

    trees.forEach(function(feature) {
      const lat = feature.latitude;
      const lng = feature.longitude;
      const commonName = feature.species_common_name;

      let label = '';
      if (map.getZoom() >= 19){ 
        label = labelForTree(feature, commonName);
      }

      // dont add trees we already have
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

      let sencotenName = '';
      if (feature.sencoten_name) {
        if (feature.sencoten_url) {
          sencotenName = `<a href="${feature.sencoten_url}">${feature.sencoten_name}</a>`;
        } else {
          sencotenName = feature.sencoten_name;
        }
      }

      let infoWindowTemplate = `
        <div style='margin:10px;padding:10px'>
          <h3>${feature.species_common_name}${(sencotenName) ? ' - ' + sencotenName : ''}</h3>
          <p><b>${(feature.botanical_name.includes("'")) ? feature.botanical_name : feature.species_name}</b></p>
          <p id="tree-content-custom"></p>
          <p><b><a href='https://en.m.wikipedia.org/?title=${feature.botanical_name}' target='_blank'>Wikipedia</a></b></p>
      `;

      if (window.location.href.indexOf("admin") > -1) {
        infoWindowTemplate += '<p><a href="https://victoria-trees-admin.vercel.app/admin/trees/'+feature.id+'" target="_blank">Edit Tree</a></p>';
      }
      infoWindowTemplate += '</div>';

      marker.addListener('click', function() {
        document.getElementById('tree-modal').classList.add('is-active');
        document.getElementById('tree-modal-content').innerHTML = infoWindowTemplate;
        l(feature.id);
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
    l(error);
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
  const treesEndpoint = 'https://victoria-trees-admin.vercel.app/trees/' + id;

  return fetch(treesEndpoint).then(function(response) {
    if (response.status > 300) {
      displayError();
    }
    return response.json();
  }).catch((error) => {
    l(error);
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

function isMobile() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

function l(m) {
  DEBUG && console.log(m);
}

function labelForTree(tree, commonName = null) {
  return {
    color: 'white',
    fontWeight: 'bold',
    text: (commonName) ? commonName : tree.common_name,
  }
}
