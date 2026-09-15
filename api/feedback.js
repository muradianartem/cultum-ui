// Feedback from the Send feedback screen.
//
// THERE IS NO ENDPOINT YET. The live OpenAPI has nothing under a feedback tag,
// so this is the one call site that has to change when one ships — deliberately
// isolated here rather than inlined in the screen, so wiring it up is a
// one-file edit and the screen never has to learn about the API.
//
// Until then it resolves. The screen is real, the form validates, and the
// message is logged in development; what does not happen is delivery. That is
// a considered trade (the screens were wanted now, the endpoint is coming), not
// an oversight — but it does mean this must not ship to the App Store as-is
// without the endpoint behind it, or it silently swallows what users write.

/** The topics the dropdown offers. `key` is what the endpoint will receive. */
export const FEEDBACK_TOPICS = [
  { key: 'bug', title: 'Bug report', subtitle: "Something isn't working" },
  { key: 'feature', title: 'Feature request', subtitle: 'An idea to make Cultum better' },
  { key: 'other', title: 'Something else', subtitle: "Anything that doesn't fit above" },
];

export const FEEDBACK_MAX_LENGTH = 600;

/**
 * Send one piece of feedback.
 *
 * @param {{ topic: string, message: string }} input
 * @returns {Promise<void>}
 *
 * TODO(api): replace the body of this function with
 *   `await apiFetch('/feedback', { method: 'POST', body: { topic, message } })`
 * once the endpoint exists. Nothing else has to change: the screen already
 * awaits this, shows a spinner while it runs, and surfaces a thrown ApiError.
 */
export async function sendFeedback({ topic, message }) {
  if (__DEV__) {
    console.log(`[feedback] (not sent — no endpoint yet) ${topic}: ${message}`);
  }
}
