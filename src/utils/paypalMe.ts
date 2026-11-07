import { toSafeCents } from './accounting';

const handlePattern = /^[A-Za-z0-9]{1,20}$/;

export function paypalMeHandle(input: string) {
  const match = /^(?:https:\/\/)?paypal\.me\/([A-Za-z0-9]{1,20})\/?$/i.exec(
    input.trim(),
  );
  return match?.[1] ?? null;
}

export function paypalMePaymentURL(handle: string, amount: number) {
  const cents = toSafeCents(amount);
  if (!handlePattern.test(handle) || cents === null || cents <= 0) return null;
  return `https://paypal.me/${handle}/${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}EUR`;
}
