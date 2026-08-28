import { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Icon, List, ListItem, SegmentedControl, State, TabBar } from '../components';
import { useRouter } from '../routing';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';
import { EMPTY, GREETING, NEXT_UP, SEGMENTS, TABS, TODAY_GROUPS } from './todayData';

// One task row: rounded-square plant photo + title + "plant · room" + a due
// badge (clock) and a chevron.
function TaskRow({ task, onComplete, divider, styles, t }) {
  return (
    <ListItem
      onPress={onComplete}
      divider={divider}
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
  );
}

// One task-type group: a header + a card of task rows.
function TaskGroup({ group, onComplete, styles, t }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{group.header}</Text>
      <List variant="card">
        {group.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            task={task}
            divider={i < group.tasks.length - 1}
            onComplete={() => onComplete(group.key, task.id)}
            styles={styles}
            t={t}
          />
        ))}
      </List>
    </View>
  );
}

// The "Today" home screen — the post-login landing. Composed from the Cultum
// primitives and themed via useTheme() (light/dark), sizing/spacing from
// theme/foundations. Mirrors screens/ProductPage.js.
export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [segment, setSegment] = useState('today');
  const [groups, setGroups] = useState(TODAY_GROUPS);

  // Remove a completed task; drop a group once its last task is done.
  const completeTask = (groupKey, id) =>
    setGroups((gs) =>
      gs
        .map((g) =>
          g.key === groupKey
            ? { ...g, tasks: g.tasks.filter((task) => task.id !== id) }
            : g
        )
        .filter((g) => g.tasks.length > 0)
    );

  // TabBar wants icon nodes; resolve each tab's icon name to an <Icon>.
  const tabBarTabs = TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: <Icon name={tab.icon} size={24} color={t.text.primary} />,
  }));

  // Today's label carries a small green count pill; Upcoming is a plain label.
  const segments = SEGMENTS.map((s) =>
    s.count
      ? {
          value: s.value,
          label: (
            <Text>
              {s.label} <Text style={styles.segCount}>{String(s.count)}</Text>
            </Text>
          ),
        }
      : { label: s.label, value: s.value }
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + space[8], paddingBottom: space[24] }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>
          {`${GREETING.salutation}, ${GREETING.name}`}
        </Text>

        <View style={styles.content}>
          <SegmentedControl
            segments={segments}
            value={segment}
            onChange={setSegment}
            style={styles.segment}
          />

          {segment === 'today' ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today’s tasks</Text>
              <Button
                label="Complete All"
                variant="outline"
                size="sm"
                fullWidth={false}
                onPress={() => setGroups([])}
              />
            </View>
          ) : null}

          {segment === 'today' && groups.length > 0 ? (
            <View style={styles.groups}>
              {groups.map((group) => (
                <TaskGroup
                  key={group.key}
                  group={group}
                  onComplete={completeTask}
                  styles={styles}
                  t={t}
                />
              ))}
            </View>
          ) : null}

          {segment === 'today' && groups.length === 0 ? (
            <View style={styles.empty}>
              <State
                icon={<Icon name="check-all" size={28} color={t.text.primary} />}
                iconVariant="secondary"
                title={EMPTY.title}
                subtitle={EMPTY.subtitle}
              />
              <View style={styles.group}>
                <Text style={styles.nextUpHeader}>Next up</Text>
                <List variant="card">
                  <TaskRow task={NEXT_UP} onComplete={() => {}} styles={styles} t={t} />
                </List>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Grouping pill + tab bar, pinned above the safe-area inset. */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom }]}>
        <View style={styles.groupingRow}>
          <Button
            label="Grouping: By Task"
            variant="outline"
            size="sm"
            fullWidth={false}
            rightIcon={<Icon name="outlined-arrow-more" size={16} color={t.text.primary} />}
            onPress={() => {}}
          />
        </View>
        <TabBar
          tabs={tabBarTabs}
          value="today"
          onChange={(value) => {
            if (value === 'scan') navigate('scan-camera');
          }}
        />
      </View>
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },
    greeting: {
      ...typography.headingLarge,
      color: t.text.primary,
      paddingHorizontal: space[16],
    },
    content: { paddingHorizontal: space[16], paddingTop: space[24], gap: space[24] },
    segment: { alignSelf: 'stretch' },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: { ...typography.headingMedium, color: t.text.primary },
    groups: { gap: space[16] },
    group: { gap: space[12] },
    groupHeader: { ...typography.headingSmall, color: t.text.primary },
    thumb: { width: 56, height: 56, borderRadius: radius[12] },
    rowAfter: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    empty: { gap: space[24] },
    nextUpHeader: { ...typography.headingSmallEmphasized, color: t.text.primary },
    bottom: { backgroundColor: t.background.primary },
    groupingRow: { alignItems: 'center', paddingVertical: space[8] },
    segCount: {
      ...typography.captionEmphasized,
      color: t.brand.onPrimary,
      backgroundColor: t.brand.primary,
      borderRadius: radius.full,
      paddingHorizontal: space[8],
    },
  });
