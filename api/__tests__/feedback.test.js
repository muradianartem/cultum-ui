import { FEEDBACK_TOPICS, feedbackMailto } from '../feedback';

const parse = (url) => {
  const [head, query] = url.split('?');
  const params = Object.fromEntries(
    query.split('&').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, decodeURIComponent(v)];
    }),
  );
  return { to: head.replace(/^mailto:/, ''), ...params };
};

const build = (over = {}) =>
  feedbackMailto({ topic: 'bug', message: 'It broke', appVersion: '1.1.1', build: '42', ...over });

test('is addressed to the support inbox', () => {
  expect(parse(build()).to).toBe('hello@cultum.app');
});

test('names the topic by its title in the subject', () => {
  for (const topic of FEEDBACK_TOPICS) {
    expect(parse(build({ topic: topic.key })).subject).toBe(`Cultum feedback: ${topic.title}`);
  }
});

test('the body is the trimmed message, then the build', () => {
  expect(parse(build({ message: '  It broke  ' })).body).toBe('It broke\n\n—\nApp 1.1.1 (42)');
});

test('encodes what would otherwise break the URL', () => {
  const message = 'Water & light? 50% = fine\nSecond line 🌿 #tag';
  const url = build({ message });
  // Nothing in the message can start a new parameter or end the query.
  expect(url.split('?')).toHaveLength(2);
  expect(url.split('&')).toHaveLength(2);
  expect(url).not.toMatch(/[\n #]/);
  expect(parse(url).body.startsWith(message)).toBe(true);
});
