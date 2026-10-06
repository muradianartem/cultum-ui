import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Badge, Icon, List, ListItem } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/foundations';

export default function TaskCard({ task, onPress }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <List variant="card">
      <ListItem
        onPress={onPress}
        before={
          <View style={styles.thumbWrap}>
            <Image source={task.photo} style={styles.thumb} />
            {/* Task-type badge on the photo's corner (Figma 667:4471); the
                card-coloured ring cuts it out of the photo. */}
            <Badge
              size="lg"
              intent="neutral"
              variant="primary"
              leftIcon={<Icon name={task.icon} size={16} color={t.brand.onPrimary} />}
              accessibilityLabel={task.typeHeader}
              style={styles.typeBadge}
            />
          </View>
        }
        title={task.title}
        subtitle={`${task.plant} · ${task.room}`}
        after={
          <View style={styles.rowAfter}>
            <Badge
              label={task.due}
              intent="neutral"
              variant="secondary"
              leftIcon={<Icon name="clock" size={14} color={t.text.primary} />}
            />
            <Icon name="chevron-right" size={20} color={t.text.primary} />
          </View>
        }
      />
    </List>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    thumbWrap: { width: 56, height: 56 },
    thumb: { width: 56, height: 56, borderRadius: radius[12] },
    typeBadge: {
      position: 'absolute',
      right: -5,
      bottom: -4,
      borderWidth: 2,
      borderColor: t.surface.primary,
    },
    rowAfter: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  });
