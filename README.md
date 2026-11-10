# İlan Röntgeni sitesi ve telefon uygulaması (v0.6)

Tek site, iki iş görür: bilgisayarda karşılaştırma ekranı, telefonda ana ekrana kurulan uygulama.

## 1. GitHub Pages'te yayınla
1. GitHub'da yeni repo aç, örn. `ilan-rontgeni`.
2. Bu klasördeki tüm dosyaları yükle: Add file → Upload files.
3. Settings → Pages → Branch: `main`, klasör: `/ (root)` → Save.
4. 1–2 dakika sonra adres: `https://KULLANICIADI.github.io/ilan-rontgeni/`

## 2. Telefona kur
- **Android (Chrome):** siteyi aç → menü → Ana ekrana ekle / Uygulamayı yükle.
  Kurduktan sonra sahibinden uygulamasında ekran görüntüsü al → Paylaş → İlan Röntgeni. Form açılır, yapay zekâ doldurur.
- **iPhone (Safari):** Paylaş → Ana Ekrana Ekle. iPhone'da paylaşma menüsü desteklenmiyor; formdan "Ekran görüntüsü seç" kullan.

## 3. Senkronu kur (bilgisayar ↔ telefon)
1. github.com → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token.
2. Sadece **gist** kutusunu işaretle, oluştur.
3. Bilgisayarda: eklenti paneli → Ayarlar → GitHub anahtarı → kaydet → "Telefonla senkronla". Gist kimliği oluşur.
4. Telefonda: ⚙ Ayarlar → aynı anahtar + aynı Gist kimliği → Kaydet.
Veriler gizli bir Gist'te durur. Sonrasında her eklemede kendiliğinden senkron olur.

## 4. Yapay zekâ
⚙ Ayarlar → sağlayıcı **Gemini** (varsayılan) → Gemini API anahtarı (aistudio.google.com → Get API key).
İstersen Claude'a da geçebilirsin. Bununla:
- **İnternette ara (yeni):** Marka/model, yıl, km, fiyat, şehir yaz. Gemini Google'da sahibinden, arabam.com, letgo ve yetkili bayilerde arar; bulduğu ilanları fotoğraflı kartlar olarak getirir. Kriterine uymayan ya da başka siteye ait linkli kayıtlar elenir. Karttan "İlana git" ile orijinal sayfaya geçersin; link yoksa "Google'da bul" çıkar. Ayarlardan ek site eklenebilir.
- **Ekran görüntüsünden okuma:** fiyat, km, tramer, boya-değişen şeması forma dolar.
- **Model araştırması:** web'den kronik arızalar, motor-şanzıman riski, hangi yıl/paket tercih edilmeli, satıcıya sorular. Model başına bir kez yapılır, senkronla paylaşılır.
- **Derin inceleme:** tek ilan için Al / Dikkatli ol / Alma kararı, bu araca özel riskler, ekspertizde baktırılacaklar, pazarlık gerekçesi.

Google Cloud'da bütçe uyarısı koy: Gemini 3 modellerinde Google Arama, yapılan her arama sorgusu başına ücretlendirilir ve her site ayrı aranır. Anahtarlar sadece cihazında saklanır.

Sınır: Google araması tüm ilanları göstermez; sadece Google'ın taradıklarını bulur ve bazıları eski olabilir. Bilgisayardaki eklenti, sahibinden arama sayfasındaki ilanların tamamını toplar; ikisini birlikte kullan.

## Veri kaynakları
Bu cihaz + (bilgisayarda) eklenti köprüsü + (varsa) repodaki veri.json birleştirilir.
Hiçbiri yoksa örnek veri gösterilir.

## Dosyalar
- Eklentiyle ortak (aynı tut): `analysis.js`, `render.js`, `style.css`, `sync.js`
- Siteye özel: `index.html`, `app.js`, `ekle.js`, `ai.js`, `veri.js`, `site.css`, `sw.js`, `manifest.webmanifest`, ikonlar

## Aracı görmeye giderken (v0.6)
Bir ilanda "İncele"ye bas; dört sekme var:
- **Özet:** fiyat-hasar analizi ve derin inceleme (Al / Dikkatli ol / Alma).
- **Kontrol:** görmeden önce, araç başında, test sürüşü, ekspertiz ve satın alma adımları. Derin inceleme yaptıysan bu araca özel sorular da eklenir. İlerleme kartta görünür.
- **Ekspertiz:** rapor fotoğrafını yükle, yapay zekâ okusun (ya da şemaya dokunarak işaretle). İlanda yazmayan hasar varsa "Gizli hasar" uyarısı çıkar ve araç sıralamada geriye düşer.
- **Notlar:** puanın (1–5 yıldız), notların, kısa liste.

Kartlardaki ★ ile kısa listeye al, filtreden "Sadece kısa listem"i seç, karşılaştır ve "Yapay zekâya sor: hangisini almalıyım?" de.
"Aramayı yenile" kayıtlı aramanı tekrar çalıştırır; yeni ilanlar "Yeni" rozetiyle işaretlenir, fiyatı düşenler sayılır.

## Arama nasıl çalışır? (v0.6)
- **Üstteki kutuya** aradığın aracı yaz ("Renault Megane 2022") → arama penceresi açılır. Kriterleri kontrol et, siteleri seç, **"Ara"** düğmesine bas. Arama sadece bu düğmeyle başlar.
- **Kapsam:** "Hızlı" site başına tek arama yapar. "Geniş" her model yılını ayrı arar; çok daha fazla ilan getirir ama daha uzun sürer ve API kullanımı yıl sayısı kadar artar.
- **Sonuç ekranında üç sekme var:** "Son arama" sadece son aramanın sonuçlarını, "Tüm ilanlar" eklenti, elle eklenen ve eski aramalar dahil her şeyi, "Kısa listem" ★ ile seçtiklerini gösterir.
- **"Sonuçları daralt"** paneli internette yeni arama yapmaz; sadece ekrandaki listeyi süzer ve sıralar.
- **Neden yüzlerce değil de birkaç düzine?** Yapay zekâ Google'ın taradığı ilanları görebilir ve her sorguda en fazla 20 ilan getirir. Hepsini görmek için sonuç ekranındaki "sahibinden'de aç" linkiyle aynı aramayı sitenin kendisinde aç. Bilgisayarda eklentiyle o sayfadaki tüm ilanları tek seferde topla; senkronla telefona da gelir.
- Belirli bir sitede aranıp gerçek bir ilan linki olmayan kayıtlar uydurma olabileceği için gösterilmez.
