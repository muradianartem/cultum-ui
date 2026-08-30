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
