// Yapay zekâ katmanı: Gemini (Google Arama bağlantılı) veya Claude.
// İnternette ilan arama, ekran görüntüsü okuma, model araştırması, derin inceleme.
import { tl } from './render.js';

export const aiHazir = a => a.saglayici === 'claude' ? !!a.apiKey : !!a.geminiKey;
export const aiEksikMesaji = a => `Bu özellik için Ayarlar’dan ${a.saglayici === 'claude' ? 'Anthropic' : 'Gemini'} API anahtarı gir`;

async function geminiCagir(a, { metin, gorseller = [], webArama }) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(a.geminiModel)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': a.geminiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [...gorseller.map(g => ({ inline_data: { mime_type: 'image/jpeg', data: g } })), { text: metin }] }],
      ...(webArama ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { temperature: 0.2 }
    })
  });
  if (!r.ok) throw new Error(`Gemini API ${r.status}: ${(await r.text()).slice(0, 180)}`);
  const d = await r.json();
  const c = d.candidates?.[0];
  if (!c) throw new Error('Gemini yanıt vermedi (güvenlik filtresi ya da kota). Tekrar dene.');
  return {
    metin: (c.content?.parts || []).map(p => p.text || '').join(''),
    kaynaklar: (c.groundingMetadata?.groundingChunks || []).filter(x => x.web).map(x => ({ baslik: x.web.title, url: x.web.uri }))
  };
}

async function claudeCagir(a, { metin, gorseller = [], webArama, maxTokens = 3000 }) {
  const mesajlar = [{ role: 'user', content: [
    ...gorseller.map(g => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: g } })),
    { type: 'text', text: metin }] }];
  let cikti = '', kaynaklar = [];
  for (let tur = 0; tur < 4; tur++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': a.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: a.model, max_tokens: maxTokens, messages: mesajlar,
        ...(webArama ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }] } : {}) })
    });
    if (!r.ok) throw new Error(`Claude API ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const d = await r.json();
    cikti += d.content.filter(c => c.type === 'text').map(c => c.text).join('');
    d.content.filter(c => c.type === 'web_search_tool_result' && Array.isArray(c.content))
      .forEach(c => c.content.forEach(s => s.url && kaynaklar.push({ baslik: s.title, url: s.url })));
    if (d.stop_reason !== 'pause_turn') break;
    mesajlar.push({ role: 'assistant', content: d.content });
  }
  return { metin: cikti, kaynaklar };
}

async function uret(a, istek) {
  if (!aiHazir(a)) throw new Error(aiEksikMesaji(a));
  const { metin, kaynaklar } = await (a.saglayici === 'claude' ? claudeCagir : geminiCagir)(a, istek);
  const temiz = metin.replace(/```(json)?/g, '');
  const bas = temiz.indexOf('{'), son = temiz.lastIndexOf('}');
  if (bas < 0) throw new Error('Yanıt okunamadı, tekrar dene');
  let json;
  try { json = JSON.parse(temiz.slice(bas, son + 1)); } catch { throw new Error('Yanıt bozuk geldi, tekrar dene'); }
  return { json, kaynaklar: [...new Map(kaynaklar.map(k => [k.url, k])).values()] };
}

// ---------- İnternette ilan arama ----------
export const VARSAYILAN_SITELER = [
  { ad: 'sahibinden.com', alan: 'sahibinden.com' },
  { ad: 'arabam.com', alan: 'arabam.com' },
  { ad: 'letgo', alan: 'letgo.com' },
  { ad: 'Yetkili bayiler', alan: '' }
];

// yil verilirse o model yılı için ayrı arama yapılır (Geniş kapsam)
export async function internetteAra(a, k, site, yil = null) {
  const nerede = site.alan
    ? `SADECE ${site.alan} sitesinde (aramalarına "site:${site.alan}" ekle)`
    : 'Türkiye’deki marka yetkili bayilerinin ve kurumsal garantili ikinci el platformlarının sitelerinde';
  const kosullar = [
    yil ? `model yılı tam olarak ${yil}` : k.y1 || k.y2 ? `model yılı ${k.y1 || '...'}–${k.y2 || '...'}` : '',
    k.km ? `en fazla ${k.km.toLocaleString('tr-TR')} km` : '',
    k.fiyat ? `en fazla ${k.fiyat.toLocaleString('tr-TR')} TL` : '',
    k.sehir ? `${k.sehir} ve çevresi` : '',
    k.vites ? `${k.vites} vites` : '', k.yakit ? `${k.yakit}` : ''
  ].filter(Boolean).join(', ');
  const { json, kaynaklar } = await uret(a, { webArama: true, maxTokens: 4000, metin:
`Google'da ara ve ${nerede} şu an satılık olan TEK TEK ikinci el araç ilanlarını bul.
Araç: ${k.arac}. Koşullar: ${kosullar || 'yok'}.
Farklı aramalar yap (paket, motor, şehir, fiyat sıralaması değiştirerek) ve olabildiğince çok gerçek ilan topla, en fazla 20.
KURALLAR:
- Sadece arama sonuçlarında gerçekten gördüğün ilanları yaz. İlan, link, fiyat veya fotoğraf UYDURMA.
- Liste/kategori sayfası değil, tek bir ilanın sayfası olmalı. url o ilanın adresi olsun.
- Görmediğin alanı null bırak. foto: ilanın ana fotoğrafının doğrudan görsel adresi; görmediysen null.
- hasar: ilanda boyalı/değişen parça yazıyorsa parça adlarıyla (Sol arka kapı, Motor kaputu, Tavan…), yoksa boş liste.
- tramer: "hasar kaydı yok/tramersiz" ise 0, tutar varsa sayı, bahsedilmiyorsa null.
Sadece şu JSON'u döndür:
{"ilanlar":[{"baslik":"","url":"","foto":null,"fiyat":0,"yil":0,"km":0,"marka":"","seri":"","model":"paket/motor","vites":null,"yakit":null,"sehir":null,"tramer":null,"kimden":null,"ilanTarihi":null,"hasar":{"boyali":[],"lokal":[],"degisen":[]},"ozet":"ilandaki önemli bilgiler, 1 cümle"}]}` });
  return { ilanlar: Array.isArray(json.ilanlar) ? json.ilanlar : [], kaynaklar };
}

// ---------- Ekran görüntüsünden okuma ----------
const PARCA_LISTESI = 'Ön tampon, Arka tampon, Motor kaputu, Bagaj kapağı, Tavan, Sol ön çamurluk, Sol ön kapı, Sol arka kapı, Sol arka çamurluk, Sağ ön çamurluk, Sağ ön kapı, Sağ arka kapı, Sağ arka çamurluk';
export async function ilanCikar(a, { metin, gorseller }) {
  return (await uret(a, { gorseller, maxTokens: 1500, metin:
`Bunlar Türkiye'deki bir ikinci el araç ilanının ekran görüntüleri ve/veya metni (sahibinden, arabam.com vb.).
Bilgileri çıkar. Okuyamadığın alanı null bırak, tahmin etme.
Boya-değişen şemasında renkleri dikkatle oku; parça adlarını SADECE şu listeden kullan: ${PARCA_LISTESI}.
Tramer: "hasar kaydı yok/tramersiz" ise 0, tutar yazıyorsa sayı, hiç bahsedilmiyorsa null.
Sadece şu JSON'u döndür:
{"baslik":null,"fiyat":null,"yil":null,"km":null,"marka":null,"seri":null,"model":null,"yakit":null,"vites":null,"tramer":null,"ilanTarihi":null,"kimden":null,"aciklama":null,"hasar":{"boyali":[],"lokal":[],"degisen":[]}}
Ek metin: ${metin || '(yok)'}` })).json;
}

// ---------- Model araştırması ----------
export async function modelRaporu(a, { ad, yillar, paketler, motorlar }) {
  const { json, kaynaklar } = await uret(a, { webArama: true, maxTokens: 4000, metin:
`Türkiye'de ikinci el ${ad} almak isteyen birine kapsamlı ve dürüst bir alım rehberi hazırla.
Bakılan yıllar: ${yillar}. İlanlarda görülen paketler/motorlar: ${[...paketler, ...motorlar].join(', ') || 'bilinmiyor'}.
Web'de araştır: kullanıcı yorumları, şikayetvar, forumlar, kronik arızalar, şanzıman/motor sorunları, geri çağırmalar, Türkiye'deki servis ve parça maliyetleri, yıl bazında yapılan değişiklikler.
Emin olmadığın bilgiyi kesin gibi yazma; "bazı kullanıcılar bildiriyor" gibi belirt. Kısa ve uygulanabilir yaz.
Sadece şu JSON'u döndür (Türkçe):
{"ozet":"2-3 cümle","motorSanziman":[{"ad":"","yorum":"","risk":"dusuk|orta|yuksek"}],
"kronik":[{"baslik":"","detay":"","belirti":"test sürüşünde/ekspertizde nasıl anlaşılır","hangiYillar":""}],
"tavsiye":{"tercihEt":"hangi yıl/motor/paket ve neden","kacin":"neyden ve neden"},
"bakimMaliyeti":"periyodik bakım ve sık değişen parçalar hakkında kısa bilgi",
"geriCagirma":[""],"saticiyaSorular":[""],"testSurusu":[""]}` });
  return { ...json, kaynaklar: kaynaklar.slice(0, 12), t: Date.now() };
}

// ---------- Tek ilan derin incelemesi ----------
export async function derinInceleme(a, ilan, an, rapor) {
  const ozet = {
    baslik: ilan.baslik, fiyat: ilan.fiyat, yil: ilan.yil, km: ilan.km, paket: ilan.model, vites: ilan.vites, yakit: ilan.yakit,
    tramer: ilan.tramer, kimden: ilan.kimden, ilandaGun: an.gun, hasarSkoru: an.hasar.skor, parcalar: an.hasar.gruplu,
    piyasa: an.fiyat.aciklama, beklenenFiyat: an.fiyat.beklenen, uyarilar: an.uyarilar, aciklama: ilan.aciklama?.slice(0, 2500),
    fiyatGecmisi: (ilan.gecmis || []).map(g => tl(g.fiyat))
  };
  const { json } = await uret(a, { maxTokens: 2000, metin:
`Sen deneyimli bir ikinci el araç alım danışmanısın. Alıcının amacı: en sıkıntısız aracı almak.
Aşağıdaki ilanı değerlendir. ${rapor ? `Bu modelin bilinen sorunları: ${JSON.stringify({ kronik: rapor.kronik, motorSanziman: rapor.motorSanziman, kacin: rapor.tavsiye?.kacin })}` : 'Modelin bilinen sorunlarını genel bilginle değerlendir, emin değilsen belirt.'}
İlan: ${JSON.stringify(ozet)}
Bilinmeyen bilgiler (tramer, boya-değişen) varsa bunu risk olarak yaz ve nasıl öğrenileceğini söyle.
Bu araca özel yaz, genel tavsiye verme. Sadece şu JSON'u döndür (Türkçe, kısa maddeler):
{"karar":"al|dikkat|alma","ozet":"2 cümle: neden","artilar":[],"riskler":[],"saticiyaSorular":["bu araca özel sorular"],
"ekspertizde":["ekspertizde özellikle baktırılacaklar"],"testSurusunde":[],"pazarlik":"hangi gerekçelerle ne kadar pazarlık"}` });
  return { ...json, t: Date.now() };
}

// ---------- Ekspertiz raporu okuma ----------
export async function ekspertizOku(a, { gorseller, metin }) {
  return (await uret(a, { gorseller, maxTokens: 2000, metin:
`Bunlar Türkiye'de bir ikinci el araç için yapılmış ekspertiz raporunun fotoğrafları ve/veya metni.
Raporu dikkatle oku. Kaporta bölümünde parça parça durumları (orijinal, lokal boyalı, boyalı, değişen) ve varsa boya kalınlığı (mikron) değerlerini çıkar.
Parça adlarını SADECE şu listeden kullan: ${PARCA_LISTESI}.
mekanik: motor, şanzıman, yürüyen aksam, fren, elektronik, şasi ile ilgili olumsuz bulgular (kısa maddeler). Olumsuz bulgu yoksa boş liste.
Okuyamadığın değeri yazma, tahmin etme.
Sadece şu JSON'u döndür:
{"hasar":{"boyali":[],"lokal":[],"degisen":[]},"mikron":{"Parça adı":0},"mekanik":[],"sasiHasari":false,"ozet":"raporun 1-2 cümlelik özeti"}
Ek not: ${metin || '(yok)'}` })).json;
}

// ---------- Kısa listeden son karar ----------
export async function sonKarar(a, adaylar, rapor) {
  const { json } = await uret(a, { maxTokens: 2500, metin:
`Sen deneyimli bir ikinci el araç alım danışmanısın. Alıcı kısa listesindeki araçlardan birini alacak; amacı en sıkıntısız ve parasının karşılığı olan aracı almak.
${rapor ? `Modelin bilinen sorunları: ${JSON.stringify({ kronik: rapor.kronik, motorSanziman: rapor.motorSanziman, tavsiye: rapor.tavsiye })}` : ''}
Adaylar (index sırasıyla): ${JSON.stringify(adaylar)}
Ekspertizde çıkan, ilanda gizlenmiş hasar ciddi güven sorunudur. Bilinmeyen bilgiler (ekspertiz yapılmamış, tramer yok) risktir; önce hangi bilginin tamamlanması gerektiğini söyle.
Sadece şu JSON'u döndür (Türkçe, kısa):
{"secim":0,"gerekce":"2-3 cümle","siralama":[{"index":0,"neden":"tek cümle"}],"eksikBilgi":["karar vermeden önce öğrenilmesi gerekenler"],"sonAdimlar":["seçilen araç için sıradaki somut adımlar"]}` });
  return { ...json, t: Date.now() };
}
