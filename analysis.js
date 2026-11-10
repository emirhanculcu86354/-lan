// Fiyat ve hasar analizi. Tüm ağırlıklar bu dosyanın başında; kendine göre ayarla.
export const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr')
  .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
  .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');

// w = parçanın önemi (1 = sıradan bir kapı)
export const PARCALAR = [
  { id: 'on_tampon', ad: 'Ön tampon', w: 0.4, re: /on tampon/ },
  { id: 'arka_tampon', ad: 'Arka tampon', w: 0.4, re: /arka tampon/ },
  { id: 'motor_kaputu', ad: 'Motor kaputu', w: 1.5, re: /motor kaput|on kaput|^kaput$/ },
  { id: 'arka_kaput', ad: 'Bagaj kapağı', w: 1.5, re: /arka kaput|bagaj/ },
  { id: 'tavan', ad: 'Tavan', w: 5, re: /tavan/ },
  { id: 'sol_on_camurluk', ad: 'Sol ön çamurluk', w: 1, re: /sol on camurluk/ },
  { id: 'sol_on_kapi', ad: 'Sol ön kapı', w: 1, re: /sol on kapi/ },
  { id: 'sol_arka_kapi', ad: 'Sol arka kapı', w: 1, re: /sol arka kapi/ },
  { id: 'sol_arka_camurluk', ad: 'Sol arka çamurluk', w: 2.5, re: /sol arka camurluk/ },
  { id: 'sag_on_camurluk', ad: 'Sağ ön çamurluk', w: 1, re: /sag on camurluk/ },
  { id: 'sag_on_kapi', ad: 'Sağ ön kapı', w: 1, re: /sag on kapi/ },
  { id: 'sag_arka_kapi', ad: 'Sağ arka kapı', w: 1, re: /sag arka kapi/ },
  { id: 'sag_arka_camurluk', ad: 'Sağ arka çamurluk', w: 2.5, re: /sag arka camurluk/ }
];
const CARPAN = { lokal: 0.4, boyali: 1, degisen: 2.5 };
const DURUM_AD = { lokal: 'lokal boyalı', boyali: 'boyalı', degisen: 'değişen' };
const YILLIK_DEGER = 0.06;      // 1 yıl fark ≈ %6 fiyat farkı (az veri varken)
const KM_DEGER = 0.008;         // 10 bin km fark ≈ %0,8
const NORMAL_YILLIK_KM = 25000;

const SIDDET = { orijinal: 0, lokal: 1, boyali: 2, degisen: 3 };
// Ekspertiz varsa gerçek durum odur; ilanBeyani=true ise satıcının ilanda yazdığı döner
export function parcaDurumu(ilan, { ilanBeyani = false } = {}) {
  if (!ilanBeyani && ilan.ekspertiz?.parcalar) return { ...ilan.ekspertiz.parcalar };
  const out = {}; const sira = SIDDET;
  for (const d of ['lokal', 'boyali', 'degisen']) {
    for (const ham of ilan.hasarHam?.[d] || []) {
      const p = PARCALAR.find(p => p.re.test(norm(ham)));
      if (p && (!out[p.id] || sira[d] > sira[out[p.id]])) out[p.id] = d;
    }
  }
  return out;
}

// Aynı ilan nesnesi için hasar bir kez hesaplanır (yüzlerce ilanda fiyat karşılaştırması hızlanır)
const hasarOnbellek = new WeakMap();
export function hasarAnalizi(ilan) {
  if (!hasarOnbellek.has(ilan)) hasarOnbellek.set(ilan, hasarHesapla(ilan));
  return hasarOnbellek.get(ilan);
}
function hasarHesapla(ilan) {
  const parcalar = parcaDurumu(ilan);
  let puan = 0; const kritik = []; const gruplu = { degisen: [], boyali: [], lokal: [] };
  for (const [id, d] of Object.entries(parcalar)) {
    const p = PARCALAR.find(x => x.id === id);
    let c = CARPAN[d];
    if (id.includes('tampon') && d === 'degisen') c = 0.6; // tampon değişimi sık ve önemsiz
    puan += p.w * c;
    gruplu[d].push(p.ad);
    if (id === 'tavan' && d !== 'lokal') kritik.push(`Tavan ${DURUM_AD[d]}: ciddi darbe/takla ihtimali, ekspertizsiz alma`);
    else if (d === 'degisen' && id.includes('arka_camurluk')) kritik.push(`${p.ad} değişmiş: kesme-kaynak işlemi demek`);
  }
  const tramerOran = ilan.tramer && ilan.fiyat ? ilan.tramer / ilan.fiyat : 0;
  const skor = Math.max(0, Math.min(100, Math.round(100 - puan * 6 - Math.min(25, tramerOran * 150))));
  const indirim = Math.min(30, puan * 1.2 + tramerOran * 50);
  return { parcalar, puan, skor, indirim, kritik, gruplu };
}

const grupOnbellek = new WeakMap();
export const grupAnahtari = i => {
  if (!grupOnbellek.has(i)) grupOnbellek.set(i, norm(i.marka && i.seri ? `${i.marka} ${i.seri}` : (i.baslik || '').split(' ').slice(0, 2).join(' ')));
  return grupOnbellek.get(i);
};

function coz3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 3; r++) if (r !== c) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[3] / r[i]);
}

const medyan = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function fiyatAnalizi(ilan, tumIlanlar, hasar) {
  const sonuc = { n: 0, beklenen: null, farkYuzde: null, yontem: null };
  if (!ilan.fiyat || !ilan.yil || ilan.km == null) {
    return { ...sonuc, etiket: 'Veri eksik', sinif: 'notr', aciklama: 'Fiyat, yıl veya km okunamadı.' };
  }
  const anahtar = grupAnahtari(ilan);
  const benzer = tumIlanlar.filter(x => x.url !== ilan.url && x.fiyat && x.yil && x.km != null &&
    grupAnahtari(x) === anahtar && Math.abs(x.yil - ilan.yil) <= 2);
  sonuc.n = benzer.length;
  if (benzer.length < 2) {
    return { ...sonuc, etiket: 'Karşılaştırma yok', sinif: 'notr',
      aciklama: `Fiyatı yorumlamak için en az 2 benzer ${ilan.seri || ''} ilanı daha topla (şu an ${benzer.length}).` };
  }
  // Her ilanı "hatasız eşdeğer" fiyata çevir
  const satirlar = benzer.map(x => [x.fiyat / (1 - hasarAnalizi(x).indirim / 100), x.yil - ilan.yil, (x.km - ilan.km) / 10000]);
  let hatasiz = null;
  if (benzer.length >= 6) {
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    for (const [y, x1, x2] of satirlar) {
      const v = [1, x1, x2];
      for (let i = 0; i < 3; i++) { b[i] += v[i] * y; for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j]; }
    }
    const k = coz3(A, b);
    if (k && k[0] > 0 && k[1] >= 0 && k[2] <= 0) { hatasiz = k[0]; sonuc.yontem = 'regresyon'; }
  }
  if (hatasiz == null) {
    hatasiz = medyan(satirlar.map(([y, dYil, dKm]) => y * (1 - YILLIK_DEGER * dYil) * (1 - KM_DEGER * -dKm)));
    sonuc.yontem = 'medyan';
  }
  sonuc.beklenen = Math.round(hatasiz * (1 - hasar.indirim / 100) / 1000) * 1000;
  sonuc.farkYuzde = Math.round((ilan.fiyat - sonuc.beklenen) / sonuc.beklenen * 1000) / 10;
  const f = sonuc.farkYuzde;
  const [etiket, sinif] =
    f <= -15 ? ['Şüpheli ucuz', 'uyari'] :
    f <= -4 ? ['Fiyatı iyi', 'iyi'] :
    f < 4 ? ['Piyasa fiyatında', 'notr'] :
    f < 10 ? ['Biraz pahalı', 'orta'] : ['Pahalı', 'kotu'];
  const yuzde = String(Math.abs(f)).replace('.', ',');
  const yon = f < 0 ? `%${yuzde} altında` : f > 0 ? `%${yuzde} üstünde` : 'tam piyasada';
  sonuc.aciklama = `${benzer.length} benzer ilana göre bu hasar durumunda beklenen fiyat ~${sonuc.beklenen.toLocaleString('tr-TR')} TL; ilan ${yon}.`;
  return { ...sonuc, etiket, sinif };
}

const AYLAR = ['ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran', 'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik'];
// İlanın kaç gündür yayında olduğu (ilan tarihi okunamadıysa ilk görüldüğü gün)
export function ilandaGun(ilan) {
  let t = ilan.eklenme || Date.now();
  const d = norm(ilan.ilanTarihi);
  let m = d.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (m && AYLAR.indexOf(m[2]) >= 0) t = Math.min(t, new Date(+m[3], AYLAR.indexOf(m[2]), +m[1]).getTime());
  else if ((m = d.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/))) t = Math.min(t, new Date(+m[3], +m[2] - 1, +m[1]).getTime());
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

// Aynı aracın başka ilanda tekrar yayınlanmış olma ihtimali (galeri + sahibi, ya da yeniden ilan)
export function benzerKayitlar(ilan, tum) {
  if (ilan.km == null || !ilan.yil) return [];
  const g = grupAnahtari(ilan);
  return tum.filter(x => x.url !== ilan.url && x.yil === ilan.yil && x.km != null && Math.abs(x.km - ilan.km) <= 1500
    && x.durum !== 'kaldirildi' && grupAnahtari(x) === g);
}

// Ekspertizde çıkıp ilanda yazmayan (ya da daha hafif yazılan) parçalar
export function gizlenenHasar(ilan) {
  if (!ilan.ekspertiz?.parcalar) return [];
  const beyan = parcaDurumu(ilan, { ilanBeyani: true });
  return Object.entries(ilan.ekspertiz.parcalar)
    .filter(([id, d]) => (SIDDET[d] || 0) > (SIDDET[beyan[id] || 'orijinal'] || 0))
    .map(([id, d]) => `${PARCALAR.find(p => p.id === id)?.ad || id} ${DURUM_AD[d]}`);
}

export function uyarilar(ilan, hasar, fiyat, gun = 0, benzer = []) {
  const u = [...hasar.kritik];
  const gizli = gizlenenHasar(ilan);
  if (gizli.length) u.unshift(`İlanda yazmayan hasar (ekspertiz): ${gizli.join(', ')}`);
  for (const m of (ilan.ekspertiz?.mekanik || []).slice(0, 3)) u.push(`Ekspertiz: ${m}`);
  const isaretli = Object.keys(parcaDurumu(ilan, { ilanBeyani: true })).length || (gizli.length ? 0 : Object.keys(hasar.parcalar).length);
  if (isaretli && /hatasiz|boyasiz|degisensiz|(tamami|komple) or[ij]i?nal/.test(norm(ilan.aciklama)))
    u.push(`Açıklama "hatasız/boyasız" diyor ama şemada ${isaretli} parça işaretli`);
  if (ilan.tramer == null) u.push('Tramer tutarı yazmıyor: şasi no isteyip sorgulat');
  else if (ilan.tramer > 0 && ilan.fiyat && ilan.tramer / ilan.fiyat > 0.1) u.push(`Tramer yüksek: ${ilan.tramer.toLocaleString('tr-TR')} TL`);
  if (ilan.yil && ilan.km != null) {
    const yas = Math.max(1, new Date().getFullYear() - ilan.yil);
    const yillik = Math.round(ilan.km / yas / 1000) * 1000;
    if (yillik > NORMAL_YILLIK_KM) u.push(`Yılda ~${yillik.toLocaleString('tr-TR')} km yapılmış, ortalamanın üstünde`);
  }
  if (fiyat.farkYuzde != null && fiyat.farkYuzde <= -15) u.push('Piyasanın çok altında: aracı görmeden kapora gönderme');
  if (fiyat.farkYuzde != null && hasar.indirim >= 1)
    u.push(`Hasar için makul pazarlık payı ~%${Math.round(hasar.indirim)}`);
  if (gun >= 21) u.push(`${gun} gündür ilanda: satıcı pazarlığa daha açık olabilir`);
  for (const b of benzer.slice(0, 2))
    u.push(`Aynı araç başka ilanda da olabilir (${b.km.toLocaleString('tr-TR')} km, ${b.fiyat.toLocaleString('tr-TR')} TL): ikisini karşılaştır`);
  return u;
}

export function analizEt(ilan, tumIlanlar) {
  const hasar = hasarAnalizi(ilan);
  const fiyat = fiyatAnalizi(ilan, tumIlanlar, hasar);
  const gun = ilandaGun(ilan);
  const benzer = benzerKayitlar(ilan, tumIlanlar);
  // Açılış teklifi: piyasa değeri ile istenen fiyatın düşüğünden, ilanda kalma süresine göre pay düşülür
  let teklif = null;
  if (fiyat.beklenen && ilan.durum !== 'kaldirildi') {
    const pay = gun >= 30 ? 0.05 : gun >= 14 ? 0.035 : 0.02;
    teklif = Math.floor(Math.min(ilan.fiyat, fiyat.beklenen) * (1 - pay) / 5000) * 5000;
  }
  const gizli = gizlenenHasar(ilan);
  return { hasar, fiyat, gun, teklif, benzer, gizli, ekspertizli: !!ilan.ekspertiz, parcalar: hasar.parcalar, uyarilar: uyarilar(ilan, hasar, fiyat, gun, benzer), DURUM_AD };
}

// Kullanıcının önceliklerine göre 0–100 uygunluk puanı. liste: [{ i, a }] — her öğeye x.uygun yazar.
export const VARSAYILAN_AGIRLIK = { fiyat: 3, hasar: 5, km: 3, yil: 2, tramer: 3 };
export function uygunlukHesapla(liste, agirlik = VARSAYILAN_AGIRLIK) {
  const kms = liste.map(x => x.i.km).filter(v => v != null), yillar = liste.map(x => x.i.yil).filter(Boolean);
  const [k0, k1, y0, y1] = [Math.min(...kms), Math.max(...kms), Math.min(...yillar), Math.max(...yillar)];
  const oran = (v, a, b, ters) => v == null || !isFinite(a) || a === b ? 0.5 : ters ? (b - v) / (b - a) : (v - a) / (b - a);
  const toplamW = Object.values(agirlik).reduce((t, v) => t + +v, 0) || 1;
  for (const x of liste) {
    const f = x.a.fiyat.farkYuzde;
    const p = {
      fiyat: f == null ? 0.5 : Math.max(0, Math.min(1, (20 - f) / 40)),
      hasar: x.a.hasar.skor / 100,
      km: oran(x.i.km, k0, k1, true),
      yil: oran(x.i.yil, y0, y1, false),
      tramer: x.i.tramer == null ? 0.4 : x.i.tramer === 0 ? 1 : Math.max(0, 1 - (x.i.tramer / (x.i.fiyat || 1)) * 8)
    };
    let t = 0; for (const k in p) t += p[k] * (+agirlik[k] || 0);
    x.uygun = Math.round(t / toplamW * 100);
    if (x.a.hasar.kritik.length) x.uygun = Math.min(x.uygun, 45);
    if (x.a.gizli?.length) x.uygun = Math.min(x.uygun, 40); // satıcı hasarı gizlemişse güven kalmaz // tavan/şasi işlemi varsa üst sıralara çıkmasın
    if (x.i.durum === 'kaldirildi') x.uygun = 0;
  }
  return liste;
}

// Sıralama için tek bir "fırsat" puanı: ucuzluk + temizlik
export const firsatPuani = a => (a.fiyat.farkYuzde == null ? 0 : -a.fiyat.farkYuzde) + (a.hasar.skor - 80) / 4;
