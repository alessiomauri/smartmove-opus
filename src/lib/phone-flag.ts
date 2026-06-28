// Best-effort country flag for a lead: derive from the phone's international
// calling code; fall back to the captured geo country code.

const CALLING_CODES: [string, string][] = [
  ['+351', 'PT'], ['+353', 'IE'], ['+352', 'LU'], ['+358', 'FI'], ['+380', 'UA'],
  ['+972', 'IL'], ['+971', 'AE'], ['+966', 'SA'], ['+212', 'MA'], ['+420', 'CZ'],
  ['+852', 'HK'], ['+34', 'ES'], ['+44', 'GB'], ['+33', 'FR'], ['+49', 'DE'],
  ['+39', 'IT'], ['+31', 'NL'], ['+32', 'BE'], ['+41', 'CH'], ['+43', 'AT'],
  ['+45', 'DK'], ['+46', 'SE'], ['+47', 'NO'], ['+48', 'PL'], ['+30', 'GR'],
  ['+90', 'TR'], ['+86', 'CN'], ['+91', 'IN'], ['+81', 'JP'], ['+82', 'KR'],
  ['+65', 'SG'], ['+61', 'AU'], ['+64', 'NZ'], ['+55', 'BR'], ['+52', 'MX'],
  ['+54', 'AR'], ['+56', 'CL'], ['+57', 'CO'], ['+27', 'ZA'], ['+36', 'HU'],
  ['+40', 'RO'], ['+7', 'RU'], ['+1', 'US'],
];
const SORTED = [...CALLING_CODES].sort((a, b) => b[0].length - a[0].length);

/** ISO-3166 alpha-2 → flag emoji (regional indicators). */
export function isoToFlag(iso?: string | null): string {
  if (!iso || iso.length !== 2) return '';
  const cc = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return String.fromCodePoint(...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

/** Country ISO from a phone number — only when it's in international form. */
export function phoneToIso(phone?: string | null): string | null {
  if (!phone) return null;
  let p = phone.trim().replace(/[\s\-().]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (!p.startsWith('+')) return null; // a local number can't be geolocated by prefix
  for (const [code, iso] of SORTED) if (p.startsWith(code)) return iso;
  return null;
}

/** Flag + ISO for a lead: phone country first, else captured geo country. */
export function leadFlag(phone?: string | null, geoCountryCode?: string | null): { flag: string; iso: string | null } {
  const iso = phoneToIso(phone) ?? (geoCountryCode ? geoCountryCode.toUpperCase() : null);
  return { flag: isoToFlag(iso), iso };
}
