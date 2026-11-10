// Araç başına kontrol listesi: görmeden önce → araç başında → test sürüşü → ekspertiz → satın alma
export const KONTROL = [
  { grup: 'Görmeden önce', maddeler: [
    ['plaka-sasi', 'Satıcıdan plaka ve şasi numarasını iste'],
    ['tramer', 'Hasar kaydı (tramer) sorgusunu şasi numarasıyla yap'],
    ['km-gecmis', 'Muayene geçmişindeki km kayıtlarına bak (TÜVTÜRK muayene geçmişi)'],
    ['servis', 'Yetkili servis bakım geçmişini iste ya da servise sorgulat'],
    ['rehin', 'Rehin, haciz veya yakalama kaydı olmadığını teyit et']
  ] },
  { grup: 'Araç başında', maddeler: [
    ['ruhsat', 'Ruhsattaki şasi/motor numarası araçla, ruhsat sahibi satıcıyla uyuşuyor'],
    ['soguk', 'Motoru soğukken çalıştır: ilk çalışma sesi ve egzoz dumanı normal'],
    ['lastik', 'Lastiklerin üretim tarihi ve diş derinliği, fren diskleri'],
    ['elektronik', 'Klima, camlar, ekran, kamera ve park sensörleri çalışıyor'],
    ['asinma', 'Direksiyon, koltuk ve pedal aşınması km ile uyumlu'],
    ['kacak', 'Motor altında yağ veya su kaçağı yok'],
    ['anahtar', 'Yedek anahtar ve kullanım kitabı var']
  ] },
  { grup: 'Test sürüşü', maddeler: [
    ['vites', 'Vites geçişleri yumuşak: kalkış, düşük hız, geri vites'],
    ['direksiyon', 'Düz yolda direksiyon çekmiyor, frenlemede titreme yok'],
    ['ses', 'Tümsek ve bozuk yolda alt takımdan ses gelmiyor'],
    ['lamba', 'Sürüş boyunca gösterge panelinde uyarı lambası yanmadı']
  ] },
  { grup: 'Ekspertiz', maddeler: [
    ['ekspertiz', 'Bağımsız bir ekspertize götürdün (satıcının önerdiği yere değil)'],
    ['rapor', 'Ekspertiz raporunu uygulamaya yükledin, ilanla karşılaştırıldı']
  ] },
  { grup: 'Satın alma', maddeler: [
    ['kapora', 'Aracı görmeden kapora göndermedin'],
    ['noter', 'Satış noterde; ödeme güvenli yöntemle (noterin güvenli ödeme sistemi ya da banka)'],
    ['sigorta', 'Trafik sigortası ve kasko teklifi aldın']
  ] }
];

// Derin incelemeden gelen, bu araca özel maddeler
export function ozelMaddeler(ilan) {
  const n = ilan.inceleme;
  if (!n) return [];
  return [
    ...(n.saticiyaSorular || []).map((m, k) => [`ai-s-${k}`, `Satıcıya sor: ${m}`]),
    ...(n.ekspertizde || []).map((m, k) => [`ai-e-${k}`, `Ekspertizde: ${m}`]),
    ...(n.testSurusunde || []).map((m, k) => [`ai-t-${k}`, `Test sürüşünde: ${m}`])
  ];
}

export function isaretli(ilan, id) {
  if (id === 'rapor' && ilan.ekspertiz) return true;
  return !!ilan.kontrolListesi?.[id];
}

export function ilerlemeHesapla(ilan) {
  const tum = [...KONTROL.flatMap(g => g.maddeler), ...ozelMaddeler(ilan)];
  const biten = tum.filter(([id]) => isaretli(ilan, id)).length;
  return { biten, toplam: tum.length, yuzde: Math.round(biten / tum.length * 100) };
}
// Kartta göstermek için: sadece başlanmışsa ya da kısa listedeyse
export function ilerleme(ilan) {
  const i = ilerlemeHesapla(ilan);
  return i.biten || ilan.kisaListe ? i : null;
}
