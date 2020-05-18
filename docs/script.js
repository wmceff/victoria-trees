let openInfoWindow;
let markers = [];
let currentPositionMarker;
let lastPos = { lat: 0, lng: 0 };
const apiDeployment = "https://sb2tcoq1of.execute-api.us-west-2.amazonaws.com/production";

// set map height
const navbarHeight = 0; // 56;
document.getElementById('map-container').setAttribute('style', 'height:'+(window.innerHeight - navbarHeight)+'px');

var map;
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 48.413489, lng: -123.363524},
    zoom: 18,
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

  document.getElementById('search-button').addEventListener('click', findTreesForCurrentPosition);

  function centerOnCurrentLocationAndFetch() {
    if (navigator.geolocation) {
      const populateTreesForPosition = function(pos) {
        // remove all markers
        markers.forEach((marker, index) => {
          marker.setMap(null);
        });
        markers = [];

        const radius = 0.0008 // roughly 2km around current position
        const boundingBox = {
          xmin: pos.lng + radius,
          xmax: pos.lng - radius,
          ymin: pos.lat - radius,
          ymax: pos.lat + radius
        }

        fetchTrees(boundingBox);
      }

      let current_retries = 0;
      const retries = 8;
      // try five times to improve location accuracy
      const getPositionAndTrees = function(callback) {
        navigator.geolocation.getCurrentPosition(function(position) {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          // set zoom according to diff in last position (less diff = closer zoom)
          error = Math.abs(pos.lat - lastPos.lat) + Math.abs(pos.lng - lastPos.lng)

          if (error < 0.0002) {
            map.setZoom(20);
          } else if(error < 0.0008) {
            map.setZoom(19);
          } else {
            map.setZoom(18);
          }
          map.setCenter(pos);

          lastPos.lat = pos.lat;
          lastPos.lng = pos.lng;


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

          current_retries++;
          // populate trees on the first req
          if (current_retries == 3 || current_retries == retries) {
            populateTreesForPosition(pos);
          }
          if (current_retries < retries) {
            setTimeout(getPositionAndTrees, 1000);
          }
        }, function() {
          alert('Had a problem finding your location - refresh and try again');
        }, {
          enableHighAccuracy: true,
          maximumAge: 500 // force device to re-fetch
        });
      }
      getPositionAndTrees();
    } else {
      fetchTrees();
    }
  }

  centerOnCurrentLocationAndFetch();

  /* example drawing polygon to find trees within it
     you need to customize the labmda to send object_id */

  var beaconHillParkPoints = [
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
  window.beaconHillParkPoly = new google.maps.Polygon({
    strokeColor: "#1E41AA",
    strokeOpacity: 1.0,
    strokeWeight: 3,
    map: map,
    fillColor: "#2652F2",
    fillOpacity: 0.6,
    paths: beaconHillParkPoints.map((p) => ({ lat: p[0], lng: p[1] }))
  });

  /* example calculating markers within bounds
  const objectIds = [];
  markers.forEach((marker, i) => {
    if (google.maps.geometry.poly.containsLocation(markers[i].getPosition(), beaconHillParkPoly)) {
      objectIds.push(marker.objectId)
    }
  });
  */

  const zoomLimit = 16;

  map.addListener('bounds_changed', () => {
    if (map.getZoom() > zoomLimit) {
      enableSearchButton()
    }
  });

  map.addListener('zoom_changed', () => {
    // only display text if in a closer zoom
    if (map.getZoom() < 20) {
      markers.forEach((marker) => {
        marker.setLabel('');
      });
    } else {
      markers.forEach((marker) => {
        marker.setLabel({
          color: 'white',
          fontWeight: 'bold',
          text: marker.name,
        })
      });
    };

    if (map.getZoom() <= zoomLimit) {
      beaconHillParkPoly.setVisible(true);
      markers.forEach((marker) => {
        marker.setVisible(false);
      });
      disableSearchButton();
    } else {
      beaconHillParkPoly.setVisible(false);
      enableSearchButton();
      markers.forEach((marker) => {
        marker.setVisible(true);
      });
    }
  });

  map.addListener('dragend', () => {
    const box = {
      xmin: map.getBounds().getNorthEast().lng(),
      xmax: map.getBounds().getSouthWest().lng(),
      ymin: map.getBounds().getSouthWest().lat(),
      ymax: map.getBounds().getNorthEast().lat()
    }
    if (map.getZoom() > 18) {
      fetchTrees(box);
    }
  })

} // initMap

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

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        // title: commonName,
        // objectId: feature.object_id, // for finding trees in regions
        label: {
          color: 'white',
          fontWeight: 'bold',
          text: commonName,
        },
        icon: {
          path: "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8z",
          fillColor: '#1dd70d',
          // darker - #0a6402
          fillOpacity: 1,
          anchor: new google.maps.Point(600,600),
          labelOrigin: new google.maps.Point(300,900),
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          scale: 0.02
        },
        name: commonName
      });

      let infoWindowTemplate = `
        <div style='margin:10px;padding:10px'>
          <h1>${feature.species_common_name}</h1>
          <p id="tree-content-custom"></p>
          <p><b>Wikipedia</b>: <a href='https://en.m.wikipedia.org/?title=${feature.botanical_name}' target='_blank'>${feature.botanical_name}</a></p>
      `;
      const genus = feature.botanical_name.split(" ")[0];
      if (genus) {
        infoWindowTemplate += `<p><b>Genus</b>: <a href='https://en.m.wikipedia.org/?title=${genus}' target='_blank'>${genus}</a></p>`;
      }
      infoWindowTemplate += '</div>';

      marker.addListener('click', function() {
        document.getElementById('tree-modal').classList.add('is-active');
        document.getElementById('tree-modal-content').innerHTML = infoWindowTemplate;
        console.log(feature.id);
        if (feature.id) {
          fetchTree(feature.id).then(function(tree) {
            const species = tree.species;
            let treeDetailsHTML = '';

            if (species.native) {
              treeDetailsHTML += '<p>This species is native to Victoria.</p>';
            } else {
              treeDetailsHTML += `<p>This species is native to ${species.native_region}.</p>`;
            }
            
            // This is jank, could do a DB query for this if we REALY want to is 32284
            const totalVicTrees = 32284;
            const treePercentage = Math.round(((species.tree_count / totalVicTrees) * 100 * 100) + Number.EPSILON) / 100;
            treeDetailsHTML += `
              <p>
                There are <b>${species.tree_count}</b> of these trees in the City of Victoria.
                (<b>${treePercentage}%</b>)
              </p>`;

            if (species.description) {
              treeDetailsHTML += `<p>${species.description}</p>`;
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

    disableSearchButton();
  }).catch((error) => {
    console.log(error);
    displayError();
  });
} // fetchTrees

function enableSearchButton() {
  document.getElementById('search-button').removeAttribute('disabled');
}

function disableSearchButton() {
  document.getElementById('search-button').setAttribute('disabled', 'disabled');
}

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

const closeModal = () => {
  document.getElementById('tree-modal').classList.remove('is-active');
}
document.getElementById('tree-modal-background')
  .addEventListener('click', closeModal);
document.querySelector('.modal-close')
  .addEventListener('click', closeModal);

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

