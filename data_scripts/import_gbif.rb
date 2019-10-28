require 'dotenv/load'
require 'pg'
require 'faraday'
require 'json'

begin
  conn = PG.connect host: ENV['PGHOST'], dbname: ENV['PGDATABASE'], user: ENV['PGUSER'], password: ENV['PGPASSWORD']
  puts ENV['PGHOST']

  # conn.exec('SELECT * FROM species WHERE properties = \'{}\'') do |results|
  conn.exec('SELECT id, name FROM species ORDER BY properties DESC') do |results|
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
rescue PG::Error => e
  puts e.message
ensure
  conn.close if conn
end
