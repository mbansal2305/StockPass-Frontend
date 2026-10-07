export function getImageSource(image: string | null | undefined): string {
  const value = image?.trim();
  if (!value) return '';

  if (/^data:/i.test(value)) {
    return value.replace(/(;base64,)(.*)$/is, (_match, prefix: string, data: string) => `${prefix}${data.replace(/\s/g, '')}`);
  }
  if (/^(https?:\/\/|blob:|\/\/)/i.test(value)) return value;

  const base64 = value.replace(/\s/g, '');
  const mimeType = base64.startsWith('/9j/') ? 'image/jpeg'
    : base64.startsWith('iVBOR') ? 'image/png'
    : base64.startsWith('UklGR') ? 'image/webp'
    : base64.startsWith('R0lGOD') ? 'image/gif'
    : null;

  if (mimeType) return `data:${mimeType};base64,${base64}`;
  if (base64.startsWith('/') || /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(base64)) return value;
  if (base64.length > 128 && /^[A-Za-z0-9+/]+=*$/.test(base64)) return `data:image/jpeg;base64,${base64}`;
  return value;
}