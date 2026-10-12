// Shared type definitions (JSDoc only, no runtime code).
// Every module refers to these with `import('./types.js').Name`.
// Changing a shape here is a contract change: update docs/SPEC.md and the tests with it.

/**
 * @typedef {{ zh_TW: string, en: string }} Bilingual
 *
 * @typedef {Object} Place
 *   One attraction, exactly as in data/attractions/*.json (schema/attraction.schema.json).
 * @property {string} id                       kebab-case, unique
 * @property {Bilingual} name
 * @property {{ city_zh: string, city_en: string, district_zh: string, district_en: string,
 *              address_zh: string, address_en: string, coordinates: LatLng }} location
 * @property {string} category   one of the schema enum: historical_fortress, temple_shrine, colonial_architecture,
 *                               historic_street_district, industrial_heritage, indigenous_cultural_site,
 *                               memorial_museum, traditional_residence, natural_cultural_landscape
 * @property {string[]} eras
 * @property {number|null} [established_year]
 * @property {string} [heritage_status]
 * @property {Bilingual} summary
 * @property {Bilingual} historical_narrative
 * @property {{ year_or_era: string, era_category: string, event_zh: string, event_en: string }[]} timeline
 * @property {CulturalSignificance} cultural_significance
 * @property {VisitorGuide} foreign_visitor_guide
 * @property {string[]} tags
 * @property {PlaceMetadata} [metadata]   not shown in the app
 *
 * @typedef {Object} CulturalSignificance   Paired fields, read with lang.js localized()
 * @property {string} why_it_matters_en
 * @property {string} why_it_matters_zh
 * @property {string} architectural_highlights_en
 * @property {string} architectural_highlights_zh
 * @property {string} [intangible_culture_en]
 * @property {string} [intangible_culture_zh]
 *
 * @typedef {Object} VisitorGuide   Place.foreign_visitor_guide; paired *_en / *_zh fields, read with localized()
 * @property {string} etiquette_tips_en
 * @property {string} [etiquette_tips_zh]
 * @property {string[]} must_see_spots_en   names only; prompts use these
 * @property {string[]} [must_see_spots_zh]
 * @property {MustSee[]} [must_see]         same items in the same order, with reasons; the place page prefers these
 * @property {number} recommended_duration_min
 * @property {string} transportation_en
 * @property {string} [transportation_zh]
 * @property {string} [best_time_to_visit] English only
 * @property {boolean} [free_entry]        true only when a source says visiting is free; free places get no ticket phrases
 *
 * @typedef {Object} MustSee
 * @property {{ en: string, zh_TW?: string }} name
 * @property {{ en: string, zh_TW?: string }} [why]   why it is worth seeing
 *
 * @typedef {Object} PlaceMetadata
 * @property {string} [generated_by]     who wrote the entry
 * @property {string} [last_updated]     YYYY-MM-DD
 * @property {string} [source]           older entries: free-text source
 * @property {string[]} [sources]        researched entries: URLs actually read
 * @property {string} [coordinates_note]
 *
 * @typedef {Object} Phrase
 * @property {string} id
 * @property {string} category   basics | food | transport | shopping | emergency | sightseeing
 * @property {string} en
 * @property {string} zh_TW
 * @property {string} pinyin
 * @property {string} zhuyin   one syllable per Han character, space-separated (source of truth for pronunciation)
 * @property {boolean} [top]     in the hand-picked "Most used" set; listed first among place suggestions
 * @property {boolean} [generic] useful anywhere (hello, thank you): never suggested for a particular place
 * @property {boolean} [ticket]  about tickets or entry: not suggested at free places
 * @property {string} [tts]    respelling fed to the voice engine when it mispronounces zh_TW (no phrase needs it yet)
 *
 * @typedef {Object} Tip
 * @property {string} id
 * @property {string} scope      "global" for now; later a city name or place id
 * @property {string} category   safety | daily-life | money | culture | transport
 * @property {string} title_en
 * @property {string} title_zh
 * @property {string} body_en
 * @property {string} body_zh
 *
 * @typedef {Object} FoodPick    One shop the owner recommends (data/food/<city>.json picks[])
 * @property {string} id         kebab-case, unique within the city
 * @property {string} name       shop name as on Google Maps; Navigate searches it with city_zh
 * @property {string} kind       one of FOOD_KINDS (app/js/views/food.js); tests/core/food-kinds.test.js keeps the copies in sync
 * @property {boolean} [local]   listed under the city's local specialties instead of its kind
 * @property {Bilingual} [dish]  what to order there
 * @property {Bilingual} [hint]  short practical note, e.g. closes early when sold out
 *
 * @typedef {Object} FoodDish    A local dish worth trying, no shop chosen yet (to_try[])
 * @property {string} id
 * @property {Bilingual} dish
 *
 * @typedef {Object} FoodCity    data/food/<city>.json
 * @property {string} city_en    matches Place.location.city_en
 * @property {string} city_zh
 * @property {Bilingual} [local_label]  name of the local specialties group; default tr('food.local')
 * @property {FoodPick[]} picks
 * @property {FoodDish[]} [to_try]
 *
 * @typedef {Object} Guidebook   app/data/guidebook.json, written by scripts/build_dataset.py
 * @property {string} version    content hash; changes only when content changes
 * @property {string} generated_at  YYYY-MM-DD
 * @property {Place[]} places
 * @property {Phrase[]} phrases
 * @property {Tip[]} tips
 * @property {FoodCity[]} food   one entry per city with picks
 *
 * @typedef {{ lat: number, lng: number }} LatLng
 *
 * @typedef {Object} Pos         Where distances are measured from
 * @property {number} lat
 * @property {number} lng
 * @property {'gps'|'pick'} source   gps = device location, pick = user chose a city
 * @property {string} label          city_en for prompts when picked, or "your location"
 * @property {string} [city]         city_en when source is 'pick' (position = cityCenter), so the UI can show the name in its language
 *
 * @typedef {Object} LogEntry    One line of the personal trip log (stored on device only)
 * @property {string} id         unique, stable across export/import
 * @property {string} date       YYYY-MM-DD
 * @property {string|null} placeId   guidebook place id, or null for "somewhere else"
 * @property {string} name       free-text name when placeId is null, otherwise ""
 * @property {number|null} stars 1..5 or null
 * @property {string} note
 *
 * @typedef {Object} LogDraft    The unsaved log form
 * @property {string} date
 * @property {string} placeId    "" when not a guidebook place
 * @property {string} name
 * @property {number} stars      0 = no rating
 * @property {string} note
 *
 * @typedef {Object} AskContext  Everything buildAskPrompt needs, passed explicitly so it stays pure
 * @property {'near'|'plan'} mode
 * @property {Pos|null} pos
 * @property {number} radius     km, used in "near" mode
 * @property {string} area       "" | "custom" | "city:<city_en>" | "district:<city_en>|<district_en>"
 * @property {string} customArea free text, used when area is "" or "custom"
 * @property {'today'|'tomorrow'} day
 * @property {string|null} question   null = use defaultQuestion()
 * @property {boolean} includeLog
 * @property {LogEntry[]} log
 * @property {Place[]} places
 * @property {string} today      YYYY-MM-DD, injected so tests are deterministic
 * @property {Trip|null} [trip]  loaded itinerary; its day for the target date is added to the prompt
 * @property {boolean} [wantPlan] ask the AI for a JSON plan to paste back (adds place ids and instructions)
 * @property {'en'|'zh_TW'} [lang] UI language: picks the default question and asks the AI to reply in it
 * @property {FoodCity|null} [food] owner's food picks for the city the question is about
 *
 * @typedef {Object} TripItem    one stop in an itinerary
 * @property {string} [place]    guidebook place id
 * @property {string} [name]     free-text stop when not in the guidebook
 * @property {string} [time]     "HH:MM", optional
 * @property {string} [note]
 *
 * @typedef {Object} TripDay
 * @property {string} date       YYYY-MM-DD
 * @property {string} [title]
 * @property {TripItem[]} items
 *
 * @typedef {Object} Trip
 * @property {string} title
 * @property {TripDay[]} days
 */

export {};
