import { supabase } from '../../lib/supabase';

export type ReportReason = 'name' | 'photo' | 'harassment' | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'name', label: 'Unangemessener Name' },
  { id: 'photo', label: 'Unangemessenes Profilbild' },
  { id: 'harassment', label: 'Belästigung oder Spam' },
  { id: 'other', label: 'Etwas anderes' },
];

export const REPORT_DETAILS_MAX = 500;

/** Sends a report about another account; the operator reviews it. */
export async function reportProfile(
  profileId: string,
  reason: ReportReason,
  details: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const { error } = await supabase
      .rpc('sk_report_profile', {
        p_profile_id: profileId,
        p_reason: reason,
        p_details: details.trim().slice(0, REPORT_DETAILS_MAX),
      })
      .abortSignal(controller.signal);
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'Keine Verbindung. Bitte später erneut versuchen.',
    };
  } finally {
    clearTimeout(timeout);
  }
}
