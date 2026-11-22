export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRule = {
  id: 'length' | 'mix';
  label: string;
  met: boolean;
};

/** Rules shown below password fields (registration and password reset). */
export function passwordRules(password: string): PasswordRule[] {
  return [
    {
      id: 'length',
      label: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`,
      met: [...password].length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: 'mix',
      label: 'Buchstaben und Ziffern',
      met: /\p{L}/u.test(password) && /\d/.test(password),
    },
  ];
}

/** German error message for the first unmet rule, or null if all are met. */
export function passwordProblem(password: string): string | null {
  const unmet = passwordRules(password).find((rule) => !rule.met);
  if (!unmet) return null;
  return unmet.id === 'length'
    ? `Das Passwort ist zu kurz. Bitte mindestens ${PASSWORD_MIN_LENGTH} Zeichen verwenden.`
    : 'Das Passwort braucht Buchstaben und mindestens eine Ziffer.';
}

/** Maps Supabase auth errors during sign-up to German messages. */
export function signUpErrorMessage(error: {
  code?: string;
  status?: number;
  name?: string;
}): string {
  switch (error.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'Zu dieser E-Mail-Adresse gibt es schon einen Account. Melde dich an oder setze dein Passwort zurück.';
    case 'weak_password':
      return 'Das Passwort ist zu schwach. Bitte wähle ein längeres Passwort mit Buchstaben und Ziffern.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Bitte gib eine gültige E-Mail-Adresse ein.';
    case 'signup_disabled':
      return 'Neue Registrierungen sind gerade nicht möglich.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.';
  }
  if (error.status === 429)
    return 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.';
  if (error.name === 'AuthRetryableFetchError')
    return 'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.';
  return 'Die Registrierung ist gerade nicht möglich. Bitte versuche es später erneut.';
}
