# Writing species and cultivar descriptions

Descriptions live in `data/species.yml`. The map's tree popup and each species page show them, so
a description has to make sense on its own, next to the facts the site already gives: common and
botanical name, SENĆOŦEN name, native range, how many trees there are, where they grow, and bloom
dates. Don't repeat those facts.

## Origin comes first

Every tree should make clear whether it belongs here or where it came from. This is the most
important fact about a tree in a city where most of the trees were planted from elsewhere. Origin
lives in its own fields, which the site shows just above the description, so the description
doesn't need to restate it.

- **Native trees:** set `native: true`. The site tags them "Native to Victoria". Also give a
  `native_region` for their wider range, which is shown as "Native to …, including Victoria".
- **Trees from elsewhere:** set `native_region`, written to follow "Native to". The site tags them
  "Planted".
- **Hybrids and garden plants that don't grow wild:** set `garden_origin` instead of
  `native_region`. Write it as the start of a sentence saying where and when the tree was raised,
  and from what: "a hybrid of two Chinese magnolias, first raised near Paris in 1820".

Write origins in human terms, so someone with no botany or geography background can picture the
place:

- **Name countries and well-known regions,** not provinces, river valleys or mountain sub-ranges
  that need a map. Write "the Atlas Mountains of Morocco and Algeria, in North Africa", not "the
  Middle Atlas, High Atlas, Rif and Tell Atlas".
- **Give the span, not the boundary:** "eastern North America, from southern Ontario to Florida",
  not a list of every state on the edge of the range.
- **Add a landmark when the place is obscure:** "the mountain forests of northern Iran and
  Azerbaijan, near the Caspian Sea".
- **Mention scarcity** when the wild range is tiny, since that's part of the story: "two small
  groves on the California coast, near Monterey".
- **Keep it short,** about 15 words or fewer, and start lowercase. Leave out "native to".

The description can still tell an origin story, such as how a tree was discovered, introduced or
named. It just shouldn't repeat the range already given in the origin fields.

## What to write about

Choose the one or two things that make the tree interesting to someone standing under it. In
rough order of preference:

1. **A story or a name.** Where the name comes from, who it honours, how it was discovered or
   introduced. Examples: deodar ("wood of the gods"), Douglas-fir ("false hemlock"), the monkey
   puzzle, the Leyland cypress crossing at Leighton Hall.
2. **Cultural standing.** National or state tree, a place in religion or history, a traditional
   use such as Hinoki timber in temples or Go boards made from Torreya.
3. **Something you can see, smell or find.** Butterscotch-scented bark, the largest pine cones,
   cypress knees, caramel-smelling leaves in autumn, bark that peels.
4. **Origin for hybrids and garden plants.** The parents, who raised it, where and when. Examples:
   Prunus × yedoensis, Magnolia × soulangeana, Malus × purpurea.
5. **Ecology.** Wildlife that relies on it, fire adaptation, clonal groves, invasiveness.

Leave out generic botany (leaf shape, height ranges) unless it's what makes the tree stand out.

## Native trees

- Lead with Indigenous uses, drawn from Nancy Turner's *Ancient Pathways, Ancestral Knowledge*
  (2014). Name the Nation or people in parentheses after each use, as the book does:
  "boughs for purification (Kwakwaka'wakw)". Where a use is local, name the local Nation, such as
  W̱SÁNEĆ, Lekwungen or Cowichan.
- Paraphrase rather than copy, but keep the Nation attributions exact.
- Record where the uses come from with `turner_pages`, by volume and page:
  `turner_pages: vol. 1, p. 341; vol. 2, p. 186`. The species page and tree popup show this as a
  citation. Leave the book's own in-text citations (Boas 1921 and so on) out of the description,
  since the page reference covers them.
- After the uses, add one ecological or naming fact if there's room.
- Write about practices as living knowledge where that's true. "Used by First Peoples for..." is
  fine for historical uses. Avoid suggesting a culture is gone.

## Voice and form

- **Length:** one to three sentences, about 20–60 words. Natives can run longer, up to about
  120 words, when there are several uses worth listing.
- **Plain and encyclopedic:** third person, no "you", no exclamation marks, no marketing words
  ("stunning", "must-see").
- **Open with a subject the reader knows.** The popup shows the description without a heading, so
  start with the tree's name or a noun ("Sugi is the national tree of Japan..."), not "It is...".
- **Canadian spelling:** colour, honour, grey, centre. Use "autumn" for the season.
- **Units:** metric first, imperial in brackets if it helps: "20–40 cm (8–16 in)".
- **Names:** italics aren't available, so write botanical names plainly. Abbreviate the genus only
  after it has been spelled out once in the same description ("P. orientalis").
- **No URLs, internal tree IDs or notes to editors** in the description. Put identification
  notes in a YAML comment instead.
- **Wikipedia:** fine as a source, since every species page already links its article. Rephrase
  and shorten rather than pasting a paragraph.

## Genus-only and unidentified records

Use the same single line for every one:

> This tree has only been identified to genus, not species.

## Cultivars

The City records cultivars in each tree's botanical name ("Prunus serrulata kwanzan", "Acer
rubrum 'Armstrong'"). Describe them under the species:

```yaml
  cultivars:
    - name: Kanzan          # the accepted cultivar name, shown in quotes on the site
      match: kwanzan        # text to find in the City's name, if it isn't spelled like the name
      description: >-
        The most widely planted Japanese flowering cherry, with large, double, deep pink flowers...
```

- One or two sentences on **what sets it apart from the species**: shape (columnar, vase,
  weeping), leaf colour, flower colour or doubling, autumn colour, or being male or seedless.
- Then, if there's room, **why it's planted** (fits narrow streets, drops no fruit) or **where it
  came from** (the breeder or nursery, the place it was found, the year).
- `match` is compared case-insensitively against the City's botanical name. Keep it short enough
  to catch the City's truncations ("baumn", "shadem", "skylin").

## YAML formatting

- Use a folded block (`description: >-`) for anything longer than one line, wrapped at about 100
  characters.
- Separate paragraphs with a blank line inside the block.
