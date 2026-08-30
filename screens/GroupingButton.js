// GroupingButton — the "Grouping: By Task" pill and the popover it opens (Figma
// "Today / Grouping"). Tapping it floats a DropdownMenu just above the button
// with Task / Room / None; the active option shows a leading check. Self-contained:
// measures its own on-screen position so the menu anchors above it.
//
//   <GroupingButton value={grouping} onChange={setGrouping} options={GROUPINGS} />

import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Button, DropdownMenu, Icon } from '../components';
import { MenuItem } from '../components/DropdownMenu';
import { useTheme } from '../theme/ThemeProvider';
const GAP = 8; // space between the button and the menu
const MENU_WIDTH = 279; // Figma "Today / Grouping" dropdown width

export default function GroupingButton({ value, onChange, options }) {
  const t = useTheme();
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null); // { x, y, width } in window coords

  const current = options.find((o) => o.value === value) ?? options[0];

  const openMenu = () => {
    // Measure where the pill sits so the popover can hang just above it.
    anchorRef.current?.measureInWindow((x, y, width) => {
      setAnchor({ x, y, width });
      setOpen(true);
    });
  };

  const select = (v) => {
    setOpen(false);
    onChange?.(v);
  };

  const screen = Dimensions.get('window');
  // Centre the menu on the button, then clamp so it stays on-screen.
  const centeredLeft = anchor ? anchor.x + anchor.width / 2 - MENU_WIDTH / 2 : 0;
  const left = anchor
    ? Math.min(Math.max(centeredLeft, 16), screen.width - MENU_WIDTH - 16)
    : 0;
  const bottom = anchor ? screen.height - anchor.y + GAP : 0;

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Button
          label={`Grouping: ${current.label}`}
          variant="outline"
          size="sm"
          fullWidth={false}
          onPress={openMenu}
          rightIcon={
            <View style={styles.selector}>
              <Icon name="chevron-up" size={12} color={t.text.primary} />
              <Icon name="chevron-down" size={12} color={t.text.primary} style={styles.selectorDown} />
            </View>
          }
        />
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        {anchor ? (
          <View style={[styles.popover, { left, bottom }]}>
            <DropdownMenu style={{ width: MENU_WIDTH }}>
              {options.map((o) => (
                <MenuItem
                  key={o.value}
                  title={o.title}
                  subtitle={o.subtitle}
                  selected={o.value === value}
                  leading={
                    o.value === value ? (
                      <Icon name="check" size={24} color={t.text.primary} />
                    ) : null
                  }
                  onPress={() => select(o.value)}
                />
              ))}
            </DropdownMenu>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: { width: 12, height: 16, alignItems: 'center', justifyContent: 'center' },
  selectorDown: { marginTop: -5 },
  popover: {
    position: 'absolute'
  },
});
