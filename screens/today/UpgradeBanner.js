import { Icon, List, ListItem, StateIcon } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';

// "Try Cultum Plus free ›" (Figma "Today / Free plan [Upgrade card]",
// 880:22189): a free account's standing way to the paywall from home. The
// caller decides when it shows; this only draws it.
export default function UpgradeBanner({ onPress }) {
  const t = useTheme();
  return (
    <List variant="card">
      <ListItem
        title="Try Cultum Plus free"
        subtitle="Unlimited scans, plants and rooms"
        before={
          <StateIcon>
            <Icon name="power" size={20} color={t.text.primary} />
          </StateIcon>
        }
        after={<Icon name="chevron-right" size={20} color={t.text.primary} />}
        onPress={onPress}
      />
    </List>
  );
}
