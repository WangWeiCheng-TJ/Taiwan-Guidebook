// TASK T2 (see docs/SPEC.md): turn an AI chat answer back into a Trip the app can show.
// Implement the bodies; do not change names, parameters or return shapes.
// Contract tests: tests/tasks/aiplan.test.js

import { parseTrip } from './trip.js';

/** @typedef {import('./types.js').Trip} Trip */
/** @typedef {import('./types.js').Place} Place */

/**
 * Instruction appended to the Ask AI prompt when the user wants a plan they can paste back.
 * Must ask for exactly one ```json fenced block in the Trip shape, using guidebook ids in "place"
 * when a stop is in the guidebook and "name" otherwise, and show a one-line example.
 * @returns {string}
 */
export function planRequestSuffix() {
  throw new Error('TODO(T2): planRequestSuffix');
}

/**
 * Find the JSON object in an AI answer.
 * Order: the first ```json fenced block; else the first ``` fenced block whose content starts with "{";
 * else the first balanced {...} span in the text (respecting strings, so "}" inside quotes does not end it).
 * @param {string} text
 * @returns {string|null}  the raw JSON text, or null if nothing found
 */
export function extractJsonBlock(text) {
  throw new Error('TODO(T2): extractJsonBlock');
}

/**
 * Full paste-back pipeline: extract, JSON.parse, link names to guidebook places, parseTrip.
 * Linking: an item without "place" whose "name" equals a guidebook place's name.en or name.zh_TW
 * (case-insensitive, trimmed) gets that place's id in "place".
 * Errors: "No plan found in the text." | "The plan is not valid JSON." | parseTrip's messages.
 * @param {string} text
 * @param {Place[]} places
 * @returns {{ trip: Trip|null, errors: string[] }}
 */
export function planFromAiText(text, places) {
  throw new Error('TODO(T2): planFromAiText');
}

void parseTrip;
