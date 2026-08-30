import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Badge, ButtonIcon, Icon, List, ListItem, SwipeableRow } from '../components';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';

function TaskActions({ close, onAdjust, onSnooze, onDone, styles, t }) {
  const act = (fn) => () => {
    close();
    fn?.();
  };
  return (
    <View style={styles.actionsRow}>
      <View style={styles.action}>
        <ButtonIcon
          size="lg"
          variant="outline"
          accessibilityLabel="Adjust task"
          icon={<Icon name="settings" size={20} color={t.text.primary} />}
          onPress={act(onAdjust)}
        />
        <Text style={styles.actionLabel}>Adjust</Text>
      </View>
      <View style={styles.action}>
        <ButtonIcon
          size="lg"
          variant="outline"
          accessibilityLabel="Snooze task"
          icon={<Icon name="clock" size={20} color={t.text.primary} />}
          onPress={act(onSnooze)}
        />
        <Text style={styles.actionLabel}>Snooze</Text>
      </View>
      <View style={styles.action}>
        <ButtonIcon
          size="lg"
          variant="primary"
          accessibilityLabel="Mark task done"
          icon={<Icon name="check" size={20} color={t.brand.onPrimary} />}
          onPress={act(onDone)}
        />
        <Text style={styles.actionLabel}>Done</Text>
      </View>
    </View>
  );
}

export default function TaskCard({ task, onPress, onDone, onAdjust, onSnooze }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const card = (
    <List variant="card">
      <ListItem
        onPress={onPress}
        before={<Image source={task.photo} style={styles.thumb} />}
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

  if (!onDone) return card;

  return (
    <SwipeableRow
      renderActions={(close) => (
        <TaskActions
          close={close}
          onAdjust={onAdjust}
          onSnooze={onSnooze}
          onDone={onDone}
          styles={styles}
          t={t}
        />
      )}
    >
      {card}
    </SwipeableRow>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    thumb: { width: 56, height: 56, borderRadius: radius[12] },
    rowAfter: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    actionsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[12] },
    action: { alignItems: 'center', gap: space[4], width: 56 },
    actionLabel: { ...typography.buttonSmall, color: t.text.primary },
  });
