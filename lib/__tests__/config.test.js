jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        googleWebClientId: 'web-id',
        googleIosClientId: 'ios-id',
        googleAndroidClientId: 'android-id',
      },
    },
  },
}));

test('GOOGLE_CLIENT_IDS reads per-platform client ids from expoConfig.extra', () => {
  const { GOOGLE_CLIENT_IDS } = require('../config');
  expect(GOOGLE_CLIENT_IDS).toEqual({
    web: 'web-id',
    ios: 'ios-id',
    android: 'android-id',
  });
});

describe('googleClientIdFor', () => {
  test('returns the configured id for each platform', () => {
    const { googleClientIdFor } = require('../config');
    expect(googleClientIdFor('ios')).toBe('ios-id');
    expect(googleClientIdFor('android')).toBe('android-id');
    expect(googleClientIdFor('web')).toBe('web-id');
  });

  test('defaults to the platform the app is running on', () => {
    const { Platform } = require('react-native');
    const { googleClientIdFor } = require('../config');
    expect(Platform.OS).toBe('ios');
    expect(googleClientIdFor()).toBe('ios-id');
  });

  test('a placeholder or missing id is null', () => {
    jest.resetModules();
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            googleIosClientId: 'ios-id',
            googleAndroidClientId: 'REPLACE_WITH_ANDROID_CLIENT_ID.apps.googleusercontent.com',
          },
        },
      },
    }));
    const { googleClientIdFor } = require('../config');
    expect(googleClientIdFor('android')).toBeNull();
    expect(googleClientIdFor('web')).toBeNull();
    expect(googleClientIdFor('ios')).toBe('ios-id');
  });
});
