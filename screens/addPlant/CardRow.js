// The card row both the room and reminder steps are built from (Figma "List
// Item", Style=Card): a 40px icon tile, a title + optional subtitle, and a
// trailing control — each row its own surface-primary card at radius 16, with 8px
// between them.
//
// Not <List variant="card">: that primitive wraps its children in ONE panel,
// where this design gives every row a card of its own.

import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, ListItem } from '../../components';
import { list } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

export function IconTile({ name }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={styles.tile}>
      <Icon name={name} size={20} color={t.text.primary} />
    </View>
  );
}

export default function CardRow({ icon, title, subtitle, after, onPress, ...rest }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <ListItem
      variant="card"
      style={styles.card}
      before={<IconTile name={icon} />}
      title={title}
      subtitle={subtitle}
      after={after}
      onPress={onPress}
      {...rest}
    />
  );
}

const makeStyles = (t) => StyleSheet.create({
  card: { backgroundColor: t.surface.primary, borderRadius: list.cardRadius },
  tile: {
    width: list.beforeBadgeSize,
    height: list.beforeBadgeSize,
    borderRadius: 9999,
    backgroundColor: t.brand.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
