import { StyleSheet, Text, View } from 'react-native';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Badge — Cultum's small status pill, imported from Figma "Badge – P2".
 *
 * A non-interactive label used to tag or annotate content (counts, statuses,
 * "New", "Beta"). Figma models it on four axes; this primitive maps them to
 * props:
 *
 *   Figma Function → `intent`:  neutral | positive | negative
 *   Figma Style    → `variant`: primary | secondary | outline | ghost
 *                                (Figma "No background" → ghost, matching <Button>)
 *   Figma Size     → `size`:    sm (16) | md (20) | lg (24)   — pill height
 *   Figma Type     → derived from props: leftIcon / rightIcon / icon-only / label
 *
 * intent picks the colour family; variant picks how it is applied:
 *   primary   → filled pill        secondary → tinted pill
 *   outline   → hairline + text    ghost     → text only, no chrome
 */

// Each intent's colour family, resolved from the active theme:
//   solid/onSolid — Style=Primary; soft/softInk — Style=Secondary;
//   line — the hairline and text of Outlined / No background.
function families(t) {
  return {
    neutral: {
      solid: t.brand.primary,
      onSolid: t.brand.onPrimary,
      soft: t.brand.secondary,
      softInk: t.brand.onSecondary,
      line: t.brand.primary,
    },
    positive: {
      solid: t.success.primary,
      onSolid: t.success.onPrimary,
      soft: t.success.secondary,
      softInk: t.success.onSecondary,
      line: t.success.primary,
    },
    negative: {
      solid: t.error.primary,
      onSolid: t.error.onPrimary,
      soft: t.error.secondary,
      softInk: t.error.onSecondary,
      line: t.error.primary,
    },
  };
}

const VARIANTS = {
  primary: (c) => ({ bg: c.solid, fg: c.onSolid }),
  secondary: (c) => ({ bg: c.soft, fg: c.softInk }),
  outline: (c) => ({
    bg: 'transparent',
    fg: c.line,
    border: { borderWidth: 1, borderColor: c.line },
  }),
  ghost: (c) => ({ bg: 'transparent', fg: c.line }),
};

// Pill height per size; label stays Body/Body Small (12px) across all three.
const SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
};

export default function Badge({
  label,
  children,
  intent = 'neutral',
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
  ...rest
}) {
  const t = useTheme();
  const all = families(t);
  const family = all[intent] || all.neutral;
  const v = (VARIANTS[variant] || VARIANTS.primary)(family);
  const height = SIZES[size] || SIZES.md;

  const content = children ?? label;
  const hasText = content != null && content !== '';
  const iconOnly = !hasText && (leftIcon || rightIcon);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={
        accessibilityLabel ?? (typeof content === 'string' ? content : undefined)
      }
      style={[
        styles.base,
        {
          height,
          minWidth: iconOnly ? height : undefined,
          backgroundColor: v.bg,
          paddingHorizontal: iconOnly ? 0 : 8,
        },
        v.border,
        style,
      ]}
      {...rest}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      {hasText ? (
        typeof content === 'string' ? (
          <Text
            numberOfLines={1}
            style={[styles.label, { color: v.fg }, textStyle]}
          >
            {content}
          </Text>
        ) : (
          content
        )
      ) : null}
      {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    gap: 2,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontSize: 12, // Figma "Body/Body Small"
    fontWeight: '400',
    lineHeight: 14,
  },
});
