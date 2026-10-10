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
  return [
    'Format your suggested itinerary as exactly one ```json fenced code block in the Trip shape, using guidebook ids in "place" when a stop is in the guidebook and "name" otherwise.',
    'Example (one line):',
    '```json',
    '{"title":"Day trip","days":[{"date":"2026-11-04","items":[{"time":"09:00","place":"chihkan-tower","note":"visit"},{"name":"Curry shop"}]}]}',
    '```',
  ].join('\n');
}

/**
 * Find the JSON object in an AI answer.
 * Order: the first ```json fenced block; else the first ``` fenced block whose content starts with "{";
 * else the first balanced {...} span in the text (respecting strings, so "}" inside quotes does not end it).
 * @param {string} text
 * @returns {string|null}  the raw JSON text, or null if nothing found
 */
export function extractJsonBlock(text) {
  if (typeof text !== 'string') return null;

  const jsonMatch = text.match(/```+[ \t]*json\b[ \t]*\r?\n?([\s\S]*?)```+/i);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  const fenceRegex = /```+[ \t]*[^\n\r`]*\r?\n?([\s\S]*?)```+/g;
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content.startsWith('{')) {
      return content;
    }
  }

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let j = i; j < text.length; j++) {
        const ch = text[j];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === '\\') {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else {
          if (ch === '"') {
            inString = true;
            escape = false;
          } else if (ch === '{') {
            depth++;
          } else if (ch === '}') {
            depth--;
            if (depth === 0) {
              return text.slice(i, j + 1);
            }
          }
        }
      }
    }
  }

  return null;
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
  const jsonText = extractJsonBlock(text);
  if (!jsonText) {
    return { trip: null, errors: ['No plan found in the text.'] };
  }

  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return { trip: null, errors: ['The plan is not valid JSON.'] };
  }

  if (data && typeof data === 'object' && Array.isArray(data.days) && Array.isArray(places)) {
    for (const day of data.days) {
      if (day && typeof day === 'object' && Array.isArray(day.items)) {
        for (const item of day.items) {
          if (item && typeof item === 'object') {
            const hasPlace = typeof item.place === 'string' && item.place.trim().length > 0;
            if (!hasPlace && typeof item.name === 'string') {
              const target = item.name.trim().toLowerCase();
              if (target) {
                const match = places.find(p => {
                  const en = typeof p?.name?.en === 'string' ? p.name.en.trim().toLowerCase() : '';
                  const zh = typeof p?.name?.zh_TW === 'string' ? p.name.zh_TW.trim().toLowerCase() : '';
                  return target === en || target === zh;
                });
                if (match) {
                  item.place = match.id;
                }
              }
            }
          }
        }
      }
    }
  }

  return parseTrip(data);
}
