export function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
export function encodeBase64(value: Uint8Array) {
  let binary = '';
  for (let i = 0; i < value.length; i += 8192)
    binary += String.fromCharCode(...value.subarray(i, i + 8192));
  return btoa(binary);
}
/** Remove EXIF/XMP/IPTC/comments after re-encoding. Never parse or upload the original. */
export function stripJpegMetadata(data: Uint8Array): Uint8Array {
  if (data[0] !== 0xff || data[1] !== 0xd8)
    throw new Error('Ungültige Bilddatei.');
  const parts: Uint8Array[] = [data.slice(0, 2)];
  let offset = 2;
  while (offset < data.length) {
    if (data[offset] !== 0xff) throw new Error('Ungültige JPEG-Struktur.');
    const marker = data[offset + 1];
    if (marker === 0xda) {
      parts.push(data.slice(offset));
      break;
    }
    if (marker === 0xd9) {
      parts.push(data.slice(offset, offset + 2));
      break;
    }
    const length = (data[offset + 2] << 8) | data[offset + 3];
    if (length < 2 || offset + 2 + length > data.length)
      throw new Error('Beschädigte Bilddatei.');
    if (!((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe))
      parts.push(data.slice(offset, offset + 2 + length));
    offset += 2 + length;
  }
  const output = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let position = 0;
  for (const part of parts) {
    output.set(part, position);
    position += part.length;
  }
  if (output.length < 4 || output.at(-2) !== 0xff || output.at(-1) !== 0xd9)
    throw new Error('Unvollständige Bilddatei.');
  return output;
}
