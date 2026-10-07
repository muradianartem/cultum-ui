import Badge from './Badge';
import Icon from './Icon';
import { useTheme } from '../theme/ThemeProvider';

/**
 * PlusBadge — the "Plus" tag on anything the free plan locks, and on a Plus
 * member's account row. Figma "Badge" Style=Primary, Function=Neutral; the
 * locked-feature tag carries the power glyph (Type=Icon Before, Size=Large),
 * the account tag is the plain Medium label (`icon={false}`).
 */
export default function PlusBadge({ icon = true, style }) {
  const t = useTheme();
  return (
    <Badge
      label="Plus"
      size={icon ? 'lg' : 'md'}
      leftIcon={icon ? <Icon name="power" size={16} color={t.brand.onPrimary} /> : undefined}
      accessibilityLabel="Cultum Plus"
      style={style}
    />
  );
}
