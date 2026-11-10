// Telefonda/tarayıcıda yerel depolama ve ayarlar
import { VARSAYILAN_AGIRLIK } from './analysis.js';
const VERI = 'ir-veri', AYAR = 'ir-ayar';
export const bosVeri = () => ({ ilanlar: {}, raporlar: {}, silinenler: {} });
export function yerelOku() {
  try { return { ...bosVeri(), ...JSON.parse(localStorage.getItem(VERI) || '{}') }; } catch { return bosVeri(); }
}
export function yerelYaz(v) { localStorage.setItem(VERI, JSON.stringify(v)); }
export function ayarOku() {
  let a = {};
  try { a = JSON.parse(localStorage.getItem(AYAR) || '{}'); } catch {}
  return { saglayici: 'gemini', geminiKey: '', geminiModel: 'gemini-3.5-flash', apiKey: '', model: 'claude-sonnet-5-5',
    ghToken: '', gistId: '', ekSiteler: '', sonArama: null, ...a, agirlik: { ...VARSAYILAN_AGIRLIK, ...(a.agirlik || {}) } };
}
export function ayarYaz(a) { localStorage.setItem(AYAR, JSON.stringify(a)); }
