import {
  passwordProblem,
  passwordRules,
  signUpErrorMessage,
} from '../utils/passwordRules';

test('requires eight characters with letters and digits', () => {
  expect(passwordProblem('')).toMatch(/zu kurz/);
  expect(passwordProblem('abc1234')).toMatch(/zu kurz/);
  expect(passwordProblem('abcdefgh')).toMatch(/Ziffer/);
  expect(passwordProblem('12345678')).toMatch(/Ziffer/);
  expect(passwordProblem('schafkopf1')).toBeNull();
  expect(passwordProblem('Übermut42')).toBeNull();
  expect(passwordRules('abc').map((rule) => rule.met)).toEqual([false, false]);
});

test('maps sign-up errors to German messages', () => {
  expect(signUpErrorMessage({ code: 'user_already_exists' })).toMatch(
    /schon einen Account/,
  );
  expect(signUpErrorMessage({ code: 'weak_password' })).toMatch(/zu schwach/);
  expect(signUpErrorMessage({ status: 429 })).toMatch(/Zu viele Versuche/);
  expect(signUpErrorMessage({ name: 'AuthRetryableFetchError' })).toMatch(
    /Internetverbindung/,
  );
  expect(signUpErrorMessage({ code: 'something_else' })).toMatch(
    /gerade nicht möglich/,
  );
});
