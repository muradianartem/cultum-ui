import { useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  DropdownMenu,
  List,
  ListItem,
  Overlay,
  SegmentedControl,
} from '../components';
import { useRouter } from '../routing';
import { colors, fonts, radius } from '../theme/tokens';
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

// Circular translucent nav button floating over the hero image.
function NavButton({ glyph, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
    >
      <Text style={styles.navGlyph}>{glyph}</Text>
    </Pressable>
  );
}

// One tile of the care grid: icon over a bold label over a caption value.
function CareFact({ icon, label, value }) {
  return (
    <View style={styles.careFact}>
      <Text style={styles.careIcon}>{icon}</Text>
      <Text style={styles.careLabel}>{label}</Text>
      <Text style={styles.careValue}>{value}</Text>
    </View>
  );
}

// A single expand/collapse FAQ row.
function AccordionItem({ question, answer, open, onToggle }) {
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
      <Text style={styles.accChevron}>{open ? '⌃' : '⌄'}</Text>
    </Pressable>
  );
}

// One "Today's tasks" row: colour-tinted icon tile + title/subtitle, a due
// badge and a chevron. Built from <List variant="card"> + <ListItem> so it
// reuses the design system's row primitive and pressed states.
function TaskRow({ task, onPress }) {
  return (
    <List variant="card">
      <ListItem
        onPress={onPress}
        before={
          <View style={[styles.taskTile, { backgroundColor: task.tint }]}>
            <Text style={styles.taskGlyph}>{task.icon}</Text>
          </View>
        }
        title={task.title}
        subtitle={task.subtitle}
        after={
          <View style={styles.taskAfter}>
            <Badge
              label={task.due}
              variant="secondary"
              leftIcon={<Text style={styles.badgeIcon}>🕑</Text>}
            />
            <Text style={styles.chevronRight}>›</Text>
          </View>
        }
      />
    </List>
  );
}

// A titled content block (matches the Figma "Section ·" frames).
function Section({ title, action, children }) {
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
        contentContainerStyle={{ paddingBottom: added ? 24 : 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <ImageBackground source={HERO} style={styles.hero} resizeMode="cover">
          <View style={styles.heroScrim} pointerEvents="none" />

          <View style={[styles.navRow, { top: insets.top + 8 }]}>
            <NavButton glyph="‹" label="Back" onPress={() => {}} />
            <View style={styles.navRight}>
              {added ? (
                <>
                  <NavButton glyph="⚙︎" label="Settings" onPress={() => {}} />
                  <NavButton
                    glyph="⋯"
                    label="More options"
                    onPress={() => setMenuOpen(true)}
                  />
                </>
              ) : (
                <NavButton glyph="🔖" label="Save" onPress={() => {}} />
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
                  leftIcon={<Text style={styles.badgeIcon}>{c.glyph}</Text>}
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
              <Section title="Today’s tasks">
                {tasks.length > 0 ? (
                  <View style={styles.taskList}>
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onPress={() => completeTask(task.id)}
                      />
                    ))}
                  </View>
                ) : (
                  <List variant="card">
                    <ListItem
                      before={
                        <View style={styles.doneIcon}>
                          <Text style={styles.doneCheck}>✓</Text>
                        </View>
                      }
                      title="All caught up"
                      subtitle={NEXT_REMINDER}
                      after={<Text style={styles.chevronRight}>›</Text>}
                      onPress={() => {}}
                    />
                  </List>
                )}
              </Section>

              {/* Your plant */}
              <Section title="Your plant">
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
                      <Text style={styles.ownedCheck}>✓</Text>
                    </View>
                  }
                  title={PLANT.owned.title}
                  subtitle={PLANT.owned.subtitle}
                  after={<Text style={styles.chevronRight}>›</Text>}
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
          <Section title="How to care">
            <View style={styles.careGrid}>
              <View style={styles.careRow}>
                <CareFact {...CARE_FACTS[0]} />
                <CareFact {...CARE_FACTS[1]} />
              </View>
              <View style={styles.careRow}>
                <CareFact {...CARE_FACTS[2]} />
                <CareFact {...CARE_FACTS[3]} />
              </View>
            </View>
          </Section>

          {/* V2: Gallery section — deferred with the full-screen photo viewer
              (ImageViewer). "View All" → navigate('premium-gallery'); each photo
              → navigate('image-viewer', { index: i }). Re-enable together in V2.

          <Section
            title="Gallery"
            action={
              <Pressable
                accessibilityRole="button"
                onPress={() => navigate('premium-gallery')}
              >
                <Text style={styles.viewAll}>View All</Text>
              </Pressable>
            }
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryScroller}
            >
              {PHOTOS.slice(0, 2).map((src, i) => (
                <ImageBackground
                  key={i}
                  source={src}
                  style={styles.galleryImage}
                  imageStyle={styles.galleryImageRadius}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </Section>
          */}

          {/* FAQ */}
          <Section title="FAQ">
            <View style={styles.accordionList}>
              {FAQ.map((item, i) => (
                <View key={i} style={styles.accordion}>
                  <AccordionItem
                    question={item.q}
                    answer={item.a}
                    open={openFaq === i}
                    onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
                  />
                </View>
              ))}
            </View>
          </Section>
        </View>
      </ScrollView>

      {/* ── Sticky CTA (only before the plant is added) ────────── */}
      {!added ? (
        <View style={[styles.cta, { paddingBottom: 16 + insets.bottom }]}>
          <Button
            label="Add to my plants"
            size="lg"
            onPress={() => setAdded(true)}
            leftIcon={<Text style={styles.addGlyph}>＋</Text>}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  scroll: { flex: 1 },

  // ── Hero ──
  hero: {
    height: 353,
    paddingHorizontal: 16,
    paddingBottom: 25,
    justifyContent: 'flex-end',
    backgroundColor: colors.brandDark,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
    // Figma bottom-up scrim so the light text stays legible over the photo.
    backgroundColor: 'rgba(21,23,20,0.28)',
  },
  navRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navRight: { flexDirection: 'row', gap: 8 },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,250,250,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(250,250,250,0.6)',
  },
  navBtnPressed: { backgroundColor: 'rgba(250,250,250,0.34)' },
  navGlyph: { color: colors.white, fontSize: 18, lineHeight: 20 },
  heroText: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeIcon: { fontSize: 12 },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    color: colors.paper,
  },
  heroSubtitle: { fontSize: 16, lineHeight: 22, color: '#DADBDA' },

  // ── Content ──
  content: { padding: 16, paddingTop: 24, gap: 32 },
  section: { gap: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: '#151515',
  },
  bodyText: { fontSize: 14, lineHeight: 20, color: '#404140' },
  viewAll: { fontSize: 14, fontWeight: '500', color: '#151515' },

  // Owned banner
  ownedIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownedCheck: { fontSize: 18, color: colors.greenInk, fontWeight: '700' },
  chevronRight: { fontSize: 22, color: '#151515' },

  // ── Today's tasks ──
  taskList: { gap: 8 },
  taskTile: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskGlyph: { fontSize: 20 },
  segment: { alignSelf: 'stretch' },
  taskAfter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheck: { fontSize: 18, color: colors.greenInk, fontWeight: '700' },

  // ── Care grid ──
  careGrid: { gap: 12 },
  careRow: { flexDirection: 'row', gap: 12 },
  careFact: {
    flex: 1,
    padding: 12,
    gap: 8,
    borderRadius: radius.card,
    backgroundColor: '#ECEDEC',
  },
  careIcon: { fontSize: 22 },
  careLabel: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#151515' },
  careValue: { fontSize: 12, lineHeight: 16, color: '#404140' },

  // ── Gallery ──
  galleryScroller: { gap: 12 },
  galleryImage: { width: 264, height: 184 },
  galleryImageRadius: { borderRadius: 12 },

  // ── FAQ accordion ──
  accordionList: { gap: 8 },
  accordion: {
    backgroundColor: '#ECEDEC',
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  accItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  accText: { flex: 1, gap: 4 },
  accQuestion: { fontSize: 16, lineHeight: 22, color: '#151515' },
  accAnswer: { fontSize: 14, lineHeight: 20, color: '#404140' },
  accChevron: { fontSize: 16, color: '#151515', width: 24, textAlign: 'center' },

  // ── CTA ──
  cta: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  addGlyph: { fontSize: 18, color: colors.greenInk, fontWeight: '600' },

  // ── Overflow menu ──
  menuAnchor: { position: 'absolute', right: 16 },
});
