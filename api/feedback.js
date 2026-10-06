// Feedback from the Send feedback screen.
//
// There is no feedback endpoint: the live OpenAPI has nothing under a feedback
// tag. So feedback goes out through the user's own mail app instead, as a
// pre-filled email to the support inbox — they see exactly what is sent, and
// sending it is visibly their action. The app never learns whether they did,
// which is why nothing anywhere claims the feedback was delivered.
//
// TODO(api): replace `feedbackMailto` with a POST once `/feedback` exists, and
// only then add a success message.

import { SUPPORT_EMAIL } from '../lib/support';

/** The topics the dropdown offers. `key` is what an endpoint would receive. */
export const FEEDBACK_TOPICS = [
  { key: 'bug', title: 'Bug report', subtitle: "Something isn't working" },
  { key: 'feature', title: 'Feature request', subtitle: 'An idea to make Cultum better' },
  { key: 'other', title: 'Something else', subtitle: "Anything that doesn't fit above" },
];

export const FEEDBACK_MAX_LENGTH = 600;

/**
 * A mailto: URL for one piece of feedback, addressed to SUPPORT_EMAIL.
 *
 * Subject "Cultum feedback: <topic title>"; the body is the trimmed message,
 * then the build it came from, so a report can be matched to a TestFlight
 * upload. Pure — it opens nothing.
 *
 * @param {{ topic: string, message: string, appVersion: string, build: string }} input
 * @returns {string}
 */
export function feedbackMailto({ topic, message, appVersion, build }) {
  const title = FEEDBACK_TOPICS.find((t) => t.key === topic)?.title ?? 'Feedback';
  const subject = `Cultum feedback: ${title}`;
  const body = `${String(message ?? '').trim()}\n\n—\nApp ${appVersion} (${build})`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
