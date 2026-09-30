/**
 * Writes tools/i18n/keys.json — the stable index of Persian content keys that
 * need a translation (edge-punctuated fragments whose bare form exists are
 * derived automatically by build-ar.mjs, so they are not listed).
 */
import fs from 'node:fs';
const { default: en } = await import('../../src/locales/content-en.js');
export const EDGE = /^[\s—–·•:،,;()«»“”"]+|[\s—–·•:،,;()«»“”"]+$/g;
const keys = Object.keys(en).filter((k) => {
  const bare = k.replace(EDGE, '');
  return !(bare !== k && en[bare] !== undefined);
});
fs.writeFileSync(new URL('./keys.json', import.meta.url), JSON.stringify(keys, null, 0));
console.log(Object.keys(en).length, '→', keys.length);
