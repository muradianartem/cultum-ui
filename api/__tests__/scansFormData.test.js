/**
 * Pins the multipart contract against Expo's own encoder.
 *
 * SDK 57's winter runtime replaces global `fetch` with expo/fetch, which builds
 * the multipart body in JavaScript rather than handing a file URI to native
 * networking. React Native's classic `{ uri, name, type }` part therefore fails
 * at runtime with "Unsupported FormDataPart implementation" — a break that no
 * amount of asserting on our own FormData would catch, since jest's FormData is
 * neither RN's nor the patched one. So this drives Expo's real converter.
 *
 * It imports an internal path on purpose. If an Expo upgrade moves or rewrites
 * that module, this failing is the signal to re-check how uploads must be
 * shaped — not a reason to delete the test.
 */
import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';
import { File } from 'expo-file-system';
import { createScan } from '../scans';
import { apiFetch } from '../client';

jest.mock('../client', () => ({ apiFetch: jest.fn(), trace: jest.fn() }));

// Under jest, FormData is Node's whatwg one, which stringifies object parts.
// In the app it is RN's, whose append expo patches to store parts verbatim —
// so capture the part and hand the converter what it would really see.
let appended;
beforeEach(() => {
  appended = [];
  jest.spyOn(FormData.prototype, 'append').mockImplementation((k, v) => appended.push([k, v]));
});
afterEach(() => jest.restoreAllMocks());

test('the part createScan builds is accepted by expo/fetch and encodes correctly', async () => {
  new File('file:///cache/ImageManipulator/abc').write('RAWJPEGBYTES');
  apiFetch.mockResolvedValueOnce({});
  await createScan({ uri: 'file:///cache/ImageManipulator/abc', mimeType: 'image/jpeg' });

  const realForm = { entries: () => appended };
  const { body } = await convertFormDataAsync(realForm, 'BOUNDARY');
  const text = new TextDecoder().decode(body);
  console.log('---- multipart body ----\n' + text);

  expect(text).toContain('content-disposition: form-data; name="image"; filename="scan.jpg"');
  expect(text).toContain('content-type: image/jpeg');
  expect(text).toContain('RAWJPEGBYTES');
});

test('the OLD { uri, name, type } shape is what expo/fetch rejects', async () => {
  const legacy = { entries: () => [['image', { uri: 'file://a.jpg', name: 'scan.jpg', type: 'image/jpeg' }]] };
  await expect(convertFormDataAsync(legacy, 'B')).rejects.toThrow(
    'Unsupported FormDataPart implementation'
  );
});
