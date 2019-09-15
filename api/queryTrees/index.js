// default coords are for beacon hill park
exports.handler = async ({xmin = -123.35412, xmax = -123.371794, ymin = 48.40558, ymax = 48.418569}) => {
  const { Client } = require("pg");
  const client = new Client();
  await client.connect();
  const res = await client.query(`
    SELECT common_name, botanical_name, latitude, longitude
    FROM trees
    WHERE latitude <= $1 AND latitude >= $2 AND longitude >= $3 AND longitude <= $4;
  `, [xmin, xmax, ymin, ymax]);
  await client.end();

  const response = {
    statusCode: 200,
    body: JSON.stringify(res.rows)
  };
  return response;
};
