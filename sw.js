/* Service Worker — Capturador Hauser */
const CACHE='capturador-v0.7-B3-r2';
const ASSETS=['./','./index.html','./app.js','./styles.css','./manifest.json','./icons/icon-192.png','./icons/icon-512.png',
  './mascota/idle.mp4','./mascota/walking.mp4','./mascota/jogging.mp4','./mascota/running.mp4','./mascota/sad.mp4','./mascota/celebrating.mp4'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  // red primero para APIs externas (Anthropic, Nominatim, Apps Script, tiles)
  if(url.origin!==location.origin){return;}
  // cache-first para los archivos propios
  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
      return resp;
    }).catch(()=>caches.match('./index.html')))
  );
});
