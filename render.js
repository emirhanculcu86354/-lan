// Eklenti ve site ortak kart çizimi (DOM'a bağımlı değil, sadece HTML metni üretir)
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const tl = n => n == null ? '—' : `${Number(n).toLocaleString('tr-TR')} TL`;
const tarih = t => t ? new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '';
const SITE_AD = { sahibinden: 'sahibinden', arabam: 'arabam.com' };

// Üstten görünüm araç şeması: ön yukarıda
export const SEKIL = {
  on_tampon: [18, 3, 44, 9], motor_kaputu: [18, 14, 44, 34], tavan: [20, 70, 40, 52],
  arka_kaput: [18, 130, 44, 18], arka_tampon: [18, 150, 44, 8],
  sol_on_camurluk: [3, 14, 13, 34], sol_on_kapi: [3, 50, 13, 38], sol_arka_kapi: [3, 90, 13, 36], sol_arka_camurluk: [3, 128, 13, 22],
  sag_on_camurluk: [64, 14, 13, 34], sag_on_kapi: [64, 50, 13, 38], sag_arka_kapi: [64, 90, 13, 36], sag_arka_camurluk: [64, 128, 13, 22]
};
export const PARCA_AD = {
  on_tampon: 'Ön tampon', motor_kaputu: 'Motor kaputu', tavan: 'Tavan', arka_kaput: 'Bagaj kapağı', arka_tampon: 'Arka tampon',
  sol_on_camurluk: 'Sol ön çamurluk', sol_on_kapi: 'Sol ön kapı', sol_arka_kapi: 'Sol arka kapı', sol_arka_camurluk: 'Sol arka çamurluk',
  sag_on_camurluk: 'Sağ ön çamurluk', sag_on_kapi: 'Sağ ön kapı', sag_arka_kapi: 'Sağ arka kapı', sag_arka_camurluk: 'Sağ arka çamurluk'
};
const DURUM_YAZI = { orijinal: 'orijinal', lokal: 'lokal boyalı', boyali: 'boyalı', degisen: 'değişen' };
export function arabaSvg(parcalar, { etkilesimli = false } = {}) {
  const r = Object.entries(SEKIL).map(([id, [x, y, w, h]]) => {
    const d = parcalar[id] || 'orijinal';
    const ek = etkilesimli ? ` data-parca="${id}" tabindex="0" role="button" aria-label="${PARCA_AD[id]}: ${DURUM_YAZI[d]}"` : '';
    return `<rect class="p p-${d}" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"${ek}><title>${PARCA_AD[id]}: ${DURUM_YAZI[d]}</title></rect>`;
  }).join('');
  return `<svg viewBox="0 0 80 161" class="araba" role="img" aria-label="Boya-değişen şeması">
    <rect class="cam" x="20" y="50" width="40" height="18" rx="4"/><rect class="cam" x="20" y="123" width="40" height="5" rx="2"/>${r}</svg>`;
}

export function fiyatDegisimi(ilan) {
  const g = (ilan.gecmis || []).filter(x => x.fiyat);
  return g.length < 2 ? null : { fark: g.at(-1).fiyat - g[0].fiyat, g };
}
export function spark(g, w = 84, h = 22) {
  const f = g.map(x => x.fiyat), min = Math.min(...f), aralik = (Math.max(...f) - min) || 1;
  const pts = g.map((x, i) => `${(i / (g.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (x.fiyat - min) / aralik * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

const KARAR = { al: ['Alınabilir', 'iyi'], dikkat: ['Dikkatli ol', 'orta'], alma: ['Alma', 'kotu'] };

// secenekler: { sil, takip, karsilastir, secili, incele, uygunluk, kisaListe, yeni, ilerleme }
export function ilanKarti(ilan, a, o = {}) {
  const g = a.hasar.gruplu;
  const u = esc(ilan.url);
  const hasarSatir = ['degisen', 'boyali', 'lokal'].filter(d => g[d].length)
    .map(d => `<span class="h-${d}">${a.DURUM_AD[d][0].toUpperCase() + a.DURUM_AD[d].slice(1)}: ${esc(g[d].join(', '))}</span>`).join('');
  const dg = fiyatDegisimi(ilan);
  const gecmis = dg && dg.fark !== 0 ? `<p class="gecmis">${dg.g.length >= 3 ? spark(dg.g) : ''}<span class="${dg.fark < 0 ? 'dustu' : 'artti'}">
      ${dg.fark < 0 ? '↓' : '↑'} ${tl(Math.abs(dg.fark))} ${dg.fark < 0 ? 'düştü' : 'arttı'}</span><span class="kucuk">ilk görülen ${tl(dg.g[0].fiyat)}</span></p>` : '';
  const ai = ilan.ai ? `<div class="ai">
      <p>${esc(ilan.ai.ozet)}</p>
      ${ilan.ai.olumlu?.length ? `<p class="arti">${ilan.ai.olumlu.map(esc).join('; ')}</p>` : ''}
      ${ilan.ai.riskler?.length ? `<p class="eksi">${ilan.ai.riskler.map(esc).join('; ')}</p>` : ''}
    </div>` : ilan.aiHata ? `<p class="kucuk">Yapay zekâ yorumu alınamadı: ${esc(ilan.aiHata)}</p>` : '';
  const eylemler = [
    o.karsilastir ? `<label class="kars"><input type="checkbox" data-kars="${u}" ${o.secili ? 'checked' : ''}>Karşılaştır</label>` : '',
    o.takip ? `<button class="ikon takip${ilan.takip ? ' aktif' : ''}" data-takip="${u}" aria-pressed="${!!ilan.takip}" title="Fiyatını takip et">★</button>` : '',
    o.kisaListe ? `<button class="ikon kisa${ilan.kisaListe ? ' aktif' : ''}" data-kisa="${u}" aria-pressed="${!!ilan.kisaListe}" title="Kısa listeye ekle">★</button>` : '',
    o.incele ? `<button class="ikon metin" data-incele="${u}">İncele</button>` : '',
    o.sil ? `<button class="ikon" data-sil="${u}" aria-label="İlanı sil" title="Sil">×</button>` : ''
  ].join('');
  const googleLink = `https://www.google.com/search?q=${encodeURIComponent(`${ilan.baslik || ''} ${ilan.fiyat || ''} ${ilan.site || ''}`)}`;
  const foto = /^https?:\/\//.test(ilan.foto || '') ? `<div class="foto"><img src="${esc(ilan.foto)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.remove()"></div>` : '';
  return `<article class="kart${ilan.durum === 'kaldirildi' ? ' kalkmis' : ''}${foto ? ' fotolu' : ''}" data-url="${u}">
    ${foto}
    <div class="sema">${arabaSvg(a.parcalar)}<span class="skor" title="Hasar skoru (100 = temiz)">${a.hasar.skor}</span></div>
    <div class="govde">
      ${/^https?:/.test(ilan.url) ? `<a class="baslik" href="${u}" target="_blank" rel="noopener">${esc(ilan.baslik || 'İlan')}</a>` : `<span class="baslik">${esc(ilan.baslik || 'İlan')}</span>`}
      <div class="fiyat-satir"><span class="fiyat">${tl(ilan.fiyat)}</span>
        ${ilan.durum === 'kaldirildi' ? '<span class="rozet kotu">Yayında değil</span>' : `<span class="rozet ${a.fiyat.sinif}">${esc(a.fiyat.etiket)}</span>`}
        ${ilan.inceleme && KARAR[ilan.inceleme.karar] ? `<span class="rozet cizgili ${KARAR[ilan.inceleme.karar][1]}" title="Derin inceleme sonucu">${KARAR[ilan.inceleme.karar][0]}</span>` : ''}
        ${a.gizli?.length ? '<span class="rozet uyari" title="Ekspertizde ilanda yazmayan hasar çıktı">Gizli hasar</span>' : a.ekspertizli ? '<span class="rozet cizgili iyi" title="Boya-değişen ekspertiz raporundan">Ekspertizli</span>' : ''}
        ${o.yeni ? '<span class="rozet yeni">Yeni</span>' : ''}
        ${o.uygunluk != null ? `<span class="uygun" title="Önceliklerine göre uygunluk">Uygunluk ${o.uygunluk}</span>` : ''}</div>
      ${gecmis}
      <dl class="bilgi">
        <div><dt>Yıl</dt><dd>${esc(ilan.yil ?? '—')}</dd></div>
        <div><dt>Km</dt><dd>${ilan.km == null ? '—' : Number(ilan.km).toLocaleString('tr-TR')}</dd></div>
        <div><dt>Tramer</dt><dd>${ilan.tramer == null ? 'yazmıyor' : ilan.tramer === 0 ? 'yok' : tl(ilan.tramer)}</dd></div>
        <div><dt>Paket</dt><dd title="${esc(ilan.model)}">${esc(ilan.model || '—')}</dd></div>
      </dl>
      ${ilan.kaynakTip === 'arama' && (ilan.aciklama || ilan.sehir) ? `<p class="ilan-ozet">${esc([ilan.sehir, ilan.aciklama].filter(Boolean).join(': '))}</p>` : ''}
      <p class="yorum">${esc(a.fiyat.aciklama)}</p>
      ${a.teklif ? `<p class="teklif">Açılış teklifi önerisi: <strong>~${tl(a.teklif)}</strong></p>` : ''}
      <p class="hasar">${hasarSatir || '<span class="h-temiz">Şemada işaretli parça yok</span>'}</p>
      ${a.uyarilar.length ? `<ul class="uyarilar">${a.uyarilar.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${ai}
      ${ilan.kaynakTip === 'arama' ? `<p class="kaynak-not kucuk">Google’dan bulundu; fiyat değişmiş ya da ilan kalkmış olabilir. ${/^https?:/.test(ilan.url) ? `<a href="${u}" target="_blank" rel="noopener">İlana git</a> ` : ''}<a href="${esc(googleLink)}" target="_blank" rel="noopener">Google’da bul</a></p>` : ''}
      ${o.ilerleme ? `<div class="ilerleme-satir" title="Kontrol listesi"><span style="width:${o.ilerleme.yuzde}%"></span></div><p class="kucuk ilerleme-yazi">Kontrol listesi ${o.ilerleme.biten}/${o.ilerleme.toplam}${ilan.puan ? `, puanın ${'★'.repeat(ilan.puan)}` : ''}</p>` : ''}
      <div class="alt"><span class="kucuk">${esc(SITE_AD[ilan.site] || ilan.site || 'elle eklendi')}${ilan.kontrol ? `, son kontrol ${tarih(ilan.kontrol)}` : ''}</span>
        <span class="eylemler">${eylemler}</span></div>
    </div>
  </article>`;
}
