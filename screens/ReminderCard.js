// One reminder card (Figma "Reminder Group", node 1:7894): a card-style List
// panel with a (non-pressable) header row — chip, title, "Next reminder"
// subtitle, enable Toggle — followed by pressable detail rows (date, frequency,
// and snooze when given) and, when removable, a Remove button.
//
// Shared by Edit Reminders (stored reminders) and the add-a-plant "Set
// reminders" step (draft rows), so the two read identically. The card only
// renders what it is handed — each caller derives its own display strings.

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Icon, List, ListItem, Toggle } from '../components';
import { actionMeta } from '../store/model';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space, typography } from '../theme/foundations';

// Coloured icon chip — a 40×40 rounded-full tinted square holding a 20px icon.
// The action's semantic tone resolves against the theme, so it re-tints in
// light/dark for free.
function Chip({ action, styles, t }) {
  const meta = actionMeta(action);
  const { bg, fg } =
    meta.tone === 'neutral'
      ? { bg: t.surface.secondary, fg: t.text.primary }
      : { bg: t[meta.tone].secondary, fg: t[meta.tone].primary };
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Icon name={meta.icon} size={20} color={fg} />
    </View>
  );
}

// One detail row: a pressable "label ↔ value + chevron" line that opens the
// value editor for its field.
function DetailRow({ label, value, onPress, accessibilityLabel, styles, t }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.detailRow}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValue}>
        <Text style={styles.detailValueText}>{value}</Text>
        <Icon name="chevron-right" size={20} color={t.text.primary} />
      </View>
    </Pressable>
  );
}

/**
 * `view` is the card's display strings: `{ nextLabel, dateLabel, dateValue,
 * frequency, snooze? }`. The Snooze row shows only when `view.snooze` is set,
 * and Remove only when `onRemove` is passed. With `collapsible`, a reminder
 * that is off folds down to its header — its parameters only matter once on.
 */
export default function ReminderCard({
  title,
  action,
  enabled,
  view,
  onToggle,
  onEditField,
  onRemove,
  collapsible = false,
}) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  return (
    <List variant="card">
      <ListItem
        before={<Chip action={action} styles={styles} t={t} />}
        title={title}
        subtitle={view.nextLabel}
        after={
          <Toggle
            value={enabled}
            onValueChange={onToggle}
            accessibilityLabel={`Enable ${title}`}
          />
        }
      />
      {collapsible && !enabled ? null : (
        <View style={styles.details}>
          <DetailRow
            label={view.dateLabel}
            value={view.dateValue}
            accessibilityLabel={`${title} date`}
            onPress={() => onEditField('date')}
            styles={styles}
            t={t}
          />
          <DetailRow
            label="Frequency"
            value={view.frequency}
            accessibilityLabel={`${title} Frequency`}
            onPress={() => onEditField('frequency')}
            styles={styles}
            t={t}
          />
          {view.snooze != null ? (
            <DetailRow
              label="Snooze for"
              value={view.snooze}
              accessibilityLabel={`${title} Snooze`}
              onPress={() => onEditField('snooze')}
              styles={styles}
              t={t}
            />
          ) : null}
          {onRemove ? (
            <View style={styles.removeWrap}>
              <Button
                variant="secondary"
                destructive
                size="sm"
                label="Remove"
                accessibilityLabel="Remove"
                onPress={onRemove}
                leftIcon={<Icon name="trash" size={16} color={t.error.primary} />}
              />
            </View>
          ) : null}
        </View>
      )}
    </List>
  );
}

const makeStyles = (t) =>
  StyleSheet.create({
    chip: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    details: { paddingHorizontal: space[16], paddingBottom: space[12], gap: space[4] },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: space[4],
    },
    detailLabel: { ...typography.bodyLarge, color: t.text.primary },
    detailValue: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
    detailValueText: { ...typography.bodyLarge, color: t.text.secondary },
    removeWrap: { paddingTop: space[8] },
  });
