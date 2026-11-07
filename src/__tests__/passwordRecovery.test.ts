import { clearRecoverySession, passwordRecoveryClient } from '../lib/supabase';
import {
  openPasswordRecovery,
  parseRecoveryLink,
  requestPasswordRecovery,
  saveRecoveredPassword,
} from '../services/auth/passwordRecovery';

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  clearRecoverySession: jest.fn(),
  passwordRecoveryClient: {
    auth: {
      resetPasswordForEmail: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));

const auth = jest.mocked(passwordRecoveryClient.auth);
const callback = 'schafkopfrechner://passwort-zuruecksetzen';

it('recognizes only the recovery destination and reads a PKCE code', () => {
  expect(parseRecoveryLink(`${callback}?code=example`)).toEqual({
    code: 'example',
    web: false,
  });
  expect(parseRecoveryLink(`${callback}?error_code=otp_expired`)).toEqual({
    code: null,
    web: false,
  });
  expect(
    parseRecoveryLink('schafkopfrechner://spiel-eintragen?code=example'),
  ).toBeNull();
  expect(parseRecoveryLink('https://example.com/?code=example')).toBeNull();
});

it('requests the callback without exposing an unknown email address', async () => {
  auth.resetPasswordForEmail.mockResolvedValueOnce({
    data: null,
    error: { code: 'user_not_found' } as never,
  });
  await expect(
    requestPasswordRecovery(' test@example.com '),
  ).resolves.toBeUndefined();
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
    redirectTo: callback,
  });
});

it('rejects an expired link and saves the password only in the recovery client', async () => {
  auth.exchangeCodeForSession.mockResolvedValueOnce({
    data: { session: null, user: null },
    error: { code: 'otp_expired' } as never,
  });
  await expect(openPasswordRecovery('expired')).resolves.toBe(false);
  auth.exchangeCodeForSession.mockResolvedValueOnce({
    data: { session: {} as never, user: {} as never },
    error: null,
  });
  await expect(openPasswordRecovery('valid')).resolves.toBe(true);
  auth.updateUser.mockResolvedValueOnce({
    data: { user: {} as never },
    error: null,
  });
  await saveRecoveredPassword('neues-passwort');
  expect(auth.updateUser).toHaveBeenCalledWith({ password: 'neues-passwort' });
  expect(clearRecoverySession).toHaveBeenCalled();
});
