exports.handler = async (event) => {
  console.log(event);
  
  const region_id = event.pathParameters.id;
  
  const { Client } = require("pg");
  const client = new Client();
  await client.connect();
  
  let res;
  res = await client.query(`
    SELECT common_name, count(*) as total
    FROM trees
    WHERE region_id = $1
    GROUP BY common_name
    ORDER BY total desc;
  `, [region_id]);
  
  const species_counts = res.rows;
  
  res = await client.query(`
    SELECT species.properties->>'genus' as genus, count(*) as total 
    FROM trees 
    INNER JOIN species on trees.species_id = species.id
    WHERE region_id = $1
    GROUP BY species.properties->>'genus'
    ORDER BY total desc
  `, [region_id])
  const genus_counts = res.rows;

  await client.end();

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
    },
    body: JSON.stringify({ species_counts, genus_counts })
  };
  return response;
};
