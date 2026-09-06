// ProductPage — a plant's page, in both of the lives it has (Figma "Product
// page", node 1:11377).
//
// Before it is yours it is a catalog entry: hero, description, Highlights, How
// to care, FAQ, and a CTA to add it. Once it is yours the same page gains the
// things only an owned plant has — today's tasks for it, an About/Journal
// switch, and the Actions list (Edit Reminders / Rename / Move / Archive /
// Delete) that used to be a three-item overflow menu.
//
// Which life it is in is decided by the store, not by a route param: an owned
// plant is addressed by `plantId` and every field is read live, so a rename
// made here is on the Rooms screen before the navigation animation finishes.
// A catalog preview arrives as `plant` (a PlantVM from api/mapPlant.js).

import { useMemo, useState } from 'react';
import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, Button, Dialog, Icon, ICON_NAMES, List, ListItem, SegmentedControl } from '../components';
import { useRouter } from '../routing';
import { useGarden } from '../store/GardenProvider';
import { plantPhoto } from '../store/model';
import { nextReminderLabel } from '../store/format';
import { speciesDetailToVM, cardToVM } from '../api/mapPlant';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, stroke, typography } from '../theme/foundations';
import RenamePlantSheet from './plant/RenamePlantSheet';
import MovePlantSheet from './plant/MovePlantSheet';

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

const HERO_PLACEHOLDER = require('../assets/plant/hero.png');

// Renders a Cultum <Icon> when `name` is a known icon, else falls back to the
// raw value as text (for the few care glyphs the icon set lacks).
function Glyph({ name, size = 24, color, textStyle }) {
  if (ICON_NAMES.includes(name)) return <Icon name={name} size={size} color={color} />;
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

// One 68pt fact card — used by both Highlights (two per row) and How to care
// (one per row); the only difference is how wide the parent lets it be.
function FactCard({ icon, label, value, styles, t }) {
  return (
    <View style={styles.factCard}>
      <Glyph name={icon} size={24} color={t.text.primary} textStyle={styles.factGlyph} />
      <View style={styles.factText}>
        <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.factValue} numberOfLines={2}>{value}</Text>
      </View>
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

// One "Today's tasks" row. The icon tile's colours come from the task's
// semantic `tone` resolved against the theme, so it follows dark/light.
function TaskRow({ task, onPress, styles, t }) {
  const tone = t[task.tone] ?? null;
  const tile = tone ? tone.secondary : t.surface.secondary;
  const glyph = tone ? tone.primary : t.text.primary;
  return (
    <List variant="card">
      <ListItem
        onPress={onPress}
        before={
          <View style={[styles.taskTile, { backgroundColor: tile }]}>
            <Glyph name={task.icon} size={20} color={glyph} textStyle={styles.taskGlyph} />
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
function Section({ title, large, children, styles }) {
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={large ? styles.headingLarge : styles.heading}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

export default function ProductPage({ plantId, plant, owned = false }) {
  const insets = useSafeAreaInsets();
  const { navigate, back } = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const garden = useGarden();

  const [segment, setSegment] = useState('about');
  const [openFaq, setOpenFaq] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'archive' | 'delete'

  const record = plantId ? garden.getPlant(plantId) : null;

  // An owned plant renders from the SpeciesDetail cached on it, so its page is
  // complete with the radio off. A preview renders from the VM it arrived with.
  const vm = useMemo(() => {
    if (record) {
      return record.care
        ? speciesDetailToVM(record.care)
        : cardToVM({ title: record.nickname, subtitle: '', speciesKey: record.speciesKey });
    }
    return plant ?? cardToVM({ title: 'Plant', subtitle: '' });
  }, [record, plant]);

  const isOwned = !!record;
  // A catalog entry the user already has one of: the nudge banner, not the page.
  const alreadyOwned = !isOwned ? garden.getPlantBySpecies(vm.speciesKey) : null;

  const room = record ? garden.getRoom(record.roomId) : null;
  const tasks = isOwned ? garden.tasksForPlant(record.id) : [];
  const reminders = isOwned ? garden.remindersFor(record.id) : [];
  const nextDue = isOwned ? garden.nextDueForPlant(record.id) : null;

  const heroSource = (record && plantPhoto(record)) ??
    (vm.heroUri ? { uri: vm.heroUri } : HERO_PLACEHOLDER);

  const openReminders = () =>
    navigate('reminders', isOwned ? { plantId: record.id } : { plantName: vm.commonName });

  const removePlant = () => {
    const target = record?.id;
    setConfirm(null);
    if (!target) return;
    garden.deletePlant(target);
    back();
  };

  const archivePlant = () => {
    const target = record?.id;
    setConfirm(null);
    if (!target) return;
    garden.archivePlant(target);
    back();
  };

  // Figma's five Actions rows. Each is a real mutation now — the two that used
  // to close the menu and do nothing (Rename, Move) open a sheet.
  const actions = [
    {
      icon: 'settings',
      title: 'Edit Reminders',
      subtitle: 'Turn them on or off, or add your own.',
      onPress: openReminders,
    },
    {
      icon: 'edit-pen',
      title: 'Rename',
      subtitle: "Change your plant's name",
      onPress: () => setRenaming(true),
    },
    {
      icon: 'arrow-up',
      title: 'Move',
      subtitle: 'Move to another room',
      onPress: () => setMoving(true),
    },
    {
      icon: 'archive',
      title: 'Archive',
      subtitle: 'You can restore it anytime',
      onPress: () => setConfirm('archive'),
    },
    {
      icon: 'trash',
      title: 'Delete',
      subtitle: 'Permanently delete it and its data',
      onPress: () => setConfirm('delete'),
      destructive: true,
    },
  ];

  const description = (
    <Text style={styles.bodyText}>
      {segment === 'journal' && isOwned
        ? 'No journal entries yet. Care you log — waterings, repottings, new leaves — will show up here.'
        : vm.about}
    </Text>
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: space[24] }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <ImageBackground source={heroSource} style={styles.hero} resizeMode="cover">
          <View style={styles.heroScrim} pointerEvents="none" />
          <LinearGradient
            colors={[HERO_GRADIENT_TOP, HERO_GRADIENT_BOTTOM]}
            style={styles.heroGradient}
            pointerEvents="none"
          />

          <View style={[styles.navRow, { top: insets.top + space[8] }]}>
            <NavButton icon="chevron-left" label="Back" onPress={back} styles={styles} />
            {isOwned ? (
              <NavButton
                icon="settings"
                label="Edit reminders"
                onPress={openReminders}
                styles={styles}
              />
            ) : null}
          </View>

          <View style={styles.heroText}>
            <View style={styles.chips}>
              {vm.chips.map((c) => (
                <Badge
                  key={c.label}
                  label={c.label}
                  intent={c.intent}
                  variant="secondary"
                  leftIcon={<Icon name={c.icon} size={16} color={t.text.primary} />}
                />
              ))}
            </View>
            {/* Once it's yours it goes by the name you gave it, and the species
                drops to the line below, next to where it lives. */}
            <Text style={styles.heroTitle}>{isOwned ? record.nickname : vm.commonName}</Text>
            <Text style={styles.heroSubtitle}>
              {isOwned
                ? [vm.latinName || vm.commonName, room?.name].filter(Boolean).join(' · ')
                : vm.latinName}
            </Text>
          </View>
        </ImageBackground>

        {/* ── Content ──────────────────────────────────────────── */}
        <View style={styles.content}>
          {isOwned ? (
            <>
              <Section title="Today’s tasks" large styles={styles}>
                {tasks.length > 0 ? (
                  <View style={styles.taskList}>
                    {tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        onPress={() => garden.completeReminder(task.reminderId)}
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
                          <Icon name="check-all" size={20} color={t.brand.onPrimary} />
                        </View>
                      }
                      title="All caught up"
                      // Nothing scheduled at all is a different state from
                      // everything being done, and reads as one.
                      subtitle={
                        reminders.some((r) => r.enabled)
                          ? nextReminderLabel(nextDue)
                          : 'No reminders'
                      }
                      after={<Icon name="chevron-right" size={20} color={t.text.primary} />}
                      onPress={openReminders}
                    />
                  </List>
                )}
              </Section>

              <View style={styles.section}>
                <SegmentedControl
                  segments={[
                    { label: 'About', value: 'about' },
                    { label: 'Journal', value: 'journal' },
                  ]}
                  value={segment}
                  onChange={setSegment}
                  style={styles.segment}
                />
                {description}
              </View>
            </>
          ) : (
            <>
              {alreadyOwned ? (
                <List variant="card">
                  <ListItem
                    before={
                      <View style={styles.doneIcon}>
                        <Icon name="check" size={20} color={t.brand.onPrimary} />
                      </View>
                    }
                    title="You already have one"
                    subtitle={[alreadyOwned.nickname, garden.getRoom(alreadyOwned.roomId)?.name]
                      .filter(Boolean)
                      .join(' · ')}
                    after={<Icon name="chevron-right" size={20} color={t.text.primary} />}
                    onPress={() => navigate('product', { plantId: alreadyOwned.id })}
                  />
                </List>
              ) : null}
              <View style={styles.section}>{description}</View>
            </>
          )}

          {/* Highlights — six facts, two per row */}
          <Section title="Highlights" styles={styles}>
            <View style={styles.grid}>
              {vm.highlights.map((h) => (
                <View key={h.key} style={styles.gridCell}>
                  <FactCard icon={h.icon} label={h.label} value={h.value} styles={styles} t={t} />
                </View>
              ))}
            </View>
          </Section>

          {/* How to care — the species' own cadence, full width */}
          <Section title="How to care" styles={styles}>
            <View style={styles.careList}>
              {vm.careActions.map((c) => (
                <FactCard
                  key={c.action}
                  icon={c.icon}
                  label={c.label}
                  value={c.value}
                  styles={styles}
                  t={t}
                />
              ))}
            </View>
          </Section>

          {/* V2: Gallery section — deferred with the full-screen photo viewer
              (ImageViewer). The catalog carries one image per species, so there
              is nothing to scroll until user photos land. */}

          {vm.faq.length > 0 ? (
            <Section title="FAQ" styles={styles}>
              <View style={styles.accordionList}>
                {vm.faq.map((item, i) => (
                  <View key={item.q} style={styles.accordion}>
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
          ) : null}

          {isOwned ? (
            <Section title="Actions" styles={styles}>
              <List variant="card">
                {actions.map((a) => (
                  <ListItem
                    key={a.title}
                    before={
                      <View style={styles.actionIcon}>
                        <Icon
                          name={a.icon}
                          size={20}
                          color={a.destructive ? t.error.primary : t.text.primary}
                        />
                      </View>
                    }
                    title={a.title}
                    subtitle={a.subtitle}
                    onPress={a.onPress}
                  />
                ))}
              </List>
            </Section>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Sticky CTA (only before the plant is added) ────────── */}
      {!isOwned ? (
        <View style={[styles.cta, { paddingBottom: space[16] + insets.bottom }]}>
          <Button
            label="Add to my plants"
            size="lg"
            onPress={() => navigate('add-plant', { plant: vm })}
            leftIcon={<Icon name="add" size={20} color={t.brand.onPrimary} />}
          />
        </View>
      ) : null}

      <RenamePlantSheet
        visible={renaming}
        name={record?.nickname ?? ''}
        onClose={() => setRenaming(false)}
        onSave={(name) => garden.renamePlant(record.id, name)}
      />

      <MovePlantSheet
        visible={moving}
        rooms={garden.rooms}
        roomId={record?.roomId}
        onClose={() => setMoving(false)}
        onMove={(roomId) => garden.movePlant(record.id, roomId)}
        onAddRoom={(name) => garden.addRoom(name)}
      />

      <Dialog
        testID="archive-dialog"
        visible={confirm === 'archive'}
        onClose={() => setConfirm(null)}
        title="Archive this plant?"
        description="It stops producing tasks and reminders. You can restore it anytime."
        primaryAction={{ label: 'Archive', onPress: archivePlant }}
        secondaryAction={{ label: 'Cancel', onPress: () => setConfirm(null) }}
      />

      <Dialog
        testID="delete-dialog"
        visible={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete this plant?"
        description={`“${record?.nickname ?? ''}” and its reminders will be permanently deleted.`}
        primaryAction={{ label: 'Delete', destructive: true, onPress: removePlant }}
        secondaryAction={{ label: 'Cancel', onPress: () => setConfirm(null) }}
      />
    </View>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.primary },
    scroll: { flex: 1 },

    // ── Hero ── (photo treatments are theme-independent)
    hero: {
      height: 336,
      paddingHorizontal: space[16],
      paddingBottom: 25,
      justifyContent: 'flex-end',
      backgroundColor: HERO_FALLBACK,
    },
    heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: HERO_SCRIM },
    heroGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 117 },
    navRow: {
      position: 'absolute',
      left: space[16],
      right: space[16],
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
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
    content: { padding: space[16], paddingTop: space[24], gap: space[24] },
    section: { gap: space[16] },
    heading: { ...typography.headingSmallEmphasized, color: t.text.primary },
    headingLarge: { ...typography.headingMediumEmphasized, color: t.text.primary },
    bodyText: { ...typography.bodyMedium, color: t.text.secondary },
    segment: { alignSelf: 'stretch' },

    // ── Today's tasks ──
    taskList: { gap: space[12] },
    taskTile: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    taskGlyph: { fontSize: 20 },
    taskAfter: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    doneIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: t.brand.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Fact cards (Highlights + How to care) ──
    // Two-column wrap rather than fixed rows, so a species with five facts
    // still lays out cleanly instead of leaving a hole in a rigid grid.
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8] },
    gridCell: { width: '48%', flexGrow: 1 },
    careList: { gap: space[8] },
    factCard: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      padding: space[12],
      gap: space[8],
      borderRadius: radius[16],
      backgroundColor: t.surface.primary,
    },
    factGlyph: { fontSize: 22 },
    factText: { flex: 1, gap: space[2] },
    factLabel: { ...typography.bodyLargeEmphasized, color: t.text.primary },
    factValue: { ...typography.bodyMedium, color: t.text.secondary },

    // ── Actions ──
    actionIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: t.surface.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── FAQ accordion ──
    accordionList: { gap: space[8] },
    accordion: { backgroundColor: t.surface.primary, borderRadius: radius[16], overflow: 'hidden' },
    accItem: { flexDirection: 'row', alignItems: 'center', gap: space[8], padding: space[12] },
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
  });
