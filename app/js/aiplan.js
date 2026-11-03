// Turn an AI chat answer back into a Trip the app can show. Contract tests: tests/core/aiplan.test.js

import { parseTrip } from './trip.js';

/** @typedef {import('./types.js').Trip} Trip */
/** @typedef {import('./types.js').Place} Place */

// The example plan in planRequestSuffix. A paste that still holds the request (a whole chat copied on a
// phone) contains it too, so extractJsonBlock skips it.
const EXAMPLE = '{"title":"Tainan day","days":[{"date":"YYYY-MM-DD","items":[{"time":"09:00","place":"chihkan-tower","note":"go early"},{"time":"12:00","name":"Lunch at a beef soup shop"}]}]}';

/**
 * Instruction appended to the Ask AI prompt when the user wants a plan they can paste back.
 * Must ask for exactly one ```json fenced block in the Trip shape, using guidebook ids in "place"
 * when a stop is in the guidebook and "name" otherwise, and show a one-line example.
 * @returns {string}
 */
export function planRequestSuffix() {
  return [
    'After your answer, add the plan as exactly one ```json code block so I can load it into my travel app.',
    'Use the real date(s) of the plan. For a place from my guidebook list, put its [id: ...] value in "place"; for anything else, put its name in "name". "time" (HH:MM) and "note" are optional.',
    'Shape (example values):',
    '```json',
    EXAMPLE,
    '```',
  ].join('\n');
}

const squash = s => s.replace(/\s+/g, '');
/** True for the request's own example plan, however the copy re-spaced it. */
const isExample = s => squash(s) === squash(EXAMPLE);
const parses = s => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

/**
 * Find the JSON object in an AI answer.
 * Order: the first ```json fenced block whose content is valid JSON (else the first ```json block);
 * else the first ``` fenced block whose content starts with "{";
 * else the first balanced {...} span in the text (respecting strings, so "}" inside quotes does not end it).
 * A ```json fence opens only where "json" is followed by a line break or by the "{" itself, so the request's
 * words "exactly one ```json code block" are not taken for a fence. The example plan from planRequestSuffix
 * is skipped at every step: a paste that holds the request and then the answer finds the answer's plan.
 * @param {string} text
 * @returns {string|null}  the raw JSON text, or null if nothing found
 */
export function extractJsonBlock(text) {
  if (typeof text !== 'string') return null;

  const jsonBlocks = [...text.matchAll(/```+[ \t]*json[ \t]*(?:\r?\n|(?=\{))([\s\S]*?)```+/gi)]
    .map(m => m[1].trim())
    .filter(s => !isExample(s));
  if (jsonBlocks.length) {
    return jsonBlocks.find(parses) ?? jsonBlocks[0];
  }

  const fenceRegex = /```+[ \t]*[^\n\r`]*\r?\n?([\s\S]*?)```+/g;
  let match;
  while ((match = fenceRegex.exec(text)) !== null) {
    const content = match[1].trim();
    if (content.startsWith('{') && !isExample(content)) {
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
              const span = text.slice(i, j + 1);
              if (!isExample(span)) return span;
              i = j; // the request's example: look on after it
              break;
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
