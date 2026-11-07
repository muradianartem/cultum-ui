// The review prompt: "Did Cultum find your plant?" (lib/reviewPrompt.js has
// the rules for when it may be asked).
//
//   Yes, love it → the OS rating sheet. iOS decides whether it actually shows
//                  (at most 3 times a year, never in TestFlight) and tells the
//                  app nothing either way, so nothing here waits on it.
//   Not quite    → Settings → Send feedback, the existing email form.
//   close        → counted as dismissed; asked again after the cooldown.
//
// iOS only for the question. Android goes straight to Play's In-App Review
// card, because Google forbids asking for an opinion before it. Web: nothing.
//
// Not in Figma yet: the copy and the use of the plain Dialog are provisional.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { Dialog, Icon } from '../components';
import { useRouter } from '../routing';
import { useTheme } from '../theme/ThemeProvider';
import {
  REVIEW_PROMPT_ALWAYS,
  loadReviewRecord,
  recordReviewAnswer,
  recordReviewAsked,
  shouldAskForReview,
} from '../lib/reviewPrompt';

// The Dialog is an RN Modal: give it time to fade out before StoreKit presents
// its own sheet or the router pushes a screen over it.
const HANDOFF_MS = 350;

function requestStoreReview() {
  StoreReview.hasAction()
    .then((can) => (can ? StoreReview.requestReview() : null))
    .catch(() => {});
}

/**
 * @returns {{ offer: () => boolean, dialog: JSX.Element }}
 *   `offer()` shows the prompt if the rules allow it and says whether it did;
 *   render `dialog` once, anywhere in the screen.
 */
export function useReviewPrompt({ now } = {}) {
  const t = useTheme();
  const { navigate } = useRouter();
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);
  // `offer` must keep one identity for the life of the screen: callers start a
  // timer keyed on it, and a new function every render (a re-render comes
  // whenever the garden clock ticks or an image loads) would cancel and restart
  // that timer forever. So the clock is read through a ref, not a dependency.
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => () => clearTimeout(timer.current), []);

  const offer = useCallback(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
    const at = nowRef.current ? nowRef.current() : new Date();
    if (!shouldAskForReview(loadReviewRecord(), at, { always: REVIEW_PROMPT_ALWAYS })) return false;
    if (Platform.OS === 'android') {
      recordReviewAsked(at, 'native');
      requestStoreReview();
      return true;
    }
    recordReviewAsked(at);
    setVisible(true);
    return true;
  }, []);

  const answer = (choice, then) => {
    recordReviewAnswer(choice);
    setVisible(false);
    if (then) timer.current = setTimeout(then, HANDOFF_MS);
  };

  const dialog = (
    <Dialog
      visible={visible}
      onClose={() => answer('dismissed')}
      statusIcon={<Icon name="plant" size={24} color={t.text.primary} />}
      title="Did Cultum find your plant?"
      description="We'd love to know how plant ID worked for you."
      primaryAction={{ label: 'Yes, love it', onPress: () => answer('yes', requestStoreReview) }}
      secondaryAction={{
        label: 'Not quite',
        onPress: () => answer('no', () => navigate('settings-feedback', { initialTopic: 'other' })),
      }}
      testID="review-prompt"
    />
  );

  return { offer, dialog };
}
