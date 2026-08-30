import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, sheet, shadow, fonts } from '../theme/tokens';
import Overlay from './Overlay';
import Button from './Button';

export default function Dialog({
  visible,
  onClose,
  title,
  description,
  statusIcon,
  primaryAction,
  secondaryAction,
  showClose = true,
  children,
  testID,
  ...rest
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
      {...rest}
    >
      <Overlay onPress={onClose} style={styles.overlay}>
        {/* Stop scrim taps from closing when they land on the card itself. */}
        <Pressable style={styles.card} accessibilityViewIsModal onPress={() => { }}>
          {showClose && onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.close}
              testID="dialog-close"
            >
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          ) : null}

          <View style={styles.textBlock}>
            {statusIcon ? <View style={styles.statusIcon}>{statusIcon}</View> : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>

          {children}

          {primaryAction || secondaryAction ? (
            <View style={styles.actions}>
              {primaryAction ? (
                <Button
                  variant="primary"
                  size="lg"
                  label={primaryAction.label}
                  onPress={primaryAction.onPress}
                  {...primaryAction}
                />
              ) : null}
              {secondaryAction ? (
                <Button
                  variant="outline"
                  size="lg"
                  label={secondaryAction.label}
                  onPress={secondaryAction.onPress}
                  {...secondaryAction}
                />
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Overlay>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { paddingHorizontal: 24 },
  card: {
    alignSelf: 'stretch',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    paddingTop: 32,
    gap: 24,
    ...shadow.float,
  },
  close: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: sheet.closeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { fontSize: 15, color: sheet.titleInk, lineHeight: 18 },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: sheet.statusIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  title: {
    fontFamily: fonts.display, // serif, matching the app's titles
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: sheet.titleInk,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: sheet.bodyInk,
    textAlign: 'center',
  },
  actions: { gap: 12 },
});
