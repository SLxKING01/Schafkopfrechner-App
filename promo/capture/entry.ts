// Nur für Promo-Aufnahmen: startet die unveränderte App und legt Stores und
// Tarif-Rechner auf `window.__promo`, damit das Aufnahme-Skript Demo-Runden
// über die echten Store-Aktionen der App erzeugen kann (gleiche Prüfungen und
// Beträge wie bei einer Eingabe von Hand). Wird nie vom normalen
// App-Einstieg (`index.ts`) geladen.
import { registerRootComponent } from 'expo';

import App from '../../App';
import { createDefaultTableSettings } from '../../src/constants/tableSettings';
import { useSharedTableStatus } from '../../src/services/shared/sharedTables';
import { useAuthStore } from '../../src/store/authStore';
import { useGameStore } from '../../src/store/gameStore';
import {
  calculatePartyAmount,
  calculateRoundTariff,
} from '../../src/utils/roundTariff';

(globalThis as unknown as { __promo: unknown }).__promo = {
  calculatePartyAmount,
  calculateRoundTariff,
  createDefaultTableSettings,
  useAuthStore,
  useGameStore,
  useSharedTableStatus,
};

registerRootComponent(App);
