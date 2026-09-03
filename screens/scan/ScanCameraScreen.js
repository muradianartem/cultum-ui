import { useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ButtonIcon, Icon, LoadingIndicator, State } from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { space, typography } from '../../theme/foundations';
import { createScan } from '../../api/scans';
import Viewfinder from './Viewfinder';

// Camera chrome sits over a live preview, so these are fixed rather than themed:
// the Figma frame's controls are the dark pill regardless of light/dark mode.
const CAMERA_BG = '#0E120B';
const PILL_BG = '#151515';
const PILL_BORDER = '#606160';
const OVER_TEXT = '#FAFAFA';
const SHUTTER = '#FFFFFF';
const SCRIM = 'rgba(0,0,0,0.55)';
const SCRIM_FADE = 'rgba(0,0,0,0)';

// Geometry of the punched-out viewfinder square.
const VIEWFINDER_MAX = 288;
const VIEWFINDER_INSET = 40;

const ERROR_COPY = {
  unauthorized: {
    title: 'Your session expired.',
    subtitle: 'Sign in again to identify plants by photo.',
  },
  network: { title: 'You’re offline.', subtitle: 'Check your connection and try again.' },
  http: { title: 'Something went wrong.', subtitle: 'Try again in a moment.' },
};

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
 * Figma: "Scan / Camera access" (158:10369) and "Scan / Camera" (158:10382).
 * The analyzing and error overlays have no Figma frame — the upload needs them.
 */
export default function ScanCameraScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { navigate, reset } = useRouter();
  const t = useTheme();
  const styles = makeStyles(t);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState('ready');
  const [errorCode, setErrorCode] = useState('http');
  const cameraRef = useRef(null);

  const granted = !!permission?.granted;
  const busy = phase !== 'ready';

  async function runScan(uri) {
    setPhase('analyzing');
    try {
      const scan = await createScan(uri);
      setPhase('ready');
      navigate('scan-matches', { photoUri: uri, scan });
    } catch (e) {
      setErrorCode(e?.code ?? 'http');
      setPhase('error');
    }
  }

  async function onCapture() {
    if (busy || !cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      await runScan(photo.uri);
    } catch {
      setErrorCode('http');
      setPhase('error');
    }
  }

  async function onUpload() {
    if (busy) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) await runScan(result.assets[0].uri);
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
            onPress={() => reset('today')}
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

  const vfSize = Math.min(width - VIEWFINDER_INSET * 2, VIEWFINDER_MAX);
  const vfTop = Math.max(insets.top + 96, (height - vfSize) / 2 - 64);

  return (
    <View style={styles.screen}>
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
        <Viewfinder width={width} height={height} size={vfSize} top={vfTop} />
      </View>

      {/* Top controls */}
      <View style={[styles.topBar, { top: insets.top + space[8] }]}>
        <CameraPill
          icon="close"
          label="Close"
          onPress={() => reset('today')}
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

      {/* Analyzing overlay */}
      {phase === 'analyzing' ? (
        <View style={styles.analyzing}>
          <LoadingIndicator color={OVER_TEXT} />
          <Text style={styles.analyzingText}>Identifying your plant…</Text>
        </View>
      ) : null}

      {/* Error overlay */}
      {phase === 'error' ? (
        <View style={styles.errorOverlay}>
          <State
            icon={<Icon name="camera" size={24} color={t.text.primary} />}
            iconVariant="secondary"
            title={(ERROR_COPY[errorCode] ?? ERROR_COPY.http).title}
            subtitle={(ERROR_COPY[errorCode] ?? ERROR_COPY.http).subtitle}
            primaryAction={{ label: 'Try again', onPress: () => setPhase('ready') }}
            secondaryAction={{
              label: 'Search by Name Instead',
              onPress: () => navigate('scan-search'),
            }}
          />
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
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(14,18,11,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space[16],
    },
    analyzingText: { ...typography.bodyLarge, color: OVER_TEXT },

    errorOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.background.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space[32],
    },
  });
