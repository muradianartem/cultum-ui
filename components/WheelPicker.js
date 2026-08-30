import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

/**
 * WheelPicker — a single iOS-style scrolling wheel column (Figma "Wheel picker").
 *
 * A snap-scrolling list where the item under the centred selection band is the
 * value. Built on a plain ScrollView (snapToInterval + momentum rounding) — no
 * gesture-handler/reanimated. Controlled: pass `index` and handle `onChange`.
 * `renderItem(item, isActive)` styles each row so the caller controls the
 * active/dimmed look; the band itself is drawn by the parent behind the wheels.
 *
 * @param items       array of values to show
 * @param index       selected index (controlled)
 * @param onChange    (index) => void, fired when a new row settles under the band
 * @param itemHeight  row height in px (matches the band height)
 * @param height      the wheel viewport height (band centred within)
 */
export default function WheelPicker({
  items,
  index = 0,
  onChange,
  renderItem,
  itemHeight = 44,
  height = 176,
  style,
}) {
  const ref = useRef(null);
  const [active, setActive] = useState(index);
  const padV = (height - itemHeight) / 2;

  // Keep the scroll position in sync with the controlled index (and on mount).
  useEffect(() => {
    ref.current?.scrollTo({ y: index * itemHeight, animated: false });
    setActive(index);
  }, [index, itemHeight]);

  const resolve = (y, commit) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / itemHeight)));
    setActive(i);
    if (commit && i !== index) onChange?.(i);
  };

  return (
    <ScrollView
      ref={ref}
      style={[{ height }, style]}
      showsVerticalScrollIndicator={false}
      contentOffset={{ x: 0, y: index * itemHeight }} // reliable initial position (iOS)
      snapToInterval={itemHeight}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={(e) => resolve(e.nativeEvent.contentOffset.y, false)}
      onMomentumScrollEnd={(e) => resolve(e.nativeEvent.contentOffset.y, true)}
      onScrollEndDrag={(e) => resolve(e.nativeEvent.contentOffset.y, true)}
      contentContainerStyle={{ paddingVertical: padV }}
    >
      {items.map((item, i) => (
        <View key={i} style={{ height: itemHeight, justifyContent: 'center' }}>
          {renderItem(item, i === active)}
        </View>
      ))}
    </ScrollView>
  );
}
