import { useMemo, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Badge,
  Button,
  DropdownMenu,
  Icon,
  ICON_NAMES,
  List,
  ListItem,
  Overlay,
  SegmentedControl,
} from '../components';
import { useRouter } from '../routing';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, stroke, typography } from '../theme/foundations';
import {
  CARE_FACTS,
  CHIPS,
  FAQ,
  HERO,
  NEXT_REMINDER,
  PHOTOS,
  PLANT,
  TODAYS_TASKS,
} from './plantData';

// Hero chrome sits over a photograph, so these treatments are theme-independent
// (they must read the same in light and dark). Everything else is themed.
const HERO_FALLBACK = '#0E120B';
const HERO_SCRIM = 'rgba(21,23,20,0.28)';
const HERO_GRADIENT_TOP = 'rgba(21,23,20,0)';
const HERO_GRADIENT_BOTTOM = '#151714';
const GLASS = 'rgba(250,250,250,0.18)';
const GLASS_PRESSED = 'rgba(250,250,250,0.34)';
const GLASS_BORDER = 'rgba(250,250,250,0.6)';
const OVER_PHOTO_TEXT = '#FFFFFF';
const OVER_PHOTO_SUBTLE = '#DADBDA';

// Renders a Cultum <Icon> when `name` is a known icon, else falls back to the
// raw value as text (for the few care/task glyphs the icon set lacks, e.g. the
// temperature emoji).
function Glyph({ name, size = 24, color, textStyle }) {
  if (ICON_NAMES.includes(name)) {
    return <Icon name={name} size={size} color={color} />;
  }
  return <Text style={[{ fontSize: size, color }, textStyle]}>{name}</Text>;
}

// Circular translucent nav button floating over the hero image.
function NavButton({ icon, label, onPress, styles }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
    >
      <Icon name={icon} size={20} color={OVER_PHOTO_TEXT} />
    </Pressable>
  );
}

// One tile of the care grid: icon over a bold label over a caption value.
function CareFact({ icon, label, value, styles, t }) {
  return (
    <View style={styles.careFact}>
      <Glyph name={icon} size={24} color={t.text.primary} textStyle={styles.careIcon} />
      <Text style={styles.careLabel}>{label}</Text>
      <Text style={styles.careValue}>{value}</Text>
    </View>
  );
}

// A single expand/collapse FAQ row.
function AccordionItem({ question, answer, open, onToggle, styles, t }) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={!answer}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={styles.accItem}
    >
      <View style={styles.accText}>
        <Text style={styles.accQuestion}>{question}</Text>
        {open && answer ? <Text style={styles.accAnswer}>{answer}</Text> : null}
      </View>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={24} color={t.text.primary} />
    </Pressable>
  );
}

// One "Today's tasks" row. The icon tile's colours come from the task's semantic
// `tone` (information/warning) resolved against the theme, so it follows dark/light.
function TaskRow({ task, onPress, styles, t }) {
  const tone = t[task.tone] || t.information;
  return (
    <List variant="card">
      <ListItem
        onPress={onPress}
        before={
          <View style={[styles.taskTile, { backgroundColor: tone.secondary }]}>
            <Glyph name={task.icon} size={20} color={tone.primary} textStyle={styles.taskGlyph} />
          </View>
        }
        title={task.title}
        subtitle={task.subtitle}
        after={
          <View style={styles.taskAfter}>
            <Badge
              label={task.due}
              variant="secondary"
              leftIcon={<Icon name="clock" size={14} color={t.text.secondary} />}
            />
            <Icon name="chevron-right" size={20} color={t.text.primary} />
          </View>
        }
      />
    </List>
  );
}

// A titled content block (matches the Figma "Section ·" frames).
function Section({ title, action, children, styles }) {
  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeader}>
          <Text style={styles.heading}>{title}</Text>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export default function ProductPage() {
  const insets = useSafeAreaInsets();
  const { navigate } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  const [added, setAdded] = useState(false);
  const [tasks, setTasks] = useState(TODAYS_TASKS);
  const [segment, setSegment] = useState('about');
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const completeTask = (id) => setTasks((t) => t.filter((task) => task.id !== id));

  const overflowItems = [
    { title: 'Rename plant', onPress: () => setMenuOpen(false) },
    { title: 'Move to another room', onPress: () => setMenuOpen(false) },
    { title: 'Notification settings', onPress: () => setMenuOpen(false) },
    {
      title: 'Remove from my plants',
      onPress: () => {
        setMenuOpen(false);
        setAdded(false);
        setTasks(TODAYS_TASKS);
      },
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: space[24] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <ImageBackground source={HERO} style={styles.hero} resizeMode="cover">
          <View style={styles.heroScrim} pointerEvents="none" />
          <LinearGradient
            colors={[HERO_GRADIENT_TOP, HERO_GRADIENT_BOTTOM]}
            style={styles.heroGradient}
            pointerEvents="none"
          />

          <View style={[styles.navRow, { top: insets.top + space[8] }]}>
            <NavButton icon="chevron-left" label="Back" onPress={() => {}} styles={styles} />
            <View style={styles.navRight}>
              {added ? (
                <>
                  <NavButton icon="settings" label="Settings" onPress={() => {}} styles={styles} />
                  <NavButton
                    icon="more-horizontal"
                    label="More options"
                    onPress={() => setMenuOpen(true)}
                    styles={styles}
                  />
                </>
              ) : (
                <NavButton icon="bookmark" label="Save" onPress={() => {}} styles={styles} />
              )}
            </View>
          </View>

          <View style={styles.heroText}>
            <View style={styles.chips}>
              {CHIPS.map((c) => (
                <Badge
                  key={c.label}
                  label={c.label}
                  intent={c.intent}
                  variant="secondary"
                  leftIcon={<Icon name={c.icon} size={16} color={t.text.primary} />}
                />
              ))}
            </View>
            <Text style={styles.heroTitle}>{PLANT.commonName}</Text>
            <Text style={styles.heroSubtitle}>{PLANT.latinName}</Text>
          </View>
        </ImageBackground>

        {/* ── Content ──────────────────────────────────────────── */}
        <View style={styles.content}>
          {added ? (
            <>
              {/* Today's tasks */}
              <Section title="Today’s tasks" styles={styles}>
                {tasks.length > 0 ? (
                  <View style={styles.taskList}>
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onPress={() => completeTask(task.id)}
                        styles={styles}
                        t={t}
                      />
                    ))}
                  </View>
                ) : (
                  <List variant="card">
                    <ListItem
                      before={
                        <View style={styles.doneIcon}>
                          <Icon name="check" size={20} color={t.brand.onPrimary} />
                        </View>
                      }
                      title="All caught up"
                      subtitle={NEXT_REMINDER}
                      after={<Icon name="chevron-right" size={20} color={t.text.primary} />}
                      onPress={() => {}}
                    />
                  </List>
                )}
              </Section>

              {/* Your plant */}
              <Section title="Your plant" styles={styles}>
                <SegmentedControl
                  segments={[
                    { label: 'About', value: 'about' },
                    { label: 'Journal', value: 'journal' },
                  ]}
                  value={segment}
                  onChange={setSegment}
                  style={styles.segment}
                />
                {segment === 'about' ? (
                  <Text style={styles.bodyText}>{PLANT.about}</Text>
                ) : (
                  <Text style={styles.bodyText}>
                    No journal entries yet. Care you log — waterings, repottings,
                    new leaves — will show up here.
                  </Text>
                )}
              </Section>
            </>
          ) : (
            <>
              {/* Owned banner */}
              <List variant="card">
                <ListItem
                  before={
                    <View style={styles.ownedIcon}>
                      <Icon name="check" size={20} color={t.brand.onPrimary} />
                    </View>
                  }
                  title={PLANT.owned.title}
                  subtitle={PLANT.owned.subtitle}
                  after={<Icon name="chevron-right" size={20} color={t.text.primary} />}
                  onPress={() => {}}
                />
              </List>

              {/* About */}
              <View style={styles.section}>
                <Text style={styles.bodyText}>{PLANT.about}</Text>
              </View>
            </>
          )}

          {/* How to care */}
          <Section title="How to care" styles={styles}>
            <View style={styles.careGrid}>
              <View style={styles.careRow}>
                <CareFact {...CARE_FACTS[0]} styles={styles} t={t} />
                <CareFact {...CARE_FACTS[1]} styles={styles} t={t} />
              </View>
              <View style={styles.careRow}>
                <CareFact {...CARE_FACTS[2]} styles={styles} t={t} />
                <CareFact {...CARE_FACTS[3]} styles={styles} t={t} />
              </View>
            </View>
          </Section>

          {/* V2: Gallery section — deferred with the full-screen photo viewer
              (ImageViewer). "View All" → navigate('premium-gallery'); each photo
              → navigate('image-viewer', { index: i }). Re-enable together in V2. */}

          {/* FAQ */}
          <Section title="FAQ" styles={styles}>
            <View style={styles.accordionList}>
              {FAQ.map((item, i) => (
                <View key={i} style={styles.accordion}>
                  <AccordionItem
                    question={item.q}
                    answer={item.a}
                    open={openFaq === i}
                    onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
                    styles={styles}
                    t={t}
                  />
                </View>
              ))}
            </View>
          </Section>
        </View>
      </ScrollView>

      {/* ── Sticky CTA (only before the plant is added) ────────── */}
      {!added ? (
        <View style={[styles.cta, { paddingBottom: space[16] + insets.bottom }]}>
          <Button
            label="Add to my plants"
            size="lg"
            onPress={() => setAdded(true)}
            leftIcon={<Icon name="add" size={20} color={t.brand.onPrimary} />}
          />
        </View>
      ) : null}

      {/* ── Overflow menu ──────────────────────────────────────── */}
      {menuOpen ? (
        <Overlay onPress={() => setMenuOpen(false)} color="transparent" opacity={1}>
          <View style={[styles.menuAnchor, { top: insets.top + 52 }]}>
            <DropdownMenu items={overflowItems} />
          </View>
        </Overlay>
      ) : null}
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },

    // ── Hero ── (photo treatments are theme-independent)
    hero: {
      height: 353,
      paddingHorizontal: space[16],
      paddingBottom: 25,
      justifyContent: 'flex-end',
      backgroundColor: HERO_FALLBACK,
    },
    heroScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: HERO_SCRIM,
    },
    heroGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 117,
    },
    navRow: {
      position: 'absolute',
      left: space[16],
      right: space[16],
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    navRight: { flexDirection: 'row', gap: space[8] },
    navBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: GLASS,
      borderWidth: stroke[1],
      borderColor: GLASS_BORDER,
    },
    navBtnPressed: { backgroundColor: GLASS_PRESSED },
    heroText: { gap: space[4] },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8] },
    heroTitle: { ...typography.headingLarge, color: OVER_PHOTO_TEXT },
    heroSubtitle: { ...typography.bodyLarge, color: OVER_PHOTO_SUBTLE },

    // ── Content ──
    content: { padding: space[16], paddingTop: space[24], gap: space[32] },
    section: { gap: space[16] },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heading: { ...typography.headingSmallEmphasized, color: t.text.primary },
    bodyText: { ...typography.bodyMedium, color: t.text.secondary },
    viewAll: { ...typography.buttonSmall, color: t.text.primary },

    // Owned banner
    ownedIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: t.brand.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Today's tasks ──
    taskList: { gap: space[8] },
    taskTile: {
      width: 40,
      height: 40,
      borderRadius: radius[8],
      alignItems: 'center',
      justifyContent: 'center',
    },
    taskGlyph: { fontSize: 20 },
    segment: { alignSelf: 'stretch' },
    taskAfter: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    doneIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: t.brand.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Care grid ──
    careGrid: { gap: space[12] },
    careRow: { flexDirection: 'row', gap: space[12] },
    careFact: {
      flex: 1,
      padding: space[12],
      gap: space[8],
      borderRadius: radius[16],
      backgroundColor: t.surface.primary,
    },
    careIcon: { fontSize: 22 },
    careLabel: { ...typography.bodyLargeEmphasized, color: t.text.primary },
    careValue: { ...typography.caption, color: t.text.secondary },

    // ── Gallery ──
    galleryScroller: { gap: space[12] },
    galleryImage: { width: 264, height: 184 },
    galleryImageRadius: { borderRadius: radius[12] },

    // ── FAQ accordion ──
    accordionList: { gap: space[8] },
    accordion: {
      backgroundColor: t.surface.primary,
      borderRadius: radius[16],
      overflow: 'hidden',
    },
    accItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[8],
      padding: space[12],
    },
    accText: { flex: 1, gap: space[4] },
    accQuestion: { ...typography.bodyLarge, color: t.text.primary },
    accAnswer: { ...typography.bodyMedium, color: t.text.secondary },

    // ── CTA ──
    cta: {
      paddingHorizontal: space[16],
      paddingTop: space[16],
      backgroundColor: t.background.primary,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border.tertiary,
    },

    // ── Overflow menu ──
    menuAnchor: { position: 'absolute', right: space[16] },
  });
