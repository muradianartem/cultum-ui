import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ButtonIcon, Icon, LoadingIndicator, State } from '../../components';
import { useRouter } from '../../routing';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space, typography } from '../../theme/foundations';
import { createScan } from '../../api/scans';

// Camera chrome sits over a live preview, so these are theme-independent.
const CAMERA_BG = '#0E120B';
const GLASS = 'rgba(250,250,250,0.18)';
const GLASS_BORDER = 'rgba(250,250,250,0.6)';
const SCRIM_TOP = 'rgba(14,18,11,0.55)';
const SCRIM_TOP_FADE = 'rgba(14,18,11,0)';
const SCRIM_BOTTOM = 'rgba(14,18,11,0.8)';
const OVER_TEXT = '#FFFFFF';

const ERROR_COPY = {
  unauthorized: { title: 'Sign-in required to scan.', subtitle: 'Search by name instead for now.' },
  network: { title: 'You’re offline.', subtitle: 'Check your connection and try again.' },
  http: { title: 'Something went wrong.', subtitle: 'Try again in a moment.' },
};

/**
 * ScanCameraScreen — live camera + the camera-permission rationale (merged into
 * this one route). phase: 'permission' | 'ready' | 'analyzing' | 'error'.
 * Capture (expo-camera) or Upload (expo-image-picker) → POST /scans → Matches.
 */
export default function ScanCameraScreen() {
  const insets = useSafeAreaInsets();
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

  async function runScan(uri) {
    setPhase('analyzing');
    try {
      const scan = await createScan(uri);
      navigate('scan-matches', { photoUri: uri, scan });
      setPhase('ready');
    } catch (e) {
      setErrorCode(e?.code ?? 'http');
      setPhase('error');
    }
  }

  async function onCapture() {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
    await runScan(photo.uri);
  }

  async function onUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled) await runScan(result.assets[0].uri);
  }

  // ── Permission rationale (Figma "Camera access") ──────────────────────────
  if (!granted) {
    const canAsk = permission?.canAskAgain !== false;
    return (
      <View style={[styles.permissionScreen, { paddingTop: insets.top }]}>
        <View style={styles.permHeader}>
          <ButtonIcon
            variant="ghost"
            size="md"
            icon={<Icon name="close" size={24} color={OVER_TEXT} />}
            onPress={() => reset('today')}
            accessibilityLabel="Close"
          />
        </View>
        <View style={styles.permBody}>
          <State
            icon={<Icon name="camera" size={28} color={t.text.primary} />}
            title="Identify by photo"
            subtitle="Point the camera at a plant and Cultum names it with an honest confidence score."
            primaryAction={{
              label: 'Allow camera access',
              onPress: canAsk ? requestPermission : () => Linking.openSettings(),
            }}
            secondaryAction={{
              label: 'Search by name instead',
              onPress: () => navigate('scan-search'),
            }}
          />
        </View>
      </View>
    );
  }

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
        colors={[SCRIM_TOP, SCRIM_TOP_FADE]}
        style={styles.topScrim}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[SCRIM_TOP_FADE, SCRIM_BOTTOM]}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {/* Top controls */}
      <View style={[styles.topBar, { top: insets.top + space[8] }]}>
        <ButtonIcon
          variant="ghost"
          size="md"
          icon={<Icon name="close" size={22} color={OVER_TEXT} />}
          onPress={() => reset('today')}
          accessibilityLabel="Close"
        />
        <View style={styles.topRight}>
          <ButtonIcon
            variant="ghost"
            size="md"
            icon={<Icon name={torch ? 'flash' : 'flash-off'} size={22} color={OVER_TEXT} />}
            onPress={() => setTorch((v) => !v)}
            accessibilityLabel="Toggle flash"
          />
          <ButtonIcon
            variant="ghost"
            size="md"
            icon={<Icon name="flip-camera" size={22} color={OVER_TEXT} />}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            accessibilityLabel="Flip camera"
          />
        </View>
      </View>

      {/* Viewfinder */}
      <View style={styles.viewfinderWrap} pointerEvents="none">
        <View style={styles.viewfinder} />
      </View>

      {/* Capture block */}
      <View style={[styles.captureBlock, { paddingBottom: insets.bottom + space[16] }]}>
        <Text style={styles.captureCaption}>Frame the plant, a leaf, or its label</Text>
        <View style={styles.shutterRow}>
          <Pressable
            onPress={onUpload}
            accessibilityRole="button"
            accessibilityLabel="Upload"
            style={styles.sideControl}
          >
            <Icon name="image" size={24} color={OVER_TEXT} />
            <Text style={styles.sideLabel}>Upload</Text>
          </Pressable>

          <Pressable
            onPress={onCapture}
            accessibilityRole="button"
            accessibilityLabel="Shutter"
            style={styles.shutter}
          >
            <View style={styles.shutterInner} />
          </Pressable>

          <Pressable
            onPress={() => navigate('scan-search')}
            accessibilityRole="button"
            accessibilityLabel="Search"
            style={styles.sideControl}
          >
            <Icon name="search" size={24} color={OVER_TEXT} />
            <Text style={styles.sideLabel}>Search</Text>
          </Pressable>
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
            icon={<Icon name="camera" size={28} color={t.text.primary} />}
            title={(ERROR_COPY[errorCode] ?? ERROR_COPY.http).title}
            subtitle={(ERROR_COPY[errorCode] ?? ERROR_COPY.http).subtitle}
            primaryAction={{ label: 'Try again', onPress: () => setPhase('ready') }}
            secondaryAction={{ label: 'Search by name', onPress: () => navigate('scan-search') }}
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: CAMERA_BG },
    permissionScreen: { flex: 1, backgroundColor: CAMERA_BG },
    permHeader: { paddingHorizontal: space[8] },
    permBody: { flex: 1, justifyContent: 'center', padding: space[16] },

    topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
    bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260 },

    topBar: {
      position: 'absolute',
      left: space[16],
      right: space[16],
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    topRight: { flexDirection: 'row', gap: space[8] },

    viewfinderWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    viewfinder: {
      width: 240,
      height: 240,
      borderRadius: radius[24] ?? 24,
      borderWidth: 2,
      borderColor: GLASS_BORDER,
    },

    captureBlock: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space[16],
      gap: space[16],
      alignItems: 'center',
    },
    captureCaption: { ...typography.bodyMedium, color: OVER_TEXT, textAlign: 'center' },
    shutterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      alignSelf: 'stretch',
      paddingHorizontal: space[16],
    },
    sideControl: { alignItems: 'center', gap: space[4], width: 64 },
    sideLabel: { ...typography.caption, color: OVER_TEXT },
    shutter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 3,
      borderColor: OVER_TEXT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: OVER_TEXT },

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
      justifyContent: 'center',
      padding: space[16],
    },
  });
