import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ButtonIcon, Icon, State } from '../../components';
import { useRouter } from '../../routing';
import { useLeaveAcquisition } from '../../onboarding';
import { useTheme, useThemeMode } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';
import { createScan } from '../../api/scans';
import { warmUp } from '../../api/health';
import { prepareScanImage } from '../../lib/prepareImage';
import Viewfinder from './Viewfinder';
import { copyFor } from './errorCopy';

// Camera chrome sits over a live preview, so these are fixed rather than themed:
// the Figma frame's controls are the dark pill regardless of light/dark mode.
const CAMERA_BG = '#0E120B';
const PILL_BG = '#151515';
const PILL_BORDER = '#606160';
const OVER_TEXT = '#FAFAFA';
const SHUTTER = '#FFFFFF';
const SCRIM = 'rgba(0,0,0,0.55)';
const SCRIM_FADE = 'rgba(0,0,0,0)';

// The captured photo on the "Searching" screen (Figma 841:10533).
const LOADING_PHOTO = 168;

// Geometry of the punched-out viewfinder: Figma's 282×379 portrait rectangle
// as a max width + ratio, placed 60/40 in the band between the top controls and
// the capture block.
const VIEWFINDER_MAX_WIDTH = 282;
const VIEWFINDER_INSET = 47; // side margin on screens narrower than the max
const VIEWFINDER_RATIO = 379 / 282; // height / width
const VIEWFINDER_MIN_GAP = 48; // above + below, each, before it shrinks
const VIEWFINDER_TOP_SHARE = 0.6;
// Capture block: padding 12 + caption 22 + gap 24 + shutter 72 + padding 12.
const CAPTURE_BLOCK_HEIGHT = 142;
const TOP_BAR_HEIGHT = 40;

// How long identification may run before the overlay admits it's slow. The
// request itself has a much longer deadline (SCAN_TIMEOUT_MS) — this only stops
// a cold backend from looking like a frozen screen.
const SLOW_SCAN_MS = 10000;

// The 40px dark pill every camera control is built from (Figma's
// _Navigation Bar Button / Button Icon over the preview).
function CameraPill({ icon, size = 24, label, onPress, styles }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.pill}
    >
      <Icon name={icon} size={size} color={OVER_TEXT} />
    </Pressable>
  );
}

// A pill with its label underneath — the Upload / Search controls flanking the
// shutter.
function SideControl({ icon, label, onPress, styles }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.sideControl}
    >
      <View style={styles.pill}>
        <Icon name={icon} size={16} color={OVER_TEXT} />
      </View>
      <Text style={styles.sideLabel}>{label}</Text>
    </Pressable>
  );
}

/**
 * ScanCameraScreen — live camera + the camera-permission rationale (merged into
 * this one route). phase: 'ready' | 'analyzing' | 'error'.
 * Capture (expo-camera) or Upload (expo-image-picker) → POST /scans → Matches.
 *
 * Figma: "Scan / Camera access" (158:10369), "Scan / Camera" (158:10382) and
 * "Scan / Loading" (739:16112), which shows the user's own photo. The error
 * overlay has no Figma frame — the upload needs it.
 */
export default function ScanCameraScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { navigate } = useRouter();
  // Close goes to Today — or, mid-onboarding, back to "Add your first plant".
  const leave = useLeaveAcquisition();
  const t = useTheme();
  const { effective } = useThemeMode();
  const styles = makeStyles(t);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState('ready');
  const [errorCode, setErrorCode] = useState('http');
  const [errorDetail, setErrorDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [slow, setSlow] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const cameraRef = useRef(null);
  // Set when the user closes mid-scan, so a late answer doesn't pull them
  // back into Matches after they've left.
  const abandonedRef = useRef(false);

  const granted = !!permission?.granted;
  const busy = phase !== 'ready';

  // Wake the backend while the user is still framing their shot. It scales to
  // zero, and a cold start is long enough to eat into the scan's own deadline.
  useEffect(() => {
    if (granted) warmUp();
  }, [granted]);

  // "Searching…" → "Still searching…" so a slow scan reads as slow, not stuck.
  useEffect(() => {
    if (phase !== 'analyzing') {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_SCAN_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  function fail(code, detail) {
    setErrorCode(code);
    setErrorDetail(detail ?? null);
    setShowDetail(false);
    setPhase('error');
  }

  async function runScan(uri, dimensions) {
    abandonedRef.current = false;
    setPhotoUri(uri);
    setPhase('analyzing');
    try {
      // Shrink and normalise first: full-resolution captures are what make an
      // upload slow enough to drop, and the picker's HEIC isn't accepted at all.
      const prepared = await prepareScanImage(uri, dimensions);
      const scan = await createScan(prepared ?? uri);
      if (abandonedRef.current) return;
      setPhase('ready');
      // Show the original, not the downscaled copy that went to the server.
      navigate('scan-matches', { photoUri: uri, scan });
    } catch (e) {
      if (abandonedRef.current) return;
      fail(e?.code ?? 'http', e?.detail ?? e?.message);
    }
  }

  function abandonScan() {
    abandonedRef.current = true;
    setPhase('ready');
    leave();
  }

  async function onCapture() {
    if (busy || !cameraRef.current) return;
    let photo;
    try {
      photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    } catch (e) {
      fail('camera', e?.message);
      return;
    }
    await runScan(photo.uri, { width: photo.width, height: photo.height });
  }

  async function onUpload() {
    if (busy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await runScan(asset.uri, { width: asset.width, height: asset.height });
  }

  // ── Permission rationale — Figma "Scan / Camera access" ───────────────────
  if (!granted) {
    const canAsk = permission?.canAskAgain !== false;
    return (
      <View style={[styles.permissionScreen, { paddingTop: insets.top }]}>
        <View style={styles.permHeader}>
          <ButtonIcon
            variant="outline"
            size="md"
            icon={<Icon name="close" size={24} color={t.text.primary} />}
            onPress={leave}
            accessibilityLabel="Close"
          />
        </View>
        <View style={styles.permBody}>
          <State
            icon={<Icon name="camera" size={24} color={t.text.primary} />}
            iconVariant="secondary"
            title="Camera Access"
            subtitle="To scan a plant, you need to allow camera access."
            primaryAction={{
              label: 'Allow Camera Access',
              leftIcon: <Icon name="camera" size={16} color={t.brand.onPrimary} />,
              onPress: canAsk ? requestPermission : () => Linking.openSettings(),
            }}
            secondaryAction={{
              label: 'Search by Name Instead',
              leftIcon: <Icon name="search" size={16} color={t.text.primary} />,
              onPress: () => navigate('scan-search'),
            }}
          />
        </View>
      </View>
    );
  }

  const barBottom = insets.top + space[8] + TOP_BAR_HEIGHT;
  const captureTop = height - insets.bottom - CAPTURE_BLOCK_HEIGHT;
  const band = captureTop - barBottom;
  // Narrow screens shrink it by width, short ones by height; the ratio holds.
  const vfWidth = Math.min(
    VIEWFINDER_MAX_WIDTH,
    width - VIEWFINDER_INSET * 2,
    (band - VIEWFINDER_MIN_GAP * 2) / VIEWFINDER_RATIO,
  );
  const vfHeight = vfWidth * VIEWFINDER_RATIO;
  const vfTop = barBottom + (band - vfHeight) * VIEWFINDER_TOP_SHARE;

  return (
    <View style={styles.screen}>
      {/* The live camera sits under the status bar in both themes; the
          Searching screen is a themed page like any other. */}
      <StatusBar
        style={phase === 'analyzing' && effective !== 'dark' ? 'dark' : 'light'}
      />
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        enableTorch={torch}
      />

      {/* Scrims */}
      <LinearGradient
        colors={[SCRIM, SCRIM_FADE]}
        style={styles.topScrim}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[SCRIM_FADE, SCRIM]}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {/* Dimming mask + corner brackets */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Viewfinder
          width={width}
          height={height}
          frameWidth={vfWidth}
          frameHeight={vfHeight}
          top={vfTop}
        />
      </View>

      {/* Top controls */}
      <View style={[styles.topBar, { top: insets.top + space[8] }]}>
        <CameraPill
          icon="close"
          label="Close"
          onPress={leave}
          styles={styles}
        />
        <View style={styles.topRight}>
          <CameraPill
            icon={torch ? 'flash' : 'flash-off'}
            label="Toggle flash"
            onPress={() => setTorch((v) => !v)}
            styles={styles}
          />
          <CameraPill
            icon="flip-camera"
            label="Flip camera"
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            styles={styles}
          />
        </View>
      </View>

      {/* Capture block */}
      <View style={[styles.captureBlock, { paddingBottom: insets.bottom + space[12] }]}>
        <Text style={styles.captureCaption}>Frame the plant, a leaf, or its label</Text>
        <View style={styles.shutterRow}>
          <SideControl icon="image" label="Upload" onPress={onUpload} styles={styles} />

          <Pressable
            onPress={onCapture}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Shutter"
            accessibilityState={{ disabled: busy }}
            style={styles.shutter}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <SideControl
            icon="search"
            label="Search"
            onPress={() => navigate('scan-search')}
            styles={styles}
          />
        </View>
      </View>

      {/* Searching — Figma "Scan / Loading" */}
      {phase === 'analyzing' ? (
        <View style={styles.analyzing}>
          <View style={[styles.analyzingHeader, { top: insets.top + space[8] }]}>
            <ButtonIcon
              variant="secondary"
              size="md"
              icon={<Icon name="close" size={24} color={t.brand.onSecondary} />}
              onPress={abandonScan}
              accessibilityLabel="Close"
            />
          </View>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.analyzingPhoto}
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <Text style={styles.analyzingText}>
            {slow ? 'Still searching — this one’s taking a moment…' : 'Searching for your plant…'}
          </Text>
        </View>
      ) : null}

      {/* Error overlay */}
      {phase === 'error' ? (
        <View style={styles.errorOverlay}>
          <State
            icon={<Icon name="camera" size={24} color={t.text.primary} />}
            iconVariant="secondary"
            title={copyFor(errorCode).title}
            subtitle={copyFor(errorCode).subtitle}
            primaryAction={{ label: 'Try again', onPress: () => setPhase('ready') }}
            secondaryAction={{
              label: 'Search by Name Instead',
              onPress: () => navigate('scan-search'),
            }}
          />
          {/* What actually went wrong, one tap away. Tucked under the copy so it
              never competes with it, but reachable — a bug report that quotes
              this is diagnosable; "it says I'm offline" is not. */}
          <Pressable
            onPress={() => setShowDetail((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Error details"
            style={styles.detailToggle}
          >
            <Text style={styles.detailToggleText}>
              {showDetail ? 'Hide details' : 'Details'}
            </Text>
          </Pressable>
          {showDetail ? (
            <Text style={styles.detailText} selectable>
              {errorCode}
              {errorDetail ? `: ${errorDetail}` : ''}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: CAMERA_BG },

    // Camera access — a light screen (Figma 158:10369), not camera chrome.
    permissionScreen: { flex: 1, backgroundColor: t.background.primary },
    permHeader: { paddingHorizontal: space[16], paddingTop: space[8] },
    permBody: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: space[32],
      paddingVertical: space[24],
    },

    topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
    bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 },

    topBar: {
      position: 'absolute',
      left: space[16],
      right: space[16],
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    topRight: { flexDirection: 'row', gap: space[8] },
    pill: {
      width: 40,
      height: 40,
      borderRadius: 9999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: PILL_BG,
      borderWidth: 1,
      borderColor: PILL_BORDER,
    },

    captureBlock: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space[24],
      paddingTop: space[12],
      gap: space[24],
      alignItems: 'stretch',
    },
    captureCaption: { ...typography.bodyLarge, color: OVER_TEXT, textAlign: 'center' },
    shutterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      alignSelf: 'stretch',
      paddingHorizontal: space[20],
    },
    sideControl: { alignItems: 'center', gap: space[8], width: 72 },
    sideLabel: { ...typography.captionEmphasized, color: OVER_TEXT },
    shutter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 3,
      borderColor: SHUTTER,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: SHUTTER },

    analyzing: {
      ...StyleSheet.absoluteFill,
      backgroundColor: t.background.primary,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[20],
      paddingHorizontal: space[32],
    },
    analyzingHeader: { position: 'absolute', left: space[16] },
    analyzingPhoto: {
      width: LOADING_PHOTO,
      height: LOADING_PHOTO,
      borderRadius: 18,
      backgroundColor: t.background.secondary,
    },
    analyzingText: {
      ...typography.headingExtraSmall,
      color: t.text.primary,
      textAlign: 'center',
    },

    errorOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: t.background.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space[32],
    },
    detailToggle: { marginTop: space[16], padding: space[8] },
    detailToggleText: { ...typography.caption, color: t.text.secondary },
    detailText: {
      ...typography.caption,
      color: t.text.secondary,
      textAlign: 'center',
      marginTop: space[4],
    },
  });
