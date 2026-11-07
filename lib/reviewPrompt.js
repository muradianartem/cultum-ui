// When to ask "Did Cultum find your plant?" — the in-app review prompt.
//
// The question only decides which door opens: a yes hands over to the OS's own
// rating sheet (StoreKit / Play In-App Review), a no to the Send feedback form.
// No stars are collected here. Apple disallows custom review prompts (App Review
// Guideline 5.6.1) and Google forbids asking anything before its review card,
// so Android skips the question entirely (screens/useReviewPrompt.js).
//
// The record describes the device, not the account, and is not cleared on
// sign-out: someone who already answered should not be asked again because
// they logged out and back in. Synchronous for the same reason as
// lib/planLapseAck.js — it is read at the moment of deciding.

import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'cultum-review-prompt.json';

/** Days between two asks, after a "no" or a dismissal. */
export const REVIEW_COOLDOWN_DAYS = 120;
/** Asks in a lifetime; the OS caps its own sheet at 3 a year anyway. */
export const REVIEW_MAX_ASKS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const ANSWERS = new Set(['yes', 'no', 'dismissed', 'native']);

export const EMPTY_REVIEW_RECORD = Object.freeze({ asks: 0, lastAskedAt: null, answer: null });

const recordFile = () => new File(Paths.document, FILE_NAME);

/** Coerce whatever was on disk into a record; anything odd reads as "never asked". */
export function migrateReviewRecord(doc) {
  if (!doc || typeof doc !== 'object') return { ...EMPTY_REVIEW_RECORD };
  const asks = Number.isInteger(doc.asks) && doc.asks > 0 ? doc.asks : 0;
  const at = typeof doc.lastAskedAt === 'string' && !Number.isNaN(Date.parse(doc.lastAskedAt))
    ? doc.lastAskedAt
    : null;
  return { asks, lastAskedAt: at, answer: ANSWERS.has(doc.answer) ? doc.answer : null };
}

export function loadReviewRecord() {
  try {
    const file = recordFile();
    if (!file.exists) return { ...EMPTY_REVIEW_RECORD };
    return migrateReviewRecord(JSON.parse(file.textSync()));
  } catch {
    return { ...EMPTY_REVIEW_RECORD };
  }
}

function saveReviewRecord(record) {
  try {
    const file = recordFile();
    if (!file.exists) file.create();
    file.write(JSON.stringify(record));
  } catch (e) {
    console.warn('[review] could not record the review prompt:', e?.message ?? e);
  }
}

/**
 * Whether the prompt may be shown now. Pure.
 *
 * Never after a yes (they were sent to the store once; that's the deal), never
 * more than REVIEW_MAX_ASKS times, and not again within REVIEW_COOLDOWN_DAYS of
 * the last ask. `always` is the preview override (EXPO_PUBLIC_REVIEW_PROMPT).
 */
export function shouldAskForReview(record, now, { always = false } = {}) {
  if (always) return true;
  const r = migrateReviewRecord(record);
  if (r.answer === 'yes') return false;
  if (r.asks >= REVIEW_MAX_ASKS) return false;
  if (!r.lastAskedAt) return true;
  return now.getTime() - Date.parse(r.lastAskedAt) >= REVIEW_COOLDOWN_DAYS * DAY_MS;
}

/**
 * Count an ask the moment it is shown, so a crash or a force-quit mid-prompt
 * still spends it. `answer` starts as 'dismissed' and is overwritten by
 * `recordReviewAnswer` if the user picks a side.
 */
export function recordReviewAsked(now, answer = 'dismissed') {
  const r = loadReviewRecord();
  saveReviewRecord({ asks: r.asks + 1, lastAskedAt: now.toISOString(), answer });
}

/** What the user chose on the prompt that is showing. */
export function recordReviewAnswer(answer) {
  if (!ANSWERS.has(answer)) return;
  saveReviewRecord({ ...loadReviewRecord(), answer });
}

/** Preview switch: `EXPO_PUBLIC_REVIEW_PROMPT=always` shows it on every add. */
export const REVIEW_PROMPT_ALWAYS = process.env.EXPO_PUBLIC_REVIEW_PROMPT === 'always';
