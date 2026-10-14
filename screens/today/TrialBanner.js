import { Icon, List, ListItem, StateIcon } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';

// "Your trial ends in 2 days ›" (Figma "Today / Trial ends in 2 days",
// 987:30151): the trial's countdown on home, in the slot the upgrade card has
// on the free plan. The caller decides when it shows; this only draws it.

export function trialEndsTitle(daysLeft) {
  if (daysLeft <= 0) return 'Your trial ends today';
  if (daysLeft === 1) return 'Your trial ends tomorrow';
  return `Your trial ends in ${daysLeft} days`;
}

// What lapsing costs, in this garden's terms: reminders for every plant past
// the free one. A garden the free plan already covers loses Plus, not reminders.
//
// `freePlants` defaults to the server's `free_plant_limit` because a trialing
// account's entitlement carries Plus limits (plants: null), so the free number
// is not on hand until the trial is over.
export function trialEndsSubtitle(plantCount, freePlants = 1) {
  if (plantCount > freePlants) return `Upgrade to keep reminders for all ${plantCount} plants`;
  return 'Upgrade to keep Cultum Plus';
}

export default function TrialBanner({ daysLeft, plantCount, freePlants, onPress }) {
  const t = useTheme();
  return (
    <List variant="card">
      <ListItem
        title={trialEndsTitle(daysLeft)}
        subtitle={trialEndsSubtitle(plantCount, freePlants)}
        subtitleLines={2}
        before={
          <StateIcon>
            <Icon name="power" size={20} color={t.text.primary} />
          </StateIcon>
        }
        after={<Icon name="chevron-right" size={20} color={t.text.primary} />}
        onPress={onPress}
        testID="trial-banner"
      />
    </List>
  );
}
