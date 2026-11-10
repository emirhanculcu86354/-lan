// Telefondan ilan ekleme/düzenleme: link + metin + ekran görüntüsü, dokunmatik boya-değişen şeması
import { arabaSvg, PARCA_AD, esc } from './render.js';
import { PARCALAR, norm } from './analysis.js';
import { ilanCikar, aiHazir } from './ai.js';

const $ = s => document.querySelector(s);
const SIRA = ['orijinal', 'lokal', 'boyali', 'degisen'];
const ALANLAR = ['baslik', 'marka', 'seri', 'model', 'yil', 'km', 'fiyat', 'tramer', 'vites', 'yakit', 'ilanTarihi', 'kimden', 'aciklama'];
const SAYI = new Set(['yil', 'km', 'fiyat', 'tramer']);
let S = { parcalar: {}, gorseller: [], onceki: null }, ayarAl, kaydet;

const sayiyaCevir = v => { const d = String(v ?? '').replace(/\D/g, ''); return d === '' ? null : +d; };
const sayiGoster = v => v == null ? '' : Number(v).toLocaleString('tr-TR');

function semaCiz() { $('#ekle-sema').innerHTML = arabaSvg(S.parcalar, { etkilesimli: true }); }
function parcaDegistir(id) {
  const simdi = S.parcalar[id] || 'orijinal';
  const yeni = SIRA[(SIRA.indexOf(simdi) + 1) % SIRA.length];
  if (yeni === 'orijinal') delete S.parcalar[id]; else S.parcalar[id] = yeni;
  semaCiz();
  $(`#ekle-sema [data-parca="${id}"]`)?.focus();
}
function hasardanParcalar(h = {}) {
  const p = {};
  for (const d of ['lokal', 'boyali', 'degisen'])
    for (const ad of h[d] || []) { const x = PARCALAR.find(k => k.re.test(norm(ad))); if (x) p[x.id] = d; }
  return p;
}

export async function kucult(dosya) {
  const bmp = await createImageBitmap(dosya);
  const o = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * o); c.height = Math.round(bmp.height * o);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}
async function gorselEkle(dosyalar) {
  for (const d of [...dosyalar].slice(0, 6 - S.gorseller.length)) S.gorseller.push(await kucult(d));
  $('#ekle-gorsel-sayi').textContent = S.gorseller.length ? `${S.gorseller.length} görsel eklendi` : '';
  $('#ekle-onizleme').innerHTML = S.gorseller.map(b => `<img src="data:image/jpeg;base64,${b}" alt="">`).join('');
}

function formuDoldur(v) {
  const f = $('#ekle-form').elements;
  for (const k of ALANLAR) if (v[k] != null && f[k]) f[k].value = SAYI.has(k) && k !== 'yil' ? sayiGoster(v[k]) : v[k];
}

async function yapayZekaOku() {
  const durum = $('#ekle-durum'), btn = $('#ekle-ai');
  const metin = $('#ekle-form').elements.metin.value.trim();
  if (!S.gorseller.length && !metin) { durum.textContent = 'Önce ekran görüntüsü ekle ya da ilan metnini yapıştır.'; return; }
  btn.disabled = true; durum.textContent = 'Okunuyor… (10–30 sn)';
  try {
    const j = await ilanCikar(ayarAl(), { metin, gorseller: S.gorseller });
    formuDoldur(j);
    const p = hasardanParcalar(j.hasar);
    if (Object.keys(p).length) { S.parcalar = p; semaCiz(); }
    durum.textContent = 'Okundu. Alanları ve şemayı kontrol et, yanlışı düzelt.';
  } catch (e) { durum.textContent = e.message; }
  btn.disabled = false;
}

export function ekleKur({ ayar, kaydetFn }) {
  ayarAl = ayar; kaydet = kaydetFn;
  $('#ekle-sema').addEventListener('click', e => { const id = e.target.closest('[data-parca]')?.dataset.parca; if (id) parcaDegistir(id); });
  $('#ekle-sema').addEventListener('keydown', e => {
    const id = e.target.dataset?.parca;
    if (id && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); parcaDegistir(id); }
  });
  $('#ekle-dosya').addEventListener('change', e => gorselEkle(e.target.files));
  $('#ekle-ai').onclick = yapayZekaOku;
  $('#ekle-iptal').onclick = () => $('#ekle-dialog').close();
  $('#ekle-form').addEventListener('blur', e => {
    if (SAYI.has(e.target.name) && e.target.name !== 'yil' && e.target.value) e.target.value = sayiGoster(sayiyaCevir(e.target.value));
  }, true);
  $('#ekle-form').onsubmit = e => {
    e.preventDefault();
    const f = e.target.elements;
    const v = {};
    for (const k of ALANLAR) { const x = f[k].value.trim(); v[k] = SAYI.has(k) ? sayiyaCevir(x) : (x || null); }
    if (!v.fiyat || !v.yil) { $('#ekle-durum').textContent = 'Fiyat ve yıl gerekli.'; return; }
    const link = f.link.value.trim().split('?')[0].split('#')[0];
    const o = S.onceki;
    const url = /^https?:\/\//.test(link) ? link : (o?.url || `elle:${Date.now()}`);
    const site = /sahibinden/.test(url) ? 'sahibinden' : /arabam/.test(url) ? 'arabam' : (o?.site || null);
    const hasarHam = { boyali: [], lokal: [], degisen: [] };
    for (const [id, d] of Object.entries(S.parcalar)) hasarHam[d].push(PARCA_AD[id]);
    const gecmis = [...(o?.gecmis || [])];
    if (gecmis.at(-1)?.fiyat !== v.fiyat) gecmis.push({ t: Date.now(), fiyat: v.fiyat });
    kaydet({
      ...(o || {}), ...v, url, site, hasarHam, gecmis,
      eklenme: o?.eklenme || Date.now(), kontrol: Date.now(), durum: 'aktif', kaynakTip: o?.kaynakTip || 'telefon'
    }, o && o.url !== url ? o.url : null);
    $('#ekle-dialog').close();
  };
}

// onceki: düzenlenecek ilan; paylasim: { link, metin, dosyalar }
export async function ekleAc(onceki = null, paylasim = null) {
  S = { parcalar: onceki ? hasardanParcalar(onceki.hasarHam) : {}, gorseller: [], onceki };
  const form = $('#ekle-form');
  form.reset();
  $('#ekle-baslik').textContent = onceki ? 'İlanı düzenle' : 'İlan ekle';
  $('#ekle-durum').textContent = ''; $('#ekle-onizleme').innerHTML = ''; $('#ekle-gorsel-sayi').textContent = '';
  if (onceki) { formuDoldur(onceki); if (/^https?:/.test(onceki.url)) form.elements.link.value = onceki.url; }
  if (paylasim) {
    if (paylasim.link) form.elements.link.value = paylasim.link;
    if (paylasim.metin) form.elements.metin.value = paylasim.metin;
  }
  semaCiz();
  $('#ekle-dialog').showModal();
  if (paylasim?.dosyalar?.length) {
    await gorselEkle(paylasim.dosyalar);
    if (aiHazir(ayarAl())) yapayZekaOku();
  }
}
export { esc };
