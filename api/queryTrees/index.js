exports.handler = async (event) => {
  console.log(event);
  
  // const {xmin = -123.35412, xmax = -123.371794, ymin = 48.40558, ymax = 48.418569} = event;
  let params = {};
  if (event.queryStringParameters) {
    params = event.queryStringParameters;
  }
  const {xmin = 1, xmax = 2, ymin = 1, ymax = 2} = params;
  
  // default coords are for beacon hill park
  console.log(xmin);
  console.log(xmax);
  console.log(ymin);
  console.log(ymax);
  
  const { Client } = require("pg");
  const client = new Client();
  await client.connect();
  const res = await client.query(`
    SELECT common_name, botanical_name, latitude, longitude
    FROM trees
    WHERE latitude >= $1 AND latitude <= $2 AND longitude <= $3 AND longitude >= $4;
  `, [ymin, ymax, xmin, xmax]);
  await client.end();

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
    },
    body: JSON.stringify(res.rows)
  };
  return response;
};
