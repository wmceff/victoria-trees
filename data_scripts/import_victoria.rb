require 'dotenv/load'
require 'pg'
require 'faraday'
require 'json'
require 'csv'

begin
  conn = PG.connect host: ENV['PGHOST'], dbname: ENV['PGDATABASE'], user: ENV['PGUSER'], password: ENV['PGPASSWORD']

=begin
  columns:
            object_id: tree.OBJECTID,
            common_name: tree.CommonName,
            species_name: tree.Species,
            latitude: tree.lat,
            longitude: tree.lng,
            data: JSON.stringify(tree),
            source: "victoria"
=end

  trees = CSV.read('trees.csv')

  trees.each_with_index do |row, i|
    puts "#{i} of #{trees.count}"

    # check if its in the database
    r = conn.exec("INSERT INTO trees(object_id, common_name, botanical_name, latitude, longitude, data, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (object_id) DO NOTHING",
      [row[0], row[1], row[2], row[3], row[4], row[5], row[6]]
    )
    puts r.inspect
  end
rescue PG::Error => e
  puts e.message
ensure
  conn.close if conn
end
