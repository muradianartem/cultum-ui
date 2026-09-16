// The confirmation the flow lands on (Figma "Add a plant / Success",
// node 338:2951, and its no-reminders variant 362:16152): the plant's photo
// with a check badge, what just happened, and when the next treatment is due.
//
// Chrome-less — AddPlantScreen supplies the nav bar and the two footer actions.

import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/foundations';
import { fonts } from '../../theme/tokens';
import { HERO } from '../placeholderPhotos';

export default function SuccessStep({ photo, title, subtitle }) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);

  return (
    <View style={styles.body}>
      <View style={styles.art}>
        <Image source={photo ? { uri: photo } : HERO} style={styles.photo} />
        <View
          style={[
            styles.badge,
            { backgroundColor: t.brand.primary, borderColor: t.background.primary },
          ]}
        >
          <Icon name="check" size={20} color={t.brand.onPrimary} />
        </View>
      </View>

      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const makeStyles = (t) => StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: space[24],
  },
  art: { width: 152, height: 152 },
  photo: { width: 152, height: 152, borderRadius: 18 },
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 40,
    height: 40,
    borderRadius: 9999,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { alignSelf: 'stretch', gap: 6 },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: t.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: t.text.secondary,
    textAlign: 'center',
  },
});
