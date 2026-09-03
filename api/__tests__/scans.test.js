import { createScan, confirmScan } from '../scans';
import { apiFetch } from '../client';

jest.mock('../client', () => ({ apiFetch: jest.fn() }));

// The FormData under jest is the whatwg one, which stringifies object parts —
// so capture what createScan actually appends rather than reading it back out.
let appended;
beforeEach(() => {
  jest.clearAllMocks();
  appended = [];
  jest.spyOn(FormData.prototype, 'append').mockImplementation((k, v) => {
    appended.push([k, v]);
  });
});
afterEach(() => jest.restoreAllMocks());

const imagePart = () => appended.find(([k]) => k === 'image')?.[1];

describe('createScan', () => {
  const upload = async (uri) => {
    apiFetch.mockResolvedValueOnce({ id: 's1', candidates: [] });
    await createScan(uri);
    const [path, opts] = apiFetch.mock.calls[0];
    return { path, opts, image: imagePart() };
  };

  test('POSTs multipart to /scans with the image under the field the API expects', async () => {
    const { path, opts, image } = await upload('file:///tmp/IMG_0001.jpg');
    expect(path).toBe('/scans');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
    expect(image).toEqual({
      uri: 'file:///tmp/IMG_0001.jpg',
      name: 'scan.jpg',
      type: 'image/jpeg',
    });
  });

  test('names the part after the real extension — the picker is not always JPEG', async () => {
    expect((await upload('file://a.png')).image).toMatchObject({
      name: 'scan.png',
      type: 'image/png',
    });
    jest.clearAllMocks();
    appended = [];
    expect((await upload('file://a.WEBP')).image).toMatchObject({
      name: 'scan.webp',
      type: 'image/webp',
    });
    jest.clearAllMocks();
    appended = [];
    expect((await upload('file://a.heic')).image).toMatchObject({
      name: 'scan.heic',
      type: 'image/heic',
    });
  });

  test('ignores a query string and falls back to JPEG for unknown extensions', async () => {
    expect((await upload('file://a.jpeg?width=100')).image).toMatchObject({
      type: 'image/jpeg',
    });
    jest.clearAllMocks();
    appended = [];
    expect((await upload('file://photo')).image).toMatchObject({
      name: 'scan.jpg',
      type: 'image/jpeg',
    });
  });
});

describe('confirmScan', () => {
  test('sends the picked candidate id', async () => {
    apiFetch.mockResolvedValueOnce({});
    await confirmScan('scan-1', 'cand-9');

    expect(apiFetch).toHaveBeenCalledWith('/scans/scan-1/confirm', {
      method: 'POST',
      body: JSON.stringify({ candidate_id: 'cand-9' }),
    });
  });

  test('sends an explicit null for "none of these" — a negative label, not an omission', async () => {
    apiFetch.mockResolvedValueOnce({});
    await confirmScan('scan-1', null);

    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ candidate_id: null });

    jest.clearAllMocks();
    appended = [];
    apiFetch.mockResolvedValueOnce({});
    await confirmScan('scan-1');
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ candidate_id: null });
  });

  test('encodes the scan id into the path', async () => {
    apiFetch.mockResolvedValueOnce({});
    await confirmScan('a/b', 'c');
    expect(apiFetch.mock.calls[0][0]).toBe('/scans/a%2Fb/confirm');
  });
});
