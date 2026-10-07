// ProductPage — a plant's page, in both of the lives it has (Figma "Product
// page", node 1:11377).
//
// Before it is yours it is a catalog entry: hero, description, Highlights, How
// to care, FAQ, and a CTA to add it. Once it is yours the same page gains the
// things only an owned plant has — today's tasks for it and the Actions list
// (Edit Reminders / Rename / Move / Delete) that used to be a three-item
// overflow menu. V2: an About/Journal switch above the description (Figma
// "Product Page / About and Journal tabs", node 1082:24366).
//
// Which life it is in is decided by the store, not by a route param: an owned
// plant is addressed by `plantId` and every field is read live, so a rename
// made here is on the Rooms screen before the navigation animation finishes.
// A catalog preview arrives as `plant` (a PlantVM from api/mapPlant.js).

import { useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  Badge,
  Button,
  ButtonIcon,
  Dialog,
  DropdownMenu,
  Icon,
  ICON_NAMES,
  List,
  ListItem,
  Overlay,
  TextButton,
  useUndoSnackbar,
} from '../components';
import { useRouter } from '../routing';
import { useEntitlement } from '../billing/EntitlementProvider';
import { plantQuota } from '../billing/limits';
import { useUpgrade } from '../billing/useUpgrade';
import { useGarden } from '../store/GardenProvider';
import { plantPhoto } from '../store/model';
import { nextReminderLabel } from '../store/format';
import { showError } from '../lib/showError';
import { truncateText } from '../lib/truncateText';
import { speciesDetailToVM, cardToVM } from '../api/mapPlant';
import { useTheme, useThemeMode } from '../theme/ThemeProvider';
import { opacity, radius, space, typography } from '../theme/foundations';
import { button, hero, list, navbar } from '../theme/tokens';
import { withAlpha } from '../theme/alpha';
import RenamePlantSheet from './plant/RenamePlantSheet';
import MovePlantSheet from './plant/MovePlantSheet';

const BAR_FADE = space[48];
// Each side of the bar is as wide as the owned bar's two buttons, so the title
// stays centred whether the right side holds none or two.
const BAR_SIDE = button.iconSizes.md * 2 + space[8];

const HERO_PLACEHOLDER = require('../assets/plant/hero.png');

// Renders a Cultum <Icon> when `name` is a known icon, else falls back to the
// raw value as text (for the few care glyphs the icon set lacks).
function Glyph({ name, size = 24, color, textStyle }) {
  if (ICON_NAMES.includes(name)) return <Icon name={name} size={size} color={color} />;
  return <Text style={[{ fontSize: size, color }, textStyle]}>{name}</Text>;
}

// Figma "_Navigation Bar Button" Type=Secondary: a grey 40pt circle, the same
// over the photo and on the solid bar.
function NavButton({ icon, label, onPress, t }) {
  return (
    <ButtonIcon
      variant="secondary"
      size="md"
      icon={<Icon name={icon} size={24} color={t.brand.onSecondary} />}
      onPress={onPress}
      accessibilityLabel={label}
    />
  );
}

// One 68pt fact card — used by both Highlights (two per row) and How to care
// (one per row); the only difference is how wide the parent lets it be. The
// value wraps rather than truncating — a toxicity list can run to three lines.
function FactCard({ icon, label, value, style, styles, t }) {
  return (
    <View style={[styles.factCard, style]}>
      <Glyph name={icon} size={24} color={t.text.primary} textStyle={styles.factGlyph} />
      <View style={styles.factText}>
        <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.factValue}>{value}</Text>
      </View>
    </View>
  );
}

// The species description. Catalog copy can run to a long raw block that
// pushes the rest of the page down, so past ~150 characters it collapses
// behind View more / View less.
function AboutText({ about, styles }) {
  const [expanded, setExpanded] = useState(false);
  const { text, full, truncated } = truncateText(about);
  return (
    <View style={styles.about}>
      <Text style={styles.bodyText}>{expanded ? full : text}</Text>
      {truncated ? (
        <TextButton
          label={expanded ? 'View less' : 'View more'}
          size="sm"
          inline
          onPress={() => setExpanded((e) => !e)}
          accessibilityState={{ expanded }}
          style={styles.aboutToggle}
        />
      ) : null}
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
  const notify = useUndoSnackbar();

  const [openFaq, setOpenFaq] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'delete'
  const [menuOpen, setMenuOpen] = useState(false);
  const { effective } = useThemeMode();

  // Scroll drives two fades: the hero dissolves as it leaves, and just before
  // it's gone the nav bar fills in behind its buttons and takes the title.
  const scrollY = useRef(new Animated.Value(0)).current;
  // Where the hero's title block starts, measured, so the bar can be solid
  // before that text slides up under it.
  const [heroTextTop, setHeroTextTop] = useState(null);
  const barBottom = insets.top + navbar.height;
  const collapse = Math.max(hero.height - barBottom, navbar.height);
  const barEnd = Math.max((heroTextTop ?? collapse) - barBottom, navbar.height);
  // The hero dissolves across its whole scroll; the bar fills in over its own
  // height, finishing as the hero text reaches it. Both are opacity (what the
  // native driver animates cleanly) and are built once per layout — a fresh
  // interpolation every render re-attaches the native animation mid-scroll.
  const { heroOpacity, barOpacity } = useMemo(
    () => ({
      heroOpacity: scrollY.interpolate({
        inputRange: [0, collapse],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
      barOpacity: scrollY.interpolate({
        inputRange: [collapse - BAR_FADE, collapse],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    }),
    [scrollY, collapse, barEnd],
  );
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  const record = plantId ? garden.getPlant(plantId) : null;

  // An owned plant renders from the SpeciesDetail the server embeds in it
  // (UserPlantOut.care). A preview renders from the VM it arrived with.
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
  // Free accounts hold one plant (Figma "Plant page / Plant limit reached").
  const entitlement = useEntitlement();
  const openPaywall = useUpgrade();
  const plants = !isOwned ? plantQuota(entitlement, garden.plants.length) : null;

  const room = record ? garden.getRoom(record.roomId) : null;
  const tasks = isOwned ? garden.tasksForPlant(record.id) : [];
  const reminders = isOwned ? garden.remindersFor(record.id) : [];
  const nextDue = isOwned ? garden.nextDueForPlant(record.id) : null;

  const heroSource = (record && plantPhoto(record)) ??
    (vm.heroUri ? { uri: vm.heroUri } : HERO_PLACEHOLDER);

  const openReminders = () =>
    navigate('reminders', isOwned ? { plantId: record.id } : { plantName: vm.commonName });

  // Leaves only once the server has deleted it; a refusal keeps the page up.
  const removePlant = async () => {
    const target = record?.id;
    setConfirm(null);
    if (!target) return;
    try {
      await garden.deletePlant(target);
      back();
    } catch (e) {
      showError(e, 'Couldn’t delete your plant');
    }
  };

  const renamePlant = (name) =>
    garden.renamePlant(record.id, name).catch((e) => showError(e, 'Couldn’t rename your plant'));

  const movePlant = (roomId) =>
    garden.movePlant(record.id, roomId).catch((e) => showError(e, 'Couldn’t move your plant'));

  /** The new room's id, or null when it wasn't created (the user is told). */
  const addRoom = (name) =>
    garden.addRoom(name).catch((e) => {
      showError(e, 'Couldn’t add the room');
      return null;
    });

  // Figma's Actions rows. Each is a real mutation — Rename and Move open a
  // sheet. (Archive is gone: the server has nowhere to keep it.)
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
      icon: 'trash',
      title: 'Delete',
      subtitle: 'Permanently delete it and its data',
      onPress: () => setConfirm('delete'),
      destructive: true,
    },
  ];

  // The ellipsis menu: the Actions list minus Edit Reminders, which already has
  // its own settings button beside it.
  const overflowItems = actions
    .filter((a) => a.onPress !== openReminders)
    .map((a) => ({
      key: a.title,
      title: a.title,
      icon: (
        <Icon name={a.icon} size={20} color={a.destructive ? t.error.primary : t.text.primary} />
      ),
      onPress: () => {
        setMenuOpen(false);
        a.onPress();
      },
    }));

  const title = isOwned ? record.nickname : vm.commonName;

  const description = <AboutText key={vm.speciesKey} about={vm.about} styles={styles} />;

  return (
    <View style={styles.screen}>
      <StatusBar style={effective === 'dark' ? 'light' : 'dark'} />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: space[24] }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Hero ─────────────────────────────────────────────── */}
        <Animated.View style={{ opacity: heroOpacity }}>
          <ImageBackground source={heroSource} style={styles.hero} resizeMode="cover">
            <LinearGradient
              colors={[
                withAlpha(t.background.primary, opacity[0]),
                withAlpha(t.background.primary, opacity[50]),
                withAlpha(t.background.primary, opacity[100]),
              ]}
              locations={hero.fadeStops}
              style={styles.heroGradient}
              pointerEvents="none"
            />
            <View
              style={styles.heroText}
              onLayout={(e) => setHeroTextTop(e.nativeEvent.layout.y)}
            >
              {/* Once it's yours it goes by the name you gave it, and the species
                  drops to the line below, next to where it lives. */}
              <Text style={styles.heroTitle}>{title}</Text>
              <Text style={styles.heroSubtitle}>
                {isOwned
                  ? [vm.latinName || vm.commonName, room?.name].filter(Boolean).join(' · ')
                  : vm.latinName}
              </Text>
            </View>
          </ImageBackground>
        </Animated.View>

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
                        onPress={() =>
                          notify('Task completed', garden.completeReminder(task.reminderId))}
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

              <View style={styles.section}>{description}</View>
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
                  <FactCard
                    icon={h.icon}
                    label={h.label}
                    value={h.value}
                    style={styles.factCardFill}
                    styles={styles}
                    t={t}
                  />
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
      </Animated.ScrollView>
      <View style={[styles.bar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[styles.barFill, { opacity: barOpacity }]} pointerEvents="none">
          <LinearGradient
            colors={[
              withAlpha(t.background.primary, opacity[100]),
              withAlpha(t.background.primary, opacity[75]),
            ]}
            style={styles.barEdge}
          />
        </Animated.View>
        <View style={styles.barRow} pointerEvents="box-none">
          <View style={styles.barSide}>
            <NavButton icon="chevron-left" label="Back" onPress={back} t={t} />
          </View>
          <Animated.Text
            style={[styles.barTitle, { opacity: barOpacity }]}
            numberOfLines={1}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {title}
          </Animated.Text>
          <View style={[styles.barSide, styles.barActions]}>
            {isOwned ? (
              <>
                <NavButton icon="settings" label="Edit reminders" onPress={openReminders} t={t} />
                <NavButton
                  icon="more-horizontal"
                  label="More options"
                  onPress={() => setMenuOpen((o) => !o)}
                  t={t}
                />
              </>
            ) : null}
          </View>
        </View>
      </View>

      {/* ── Sticky CTA (only before the plant is added) ────────── */}
      {!isOwned ? (
        <View style={[styles.cta, { paddingBottom: space[16] + insets.bottom }]}>
          {plants?.reached ? (
            <>
              <Badge
                label={`${plants.used} of ${plants.limit} free ${plants.limit === 1 ? 'plant' : 'plants'} used`}
                variant="secondary"
                style={styles.ctaBadge}
              />
              <Button
                label="Upgrade to Plus"
                size="lg"
                onPress={() => openPaywall('plant_limit')}
                leftIcon={<Icon name="power" size={20} color={t.brand.onPrimary} />}
              />
            </>
          ) : (
            <Button
              label="Add to my plants"
              size="lg"
              onPress={() => navigate('add-plant', { plant: vm })}
              leftIcon={<Icon name="add" size={20} color={t.brand.onPrimary} />}
            />
          )}
        </View>
      ) : null}

      {menuOpen ? (
        <Overlay onPress={() => setMenuOpen(false)} color="transparent" opacity={1}>
          <View style={[styles.menuAnchor, { top: insets.top + navbar.height }]}>
            <DropdownMenu items={overflowItems} />
          </View>
        </Overlay>
      ) : null}

      <RenamePlantSheet
        visible={renaming}
        name={record?.nickname ?? ''}
        onClose={() => setRenaming(false)}
        onSave={renamePlant}
      />

      <MovePlantSheet
        visible={moving}
        rooms={garden.rooms}
        roomId={record?.roomId}
        onClose={() => setMoving(false)}
        onMove={movePlant}
        onAddRoom={addRoom}
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

    // ── Hero ──
    hero: {
      height: hero.height,
      paddingHorizontal: space[16],
      paddingBottom: space[16],
      justifyContent: 'flex-end',
      backgroundColor: t.surface.primary,
    },
    heroGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: hero.fadeHeight },
    heroText: { gap: space[4] },
    heroTitle: { ...typography.headingLarge, color: t.text.primary },
    heroSubtitle: { ...typography.bodyLarge, color: t.text.secondary },

    // ── Navigation bar ── (Figma "Navigation Bar", Size=Small)
    bar: { position: 'absolute', top: 0, left: 0, right: 0 },
    barFill: {
      ...StyleSheet.absoluteFill,
      backgroundColor: t.background.primary,
      borderBottomLeftRadius: radius[24],
      borderBottomRightRadius: radius[24],
    },
    // Content softens into the bar rather than cutting off at its edge.
    barEdge: { position: 'absolute', top: -80, left: 0, right: 0, height: 140, },
    barRow: {
      height: navbar.height,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: space[16],
      gap: space[8],
    },
    barTitle: {
      flex: 1,
      ...typography.headingExtraSmall,
      color: t.text.primary,
      textAlign: 'center',
    },
    // Both sides are as wide as the owned bar's two buttons, so the title
    // stays centred with one button on the left and none or two on the right.
    barSide: { minWidth: BAR_SIDE, flexDirection: 'row' },
    barActions: { justifyContent: 'flex-end', gap: space[8] },
    menuAnchor: { position: 'absolute', right: space[16] },

    // ── Content ──
    content: { padding: space[16], paddingTop: space[24], gap: space[24] },
    section: { gap: space[16] },
    heading: { ...typography.headingSmallEmphasized, color: t.text.primary },
    headingLarge: { ...typography.headingMediumEmphasized, color: t.text.primary },
    bodyText: { ...typography.bodyMedium, color: t.text.secondary },
    about: { gap: space[4] },
    aboutToggle: { paddingLeft: 0, paddingVertical: space[4] },

    // ── Today's tasks ──
    taskList: { gap: space[12] },
    taskTile: {
      width: list.beforeBadgeSize,
      height: list.beforeBadgeSize,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    taskGlyph: { fontSize: 20 },
    taskAfter: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
    doneIcon: {
      width: list.beforeBadgeSize,
      height: list.beforeBadgeSize,
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
    // A Highlights card fills its cell, so when one value wraps further its
    // row partner grows with it instead of sitting short.
    factCardFill: { flexGrow: 1 },
    factGlyph: { fontSize: 22 },
    factText: { flex: 1, gap: space[2] },
    factLabel: { ...typography.bodyLargeEmphasized, color: t.text.primary },
    factValue: { ...typography.bodyMedium, color: t.text.secondary },

    // ── Actions ──
    actionIcon: {
      width: list.beforeBadgeSize,
      height: list.beforeBadgeSize,
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
      gap: space[12],
    },
    ctaBadge: { alignSelf: 'center' },
  });
