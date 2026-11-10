// Çevrimdışı açılış + Android "Paylaş" ile gelen ekran görüntülerini karşılama
const SURUM = 'ir-v6';
const DOSYALAR = ['./', 'index.html', 'app.js', 'analysis.js', 'render.js', 'sync.js', 'veri.js', 'ai.js', 'ekle.js', 'kontrol.js',
  'style.css', 'site.css', 'manifest.webmanifest', 'ikon-192.png', 'ikon-512.png', 'ornek-veri.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(DOSYALAR)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== SURUM && x !== 'ir-paylasim').map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});

async function paylasimAl(istek) {
  const fd = await istek.formData();
  const c = await caches.open('ir-paylasim');
  for (const k of await c.keys()) await c.delete(k);
  const dosyalar = fd.getAll('gorsel').filter(f => f && f.size);
  const kok = self.registration.scope;
  await c.put(new URL('paylasim/meta', kok), new Response(JSON.stringify({
    title: fd.get('title') || '', text: fd.get('text') || '', url: fd.get('url') || '', n: dosyalar.length
  })));
  for (let k = 0; k < dosyalar.length; k++) await c.put(new URL(`paylasim/${k}`, kok), new Response(dosyalar[k]));
  return Response.redirect(new URL('./?paylasim=1', kok), 303);
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.pathname.endsWith('/paylas')) { e.respondWith(paylasimAl(e.request)); return; }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Önce ağ (güncellemeler hemen gelsin), ağ yoksa önbellek
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const kopya = r.clone(); caches.open(SURUM).then(c => c.put(e.request, kopya)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
