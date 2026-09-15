// Settings → Edit profile — Figma "Sheet · Edit profile" (node 404:2459).
//
// Edits the display name, and nothing else: the email is shown as context but
// is the provider's, not ours to change.
//
// DEVICE-LOCAL. There is no PATCH /users/me, and POST /auth/apple accepts a
// name only at sign-in — so this name lives on this phone, in the same category
// as a plant's nickname. Signing in on a second device shows the provider's
// name again.
//
// The write goes through auth.updateProfileName() and only there. GardenProvider
// mirrors auth's `profileName` into the garden document on every render, so a
// write aimed at the garden instead would be overwritten by the mirror on the
// next one — the edit would appear to take, then snap back.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, TextInput } from '../../components';
import { useAuth } from '../../auth/AuthProvider';
import { space } from '../../theme/foundations';

export default function EditProfileSheet({ visible, onClose }) {
  const { profileName, profileEmail, profileEmailIsPrivate, updateProfileName } = useAuth();
  const [name, setName] = useState(profileName ?? '');
  const [busy, setBusy] = useState(false);

  // The sheet is mounted for the life of the screen (one Modal, swapped by
  // visibility), so re-seed the field each time it opens rather than trusting
  // whatever the last edit left behind.
  useEffect(() => {
    if (visible) setName(profileName ?? '');
  }, [visible, profileName]);

  const helper = useMemo(() => {
    if (!profileEmail) return undefined;
    // "Hide My Email" addresses are shown verbatim — that is the address the
    // user chose and the one that actually receives mail — but it is worth
    // saying why it looks like that.
    return profileEmailIsPrivate
      ? `Signed in as ${profileEmail} (hidden by Apple).`
      : `Signed in as ${profileEmail}.`;
  }, [profileEmail, profileEmailIsPrivate]);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      await updateProfileName(name);
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Edit profile"
      primaryAction={{ label: 'Save', loading: busy, onPress: save }}
      testID="edit-profile-sheet"
    >
      <View style={styles.body}>
        <TextInput
          label="Your name"
          value={name}
          onChangeText={setName}
          helper={helper}
          placeholder="Your name"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={save}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space[16] },
});
