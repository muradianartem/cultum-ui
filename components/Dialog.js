import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { shadow } from '../theme/tokens';
import { typography } from '../theme/foundations';
import { useTheme } from '../theme/ThemeProvider';
import Overlay from './Overlay';
import Button from './Button';
import Icon from './Icon';

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
  const t = useTheme();
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
        <Pressable style={[styles.card, { backgroundColor: t.background.primary }]} accessibilityViewIsModal onPress={() => { }}>
          {showClose && onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.close, { backgroundColor: t.brand.secondary }]}
              testID="dialog-close"
            >
              <Icon name="close" size={20} color={t.text.primary} />
            </Pressable>
          ) : null}

          <View style={styles.textBlock}>
            {statusIcon ? <View style={[styles.statusIcon, { backgroundColor: t.brand.secondary }]}>{statusIcon}</View> : null}
            {title ? <Text style={[styles.title, { color: t.text.primary }]}>{title}</Text> : null}
            {description ? <Text style={[styles.description, { color: t.text.secondary }]}>{description}</Text> : null}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  // The design system has no Dialog component; the title is Heading Medium
  // Emphasized, the named style matching its size and weight.
  title: { ...typography.headingMediumEmphasized, textAlign: 'center' },
  // Bottom Sheet's description (Inter 16/24, not a named style). See
  // design-system/exceptions.json.
  description: { ...typography.bodyLarge, lineHeight: 24, textAlign: 'center' },
  actions: { gap: 12 },
});
