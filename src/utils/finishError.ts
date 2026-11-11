import { BalanceMismatchError } from './accounting';
import { formatOverviewMoney } from './gameOverview';

const GENERIC_FINISH_ERROR =
  'Bitte prüfe den aktiven Tisch und seine Rundeneinträge. Ungültige Abrechnungsdaten werden nicht abgeschlossen.';

/** Explains why a table could not be closed, naming the exact gap if known. */
export function describeFinishError(error: unknown): string {
  if (!(error instanceof BalanceMismatchError)) return GENERIC_FINISH_ERROR;
  const cents = error.differenceCents;
  const gap = `${cents > 0 ? '+' : ''}${formatOverviewMoney(cents)}`;
  const subject = error.includesStock
    ? 'Die Salden und der Stock ergeben'
    : 'Die Salden ergeben';
  return `${subject} zusammen ${gap} statt 0,00 €. Es wurde kein Zahlungsplan erstellt. Bitte die Einträge dieses Tisches prüfen und die Differenz von ${formatOverviewMoney(Math.abs(cents))} klären.`;
}
