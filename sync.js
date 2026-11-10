// Cihazlar arası senkron: gizli GitHub Gist. Eklenti ve site ortak kullanır.
// Veri: { ilanlar: {url: ilan}, raporlar: {model: rapor}, silinenler: {url: zaman} }
const DOSYA = 'ilan-rontgeni.json';
const zaman = i => Math.max(i?.kontrol || 0, i?.degisim || 0, i?.eklenme || 0);

export function ilanBirlestir(a, b) {
  if (!a) return b; if (!b) return a;
  const [yeni, eski] = zaman(b) >= zaman(a) ? [b, a] : [a, b];
  const g = new Map();
  [...(eski.gecmis || []), ...(yeni.gecmis || [])].forEach(x => g.set(x.t, x));
  const gecmis = [...g.values()].sort((x, y) => x.t - y.t).filter((x, k, d) => k === 0 || x.fiyat !== d[k - 1].fiyat);
  return {
    ...eski, ...yeni, gecmis,
    eklenme: Math.min(a.eklenme || Infinity, b.eklenme || Infinity),
    ai: yeni.ai || eski.ai, inceleme: yeni.inceleme || eski.inceleme
  };
}

export function veriBirlestir(x = {}, y = {}) {
  const silinenler = { ...(x.silinenler || {}) };
  for (const [u, t] of Object.entries(y.silinenler || {})) silinenler[u] = Math.max(silinenler[u] || 0, t);
  const ilanlar = {};
  for (const u of new Set([...Object.keys(x.ilanlar || {}), ...Object.keys(y.ilanlar || {})])) {
    const m = ilanBirlestir(x.ilanlar?.[u], y.ilanlar?.[u]);
    if (silinenler[u] && silinenler[u] >= zaman(m)) continue;
    ilanlar[u] = m;
  }
  const raporlar = { ...(x.raporlar || {}) };
  for (const [k, r] of Object.entries(y.raporlar || {})) if (!raporlar[k] || (r.t || 0) > (raporlar[k].t || 0)) raporlar[k] = r;
  return { ilanlar, raporlar, silinenler };
}

// Uzak veriyi çeker, yerelle birleştirir, sonucu geri yazar. Dönüş: { veri, gistId }
export async function gistSenkron({ ghToken, gistId }, yerel) {
  if (!ghToken) throw new Error('Ayarlarda GitHub anahtarı yok');
  const h = { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' };
  let veri = yerel;
  if (gistId) {
    const r = await fetch(`https://api.github.com/gists/${gistId}`, { headers: h, cache: 'no-store' });
    if (!r.ok) throw new Error(`Gist okunamadı (${r.status}). Anahtarın "gist" iznini ve Gist kimliğini kontrol et.`);
    const dosya = (await r.json()).files?.[DOSYA];
    if (dosya) {
      const icerik = dosya.truncated ? await (await fetch(dosya.raw_url)).text() : dosya.content;
      veri = veriBirlestir(JSON.parse(icerik || '{}'), yerel);
    }
  }
  const govde = { files: { [DOSYA]: { content: JSON.stringify({ surum: 1, ...veri }) } } };
  const r = await fetch(gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists', {
    method: gistId ? 'PATCH' : 'POST', headers: h,
    body: JSON.stringify(gistId ? govde : { ...govde, public: false, description: 'İlan Röntgeni senkron verisi' })
  });
  if (!r.ok) throw new Error(`Gist yazılamadı (${r.status})`);
  return { veri, gistId: gistId || (await r.json()).id };
}
