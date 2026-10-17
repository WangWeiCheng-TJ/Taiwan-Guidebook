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
 * @property {string[]} tags                  also link the place to knowledge topics (topics.js)
 * @property {PlacePhoto} [photo]            shown online only, always with its credit line
 * @property {PlaceMetadata} [metadata]   not shown in the app
 *
 * @typedef {Object} PlacePhoto   A freely licensed photo from Wikimedia Commons (cross-origin: never precached)
 * @property {string} src          https://upload.wikimedia.org/... thumbnail, about 800px wide
 * @property {string} page         https://commons.wikimedia.org/wiki/File:... (the file's page, linked in the credit)
 * @property {string} author       plain text
 * @property {string} license      e.g. "CC BY-SA 4.0"
 * @property {string} license_url  the license deed, or a public-domain page
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
 * @property {boolean} [always_open]       open all day, every day (a gate, a street): no opening-hours phrases
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
 * @property {boolean} [hours]   about opening hours: not suggested at places that are always open
 * @property {PhraseParty} [party]  the phrase names a party size; en/zh_TW/zhuyin/pinyin are the n=2 form (party.js withParty)
 * @property {string} [tts]    respelling fed to the voice engine when it mispronounces zh_TW (no phrase needs it yet)
 *
 * @typedef {Object} PhraseParty   How the number in a phrase is written, so withParty() can swap it for 1..10
 * @property {string} zh_TW     the number in the phrase, e.g. "兩"; its first occurrence is replaced
 * @property {string} zhuyin    the same syllable in zhuyin, e.g. "ㄌㄧㄤˇ"
 * @property {string} pinyin    the same syllable in pinyin, e.g. "liǎng"
 * @property {string} en_one    English for one, e.g. "One ticket, please"
 * @property {string} en_other  English for 2..10: {n} = number word ("two"), {N} = capitalized ("Two")
 *
 * @typedef {Object} Tip
 * @property {string} id
 * @property {string|string[]} scope  "global", or a city_en (or a list of them) for city-specific tips
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
 * @typedef {Object} App        A recommended phone app (data/apps.json, in display order)
 * @property {string} id         kebab-case, unique
 * @property {string} category   one of APP_CATEGORIES (app/js/views/apps.js): getting-around, taxi, trains,
 *                               messaging, language, weather, food
 * @property {Bilingual} name
 * @property {Bilingual} why     one or two plain sentences
 * @property {string} url        https, the app's official page
 * @property {string[]} platforms  "ios" | "android"
 *
 * @typedef {Object} Topic      A knowledge topic (data/topics/<id>.json), e.g. temple layout; read at #/learn/<id>
 * @property {string} id         kebab-case, unique, the file name
 * @property {Bilingual} title
 * @property {Bilingual} summary one sentence
 * @property {{ en: string[], zh_TW: string[] }} body   paragraphs, read with localizedList()
 * @property {string[]} tags     place tags: places sharing one are related (topics.js)
 * @property {string[]} places   attraction ids listed first among the related places
 * @property {{ sources: string[], generated_by: string, last_updated: string }} metadata
 *           generated_by ends with "pending owner review" until the owner has checked it (the page says so)
 *
 * @typedef {Object} Guidebook   app/data/guidebook.json, written by scripts/build_dataset.py
 * @property {string} version    content hash; changes only when content changes
 * @property {string} generated_at  YYYY-MM-DD
 * @property {Place[]} places
 * @property {Phrase[]} phrases
 * @property {Tip[]} tips
 * @property {FoodCity[]} food   one entry per city with picks
 * @property {App[]} [apps]      data order; missing in older bundles (views treat it as [])
 * @property {Topic[]} [topics]  sorted by id; missing in older bundles (views treat it as [])
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
 * @property {number|null} [party] party size 1..10: one sentence ("I'm traveling alone." / "We are <n> people.");
 *           null or absent adds nothing
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
