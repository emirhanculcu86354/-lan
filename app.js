import { analizEt, grupAnahtari, firsatPuani, norm, uygunlukHesapla, parcaDurumu, gizlenenHasar, PARCALAR } from './analysis.js';
import { ilanKarti, arabaSvg, esc, tl, fiyatDegisimi, PARCA_AD } from './render.js';
import { KONTROL, ozelMaddeler, isaretli, ilerleme, ilerlemeHesapla } from './kontrol.js';
import { veriBirlestir, gistSenkron } from './sync.js';
import { yerelOku, yerelYaz, ayarOku, ayarYaz, bosVeri } from './veri.js';
import { modelRaporu, derinInceleme, internetteAra, aiHazir, aiEksikMesaji, VARSAYILAN_SITELER, ekspertizOku, sonKarar } from './ai.js';
import { ekleKur, ekleAc, kucult } from './ekle.js';

const $ = s => document.querySelector(s);
const D = { yerel: yerelOku(), kopru: null, dosya: null, dosyaAd: '', ornek: null, ornekModu: false,
  ilanlar: [], raporlar: {}, analiz: new Map(), secili: new Set(), limit: 40, liste: [], mesgul: new Set() };
let ayar = ayarOku();
const mn = v => `${(v / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} mn`;
const medyan = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const liste = a => a?.length ? `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
const grupAdi = i => `${i.marka || ''} ${i.seri || ''}`.trim() || grupAnahtari(i);

function bildirim(metin, hata = false) {
  const b = $('#bildirim');
  b.textContent = metin; b.className = `bildirim${hata ? ' hata' : ''}`; b.hidden = false;
  clearTimeout(bildirim.t); bildirim.t = setTimeout(() => b.hidden = true, hata ? 6000 : 3000);
}

// ---------- Veri kaynakları ve birleştirme ----------
function hesapla() {
  let v = D.yerel; const kaynak = [];
  if (Object.keys(D.yerel.ilanlar).length) kaynak.push('bu cihaz');
  if (D.kopru) { v = veriBirlestir(v, D.kopru); kaynak.push('eklenti'); }
  if (D.dosya) { v = veriBirlestir(v, D.dosya); kaynak.push(D.dosyaAd); }
  let ilanlar = Object.values(v.ilanlar).filter(i => i && i.fiyat);
  D.ornekModu = !ilanlar.length && !!D.ornek?.length;
  if (D.ornekModu) ilanlar = D.ornek;
  D.ilanlar = ilanlar;
  D.raporlar = v.raporlar || {};
  D.analiz = new Map(ilanlar.map(i => [i.url, analizEt(i, ilanlar)]));
  D.sonAramaT = Math.max(0, ...ilanlar.map(i => i.aramaT || 0));
  $('#bant').hidden = !D.ornekModu;
  $('#kaynak').textContent = D.ornekModu ? 'Örnek veri' : kaynak.join(' + ');
  secenekler(); ciz();
}

function yerelKaydet() { yerelYaz(D.yerel); hesapla(); otoSenkron(); }
function ilanKaydet(ilan, eskiUrl = null) {
  if (eskiUrl) { delete D.yerel.ilanlar[eskiUrl]; D.yerel.silinenler[eskiUrl] = Date.now(); }
  D.yerel.ilanlar[ilan.url] = { ...ilan, degisim: Date.now() };
  delete D.yerel.silinenler[ilan.url];
  yerelKaydet();
}
function ilanSil(url) {
  delete D.yerel.ilanlar[url]; D.yerel.silinenler[url] = Date.now();
  if (D.kopru) delete D.kopru.ilanlar[url];
  yerelKaydet();
}

async function jsonGetir(ad) {
  try { const r = await fetch(ad, { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch { return null; }
}

let senkronZaman;
function otoSenkron() {
  if (!ayar.ghToken || !ayar.gistId) return;
  clearTimeout(senkronZaman); senkronZaman = setTimeout(() => senkron(true), 2500);
}
async function senkron(sessiz = false) {
  if (!ayar.ghToken) { if (!sessiz) ayarAc(); return; }
  const btn = $('#senkron-btn'); btn.classList.add('donuyor'); btn.disabled = true;
  try {
    const { veri, gistId } = await gistSenkron(ayar, D.yerel);
    D.yerel = { ...bosVeri(), ...veri }; yerelYaz(D.yerel);
    if (gistId !== ayar.gistId) { ayar.gistId = gistId; ayarYaz(ayar); }
    hesapla();
    if (!sessiz) bildirim(`Senkronlandı: ${Object.keys(veri.ilanlar).length} ilan`);
  } catch (e) { if (!sessiz) bildirim(e.message, true); }
  btn.classList.remove('donuyor'); btn.disabled = false;
}

// ---------- Filtreler ----------
function secenekler() {
  const f = $('#filtre');
  const doldur = (ad, ciftler) => {
    const sel = f.elements[ad], eski = sel.value;
    sel.innerHTML = '<option value="">Hepsi</option>' + ciftler.map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join('');
    sel.value = ciftler.some(([k]) => k === eski) ? eski : '';
  };
  const gruplar = new Map();
  D.ilanlar.forEach(i => { const k = grupAnahtari(i); if (!gruplar.has(k)) gruplar.set(k, grupAdi(i)); });
  doldur('model', [...gruplar]);
  const benzersiz = alan => [...new Set(D.ilanlar.map(i => i[alan]).filter(Boolean))].sort().map(v => [v, v]);
  doldur('vites', benzersiz('vites'));
  doldur('yakit', benzersiz('yakit'));
}

function filtreDegerleri() {
  const f = $('#filtre').elements, n = ad => +f[ad].value || null;
  return {
    q: norm($('#ara').value).split(' ').filter(Boolean), model: f.model.value, vites: f.vites.value, yakit: f.yakit.value,
    y1: n('y1'), y2: n('y2'), f1: n('f1'), f2: n('f2'), km: n('km'), hasar: f.hasar.value, tramer: f.tramer.value,
    siteler: new Set([...document.querySelectorAll('input[name=site]:checked')].map(x => x.value)),
    dusen: f.dusen.checked, aktif: f.aktif.checked
  };
}

function filtrele() {
  const f = filtreDegerleri();
  const etkin = [f.q.length, f.model, f.vites, f.yakit, f.y1, f.y2, f.f1, f.f2, f.km, f.hasar, f.tramer, f.dusen].filter(Boolean).length;
  $('#filtre-sayi').textContent = etkin ? `(${etkin} etkin)` : '';
  return gorunumIlanlari().filter(i => {
    const a = D.analiz.get(i.url);
    if (f.q.length) { const m = norm(`${i.baslik} ${i.marka} ${i.seri} ${i.model} ${i.yil} ${i.sehir || ''}`); if (!f.q.every(w => m.includes(w))) return false; }
    if (f.model && grupAnahtari(i) !== f.model) return false;
    if (f.vites && i.vites !== f.vites) return false;
    if (f.yakit && i.yakit !== f.yakit) return false;
    if (f.y1 && (i.yil ?? 0) < f.y1) return false;
    if (f.y2 && (i.yil ?? 9999) > f.y2) return false;
    if (f.f1 && i.fiyat < f.f1) return false;
    if (f.f2 && i.fiyat > f.f2) return false;
    if (f.km && (i.km ?? Infinity) > f.km) return false;
    if (f.hasar === 'degisensiz' && a.hasar.gruplu.degisen.length) return false;
    if (f.hasar === 'boyasiz' && Object.keys(a.parcalar).length) return false;
    if (f.tramer === 'yok' && i.tramer !== 0) return false;
    if (f.tramer === '50' && (i.tramer == null || i.tramer >= 50000)) return false;
    if (['sahibinden', 'arabam'].includes(i.site) && !f.siteler.has(i.site)) return false;
    if (f.dusen && !((fiyatDegisimi(i)?.fark ?? 0) < 0)) return false;
    if (f.aktif && i.durum === 'kaldirildi') return false;
    return true;
  }).map(i => ({ i, a: D.analiz.get(i.url) }));
}

// ---------- Görünümler: son arama / tüm ilanlar / kısa liste ----------
const sonArama = () => ayar.sonAramaSonuc;
function gorunumIlanlari(g = D.gorunum) {
  if (g === 'arama' && sonArama() && !D.ornekModu) return D.ilanlar.filter(i => i.aramaT === sonArama().t);
  if (g === 'kisa') return D.ilanlar.filter(i => i.kisaListe);
  return D.ilanlar;
}
function gorunumCiz() {
  const say = g => gorunumIlanlari(g).length;
  const sekmeler = [...(sonArama() && !D.ornekModu ? [['arama', 'Son arama']] : []), ['tum', 'Tüm ilanlar'], ['kisa', 'Kısa listem']];
  if (!sekmeler.some(([k]) => k === D.gorunum)) D.gorunum = sekmeler[0][0];
  $('#gorunum').innerHTML = sekmeler.map(([k, ad]) =>
    `<button role="tab" aria-selected="${k === D.gorunum}" class="gorunum-sekme${k === D.gorunum ? ' secili' : ''}" data-gorunum="${k}">${ad} <span>${say(k)}</span></button>`).join('');
  const s = sonArama(), ao = $('#arama-ozet');
  if (D.gorunum !== 'arama' || !s) { ao.hidden = true; return; }
  const k = s.kriter, tarih = new Date(s.t);
  const kriter = [k.arac, k.y1 || k.y2 ? `${k.y1 || '…'}–${k.y2 || '…'} model` : '', k.km ? `en fazla ${sayiYaz(k.km)} km` : '',
    k.fiyat ? `${sayiYaz(k.fiyat)} TL'ye kadar` : '', k.sehir, k.vites, k.yakit].filter(Boolean).join(', ');
  ao.hidden = false;
  ao.innerHTML = `<div class="ao-ust"><div><strong>${esc(kriter)}</strong>
      <p class="kucuk">${tarih.toLocaleDateString('tr-TR')} ${tarih.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}, ${s.kapsam === 'genis' ? 'geniş' : 'hızlı'} arama:
      ${s.siteler.map(x => `${esc(x.ad)} <b class="${x.hata && !x.sayi ? 'hata' : ''}">${x.hata && !x.sayi ? 'hata' : x.sayi}</b>`).join(', ')}</p></div>
    <div class="ao-dugmeler"><button class="ikincil kucuk-btn" data-ara-degistir>Kriterleri değiştir</button><button class="kucuk-btn" data-ara-yenile>Yenile</button></div></div>
    <details class="ao-site" ${s.toplam ? '' : 'open'}><summary>${s.toplam ? `Neden sadece ${s.toplam} ilan? Hepsini gör` : 'Sitenin kendisinde ara'}</summary>
      <p class="kucuk">Yapay zekâ Google’da arar ve her sorguda en fazla 20 ilan getirebilir; Google da sitelerdeki ilanların ancak bir kısmını tarar. Sahibinden’de yüzlerce ilanın hepsini görmek için aramayı sitenin kendisinde aç${s.kapsam === 'genis' ? '' : ' ya da “Geniş” kapsamla tekrar ara'}. Bilgisayarda eklenti açıkken o sayfadaki tüm ilanları tek dokunuşla buraya toplayabilirsin.</p>
      <div class="satir sar">${siteLinkleri(k).map(([ad, url]) => `<a class="dugme ikincil" href="${esc(url)}" target="_blank" rel="noopener">${ad}’de aç</a>`).join('')}</div>
    </details>`;
}

const SIRALAMA = {
  uygun: (x, y) => y.uygun - x.uygun,
  firsat: (x, y) => firsatPuani(y.a) - firsatPuani(x.a),
  ucuz: (x, y) => x.i.fiyat - y.i.fiyat,
  pahali: (x, y) => y.i.fiyat - x.i.fiyat,
  km: (x, y) => (x.i.km ?? Infinity) - (y.i.km ?? Infinity),
  yil: (x, y) => (y.i.yil ?? 0) - (x.i.yil ?? 0),
  temiz: (x, y) => y.a.hasar.skor - x.a.hasar.skor,
  dusus: (x, y) => (fiyatDegisimi(x.i)?.fark ?? 0) - (fiyatDegisimi(y.i)?.fark ?? 0)
};

// ---------- Çizim ----------
function ciz() {
  gorunumCiz();
  const l = uygunlukHesapla(filtrele(), ayar.agirlik).sort(SIRALAMA[$('#sira').value]);
  D.liste = l;
  raporCiz(l); ozetCiz(l); grafikCiz(l);
  $('#sayi').textContent = `${l.length} ilan`;
  $('#liste').innerHTML = l.length
    ? l.slice(0, D.limit).map(x => ilanKarti(x.i, x.a, { karsilastir: true, secili: D.secili.has(x.i.url), incele: true, uygunluk: x.uygun,
        kisaListe: true, yeni: !!x.i.yeniT && x.i.yeniT === D.sonAramaT, ilerleme: ilerleme(x.i) })).join('')
    : `<div class="bos">${bosMesaj()}</div>`;
  $('#daha').hidden = l.length <= D.limit;
  karsBar();
}

function bosMesaj() {
  if (!D.ilanlar.length) return 'Henüz ilan yok. Yukarıdaki kutuya aradığın aracı yaz ya da "İnternette ara"ya bas.';
  if (!gorunumIlanlari().length) return D.gorunum === 'kisa' ? 'Kısa listen boş. Beğendiğin ilanlarda ★ düğmesine bas.'
    : D.gorunum === 'arama' ? 'Bu aramada ilan bulunamadı. Kriterleri gevşet, “Geniş” kapsamı dene ya da yukarıdan aramayı sitenin kendisinde aç.' : 'Henüz ilan yok.';
  return 'Bu filtrelere uyan ilan yok. “Sonuçları daralt” bölümünde birkaç filtreyi gevşet.';
}

// Ekrandaki ilanların çoğu tek modelse o modelin anahtarı
function aktifModel(l) {
  const secilen = $('#filtre').elements.model.value;
  if (secilen) return secilen;
  const say = {}; l.forEach(x => { const k = grupAnahtari(x.i); say[k] = (say[k] || 0) + 1; });
  const [k, n] = Object.entries(say).sort((a, b) => b[1] - a[1])[0] || [];
  return n && n / l.length >= 0.6 ? k : null;
}

const RISK = { dusuk: 'Düşük risk', orta: 'Orta risk', yuksek: 'Yüksek risk' };
function raporCiz(l) {
  const k = aktifModel(l);
  if (!k) { $('#rapor').innerHTML = ''; return; }
  const ornekIlan = D.ilanlar.find(i => grupAnahtari(i) === k);
  const ad = ornekIlan ? grupAdi(ornekIlan) : k;
  const r = D.raporlar[k];
  if (D.mesgul.has(`rapor:${k}`)) {
    $('#rapor').innerHTML = `<section class="kutu rapor"><h2>${esc(ad)} araştırılıyor…</h2><p class="kucuk">Kullanıcı yorumları, kronik arızalar ve geri çağırmalar taranıyor. 1–2 dakika sürebilir; bu sırada listeye bakmaya devam edebilirsin.</p><div class="yukleniyor"></div></section>`;
    return;
  }
  if (!r) {
    $('#rapor').innerHTML = `<section class="kutu rapor bos-rapor">
      <h2>${esc(ad)} almadan önce</h2>
      <p>Bu modelin kronik arızalarını, motor ve şanzıman risklerini, hangi yılın ve paketin tercih edilmesi gerektiğini web’den araştırır. Sonuç her ilanın derin incelemesinde de kullanılır.</p>
      <button data-rapor="${esc(k)}">Model araştırmasını başlat</button></section>`;
    return;
  }
  $('#rapor').innerHTML = `<details class="kutu rapor" ${D.raporKapali ? '' : 'open'} id="rapor-detay">
    <summary><h2>${esc(ad)} alım rehberi</h2></summary>
    <p>${esc(r.ozet)}</p>
    <div class="tavsiye">
      <div class="t-iyi"><strong>Tercih et</strong><p>${esc(r.tavsiye?.tercihEt)}</p></div>
      <div class="t-kotu"><strong>Kaçın</strong><p>${esc(r.tavsiye?.kacin)}</p></div>
    </div>
    ${r.motorSanziman?.length ? `<h3>Motor ve şanzıman</h3><ul class="motorlar">${r.motorSanziman.map(m =>
      `<li><span class="risk risk-${esc(m.risk)}">${RISK[m.risk] || esc(m.risk)}</span><strong>${esc(m.ad)}</strong><span>${esc(m.yorum)}</span></li>`).join('')}</ul>` : ''}
    ${r.kronik?.length ? `<h3>Bilinen sorunlar</h3>${r.kronik.map(s => `<details class="sorun"><summary>${esc(s.baslik)}${s.hangiYillar ? ` <span class="kucuk">${esc(s.hangiYillar)}</span>` : ''}</summary>
      <p>${esc(s.detay)}</p>${s.belirti ? `<p><strong>Nasıl anlaşılır:</strong> ${esc(s.belirti)}</p>` : ''}</details>`).join('')}` : ''}
    <div class="rapor-alt">
      <details><summary>Satıcıya sorulacaklar</summary>${liste(r.saticiyaSorular)}</details>
      <details><summary>Test sürüşünde dikkat</summary>${liste(r.testSurusu)}</details>
      <details><summary>Bakım maliyeti ve geri çağırmalar</summary><p>${esc(r.bakimMaliyeti)}</p>${liste(r.geriCagirma?.filter(Boolean))}</details>
      ${r.kaynaklar?.length ? `<details><summary>Kaynaklar (${r.kaynaklar.length})</summary><ul>${r.kaynaklar.map(s =>
        `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.baslik || s.url)}</a></li>`).join('')}</ul></details>` : ''}
    </div>
    <p class="kucuk">${new Date(r.t).toLocaleDateString('tr-TR')} tarihinde web kaynaklarından derlendi; kesin bilgi değildir. <button class="baglanti" data-rapor="${esc(k)}">Yeniden araştır</button></p>
  </details>`;
  $('#rapor-detay').addEventListener('toggle', e => D.raporKapali = !e.target.open);
}

async function raporOlustur(k) {
  if (D.ornekModu) return bildirim('Örnek veride araştırma yapılmaz. Önce kendi ilanını ekle.', true);
  if (!aiHazir(ayar)) { bildirim(aiEksikMesaji(ayar), true); return ayarAc(); }
  const grup = D.ilanlar.filter(i => grupAnahtari(i) === k);
  const yillar = grup.map(i => i.yil).filter(Boolean);
  D.mesgul.add(`rapor:${k}`); ciz();
  try {
    const r = await modelRaporu(ayar, {
      ad: grupAdi(grup[0]), yillar: yillar.length ? `${Math.min(...yillar)}–${Math.max(...yillar)}` : 'bilinmiyor',
      paketler: [...new Set(grup.map(i => i.model).filter(Boolean))].slice(0, 10),
      motorlar: [...new Set(grup.map(i => [i.yakit, i.vites].filter(Boolean).join(' ')).filter(Boolean))]
    });
    D.yerel.raporlar[k] = r;
    D.mesgul.delete(`rapor:${k}`);
    yerelKaydet();
    bildirim('Model araştırması hazır');
  } catch (e) { D.mesgul.delete(`rapor:${k}`); ciz(); bildirim(e.message, true); }
}

function ozetCiz(l) {
  if (!l.length) { $('#ozet').hidden = true; return; }
  $('#ozet').hidden = false;
  const fiyatlar = l.map(x => x.i.fiyat), min = Math.min(...fiyatlar), max = Math.max(...fiyatlar), med = medyan(fiyatlar);
  const enUcuz = l.find(x => x.i.fiyat === min);
  const enUygun = [...l].sort((a, b) => b.uygun - a.uygun)[0];
  const k = aktifModel(l);
  const baslik = k ? `${grupAdi(enUcuz.i)} fiyatları` : 'Tüm modeller';
  const W = Math.max(300, Math.min(900, $('#ozet').clientWidth - 36)), sol = 8, sag = 8;
  const x = v => sol + (max === min ? 0.5 : (v - min) / (max - min)) * (W - sol - sag);
  const noktalar = l.map(({ i, a }) =>
    `<circle class="nokta ${i.durum === 'kaldirildi' ? '' : a.fiyat.sinif}" cx="${x(i.fiyat).toFixed(1)}" cy="16" r="6" data-git="${esc(i.url)}"><title>${esc(i.baslik)}: ${tl(i.fiyat)}</title></circle>`).join('');
  $('#ozet').innerHTML = `<h2>${esc(baslik)}</h2>
    <div class="ozet-sayilar">
      <div><span class="kucuk">En düşük</span><strong><a href="#" data-git="${esc(enUcuz.i.url)}">${tl(min)}</a></strong></div>
      <div><span class="kucuk">Orta fiyat</span><strong>${tl(Math.round(med / 1000) * 1000)}</strong></div>
      <div><span class="kucuk">En yüksek</span><strong>${tl(max)}</strong></div>
      <div><span class="kucuk">Sana en uygun</span><strong><a href="#" data-git="${esc(enUygun.i.url)}">${tl(enUygun.i.fiyat)}</a></strong></div>
    </div>
    <svg class="aralik" viewBox="0 0 ${W} 44" role="img" aria-label="Fiyat aralığı: her nokta bir ilan">
      <line class="hat" x1="${sol}" y1="16" x2="${W - sag}" y2="16"/>
      <line class="med" x1="${x(med)}" y1="4" x2="${x(med)}" y2="28"/>
      ${noktalar}
      <text x="${sol}" y="42">${mn(min)}</text><text x="${x(med)}" y="42" text-anchor="middle">orta ${mn(med)}</text>
      <text x="${W - sag}" y="42" text-anchor="end">${mn(max)}</text>
    </svg>`;
}

function grafikCiz(l) {
  if (!$('#grafik-kutu').open) return;
  const veri = l.filter(x => x.i.km != null);
  if (veri.length < 3) { $('#grafik').innerHTML = '<p class="kucuk">Grafik için en az 3 ilan gerekli.</p>'; return; }
  const W = Math.max(340, Math.min(900, $('#grafik').clientWidth || 600)), H = W < 500 ? 300 : 280, L = 58, B = 30, T = 10, R = 10;
  const kms = veri.map(x => x.i.km), fs = veri.map(x => x.i.fiyat);
  const k0 = Math.min(...kms), k1 = Math.max(...kms) || 1, f0 = Math.min(...fs) * 0.97, f1 = Math.max(...fs) * 1.03;
  const X = v => L + (k1 === k0 ? 0.5 : (v - k0) / (k1 - k0)) * (W - L - R);
  const Y = v => T + (1 - (v - f0) / (f1 - f0)) * (H - T - B);
  const tik = (a, b) => [0, 1, 2, 3].map(n => a + (b - a) * n / 3);
  const eksen = tik(f0, f1).map(v => `<line class="eksen" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${mn(v)}</text>`).join('')
    + tik(k0, k1).map(v => `<text x="${X(v)}" y="${H - 10}" text-anchor="middle">${Math.round(v / 1000)} bin km</text>`).join('');
  const nok = veri.map(({ i, a }) => `<circle class="nokta ${a.fiyat.sinif}" cx="${X(i.km).toFixed(1)}" cy="${Y(i.fiyat).toFixed(1)}" r="6" data-git="${esc(i.url)}"><title>${esc(i.baslik)}: ${tl(i.fiyat)}, ${Number(i.km).toLocaleString('tr-TR')} km</title></circle>`).join('');
  const yillar = {};
  l.forEach(({ i }) => { if (i.yil) (yillar[i.yil] ??= []).push(i.fiyat); });
  const cipler = Object.keys(yillar).sort().map(y => `<span>${y}: <strong>${mn(medyan(yillar[y]))}</strong> (${yillar[y].length})</span>`).join('');
  $('#grafik').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Km ve fiyat dağılımı">${eksen}${nok}</svg>
    <p class="kucuk">Yeşil noktalar fiyatı iyi olanlar. Noktaya dokununca ilana gider. Yıllara göre orta fiyat:</p><div class="yillar">${cipler}</div>`;
}

function git(url) {
  const sira = D.liste.findIndex(x => x.i.url === url);
  if (sira >= D.limit) { D.limit = sira + 10; ciz(); }
  const kart = document.querySelector(`#liste article[data-url="${CSS.escape(url)}"]`);
  if (!kart) return;
  kart.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  kart.classList.add('vurgu'); setTimeout(() => kart.classList.remove('vurgu'), 1800);
}

// ---------- İlan detayı: değerlendirme, kontrol listesi, ekspertiz, notlar ----------
const KARAR = { al: ['Alınabilir', 'iyi'], dikkat: ['Dikkatli ol', 'orta'], alma: ['Alma', 'kotu'] };
const SEKMELER = [['deger', 'Özet'], ['kontrol', 'Kontrol'], ['eksp', 'Ekspertiz'], ['not', 'Notlar']];
const LEJANT = `<div class="lejant dikey"><span><i style="background:var(--orijinal)"></i>Orijinal</span><span><i style="background:var(--lokal)"></i>Lokal boyalı</span>
  <span><i style="background:var(--boyali)"></i>Boyalı</span><span><i style="background:var(--degisen)"></i>Değişen</span></div>`;
D.sekme = 'deger';
D.gorunum = ayar.sonAramaSonuc ? 'arama' : 'tum';
const bul = url => D.ilanlar.find(x => x.url === url);

function guncelle(url, degisim) {
  if (D.ornekModu) { bildirim('Örnek ilanlar değiştirilemez. Kendi ilanlarını ekle.', true); return false; }
  const i = bul(url); if (!i) return false;
  ilanKaydet({ ...i, ...degisim });
  return true;
}

function incelemeHtml(i, url) {
  const n = i.inceleme;
  if (D.mesgul.has(`inc:${url}`)) return `<div class="inceleme"><h3>İnceleniyor…</h3><div class="yukleniyor"></div></div>`;
  if (n) return `<div class="inceleme karar-${KARAR[n.karar]?.[1] || 'notr'}">
    <h3>Derin inceleme: ${KARAR[n.karar]?.[0] || esc(n.karar)}</h3><p>${esc(n.ozet)}</p>
    ${n.artilar?.length ? `<h4>Artılar</h4>${liste(n.artilar)}` : ''}
    ${n.riskler?.length ? `<h4>Riskler</h4>${liste(n.riskler)}` : ''}
    ${n.pazarlik ? `<h4>Pazarlık</h4><p>${esc(n.pazarlik)}</p>` : ''}
    <p class="kucuk">Satıcıya sorulacaklar ve ekspertiz maddeleri kontrol listesine eklendi. ${new Date(n.t).toLocaleDateString('tr-TR')} tarihli. <button class="baglanti" data-inc="${esc(url)}">Yeniden incele</button></p></div>`;
  const raporVar = !!D.raporlar[grupAnahtari(i)];
  return `<div class="inceleme bos-inc"><h3>Bu araç sıkıntılı mı?</h3>
    <p>İlanı, fiyat ve hasar analizini${raporVar ? ', model araştırmasını' : ''}${i.ekspertiz ? ' ve ekspertiz raporunu' : ''} birlikte değerlendirir: karar, riskler, satıcıya sorulacaklar, ekspertizde nelere baktırılacağı.</p>
    ${raporVar ? '' : '<p class="kucuk">İpucu: önce model araştırmasını yaparsan inceleme o modelin kronik sorunlarını da hesaba katar.</p>'}
    <button data-inc="${esc(url)}">Derin inceleme yap</button></div>`;
}

function kontrolHtml(i) {
  const grup = (ad, maddeler) => `<fieldset class="kontrol-grup"><legend>${esc(ad)}</legend>${maddeler.map(([id, yazi]) =>
    `<label class="sec"><input type="checkbox" data-kontrol="${esc(id)}" ${isaretli(i, id) ? 'checked' : ''} ${id === 'rapor' && i.ekspertiz ? 'disabled' : ''}><span>${esc(yazi)}</span></label>`).join('')}</fieldset>`;
  const il = ilerlemeHesapla(i), ozel = ozelMaddeler(i);
  return `<div class="kontrol">
    <p class="kontrol-ozet"><strong>${il.biten}/${il.toplam}</strong> tamamlandı</p><div class="ilerleme-satir"><span style="width:${il.yuzde}%"></span></div>
    ${ozel.length ? grup('Bu araca özel', ozel) : '<p class="kucuk">Derin inceleme yaparsan bu araca özel sorular da buraya eklenir.</p>'}
    ${KONTROL.map(g => grup(g.grup, g.maddeler)).join('')}</div>`;
}

function ekspHtml(i) {
  const e = D.eksp?.url === i.url ? D.eksp : null;
  if (e) return `<div class="eksp-duzen">
    <p class="kucuk">Rapor fotoğraflarını yükle, yapay zekâ parçaları ve bulguları okusun. Ya da şemaya dokunarak kendin işaretle.</p>
    <label class="dosya-sec ikincil">Rapor fotoğrafı seç<input type="file" accept="image/*" multiple data-eksp-dosya></label>
    ${e.gorseller.length ? `<div class="onizleme">${e.gorseller.map(b => `<img src="data:image/jpeg;base64,${b}" alt="">`).join('')}</div>` : ''}
    <button type="button" data-eksp-oku ${e.okunuyor ? 'disabled' : ''}>${e.okunuyor ? 'Okunuyor…' : 'Yapay zekâ ile oku'}</button>
    <p class="kucuk" role="status">${esc(e.durum || '')}</p>
    <div class="sema-satir"><div class="ekle-sema" id="eksp-sema">${arabaSvg(e.parcalar, { etkilesimli: true })}</div>${LEJANT}</div>
    <label class="kucuk tam-etiket">Mekanik ve diğer bulgular (her satıra bir tane)<textarea rows="4" data-eksp-mekanik>${esc(e.mekanik)}</textarea></label>
    <label class="sec"><input type="checkbox" data-eksp-sasi ${e.sasiHasari ? 'checked' : ''}>Raporda şasi hasarı var</label>
    <div class="satir"><button data-eksp-kaydet>Ekspertizi kaydet</button><button class="ikincil" data-eksp-iptal>Vazgeç</button></div></div>`;
  if (!i.ekspertiz) return `<div class="inceleme bos-inc"><h3>Ekspertiz sonucu yok</h3>
    <p>Aracı bağımsız bir ekspertize götürdükten sonra raporu buraya ekle. İlanda yazanla karşılaştırılır; satıcının söylemediği hasar varsa hemen görürsün ve puanlar gerçek duruma göre güncellenir.</p>
    <button data-eksp-ac>Ekspertiz ekle</button></div>`;
  const ex = i.ekspertiz, gizli = gizlenenHasar(i);
  const mikron = Object.entries(ex.mikron || {}).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  return `<div class="eksp">
    ${gizli.length ? `<div class="inceleme karar-kotu"><h3>İlanda yazmayan hasar çıktı</h3>${liste(gizli)}<p>Satıcı bunları söylememiş. Pazarlıkta kullan; güvenin sarsıldıysa vazgeç.</p></div>`
      : `<div class="inceleme karar-iyi"><h3>İlanla uyumlu</h3><p>Ekspertizde ilanda yazandan fazla kaporta işlemi çıkmadı.</p></div>`}
    <div class="sema-kars"><figure>${arabaSvg(parcaDurumu(i, { ilanBeyani: true }))}<figcaption>İlanda yazan</figcaption></figure>
      <figure>${arabaSvg(ex.parcalar)}<figcaption>Ekspertizde çıkan</figcaption></figure>${LEJANT}</div>
    ${ex.sasiHasari ? '<p class="uyari-metin">Raporda şasi hasarı belirtilmiş. Bu, araçtan vazgeçmek için tek başına yeterli bir sebep olabilir.</p>' : ''}
    ${ex.mekanik?.length ? `<h4>Mekanik bulgular</h4>${liste(ex.mekanik)}` : ''}
    ${mikron.length ? `<h4>Boya kalınlığı</h4><table class="mikron">${mikron.map(([id, v]) => `<tr><td>${esc(PARCA_AD[id] || id)}</td><td>${v} µm</td></tr>`).join('')}</table>` : ''}
    ${ex.ozet ? `<p>${esc(ex.ozet)}</p>` : ''}
    <p class="kucuk">${new Date(ex.t).toLocaleDateString('tr-TR')} tarihli. <button class="baglanti" data-eksp-ac>Düzenle</button> <button class="baglanti" data-eksp-sil>Sil</button></p></div>`;
}

function notHtml(i) {
  return `<div class="notlar">
    <fieldset class="puan"><legend>Aracı gördükten sonra senin puanın</legend>${[1, 2, 3, 4, 5].map(n =>
      `<button type="button" class="yildiz${(i.puan || 0) >= n ? ' dolu' : ''}" data-puan="${n}" aria-label="${n} yıldız" aria-pressed="${(i.puan || 0) >= n}">★</button>`).join('')}</fieldset>
    <label class="sec"><input type="checkbox" data-kisa-cb ${i.kisaListe ? 'checked' : ''}>Kısa listemde</label>
    <label class="tam-etiket">Notların: satıcıyla konuşma, aracı görünce fark ettiklerin<textarea rows="7" data-notlar placeholder="Ör. Satıcı triger kayışının 60 binde değiştiğini söyledi, faturası var.">${esc(i.notlar || '')}</textarea></label>
    <p class="kucuk">Yazmayı bitirince kendiliğinden kaydedilir. Notların son kararda yapay zekâya da verilir.</p></div>`;
}

function detayAc(url, sekme = D.sekme) {
  const i = bul(url), a = D.analiz.get(url);
  if (!i) return;
  D.sekme = sekme;
  const govde = { deger: () => ilanKarti(i, a) + incelemeHtml(i, url), kontrol: () => kontrolHtml(i), eksp: () => ekspHtml(i), not: () => notHtml(i) }[sekme]();
  const dlg = $('#detay-dialog'), kaydir = dlg.scrollTop;
  $('#detay-icerik').innerHTML = `<div class="detay-bas"><strong>${esc(i.baslik)}</strong><span>${tl(i.fiyat)}</span></div>
    <div class="sekmeler" role="tablist">${SEKMELER.map(([k, ad]) =>
      `<button role="tab" aria-selected="${k === sekme}" class="sekme${k === sekme ? ' secili' : ''}" data-sekme="${k}">${ad}</button>`).join('')}</div>
    <div class="sekme-icerik" data-url="${esc(url)}">${govde}</div>
    <div class="satir sar detay-alt">
      ${/^https?:/.test(i.url) ? `<a class="dugme ikincil" href="${esc(i.url)}" target="_blank" rel="noopener">İlana git</a>` : ''}
      <button class="ikincil" data-duzenle="${esc(url)}">Düzenle</button>
      <button class="ikincil tehlike" data-sil="${esc(url)}">Sil</button>
      <button class="ikincil" data-kapat>Kapat</button></div>`;
  if (!dlg.open) dlg.showModal(); else dlg.scrollTop = kaydir;
}
const acikUrl = () => $('#detay-dialog').open ? $('#detay-icerik .sekme-icerik')?.dataset.url : null;

async function incele(url) {
  if (D.ornekModu) return bildirim('Örnek ilanlar incelenemez. Kendi ilanını ekle.', true);
  if (!aiHazir(ayar)) { bildirim(aiEksikMesaji(ayar), true); return ayarAc(); }
  const i = bul(url), a = D.analiz.get(url);
  D.mesgul.add(`inc:${url}`); detayAc(url);
  try {
    const n = await derinInceleme(ayar, { ...i, notlar: i.notlar, ekspertiz: i.ekspertiz }, a, D.raporlar[grupAnahtari(i)]);
    D.mesgul.delete(`inc:${url}`);
    ilanKaydet({ ...bul(url), inceleme: n });
  } catch (e) { D.mesgul.delete(`inc:${url}`); bildirim(e.message, true); }
  if (acikUrl() === url) detayAc(url);
}

// Ekspertiz düzenleme
function ekspBasla(url) {
  if (D.ornekModu) return bildirim('Örnek ilanlara ekspertiz eklenemez', true);
  const i = bul(url), ex = i.ekspertiz;
  D.eksp = { url, parcalar: { ...(ex?.parcalar || parcaDurumu(i, { ilanBeyani: true })) }, mikron: { ...(ex?.mikron || {}) },
    mekanik: (ex?.mekanik || []).join('\n'), sasiHasari: !!ex?.sasiHasari, ozet: ex?.ozet || '', gorseller: [] };
  detayAc(url, 'eksp');
}
const parcaId = ad => PARCALAR.find(p => p.re.test(norm(ad)))?.id;
async function ekspOku() {
  const e = D.eksp;
  if (!aiHazir(ayar)) { bildirim(aiEksikMesaji(ayar), true); return ayarAc(); }
  if (!e.gorseller.length) { e.durum = 'Önce rapor fotoğrafı seç.'; return detayAc(e.url, 'eksp'); }
  e.okunuyor = true; e.durum = 'Rapor okunuyor (10–40 sn)…'; detayAc(e.url, 'eksp');
  try {
    const r = await ekspertizOku(ayar, { gorseller: e.gorseller, metin: e.mekanik });
    const p = {};
    for (const d of ['lokal', 'boyali', 'degisen']) for (const ad of r.hasar?.[d] || []) { const id = parcaId(ad); if (id) p[id] = d; }
    const m = {};
    for (const [ad, v] of Object.entries(r.mikron || {})) { const id = parcaId(ad); if (id && +v) m[id] = +v; }
    Object.assign(e, { parcalar: p, mikron: m, mekanik: (r.mekanik || []).join('\n'), sasiHasari: !!r.sasiHasari, ozet: r.ozet || '',
      durum: 'Okundu. Şemayı ve bulguları raporla karşılaştır, yanlışı düzelt, sonra kaydet.' });
  } catch (err) { e.durum = err.message; }
  e.okunuyor = false;
  if (D.eksp === e) detayAc(e.url, 'eksp');
}
function ekspKaydet() {
  const e = D.eksp, i = bul(e.url);
  const ekspertiz = { parcalar: e.parcalar, mikron: e.mikron, sasiHasari: e.sasiHasari, ozet: e.ozet, t: Date.now(),
    mekanik: e.mekanik.split('\n').map(x => x.trim()).filter(Boolean) };
  D.eksp = null;
  if (guncelle(e.url, { ekspertiz, kontrolListesi: { ...(i.kontrolListesi || {}), ekspertiz: true } })) {
    const gizli = gizlenenHasar({ ...i, ekspertiz });
    bildirim(gizli.length ? `Dikkat: ilanda yazmayan ${gizli.length} hasar çıktı` : 'Ekspertiz kaydedildi, ilanla uyumlu');
  }
  detayAc(e.url, 'eksp');
}

// ---------- Karşılaştırma ----------
function karsBar() {
  const n = D.secili.size;
  $('#kars-bar').hidden = n === 0;
  $('#kars-yazi').textContent = n < 2 ? `${n} ilan seçildi, en az 2 seç` : `${n} ilan seçildi`;
  $('#kars-ac').disabled = n < 2;
}
function karsTablo() {
  const s = [...D.secili].map(u => ({ i: D.ilanlar.find(x => x.url === u), a: D.analiz.get(u) })).filter(x => x.i);
  uygunlukHesapla(s, ayar.agirlik);
  const satir = (ad, fn, enIyi) => {
    const say = s.map(x => enIyi?.deger(x)), gecerli = say.filter(v => v != null);
    const hedef = enIyi && gecerli.length ? (enIyi.yon === 'min' ? Math.min(...gecerli) : Math.max(...gecerli)) : null;
    return `<tr><th>${ad}</th>${s.map((x, k) => `<td class="${hedef != null && say[k] === hedef ? 'en-iyi' : ''}">${fn(x)}</td>`).join('')}</tr>`;
  };
  const parca = d => x => esc(x.a.hasar.gruplu[d].join(', ') || '—');
  $('#kars-icerik').innerHTML = `<h2>Karşılaştırma</h2><div class="tablo-kap"><table class="kars-tablo"><tbody>
    <tr><th></th>${s.map(x => `<td><button class="baglanti" data-detay="${esc(x.i.url)}">${esc(x.i.baslik)}</button></td>`).join('')}</tr>
    <tr><th>Şema</th>${s.map(x => `<td>${arabaSvg(x.a.parcalar)}</td>`).join('')}</tr>
    ${satir('Sana uygunluk', x => `${x.uygun}/100`, { yon: 'max', deger: x => x.uygun })}
    ${satir('Fiyat', x => tl(x.i.fiyat), { yon: 'min', deger: x => x.i.fiyat })}
    ${satir('Piyasaya göre', x => { const f = x.a.fiyat.farkYuzde; return f == null ? '—' : `%${String(Math.abs(f)).replace('.', ',')} ${f < 0 ? 'ucuz' : 'pahalı'}`; }, { yon: 'min', deger: x => x.a.fiyat.farkYuzde })}
    ${satir('Açılış teklifi', x => tl(x.a.teklif))}
    ${satir('Yıl', x => esc(x.i.yil ?? '—'), { yon: 'max', deger: x => x.i.yil })}
    ${satir('Km', x => x.i.km == null ? '—' : Number(x.i.km).toLocaleString('tr-TR'), { yon: 'min', deger: x => x.i.km })}
    ${satir('Paket', x => esc(x.i.model || '—'))}
    ${satir('Vites', x => esc(x.i.vites || '—'))}
    ${satir('Tramer', x => x.i.tramer == null ? 'yazmıyor' : x.i.tramer === 0 ? 'yok' : tl(x.i.tramer), { yon: 'min', deger: x => x.i.tramer })}
    ${satir('Hasar skoru', x => `${x.a.hasar.skor}/100`, { yon: 'max', deger: x => x.a.hasar.skor })}
    ${satir('Değişen', parca('degisen'))}
    ${satir('Boyalı', parca('boyali'))}
    ${satir('Lokal boyalı', parca('lokal'))}
    ${satir('İlanda', x => `${x.a.gun} gün`)}
    ${satir('Derin inceleme', x => x.i.inceleme ? esc(KARAR[x.i.inceleme.karar]?.[0] || x.i.inceleme.karar) : '—')}
    ${satir('Ekspertiz', x => !x.i.ekspertiz ? 'yapılmadı' : x.a.gizli.length ? `<span class="uyari-metin">Gizli hasar: ${esc(x.a.gizli.join(', '))}</span>` : 'İlanla uyumlu')}
    ${satir('Kontrol listesi', x => { const il = ilerlemeHesapla(x.i); return `${il.biten}/${il.toplam}`; }, { yon: 'max', deger: x => ilerlemeHesapla(x.i).biten })}
    ${satir('Senin puanın', x => x.i.puan ? '★'.repeat(x.i.puan) : '—', { yon: 'max', deger: x => x.i.puan || null })}
  </tbody></table></div>
  <div class="final"><button data-final>Yapay zekâya sor: hangisini almalıyım?</button><div id="final-sonuc">${finalHtml(s)}</div></div>`;
  $('#kars-dialog').showModal();
}

// ---------- İnternette arama ----------
const sayi = v => { if (typeof v === 'number') return v; const d = String(v ?? '').replace(/\D/g, ''); return d ? +d : null; };
const sayiYaz = v => v == null ? '' : Number(v).toLocaleString('tr-TR');
const buyukHarf = w => w ? w[0].toLocaleUpperCase('tr') + w.slice(1) : w;

function siteListesi() {
  const ek = (ayar.ekSiteler || '').split(/\s+/).map(x => x.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')).filter(Boolean);
  return [...VARSAYILAN_SITELER, ...ek.map(x => ({ ad: x, alan: x }))];
}

function araAc(on = null) {
  const f = $('#ara-form').elements, s = on ? { ...(ayar.sonArama || {}), y1: '', y2: '', ...on } : (ayar.sonArama || {});
  f.kapsam.value = s.kapsam || 'hizli';
  for (const k of ['arac', 'sehir', 'vites', 'yakit']) f[k].value = s[k] || '';
  for (const k of ['y1', 'y2']) f[k].value = s[k] || '';
  for (const k of ['km', 'fiyat']) f[k].value = sayiYaz(s[k]);
  const secili = s.siteAdlari;
  $('#ara-siteler').innerHTML = siteListesi().map((x, k) =>
    `<label><input type="checkbox" name="site" value="${k}" ${!secili || secili.includes(x.ad) ? 'checked' : ''}>${esc(x.ad)}</label>`).join('');
  $('#ara-ilerleme').innerHTML = '';
  $('#ara-dialog').showModal();
}

// Yapay zekânın bulduğu kaydı uygulamanın ilan biçimine çevirir; şüpheli kayıtları eler
function ilanaCevir(x, site, k, zaman) {
  const fiyat = sayi(x.fiyat), yil = sayi(x.yil), km = sayi(x.km);
  if (!fiyat || fiyat < 50000 || !yil || yil < 1990 || yil > new Date().getFullYear() + 1) return null;
  let url = typeof x.url === 'string' && /^https?:\/\/[^ ]+\.[a-z]{2,}/i.test(x.url) ? x.url.trim().split('#')[0] : null;
  if (url && site.alan && !url.includes(site.alan)) url = null; // istenen siteye ait değilse güvenme
  if (url && /sahibinden\.com|arabam\.com/.test(url) && !/\/ilan\//.test(url)) url = null; // liste sayfası, tek ilan değil
  if (site.alan && !url) return null; // belirli sitede arandı ama gerçek ilan linki yok: büyük ihtimalle uydurma, atla
  let host = url ? new URL(url).hostname.replace(/^www\./, '') : site.alan || site.ad;
  const siteAd = /sahibinden/.test(host) ? 'sahibinden' : /arabam/.test(host) ? 'arabam' : host;
  // Aynı modelin ilanları tek grupta toplansın: aranan marka/seri metinde geçiyorsa onu kullan
  const [m1, m2] = k.arac.split(/\s+/);
  let marka = x.marka || null, seri = x.seri || null;
  const metin = norm(`${x.baslik} ${x.marka} ${x.seri} ${x.model}`);
  if (m1 && m2 && metin.includes(norm(m2))) { marka = buyukHarf(m1); seri = buyukHarf(m2); }
  const h = x.hasar || {};
  const liste = v => Array.isArray(v) ? v.filter(p => typeof p === 'string') : [];
  return {
    url: url || `ara:${siteAd}:${fiyat}:${yil}:${km ?? ''}`, site: siteAd,
    baslik: x.baslik || [marka, seri, x.model, yil].filter(Boolean).join(' '),
    foto: typeof x.foto === 'string' ? x.foto : null,
    fiyat, yil, km, marka, seri, model: x.model || null, vites: x.vites || null, yakit: x.yakit || null,
    sehir: x.sehir || null, tramer: x.tramer == null ? null : sayi(x.tramer), kimden: x.kimden || null, ilanTarihi: x.ilanTarihi || null,
    aciklama: x.ozet || null, hasarHam: { boyali: liste(h.boyali), lokal: liste(h.lokal), degisen: liste(h.degisen) },
    kaynakTip: 'arama', aramaT: zaman, kontrol: zaman, durum: 'aktif'
  };
}
const kriteraUyar = (x, k) => !(k.y1 && x.yil < k.y1) && !(k.y2 && x.yil > k.y2)
  && !(k.km && x.km != null && x.km > k.km * 1.05) && !(k.fiyat && x.fiyat > k.fiyat * 1.03);
const anahtar = x => `${x.site}|${x.fiyat}|${x.km}|${x.yil}`;

// Aynı anda en fazla n istek (Gemini kotasını aşmamak için)
async function havuz(isler, n = 3) {
  let sira = 0;
  await Promise.all(Array.from({ length: Math.min(n, isler.length) }, async () => { while (sira < isler.length) await isler[sira++](); }));
}
const bekle = ms => new Promise(r => setTimeout(r, ms));
async function tekrarli(fn) {
  try { return await fn(); } catch (e) {
    if (!/429|500|503|kota|bozuk|okunamadı/i.test(e.message)) throw e;
    await bekle(4000); return fn(); // kota/geçici hata: bir kez daha dene
  }
}

// Sitenin kendi arama sayfası: Google'ın bulamadığı ilanların hepsi orada
function siteLinkleri(k) {
  const [m1, m2] = norm(k.arac).split(' ');
  const slug = [m1, m2].filter(Boolean).join('-').replace(/[^a-z0-9-]/g, '');
  const sp = new URLSearchParams();
  if (k.y1) sp.set('a5_min', k.y1); if (k.y2) sp.set('a5_max', k.y2);
  if (k.km) sp.set('a4_max', k.km); if (k.fiyat) sp.set('price_max', k.fiyat);
  sp.set('pagingSize', '50');
  const ap = new URLSearchParams({ searchText: k.arac });
  if (k.y1) ap.set('minyear', k.y1); if (k.y2) ap.set('maxyear', k.y2);
  return [['sahibinden', `https://www.sahibinden.com/${slug}?${sp}`], ['arabam.com', `https://www.arabam.com/ikinci-el/otomobil?${ap}`]];
}

async function araBaslat(e) {
  e.preventDefault();
  if (!aiHazir(ayar)) { bildirim(aiEksikMesaji(ayar), true); return ayarAc(); }
  const f = $('#ara-form').elements;
  const k = { arac: f.arac.value.trim(), y1: sayi(f.y1.value), y2: sayi(f.y2.value), km: sayi(f.km.value), fiyat: sayi(f.fiyat.value),
    sehir: f.sehir.value.trim(), vites: f.vites.value, yakit: f.yakit.value };
  if (!k.arac) { f.arac.focus(); return bildirim('Marka ve model yaz', true); }
  if (k.y1 && k.y2 && k.y1 > k.y2) [k.y1, k.y2] = [k.y2, k.y1];
  const tum = siteListesi();
  const secilen = [...$('#ara-form').querySelectorAll('input[name=site]:checked')].map(c => tum[+c.value]);
  if (!secilen.length) return bildirim('En az bir site seç', true);
  const genis = f.kapsam.value === 'genis';
  ayar.sonArama = { ...k, siteAdlari: secilen.map(s => s.ad), kapsam: f.kapsam.value }; ayarYaz(ayar);

  // Geniş kapsam: her model yılı ayrı aranır (en fazla 6 yıl)
  const buYil = new Date().getFullYear();
  const y1 = k.y1 || buYil - 4, y2 = Math.min(k.y2 || buYil, y1 + 5);
  const yillar = genis ? Array.from({ length: y2 - y1 + 1 }, (_, n) => y1 + n) : [null];
  const btn = $('#ara-baslat'); btn.disabled = true; btn.textContent = 'Aranıyor…';
  $('#ara-ilerleme').innerHTML = secilen.map((s, i) => `<li id="ai-${i}"><span>${esc(s.ad)}</span><span>sırada…</span></li>`).join('');
  const zaman = Date.now(), bulunan = [], durum = secilen.map(s => ({ ad: s.ad, sayi: 0, hata: null, biten: 0 }));
  let elenen = 0;
  const isler = secilen.flatMap((s, i) => yillar.map(yil => async () => {
    const d = durum[i], el = $(`#ai-${i} span:last-child`);
    el.textContent = genis ? `aranıyor (${d.biten}/${yillar.length})…` : 'aranıyor…';
    try {
      const { ilanlar } = await tekrarli(() => internetteAra(ayar, k, s, yil));
      const uyan = ilanlar.map(x => ilanaCevir(x, s, k, zaman)).filter(Boolean).filter(x => kriteraUyar(x, k));
      elenen += ilanlar.length - uyan.length; bulunan.push(...uyan); d.sayi += uyan.length;
    } catch (err) { d.hata = err.message.slice(0, 90); }
    d.biten++;
    const bitti = d.biten === yillar.length;
    el.textContent = !bitti ? `aranıyor (${d.biten}/${yillar.length})… ${d.sayi} ilan` : d.sayi ? `${d.sayi} ilan` : d.hata || 'uygun ilan bulunamadı';
    el.className = bitti ? (d.sayi ? 'ok' : d.hata ? 'hata' : '') : '';
  }));
  await havuz(isler, 3);
  btn.disabled = false; btn.textContent = 'Ara';

  // Kaydet: önceki bilgiler (inceleme, ekspertiz, notlar, fiyat geçmişi) korunur
  const onceki = { ...D.yerel.ilanlar };
  const oncekiAnahtar = new Set(Object.values(onceki).map(anahtar));
  const oncekiArama = Object.values(onceki).some(i => i.kaynakTip === 'arama');
  let yeniSay = 0, dusenSay = 0, kaydedilen = 0;
  const goruldu = new Set();
  for (const x of bulunan) {
    const eski = onceki[x.url];
    if (goruldu.has(anahtar(x)) || goruldu.has(x.url)) continue; // aynı ilan iki sorguda bulunduysa
    goruldu.add(anahtar(x)); goruldu.add(x.url);
    if (!eski && !oncekiAnahtar.has(anahtar(x)) && oncekiArama) { x.yeniT = zaman; yeniSay++; }
    if (eski?.fiyat > x.fiyat) dusenSay++;
    const gecmis = [...(eski?.gecmis || [])];
    if (gecmis.at(-1)?.fiyat !== x.fiyat) gecmis.push({ t: zaman, fiyat: x.fiyat });
    D.yerel.ilanlar[x.url] = { ...(eski || {}), ...x, gecmis, eklenme: eski?.eklenme || zaman,
      inceleme: eski?.inceleme, takip: eski?.takip, kisaListe: eski?.kisaListe, ekspertiz: eski?.ekspertiz,
      kontrolListesi: eski?.kontrolListesi, notlar: eski?.notlar, puan: eski?.puan, degisim: zaman };
    delete D.yerel.silinenler[x.url];
    kaydedilen++;
  }
  // 7 günden eski, hiç dokunulmamış arama sonuçlarını temizle (depo şişmesin)
  for (const [u, i] of Object.entries(D.yerel.ilanlar))
    if (i.kaynakTip === 'arama' && (i.aramaT || 0) < zaman - 7 * 864e5 && !i.inceleme && !i.takip && !i.kisaListe && !i.ekspertiz && !i.notlar) {
      delete D.yerel.ilanlar[u]; D.yerel.silinenler[u] = zaman - 1;
    }
  ayar.sonAramaSonuc = { t: zaman, kriter: k, kapsam: f.kapsam.value, siteler: durum.map(({ ad, sayi, hata }) => ({ ad, sayi, hata })), toplam: kaydedilen, elenen };
  ayarYaz(ayar);
  D.gorunum = 'arama';
  $('#ara').value = ''; $('#filtre').reset(); $('#sira').value = 'uygun';
  yerelKaydet();
  $('#ara-dialog').close();
  setTimeout(() => { yeniden(); $('#gorunum').scrollIntoView({ block: 'start' }); });
  const toplam = ayar.sonAramaSonuc.toplam;
  if (!toplam) bildirim('Bu aramada ilan bulunamadı. Aşağıdaki linklerle sitenin kendisinde arayabilirsin.', true);
  else bildirim(oncekiArama ? `${toplam} ilan: ${yeniSay} yeni, ${dusenSay} ilanın fiyatı düştü` : `${toplam} ilan bulundu`);
}
// Telefonda klavyenin "Git" tuşu aramayı başlatmasın; sadece "Ara" düğmesi başlatır
$('#ara-form').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  e.preventDefault();
  const alanlar = [...$('#ara-form').querySelectorAll('input:not([type=checkbox]):not([type=radio]), select')];
  alanlar[alanlar.indexOf(e.target) + 1]?.focus();
});
// Üstteki kutu: yazılanı arama penceresine taşır (yıl yazıldıysa yıl alanına)
$('#ust-ara').addEventListener('submit', e => {
  e.preventDefault();
  const metin = $('#ust-ara-metin').value.trim();
  const yil = metin.match(/\b(19[9]\d|20[0-4]\d)\b/)?.[1];
  const arac = metin.replace(yil || '', '').replace(/\s+/g, ' ').trim();
  if (!arac && !yil) araAc(); // boş kutu: son arama kriterleriyle aç
  else araAc({ ...(arac ? { arac } : {}), ...(yil ? { y1: +yil, y2: +yil } : {}) });
  $('#ust-ara-metin').blur();
});
$('#ara-form').addEventListener('submit', araBaslat);
$('#ara-elle').onclick = () => { $('#ara-dialog').close(); ekleAc(); };

// ---------- Son karar ----------
const seciliAnahtar = s => s.map(x => x.i.url).sort().join('|');
function finalHtml(s) {
  if (D.finalMesgul) return '<p>Değerlendiriliyor…</p><div class="yukleniyor"></div>';
  const f = D.final;
  if (!f || f.anahtar !== seciliAnahtar(s)) return '<p class="kucuk">Ekspertiz, kontrol listesi, notların ve puanların dahil her şeyi tartar. Ne kadar çok bilgi girdiysen o kadar isabetli olur.</p>';
  const r = f.sonuc, ad = k => esc(s[k]?.i.baslik || `Aday ${k + 1}`);
  return `<div class="inceleme karar-iyi"><h3>Önerim: ${ad(r.secim)}</h3><p>${esc(r.gerekce)}</p>
    ${r.siralama?.length ? `<h4>Sıralama</h4><ol>${r.siralama.map(x => `<li><strong>${ad(x.index)}</strong>: ${esc(x.neden)}</li>`).join('')}</ol>` : ''}
    ${r.eksikBilgi?.length ? `<h4>Karar vermeden önce öğren</h4>${liste(r.eksikBilgi)}` : ''}
    ${r.sonAdimlar?.length ? `<h4>Sıradaki adımlar</h4>${liste(r.sonAdimlar)}` : ''}
    <p class="kucuk">Bu bir öneri; son kararı aracı görüp ekspertiz sonucuna bakarak sen ver.</p></div>`;
}
async function finalCalistir() {
  if (D.ornekModu) return bildirim('Örnek verilerle karar verilemez', true);
  if (!aiHazir(ayar)) { bildirim(aiEksikMesaji(ayar), true); return ayarAc(); }
  const s = [...D.secili].map(u => ({ i: bul(u), a: D.analiz.get(u) })).filter(x => x.i);
  uygunlukHesapla(s, ayar.agirlik);
  const adaylar = s.map((x, index) => ({
    index, baslik: x.i.baslik, fiyat: x.i.fiyat, yil: x.i.yil, km: x.i.km, paket: x.i.model, vites: x.i.vites, tramer: x.i.tramer,
    hasarSkoru: x.a.hasar.skor, parcalar: x.a.hasar.gruplu, gizliHasar: x.a.gizli, piyasa: x.a.fiyat.aciklama, uygunluk: x.uygun,
    ekspertiz: x.i.ekspertiz ? { mekanik: x.i.ekspertiz.mekanik, sasiHasari: x.i.ekspertiz.sasiHasari, ozet: x.i.ekspertiz.ozet } : 'yapılmadı',
    kontrolListesi: ilerlemeHesapla(x.i), puan: x.i.puan || null, notlar: x.i.notlar || null, ilandaGun: x.a.gun,
    derinInceleme: x.i.inceleme ? { karar: x.i.inceleme.karar, riskler: x.i.inceleme.riskler } : null
  }));
  D.finalMesgul = true; $('#final-sonuc').innerHTML = finalHtml(s);
  try { D.final = { anahtar: seciliAnahtar(s), sonuc: await sonKarar(ayar, adaylar, D.raporlar[grupAnahtari(s[0].i)]) }; }
  catch (e) { bildirim(e.message, true); }
  D.finalMesgul = false;
  if ($('#kars-dialog').open) $('#final-sonuc').innerHTML = finalHtml(s);
}

// ---------- Ayarlar ----------
const AYAR_ALANLARI = ['geminiKey', 'geminiModel', 'apiKey', 'model', 'ghToken', 'gistId', 'ekSiteler'];
function ayarAc() {
  const f = $('#ayar-form').elements;
  for (const k of AYAR_ALANLARI) f[k].value = ayar[k] || '';
  f.saglayici.value = ayar.saglayici;
  $('#ayar-dialog').showModal();
}
$('#ayar-form').onsubmit = e => {
  e.preventDefault();
  const f = e.target.elements;
  for (const k of AYAR_ALANLARI) ayar[k] = f[k].value.trim();
  ayar.saglayici = f.saglayici.value || 'gemini';
  ayar.geminiModel ||= 'gemini-3.5-flash'; ayar.model ||= 'claude-sonnet-5-5';
  ayarYaz(ayar);
  $('#ayar-dialog').close();
  bildirim('Ayarlar kaydedildi');
  if (ayar.ghToken) senkron();
};
$('#ayar-kapat').onclick = () => $('#ayar-dialog').close();
$('#disa-btn').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(D.yerel)], { type: 'application/json' }));
  a.download = `ilan-rontgeni-yedek-${new Date().toISOString().slice(0, 10)}.json`; a.click();
};
$('#temizle-btn').onclick = () => {
  if (!confirm('Bu cihazdaki tüm ilanlar ve araştırmalar silinsin mi? Senkron açıksa Gist’teki kopya korunur.')) return;
  D.yerel = bosVeri(); yerelYaz(D.yerel); hesapla();
};
$('#dosya').addEventListener('change', async e => {
  const dosya = e.target.files[0]; if (!dosya) return;
  try {
    const j = JSON.parse(await dosya.text());
    const ilanlar = j.ilanlar && !Array.isArray(j.ilanlar) ? j.ilanlar : Object.fromEntries((j.ilanlar || j).map(i => [i.url, i]));
    D.yerel = veriBirlestir(D.yerel, { ilanlar, raporlar: j.raporlar || {} });
    yerelKaydet(); $('#ayar-dialog').close(); bildirim(`${Object.keys(ilanlar).length} ilan içe aktarıldı`);
  } catch { bildirim('Dosya okunamadı. Eklentiden ya da buradan indirilen JSON’u seç.', true); }
});
let kurOlayi;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); kurOlayi = e; $('#kur-btn').hidden = false; });
$('#kur-btn').onclick = async () => { kurOlayi?.prompt(); kurOlayi = null; $('#kur-btn').hidden = true; };

// ---------- Olaylar ----------
document.addEventListener('click', e => {
  const parca = e.target.closest('#eksp-sema [data-parca]');
  if (parca && D.eksp) {
    const SIRA = ['orijinal', 'lokal', 'boyali', 'degisen'], id = parca.dataset.parca;
    const y = SIRA[(SIRA.indexOf(D.eksp.parcalar[id] || 'orijinal') + 1) % 4];
    if (y === 'orijinal') delete D.eksp.parcalar[id]; else D.eksp.parcalar[id] = y;
    $('#eksp-sema').innerHTML = arabaSvg(D.eksp.parcalar, { etkilesimli: true });
    $(`#eksp-sema [data-parca="${id}"]`)?.focus();
    return;
  }
  const t = e.target.closest('[data-git],[data-incele],[data-detay],[data-inc],[data-rapor],[data-duzenle],[data-sil],[data-kapat],[data-kisa],[data-sekme],[data-puan],[data-eksp-ac],[data-eksp-oku],[data-eksp-kaydet],[data-eksp-iptal],[data-eksp-sil],[data-final],[data-gorunum],[data-ara-degistir],[data-ara-yenile]');
  if (!t) return;
  const d = t.dataset, url = acikUrl();
  if (d.git) { e.preventDefault(); git(d.git); }
  else if (d.incele || d.detay) { $('#kars-dialog').open && $('#kars-dialog').close(); D.eksp = null; detayAc(d.incele || d.detay, 'deger'); $('#detay-dialog').scrollTop = 0; }
  else if (d.kisa) { const i = bul(d.kisa); if (i && guncelle(d.kisa, { kisaListe: !i.kisaListe })) bildirim(i.kisaListe ? 'Kısa listeden çıkarıldı' : 'Kısa listeye eklendi'); }
  else if (d.sekme) { D.eksp = null; detayAc(url, d.sekme); $('#detay-dialog').scrollTop = 0; }
  else if (d.puan) { const i = bul(url); if (guncelle(url, { puan: +d.puan === i.puan ? 0 : +d.puan })) detayAc(url); }
  else if ('ekspAc' in d) ekspBasla(url);
  else if ('ekspOku' in d) { D.eksp.mekanik = $('[data-eksp-mekanik]')?.value ?? D.eksp.mekanik; ekspOku(); }
  else if ('ekspKaydet' in d) { D.eksp.mekanik = $('[data-eksp-mekanik]').value; D.eksp.sasiHasari = $('[data-eksp-sasi]').checked; ekspKaydet(); }
  else if ('ekspIptal' in d) { D.eksp = null; detayAc(url, 'eksp'); }
  else if ('ekspSil' in d) { if (confirm('Ekspertiz sonucu silinsin mi?') && guncelle(url, { ekspertiz: null })) detayAc(url, 'eksp'); }
  else if ('final' in d) finalCalistir();
  else if (d.gorunum) { D.gorunum = d.gorunum; D.limit = 40; ciz(); }
  else if ('araDegistir' in d) araAc();
  else if ('araYenile' in d) { araAc(); araBaslat(new Event('submit')); }
  else if (d.inc) incele(d.inc);
  else if (d.rapor) raporOlustur(d.rapor);
  else if (d.duzenle) {
    if (D.ornekModu) return bildirim('Örnek ilanlar düzenlenemez', true);
    $('#detay-dialog').close(); ekleAc(D.ilanlar.find(x => x.url === d.duzenle));
  } else if (d.sil) {
    if (D.ornekModu) return bildirim('Örnek ilanlar silinemez', true);
    if (confirm('Bu ilan silinsin mi?')) { ilanSil(d.sil); $('#detay-dialog').close(); }
  } else if ('kapat' in d) t.closest('dialog')?.close();
});
$('#liste').addEventListener('change', e => {
  const u = e.target.dataset?.kars;
  if (!u) return;
  if (e.target.checked && D.secili.size >= 4) { e.target.checked = false; $('#kars-yazi').textContent = 'En fazla 4 ilan karşılaştırılabilir'; return; }
  e.target.checked ? D.secili.add(u) : D.secili.delete(u);
  karsBar();
});
document.addEventListener('change', async e => {
  const t = e.target, url = acikUrl();
  if (!url) return;
  if (t.dataset.kontrol) {
    const i = bul(url);
    if (guncelle(url, { kontrolListesi: { ...(i.kontrolListesi || {}), [t.dataset.kontrol]: t.checked } })) detayAc(url, 'kontrol');
  } else if ('kisaCb' in t.dataset) guncelle(url, { kisaListe: t.checked });
  else if ('notlar' in t.dataset) { if (guncelle(url, { notlar: t.value.trim() })) bildirim('Not kaydedildi'); }
  else if ('ekspDosya' in t.dataset && D.eksp) {
    D.eksp.mekanik = $('[data-eksp-mekanik]')?.value ?? D.eksp.mekanik;
    for (const f of [...t.files].slice(0, 8 - D.eksp.gorseller.length)) D.eksp.gorseller.push(await kucult(f));
    detayAc(url, 'eksp');
  }
});
$('#kars-ac').onclick = karsTablo;
$('#kars-temizle').onclick = () => { D.secili.clear(); document.querySelectorAll('[data-kars]').forEach(c => c.checked = false); karsBar(); };

// Öncelik kaydırıcıları
const filtreF = $('#filtre').elements;
for (const k in ayar.agirlik) { filtreF[`w-${k}`].value = ayar.agirlik[k]; filtreF[`w-${k}`].defaultValue = ayar.agirlik[k]; }
const yeniden = () => { D.limit = 40; ciz(); };
$('#filtre').addEventListener('input', e => {
  if (e.target.id === 'ara') return; // metin kutusu gecikmeli çalışır
  if (e.target.name?.startsWith('w-')) { ayar.agirlik[e.target.name.slice(2)] = +e.target.value; e.target.defaultValue = e.target.value; ayarYaz(ayar); }
  yeniden();
});
$('#filtre').addEventListener('reset', () => setTimeout(yeniden));
let yazZaman;
$('#ara').addEventListener('input', () => { clearTimeout(yazZaman); yazZaman = setTimeout(yeniden, 180); });
$('#sira').addEventListener('input', yeniden);
$('#daha').onclick = () => { D.limit += 40; ciz(); };
$('#grafik-kutu').addEventListener('toggle', () => grafikCiz(D.liste));
$('#ekle-btn').onclick = () => ekleAc();
$('#ara-btn').onclick = araAc;
$('#ayar-btn').onclick = ayarAc;
$('#senkron-btn').onclick = () => senkron();
let boyutZaman;
addEventListener('resize', () => { clearTimeout(boyutZaman); boyutZaman = setTimeout(() => { ozetCiz(D.liste); grafikCiz(D.liste); }, 200); });
if (matchMedia('(min-width: 901px)').matches) $('#filtre-kutu').open = true;

ekleKur({ ayar: () => ayar, kaydetFn: (ilan, eskiUrl) => { ilanKaydet(ilan, eskiUrl); bildirim('İlan kaydedildi'); } });

// ---------- Başlangıç ----------
async function paylasimiAl() {
  if (!new URLSearchParams(location.search).has('paylasim') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname);
  const c = await caches.open('ir-paylasim');
  const meta = await (await c.match(new URL('paylasim/meta', location.href)))?.json();
  if (!meta) return;
  const dosyalar = [];
  for (let k = 0; k < meta.n; k++) { const r = await c.match(new URL(`paylasim/${k}`, location.href)); if (r) dosyalar.push(await r.blob()); }
  for (const r of await c.keys()) await c.delete(r);
  const link = meta.url || (meta.text || '').match(/https?:\/\/\S+/)?.[0] || '';
  ekleAc(null, { link, metin: [meta.title, meta.text].filter(Boolean).join('\n'), dosyalar });
}

async function baslat() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  addEventListener('message', e => {
    if (e.source === window && e.data?.kaynak === 'ilan-rontgeni-eklenti' && e.data.tip === 'veri') {
      D.kopru = { ilanlar: Object.fromEntries(e.data.ilanlar.map(i => [i.url, i])), raporlar: e.data.raporlar || {} };
      hesapla();
    }
  });
  postMessage({ kaynak: 'ilan-rontgeni-site', tip: 'veriIste' }, location.origin);
  const veri = await jsonGetir('veri.json');
  if (veri) {
    const l = veri.ilanlar || veri;
    D.dosya = { ilanlar: Object.fromEntries((Array.isArray(l) ? l : Object.values(l)).map(i => [i.url, i])), raporlar: veri.raporlar || {} };
    D.dosyaAd = 'veri.json';
  }
  D.ornek = (await jsonGetir('ornek-veri.json'))?.ilanlar || [];
  hesapla();
  paylasimiAl();
  if (ayar.ghToken && ayar.gistId) senkron(true);
}
baslat();
