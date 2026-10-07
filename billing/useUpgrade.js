import { useCallback } from 'react';
import { useRouter } from '../routing';

/**
 * Opens the paywall from an upgrade trigger. `source` names the trigger
 * ('today_banner', 'scan_limit', 'plant_limit', 'custom_reminders', 'settings');
 * PaywallScreen only acts on 'onboarding', the rest ride along for analytics.
 */
export function useUpgrade() {
  const { navigate } = useRouter();
  return useCallback((source) => navigate('paywall', { source }), [navigate]);
}
