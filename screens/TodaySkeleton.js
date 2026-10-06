// The Today screen while the garden's first load is in flight (Figma
// "Today / Loading", 737:15483): the real greeting, segment control and tab
// bar, with placeholder task cards where the list will be.
//
// Laid out with TodayScreen's own paddings and gaps so the real screen lands
// on top of it without anything jumping.

import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, SegmentedControl, Skeleton, TabBar, useSkeletonPulse } from '../components';
import { useGarden } from '../store/GardenProvider';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';
import { TABS, salutation } from './navConfig';

// Cards per placeholder group, as drawn.
const GROUPS = [2, 2, 1];

const SEGMENTS = [
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
];

const noop = () => {};

function SkeletonTaskCard({ pulse, styles }) {
  return (
    <View style={styles.card} testID="skeleton-task-card">
      <Skeleton width={56} height={56} radius={radius[12]} pulse={pulse} />
      <View style={styles.cardText}>
        <Skeleton width={128} height={20} radius={radius.full} pulse={pulse} />
        <Skeleton width={195} height={12} radius={radius.full} pulse={pulse} />
      </View>
    </View>
  );
}

export default function TodaySkeleton() {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const garden = useGarden();
  const pulse = useSkeletonPulse();

  const greeting = [salutation(garden.now), garden.profileName].filter(Boolean).join(', ');
  const tabBarTabs = TABS.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: <Icon name={tab.icon} size={24} color={t.text.primary} />,
  }));

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + space[8], paddingBottom: space[24] }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greeting}>{greeting}</Text>
        <View style={styles.content}>
          <SegmentedControl segments={SEGMENTS} value="today" onChange={noop} style={styles.segment} />
          <View
            style={styles.groups}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Loading your garden"
          >
            {GROUPS.map((count, g) => (
              <View key={g} style={styles.group}>
                {/* One Heading Small line (20/26) where the group header goes. */}
                <Skeleton width={96} height={26} radius={radius.full} pulse={pulse} />
                {Array.from({ length: count }, (_, i) => (
                  <SkeletonTaskCard key={i} pulse={pulse} styles={styles} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom }]}>
        <TabBar tabs={tabBarTabs} value="today" onChange={noop} />
      </View>
    </View>
  );
}

// Screen-level values mirror TodayScreen's makeStyles.
const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },
    greeting: {
      ...typography.headingLarge,
      color: t.text.primary,
      paddingHorizontal: space[16],
      marginBottom: space[16],
    },
    content: { paddingHorizontal: space[16], gap: space[24] },
    segment: { alignSelf: 'stretch' },
    groups: { gap: space[16] },
    group: { gap: space[12] },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[12],
      padding: space[12],
      borderRadius: radius[16],
      backgroundColor: t.surface.primary,
    },
    cardText: { flex: 1, gap: space[8] },
    bottom: { alignItems: 'center', backgroundColor: t.background.primary },
  });
