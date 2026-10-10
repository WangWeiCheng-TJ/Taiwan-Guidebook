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
 * @property {string} category
 * @property {string[]} eras
 * @property {number} [established_year]
 * @property {string} [heritage_status]
 * @property {Bilingual} summary
 * @property {Bilingual} historical_narrative
 * @property {{ year_or_era: string, era_category: string, event_zh: string, event_en: string }[]} timeline
 * @property {Object<string, string>} cultural_significance   why_it_matters_en, architectural_highlights_en, ...
 * @property {Object<string, any>} foreign_visitor_guide       etiquette_tips_en, must_see_spots_en[], best_time_to_visit,
 *                                                             recommended_duration_min, transportation_en, ...
 * @property {string[]} tags
 *
 * @typedef {Object} Phrase
 * @property {string} id
 * @property {string} category   basics | food | transport | shopping | emergency
 * @property {string} en
 * @property {string} zh_TW
 * @property {string} pinyin
 *
 * @typedef {Object} Tip
 * @property {string} id
 * @property {string} scope      "global" for now; later a city name or place id
 * @property {string} category
 * @property {string} title_en
 * @property {string} body_en
 *
 * @typedef {Object} Guidebook   app/data/guidebook.json, written by scripts/build_dataset.py
 * @property {string} version    content hash; changes only when content changes
 * @property {string} generated_at  YYYY-MM-DD
 * @property {Place[]} places
 * @property {Phrase[]} phrases
 * @property {Tip[]} tips
 *
 * @typedef {{ lat: number, lng: number }} LatLng
 *
 * @typedef {Object} Pos         Where distances are measured from
 * @property {number} lat
 * @property {number} lng
 * @property {'gps'|'pick'} source   gps = device location, pick = user chose a place
 * @property {string} label          shown to the user ("your location" or a place name)
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
 *
 * @typedef {Object} TripItem    (phase 2) one stop in an itinerary
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
