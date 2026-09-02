import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Dialog, Icon, SegmentedControl, State, TabBar } from '../components';
import { useRouter } from '../routing';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';
import { EMPTY, GREETING, GROUPINGS, NEXT_UP, SEGMENTS, TABS, TODAY_GROUPS, UPCOMING_TASKS } from './todayData';
import TaskCard from './TaskCard';
import TaskSheet from './TaskSheet';
import GroupingButton from './GroupingButton';

// Flatten the seed groups into a single task list, tagging each task with its
// task-type (for "By Task") — room already lives on the task (for "By Room").
const ALL_TASKS = TODAY_GROUPS.flatMap((g) =>
  g.tasks.map((task) => ({ ...task, typeKey: g.key, typeHeader: g.header }))
);

// Bucket the flat task list into display groups for the active grouping,
// preserving first-seen order. `header: null` renders a headerless flat list.
function buildGroups(tasks, grouping) {
  if (tasks.length === 0) return [];
  if (grouping === 'none') return [{ key: 'all', header: null, tasks }];
  const keyOf = grouping === 'room' ? (t) => t.room : (t) => t.typeHeader;
  const order = [];
  const byKey = new Map();
  for (const task of tasks) {
    const k = keyOf(task);
    if (!byKey.has(k)) {
      byKey.set(k, []);
      order.push(k);
    }
    byKey.get(k).push(task);
  }
  return order.map((k) => ({ key: k, header: k, tasks: byKey.get(k) }));
}

// "Fri, Aug 21" — formatted by hand rather than via Intl/toLocaleDateString,
// whose options aren't reliably honored on Hermes across platforms.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDayHeader = (date) =>
  `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;

// Bucket the Upcoming tasks by due day, sorted soonest-first. Each group's
// header is the real calendar date (today + inDays), and each card's due badge
// reads "In Nd".
function buildUpcomingGroups(tasks) {
  const now = new Date();
  const order = [];
  const byDay = new Map();
  for (const task of tasks) {
    if (!byDay.has(task.inDays)) {
      const date = new Date(now);
      date.setDate(now.getDate() + task.inDays);
      byDay.set(task.inDays, { key: String(task.inDays), header: formatDayHeader(date), tasks: [] });
      order.push(task.inDays);
    }
    byDay.get(task.inDays).tasks.push({ ...task, due: `In ${task.inDays}d` });
  }
  return order.sort((a, b) => a - b).map((k) => byDay.get(k));
}

// One display group: an optional header + a stack of individual TaskCards.
// `header` is null for the "None" grouping, giving a flat headerless list.
function TaskGroup({ group, onComplete, onOpen, onAdjust, onSnooze, styles }) {
  return (
    <View style={styles.group}>
      {group.header ? <Text style={styles.groupHeader}>{group.header}</Text> : null}
      {group.tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onPress={onOpen ? () => onOpen(task) : undefined}
          onDone={onComplete ? () => onComplete(task.id) : undefined}
          onAdjust={onAdjust ? () => onAdjust(task) : undefined}
          onSnooze={onSnooze ? () => onSnooze(task) : undefined}
        />
      ))}
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
  const [tasks, setTasks] = useState(ALL_TASKS);
  const [grouping, setGrouping] = useState('task');
  const [confirmAll, setConfirmAll] = useState(false);
  // Task detail sheet: `sheetTask` persists through the slide-out (kept while
  // `sheetOpen` is false) so the content doesn't blank mid-animation.
  const [sheetTask, setSheetTask] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Which page the sheet opens on: tapping a card lands on 'detail', the swipe
  // "Snooze" action opens straight on the 'snooze' step.
  const [sheetStep, setSheetStep] = useState('detail');
  const openSheet = (task) => {
    setSheetTask(task);
    setSheetStep('detail');
    setSheetOpen(true);
  };
  const openSnooze = (task) => {
    setSheetTask(task);
    setSheetStep('snooze');
    setSheetOpen(true);
  };
  const closeSheet = () => setSheetOpen(false);
  // A task's "Adjust" (swipe action) and the sheet's "Reminder settings" gear
  // both jump to that plant's notification settings (the Edit Reminders screen).
  const openReminders = (task) => navigate('reminders', { plantName: task?.plant });

  const taskCount = tasks.length;
  const groups = useMemo(() => buildGroups(tasks, grouping), [tasks, grouping]);
  const upcomingGroups = useMemo(() => buildUpcomingGroups(UPCOMING_TASKS), []);

  const completeTask = (id) => setTasks((ts) => ts.filter((task) => task.id !== id));
  const completeAll = () => {
    setTasks([]);
    setConfirmAll(false);
  };

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
          <View style={styles.segLabel}>
            <Text style={styles.segLabelText}>{s.label}</Text>
            <View style={styles.segCount}>
              <Text style={styles.segCountText}>{String(s.count)}</Text>
            </View>
          </View>
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

          {segment === 'today' && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today’s tasks</Text>
              <Button
                label="Complete All"
                variant="outline"
                size="sm"
                fullWidth={false}
                disabled={taskCount === 0}
                onPress={() => setConfirmAll(true)}
              />
            </View>
          )}

          {segment === 'today' && groups.length > 0 && (
            <View style={styles.groups}>
              {groups.map((group) => (
                <TaskGroup
                  key={group.key}
                  group={group}
                  onComplete={completeTask}
                  onOpen={openSheet}
                  onAdjust={openReminders}
                  onSnooze={openSnooze}
                  styles={styles}
                />
              ))}
            </View>
          )}

          {segment === 'today' && groups.length === 0 && (
            <View style={styles.empty}>
              <State
                icon={<Icon name="check-all" size={28} color={t.text.primary} />}
                iconVariant="secondary"
                title={EMPTY.title}
                subtitle={EMPTY.subtitle}
              />
              <View style={styles.group}>
                <Text style={styles.nextUpHeader}>Next up</Text>
                {/* Preview only — no onDone, so it's a plain (non-swipeable) card. */}
                <TaskCard task={NEXT_UP} />
              </View>
            </View>
          )}

          {/* Upcoming: future tasks grouped by due day (date headers), no
              section header / complete-all / grouping — plain cards. Tapping a
              card jumps straight to the plant page (no task detail sheet). */}
          {segment === 'upcoming' && (
            <View style={styles.groups}>
              {upcomingGroups.map((group) => (
                <TaskGroup
                  key={group.key}
                  group={group}
                  onOpen={() => navigate('product')}
                  styles={styles}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom }]}>
        {/* Grouping control is a Today-only affordance; Upcoming groups by day. */}
        {segment === 'today' ? (
          <View style={styles.groupingRow}>
            <GroupingButton value={grouping} onChange={setGrouping} options={GROUPINGS} />
          </View>
        ) : null}
        <TabBar
          tabs={tabBarTabs}
          value="today"
          onChange={(value) => {
            if (value === 'scan') navigate('scan-camera');
            if (value === 'settings') navigate('settings');
          }}
        />
      </View>

      <Dialog
        visible={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Complete all?"
        description={`This action will complete all ${taskCount} today’s tasks.`}
        primaryAction={{ label: `Complete ${taskCount} tasks`, onPress: completeAll }}
        secondaryAction={{ label: 'Cancel', onPress: () => setConfirmAll(false) }}
      />

      <TaskSheet
        task={sheetTask}
        visible={sheetOpen}
        initialStep={sheetStep}
        onClose={closeSheet}
        onMarkDone={() => {
          if (sheetTask) completeTask(sheetTask.id);
          closeSheet();
        }}
        onSnoozeConfirm={() => {
          // Mock: a snoozed task leaves today's list (no real reschedule yet).
          if (sheetTask) completeTask(sheetTask.id);
          closeSheet();
        }}
        onOpenPlant={() => {
          closeSheet();
          navigate('product');
        }}
        onSettings={() => {
          const task = sheetTask;
          closeSheet();
          openReminders(task);
        }}
      />
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
      marginBottom: space[16]
    },
    content: { paddingHorizontal: space[16], gap: space[24] },
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
    empty: { gap: space[24] },
    nextUpHeader: { ...typography.headingSmallEmphasized, color: t.text.primary },
    bottom: { alignItems: 'center', backgroundColor: t.background.primary },
    groupingRow: { alignItems: 'center', paddingVertical: space[8] },
    // Label for the "Today" segment: text + a count badge, laid out as a row.
    segLabel: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    segLabelText: { fontSize: 14, fontWeight: '500', color: t.text.primary },
    // The count badge — a View so padding + full radius render as a real pill
    // (a Text background on iOS hugs the glyphs and ignores padding/radius).
    segCount: {
      backgroundColor: t.brand.primary,
      borderRadius: radius.full,
      paddingHorizontal: space[8],
      paddingVertical: space[2],
      alignItems: 'center',
      justifyContent: 'center',
    },
    segCountText: { ...typography.captionEmphasized, color: t.brand.onPrimary },
  });
