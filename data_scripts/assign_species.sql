-- remove " spp" or " species" from botanical_names
UPDATE trees
SET botanical_name = regexp_replace(botanical_name, ' spp\.', '')
WHERE botanical_name LIKE '% spp%'

UPDATE trees
SET botanical_name = regexp_replace(botanical_name, ' species', '')
WHERE botanical_name LIKE '% species%'

-- clean up cultivar names
UPDATE trees
SET botanical_name = REGEXP_REPLACE(botanical_name, '\"', '''', 'g');

-- set the first two names as the "species name" in trees table
UPDATE trees SET species_name = regexp_replace(botanical_name, '(\w+ \w+)(.*)', '\1');

-- insert species
insert into species (name)
	select CONCAT(LEFT(botanical_name,1), LOWER(RIGHT(botanical_name,-1))) as name
	from (
		SELECT id, (regexp_matches(botanical_name, '\A(\w+ \w+)'))[1] as botanical_name FROM trees
	)two_word_trees
	GROUP BY name
ON CONFLICT(name) DO NOTHING;

insert into species (name)
	select CONCAT(LEFT(botanical_name,1), LOWER(RIGHT(botanical_name,-1))) as name
	from (
		SELECT id, (regexp_matches(botanical_name, '\A(\w+)'))[1] as botanical_name FROM trees
	)one_word_trees
	GROUP BY name
ON CONFLICT(name) DO NOTHING;

-- assign species match on species name
update trees
set species_id = species.id
from species
where trees.species_name = species.name

-- INSERT 2 WORD SPECIES (capitalized properly)
select CONCAT(LEFT(botanical_name,1), LOWER(RIGHT(botanical_name,-1))) as botanical_name
from (
	SELECT id, (regexp_matches(botanical_name, '\A(\w+ \w+)'))[1] as botanical_name FROM trees
)two_word_trees
GROUP BY botanical_name
