import { Children, cloneElement, isValidElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { list } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

/**
 * List — vertical stack of ListItems, imported from Figma "List – P2" (List Group).
 *
 * Style=List renders items edge-to-edge; Style=Card wraps them in a grey rounded
 * panel. The `variant` is propagated to child <ListItem>s so their padding and
 * pressed colour match. Compose with <ListItem> children.
 */
export default function List({ variant = 'list', children, style, ...rest }) {
  const t = useTheme();
  const items = Children.map(children, (child) =>
    isValidElement(child) && child.props.variant == null
      ? cloneElement(child, { variant })
      : child
  );

  return (
    <View
      accessibilityRole="list"
      style={[
        variant === 'card' ? styles.card : styles.plain,
        variant === 'card' && { backgroundColor: t.surface.primary },
        style,
      ]}
      {...rest}
    >
      {items}
    </View>
  );
}

const styles = StyleSheet.create({
  plain: { alignSelf: 'stretch' },
  card: {
    alignSelf: 'stretch',
    borderRadius: list.cardRadius,
    overflow: 'hidden',
  },
});
