const { validate } = require('../check-release-config');

const APP = {
  expo: {
    version: '1.1.1',
    ios: { bundleIdentifier: 'com.cultum.ui' },
    android: {},
    extra: {
      apiBaseUrl: 'https://api.cultum.app',
      googleIosClientId: '123-ios.apps.googleusercontent.com',
      googleAndroidClientId: 'REPLACE_WITH_ANDROID_CLIENT_ID.apps.googleusercontent.com',
    },
  },
};
const withExtra = (extra) => ({ expo: { ...APP.expo, extra: { ...APP.expo.extra, ...extra } } });

test('an iOS build is not held up by the Android placeholder', () => {
  expect(validate(APP, {}, 'ios')).toEqual({ errors: [], warnings: [] });
});

test('the Android placeholder fails an Android build, naming it', () => {
  const { errors } = validate(APP, {}, 'android');
  expect(errors).toEqual(
    expect.arrayContaining([expect.stringContaining('googleAndroidClientId is a placeholder')]),
  );
  expect(errors).toEqual(expect.arrayContaining(['expo.android.package is missing']));
});

test('a plain-http API URL is an error, from app.json or the env', () => {
  expect(validate(withExtra({ apiBaseUrl: 'http://api.cultum.app' }), {}, 'ios').errors).toEqual([
    'API URL is not https: http://api.cultum.app',
  ]);
  expect(validate(APP, { EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8000' }, 'ios').errors).toHaveLength(1);
});

test('the dev backend only warns', () => {
  const dev = withExtra({ apiBaseUrl: 'https://ca-cultum-dev-cac.example.io' });
  const { errors, warnings } = validate(dev, {}, 'ios');
  expect(errors).toEqual([]);
  expect(warnings).toEqual([expect.stringContaining('dev backend')]);
});

test('a version mismatch only warns', () => {
  const { errors, warnings } = validate(APP, {}, 'ios', { packageVersion: '1.2.0' });
  expect(errors).toEqual([]);
  expect(warnings).toEqual([expect.stringContaining('1.2.0')]);
});
