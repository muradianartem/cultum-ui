// The four onboarding screens — Figma section "Onboarding" (file
// 4jmjNlaM7IRpCOogYRJMks, node 268:554), frames ordered left to right.
//
// Copy is transcribed verbatim from each frame's text nodes. The three intro
// illustrations are the full "Illustration" frames exported at 2× — photo,
// overlays and the rounded corner baked in. They are decoration only: every
// title, body, control and progress mark on these screens is a native element.

// FIXME(product): "stays quiet during the hours you set" promises quiet hours,
// and the app has only a reminder time and a master switch. Resolve the copy
// (or the feature) before release — see docs/onboarding-execution-plan.md.
export const ONBOARDING_STEPS = [
  {
    id: 'scan',
    figma: '772:21068',
    title: 'Scan a plant',
    body: 'Scan a plant or search by name. Cultum shows possible matches and tells you how confident it is.',
    illustration: require('../../assets/onboarding/scan.png'), // 772:21080
    cta: 'Next',
  },
  {
    id: 'care',
    figma: '772:20998',
    title: 'Add your plant',
    body: 'Each plant gets its own watering and feeding rhythm. Change it whenever you like and the reminders follow.',
    illustration: require('../../assets/onboarding/care.png'), // 772:21010
    cta: 'Next',
  },
  {
    id: 'notifications',
    figma: '772:20967',
    title: 'Get notified',
    body: 'Cultum tells you when a plant needs you, and stays quiet during the hours you set.',
    illustration: require('../../assets/onboarding/notifications.png'), // 772:20979
    cta: 'Continue',
  },
  {
    id: 'first-plant',
    figma: '772:20947',
    title: 'Add your first plant',
    body: 'Add a plant and Cultum will create a starting care rhythm in about a minute.',
    illustration: null,
    cta: 'Scan a plant',
    secondaryCta: 'Search by name',
  },
];
