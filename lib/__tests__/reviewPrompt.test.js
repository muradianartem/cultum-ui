import { File, Paths, __files } from 'expo-file-system';
import {
  EMPTY_REVIEW_RECORD,
  REVIEW_COOLDOWN_DAYS,
  REVIEW_MAX_ASKS,
  loadReviewRecord,
  recordReviewAnswer,
  recordReviewAsked,
  shouldAskForReview,
} from '../reviewPrompt';

const NOW = new Date(2026, 10, 7, 12);
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => __files.clear());

test('a device that was never asked gets asked', () => {
  expect(loadReviewRecord()).toEqual(EMPTY_REVIEW_RECORD);
  expect(shouldAskForReview(loadReviewRecord(), NOW)).toBe(true);
});

test('a yes is final', () => {
  expect(shouldAskForReview({ asks: 1, lastAskedAt: daysAgo(400), answer: 'yes' }, NOW)).toBe(false);
});

test('a no or a dismissal waits out the cooldown', () => {
  for (const answer of ['no', 'dismissed', 'native']) {
    expect(shouldAskForReview({ asks: 1, lastAskedAt: daysAgo(REVIEW_COOLDOWN_DAYS - 1), answer }, NOW)).toBe(false);
    expect(shouldAskForReview({ asks: 1, lastAskedAt: daysAgo(REVIEW_COOLDOWN_DAYS), answer }, NOW)).toBe(true);
  }
});

test('stops after the lifetime cap', () => {
  expect(shouldAskForReview({ asks: REVIEW_MAX_ASKS, lastAskedAt: daysAgo(1000), answer: 'no' }, NOW)).toBe(false);
});

test('the preview override always asks', () => {
  expect(shouldAskForReview({ asks: 9, lastAskedAt: daysAgo(0), answer: 'yes' }, NOW, { always: true })).toBe(true);
});

test('an ask is counted when shown, and the answer replaces the dismissal', () => {
  recordReviewAsked(NOW);
  expect(loadReviewRecord()).toEqual({ asks: 1, lastAskedAt: NOW.toISOString(), answer: 'dismissed' });
  recordReviewAnswer('yes');
  expect(loadReviewRecord()).toMatchObject({ asks: 1, answer: 'yes' });
  expect(shouldAskForReview(loadReviewRecord(), NOW)).toBe(false);
});

test('an unreadable record reads as never asked', () => {
  new File(Paths.document, 'cultum-review-prompt.json').write('{ nope');
  expect(loadReviewRecord()).toEqual(EMPTY_REVIEW_RECORD);
});
