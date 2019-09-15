const fs = require("fs");
const os = require("os");
const fetch = require("node-fetch");
const CSV = require("csv-string");

const trees = [];
const offset = 1000;

var fetchTrees = function(pageNum) {
  var params = {
    where: "1=1",
    outFields: "*",
    outSR: "4326",
    f: "json"
  };
  var encodedParams = Object.keys(params)
    .map(function(k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    })
    .join("&");

  var treesEndpoint =
    "http://vicmap.victoria.ca/arcgis/rest/services/OpenData/OpenData_Parks/MapServer/15/query?" +
    encodedParams;
  var req = treesEndpoint;
  if (pageNum >= 1) {
    req = treesEndpoint + "&resultOffset=" + pageNum * offset;
  }

  fetch(req)
    .then(function(response) {
      return response.json();
    })
    .then(function(response) {
      response_trees = response.features;

      trees = trees.concat(
        response_trees.map(response_tree => {
          tree = response_tree.attributes;
          tree.lng = response_tree.geometry.x;
          tree.lat = response_tree.geometry.y;
          return tree;
        })
      );

      /* sample attributes
       {
         attributes:
         { OBJECTID: 2275,
           SiteID: '1400',
           Address: '100',
           Street: 'DALLAS RD',
           OnStreet: 'DALLAS RD',
           FromStreet: 'COOK ST',
           ToStreet: 'DOUGLAS ST',
           SideOfParcel: 'N/A',
           Species: 'Pinus nigra',
           DiameterAtBreastHeight: 11,
           GrowSpace: 'Turf',
           Height: 9,
           Width: 2,
           PlantingDateEst: '40+',
           Area: 'James Bay',
           YearPlanted: 'Unassigned',
           InventoryDate: '20130608',
           ChangedDate: '20141008',
           FullAddress: '100 DALLAS RD',
           BotanicalName: 'Pinus nigra',
           CommonName: 'Austrian pine ',
           BlossomDateStart: null,
           BlossomDateEnd: null },
         geometry: { x: -123.3685216739265, y: 48.41045552543724 }
       }
       */

      if (response.exceededTransferLimit) {
        fetchTrees(pageNum + 1);
      } else {
        // reformat write to CSV file
        csv_rows = [];

        trees_csv = trees.map(tree => {
          const tree_row = {
            object_id: tree.OBJECTID,
            // botanical_name: tree.BotanicalName, this is bunk dat\COPY trees(object_id,common_name,botanical_name,latitude,longitude,data,source)  FROM 'trees2.csv' DELIMITER ',' CSV;a
            common_name: tree.CommonName,
            species_name: tree.Species,
            latitude: tree.lat,
            longitude: tree.lng,
            data: JSON.stringify(tree),
            source: "victoria"
          };

          return Object.values(tree_row);
        });

        fs.writeFile("trees.csv", CSV.stringify(trees_csv), function(err) {
          if (err) {
            return console.log(err);
          }

          console.log("The file was saved!");
        });
      }
    });
};

fetchTrees(1);
