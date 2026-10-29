export const phonePresets = [
  { label: 'Klein', width: 375, height: 812 },
  { label: 'Standard', width: 393, height: 852 },
  { label: 'Groß', width: 430, height: 932 },
] as const;

export function phonePreviewUrl(href: string) {
  const url = new URL(href);
  url.searchParams.set('__app_viewport', '1');
  url.searchParams.delete('preview');
  return url.href;
}

export function shouldShowPhonePreview(href: string, width: number) {
  const params = new URL(href).searchParams;
  return (
    width >= 700 &&
    params.get('__app_viewport') !== '1' &&
    params.get('preview') !== 'off'
  );
}

export function phonePreviewScale(
  width: number,
  height: number,
  deviceWidth: number,
  deviceHeight: number,
) {
  return Math.max(
    0.1,
    Math.min(
      1,
      (width - 48) / (deviceWidth + 20),
      (height - 142) / (deviceHeight + 20),
    ),
  );
}
