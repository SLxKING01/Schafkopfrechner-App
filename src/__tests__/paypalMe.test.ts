import { paypalMeHandle, paypalMePaymentURL } from '../utils/paypalMe';

it('accepts only the exact PayPal.Me host and a valid handle', () => {
  expect(paypalMeHandle(' HTTPS://PAYPAL.ME/Beispiel/ ')).toBe('Beispiel');
  expect(paypalMeHandle('paypal.me/Beispiel')).toBe('Beispiel');
  for (const input of [
    'http://paypal.me/Beispiel',
    'https://paypal.me.example/Beispiel',
    'https://paypal.me@evil.example/Beispiel',
    'https://evil.example@paypal.me/Beispiel',
    'https://paypal.me:443/Beispiel',
    'https://paypal.me/Beispiel/3EUR',
    'https://paypal.me/Beispiel?redirect=1',
    'https://paypal.me/Beispiel#test',
    'javascript:alert(1)',
  ])
    expect(paypalMeHandle(input)).toBeNull();
});

it('constructs an HTTPS URL with positive exact cents and explicit EUR', () => {
  expect(paypalMePaymentURL('BEISPIEL', 3.2)).toBe(
    'https://paypal.me/BEISPIEL/3.20EUR',
  );
  expect(paypalMePaymentURL('BEISPIEL', 0.01)).toBe(
    'https://paypal.me/BEISPIEL/0.01EUR',
  );
  for (const amount of [0, -1, 0.001, Infinity, NaN])
    expect(paypalMePaymentURL('BEISPIEL', amount)).toBeNull();
  expect(paypalMePaymentURL('example.com/x', 1)).toBeNull();
});
