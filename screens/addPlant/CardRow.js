// The card row both the room and reminder steps are built from (Figma "List
// Item", Style=Card): a 40px icon tile, a title + optional subtitle, and a
// trailing control — each row its own #ECEDEC card at radius 16, with 8px
// between them.
//
// Not <List variant="card">: that primitive wraps its children in ONE panel,
// where this design gives every row a card of its own.

import { StyleSheet, View } from 'react-native';
import { Icon, ListItem } from '../../components';
import { list } from '../../theme/tokens';

export function IconTile({ name }) {
  return (
    <View style={styles.tile}>
      <Icon name={name} size={20} color={list.titleInk} />
    </View>
  );
}

export default function CardRow({ icon, title, subtitle, after, onPress, ...rest }) {
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

const styles = StyleSheet.create({
  card: { backgroundColor: list.cardBg, borderRadius: list.cardRadius },
  tile: {
    width: list.beforeBadgeSize,
    height: list.beforeBadgeSize,
    borderRadius: 9999,
    backgroundColor: list.beforeBadgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
