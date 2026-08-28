import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/foundations';

/**
 * ConfidenceRing — the Figma "Pie Chart" confidence ring (component 158:12423).
 *
 * A grey track with a green arc whose length is `percent` of the circumference,
 * and the percent number centered inside. Used by SpeciesCard on the Matches
 * screen to show each candidate's identification confidence.
 *
 * @param {number} percent      0–100 confidence to draw and label
 * @param {number} size         outer width/height in px (default 44)
 * @param {number} strokeWidth  ring thickness in px (default 3)
 */
export default function ConfidenceRing({ percent, size = 44, strokeWidth = 3 }) {
  const t = useTheme();
  const center = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const arc = (circumference * percent) / 100;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={t.border.secondary}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={t.brand.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[arc, circumference]}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <Text style={[typography.captionEmphasized, { color: t.text.primary }]}>
        {`${percent}%`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
