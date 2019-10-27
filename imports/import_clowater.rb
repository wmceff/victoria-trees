require 'dotenv/load'
require 'pg'
require 'faraday'
require 'json'
require 'csv'

begin
  conn = PG.connect host: ENV['PGHOST'], dbname: ENV['PGDATABASE'], user: ENV['PGUSER'], password: ENV['PGPASSWORD']

  # columns: tree_code	site_number	date_m	botanical_name	common name	CBH	LatDeg	LonDeg
  trees = CSV.read('clowater.csv', headers: true, encoding: 'windows-1251:utf-8')

  trees.each do |row|
    next unless row['LatDeg'] && row['LonDeg']

    # check if its in the database
    conn.exec("SELECT * from trees WHERE ROUND(latitude::numeric, 5) = #{row['LatDeg']} AND ROUND(longitude::numeric, 5) = #{row['LonDeg']}") do |result|
      if result.count > 0
        puts "match found - skipping"
      else
        puts "inserting"
      end

      next unless result.count > 0
    end

    tree_data = {
      cbh: row['CBH'],
      date_measured: row['date_m'],
      site_number: row['site_number'],
      tree_code: row['tree_code']
    }

    # if not insert
    # puts tree.inspect
    conn.exec(
      "INSERT INTO trees(botanical_name, common_name, latitude, longitude, data, source) VALUES ($1,$2,$3,$4,$5,$6)",
      [row['botanical_name'], row['common name'], row['LatDeg'], row['LonDeg'], tree_data.to_json, "clowater"]
    )
  end

=begin
  # conn.exec('SELECT * FROM species WHERE properties = \'{}\'') do |results|
  conn.exec('SELECT id, name FROM species') do |results|
    results.each do |row|
      # query the species API
      puts "SEARCHING #{row['name']}"
      gbif_endpoint = "http://api.gbif.org/v1/species?name="
      response = JSON.parse(Faraday.get("#{gbif_endpoint}#{row['name']}").body)
      properties = response['results'][0]

      puts "Nothing found for #{row['name']} - skipping" unless properties
      next unless properties

      r = conn.exec_params(
        'UPDATE species SET properties = $1 WHERE id = $2',
        [properties.to_json, row['id']]
      )

      puts "Updated"
    end
  end
=end
rescue PG::Error => e
  puts e.message
ensure
  conn.close if conn
end
