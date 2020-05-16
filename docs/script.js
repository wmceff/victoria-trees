let openInfoWindow;
let markers = [];
let currentPositionMarker;
const apiDeployment = "https://sb2tcoq1of.execute-api.us-west-2.amazonaws.com/production";

// set map height
const navbarHeight = 0; // 56;
document.getElementById('map-container').setAttribute('style', 'height:'+(window.innerHeight - navbarHeight)+'px');

var map;
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: {lat: 48.413489, lng: -123.363524},
    zoom: 18,
    mapTypeId: google.maps.MapTypeId.SATELLITE,
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

        const radius = 0.001 // roughly 2km around current position
        const boundingBox = {
          xmin: pos.lng + radius,
          xmax: pos.lng - radius,
          ymin: pos.lat - radius,
          ymax: pos.lat + radius
        }

        fetchTrees(boundingBox);
      }

      // try five times to improve location accuracy
      const getPositionAndTrees = function(callback) {
        navigator.geolocation.getCurrentPosition(function(position) {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          map.setCenter(pos);
          map.setZoom(20);

          if (currentPositionMarker) {
            currentPositionMarker.setMap(null);
          }
          currentPositionMarker = new google.maps.Marker({
            position: pos,
            map: map,
            title: 'You are here',
          });

          if(callback) {
            callback(pos);
          }
        }, function() {
          alert('Had a problem finding your location - refresh and try again');
        }, {
          enableHighAccuracy: true,
          maximumAge: 500 // force device to re-fetch
        });
      }
      for (let k=0; k<5; k++) {
        // TODO: potentially do this at the end
        getPositionAndTrees(populateTreesForPosition);
        // update position without populating trees
        setTimeout(getPositionAndTrees, k*1100);
      }
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

  const zoomLimit = 15;

  map.addListener('bounds_changed', () => {
    if (map.getZoom() > zoomLimit) {
      enableSearchButton()
    }
  });

  map.addListener('zoom_changed', () => {
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
} // initMap

function fetchTrees({ xmin, xmax, ymin, ymax }) {
  let params = '';
  if (xmin) {
    params = `?xmin=${xmin}&xmax=${xmax}&ymin=${ymin}&ymax=${ymax}`
  }

  const displayError = () => {
    alert('Whoops, something went wrong on our end. The database might be waking up - try refreshing in a minute.');
  };

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

    const mapIcon = {
      url: 'https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png',
      scaledSize: new google.maps.Size(20, 20)
    };

    trees.forEach(function(feature) {
      const lat = feature.latitude;
      const lng = feature.longitude;
      const commonName = feature.common_name;

      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: map,
        title: commonName,
        // objectId: feature.object_id, // for finding trees in regions
        icon: mapIcon
      });

      let infoWindowTemplate = `
        <div style='margin:10px;padding:10px'>
          <h1>${feature.common_name}</h1>
          <a href='https://en.m.wikipedia.org/?title=${feature.botanical_name}' target='_blank'>${feature.botanical_name}</a>
      `;
      const genus = feature.botanical_name.split(" ")[0];
      if (genus) {
        infoWindowTemplate += `<br><a href='https://en.m.wikipedia.org/?title=${genus}' target='_blank'>${genus}</a>`;
      }
      infoWindowTemplate += '</div>';

      // info window is 250px  on an iphone6 - 12px margin
      // could probably do soemthing better with window size
      let infoWindow = new google.maps.InfoWindow({
        content: infoWindowTemplate
      });

      marker.addListener('click', function() {
        if (openInfoWindow) {
          openInfoWindow.close();
        };
        infoWindow.open(map, marker);
        openInfoWindow = infoWindow;
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

/*
// fetch region details
fetch(apiDeployment + '/regions/1').then((response) => {
  if (response.status > 300) {
    displayError();
  }
  return response.json();
}).then(function(response) {
  // tree list
  const infoSection = document.querySelector('.info-section');
  
  const treeList = document.querySelector('#tree-list')
  treeList.innerHtml = '';

  response.species_counts.forEach((item) => {
    const textNode = document.createTextNode(item.common_name + ' ' + item.total);
    const listNode = document.createElement("li");

    listNode.appendChild(textNode);

    const filterNode = document.createElement("a");
    // filterNode.setAttribute('data-derpy', item.common_name);
    filterNode.classList.add('button');
    filterNode.classList.add('filter-button');
    filterNode.addEventListener('click', () => {
      filterMarkers(item.common_name);
      document.querySelector('.info-section').classList.toggle('is-hidden');
    });
    const filterTextNode = document.createTextNode("FILTER");

    filterNode.append(filterTextNode);

    listNode.appendChild(filterNode);

    treeList.appendChild(listNode);
  });
});
// Display list of trees on screen
/*
document.getElementById('details-button').addEventListener('click', function() {
  const infoSection = document.querySelector('.info-section');
  
  infoSection.classList.toggle('is-hidden');

  const treeList = document.querySelector('#tree-list')
  treeList.innerHtml = '';

  markers.forEach((item) => {
    const textNode = document.createTextNode(item.title);
    const listNode = document.createElement("li");
    listNode.appendChild(textNode);
    treeList.appendChild(listNode);
  });
});

function filterMarkers(common_name) {
  markers.forEach((marker) => {
    if (marker.title !== common_name) {
      marker.setVisible(false);
    } else {
      marker.setVisible(true);
    }
  });
}
*/
