import { prepareScanImage, MAX_EDGE, JPEG_QUALITY } from '../prepareImage';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// A minimal stand-in for the manipulator's chainable context: record what was
// asked of it, hand back a ref carrying the dimensions the test set up.
let resized;
let saved;
const makeContext = (width, height) => {
  const context = {
    resize: jest.fn((size) => {
      resized = size;
      return context;
    }),
    renderAsync: jest.fn(async () => ({
      width,
      height,
      saveAsync: jest.fn(async (options) => {
        saved = options;
        return { uri: 'file:///cache/out.jpg', width, height };
      }),
    })),
  };
  return context;
};

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  resized = undefined;
  saved = undefined;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('downscales a full-resolution capture to the long edge, keeping its aspect', async () => {
  ImageManipulator.manipulate.mockReturnValue(makeContext(4032, 3024));

  const out = await prepareScanImage('file://IMG.jpg', { width: 4032, height: 3024 });

  expect(resized).toEqual({ width: MAX_EDGE, height: Math.round(MAX_EDGE * (3024 / 4032)) });
  expect(out).toEqual({
    uri: 'file:///cache/out.jpg',
    mimeType: 'image/jpeg',
    fileName: 'scan.jpg',
  });
});

test('scales by the taller side for a portrait photo', async () => {
  ImageManipulator.manipulate.mockReturnValue(makeContext(3024, 4032));

  await prepareScanImage('file://IMG.jpg', { width: 3024, height: 4032 });

  expect(resized).toEqual({ width: Math.round(MAX_EDGE * (3024 / 4032)), height: MAX_EDGE });
});

test('never upscales — a small image is only re-encoded', async () => {
  ImageManipulator.manipulate.mockReturnValue(makeContext(800, 600));

  await prepareScanImage('file://small.png', { width: 800, height: 600 });

  expect(resized).toBeUndefined();
  // Still saved as JPEG: that is what turns the picker's HEIC into something
  // the API accepts.
  expect(saved).toEqual({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
});

test('probes the source when the caller does not know its dimensions', async () => {
  ImageManipulator.manipulate.mockReturnValue(makeContext(4000, 4000));

  await prepareScanImage('file://unknown.heic');

  // Once to read the size, once to do the work.
  expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(2);
  expect(resized).toEqual({ width: MAX_EDGE, height: MAX_EDGE });
});

test('falls back to the original file rather than losing the photo', async () => {
  ImageManipulator.manipulate.mockImplementation(() => {
    throw new Error('unsupported format');
  });

  await expect(prepareScanImage('file://IMG.jpg', { width: 100, height: 100 })).resolves.toBeNull();
});
