import { Pressable, StyleSheet, View } from 'react-native';
import { overlay } from '../theme/tokens';

/**
 * Overlay — full-screen dimming scrim, imported from Figma "Overlay - P3".
 *
 * A layer placed behind modal content (sheets, dialogs, takeovers) to focus
 * attention and mark the rest of the screen inactive. Tapping it usually
 * dismisses what's above — wire `onPress`. Figma's scrim is a #FAFAFA layer at
 * 0.85; `color`/`opacity` override it. `children` render on top, undimmed.
 *
 * Renders as an absolute fill — place it inside a Modal or a positioned parent.
 */
export default function Overlay({
  visible = true,
  onPress,
  color = overlay.color,
  opacity = overlay.opacity,
  children,
  style,
  ...rest
}) {
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, style]} {...rest}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity }]}
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : 'none'}
        accessibilityLabel={onPress ? 'Dismiss' : undefined}
        testID="overlay-scrim"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
});
