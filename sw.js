// Service Worker: cache aset agar aplikasi terbuka instan/offline,
// dan mengecek jadwal siram untuk memicu notifikasi lokal.
importScripts('assets/config.js', 'assets/kv.js');

var CACHE = 'ingat-siram-v4';
var DAY = 24 * 60 * 60 * 1000;
var ASSETS = [
  'app.html',
  'index.html',
  'pasang.html',
  'manifest.json',
  'assets/style.css',
  'assets/config.js',
  'assets/kv.js',
  'assets/tracking.js',
  'assets/app.js',
  'assets/landing.js',
  'assets/stats.js',
  'assets/lead.js',
  'assets/pasang.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Stale-while-revalidate untuk aset statis sendiri; API dan domain lain lewat langsung.
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.indexOf('/api/') !== -1) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(e.request, { ignoreSearch: true }).then(function (cached) {
        var network = fetch(e.request).then(function (res) {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      });
    })
  );
});

function checkDue() {
  if (!self.Notification || Notification.permission !== 'granted') return Promise.resolve();

  return Promise.all([kv.get('tanaman'), kv.get('notified')]).then(function (r) {
    var plants = r[0] || [];
    var notified = r[1] || {};
    var now = Date.now();
    var jobs = [];

    plants.forEach(function (p) {
      var due = p.timestamp_terakhir_siram + p.interval_siram * DAY;
      // Satu notifikasi per siklus siram: dicatat dengan timestamp siram terakhir.
      if (now < due || notified[p.id_tanaman] === p.timestamp_terakhir_siram) return;
      notified[p.id_tanaman] = p.timestamp_terakhir_siram;

      var prod = productFor(p);
      var body = 'Waktunya menyiram ' + p.nama_tanaman + ' 💧';
      if (prod) body += '\nTips: ' + prod.title + ' – ' + prod.desc;

      jobs.push(self.registration.showNotification('Ingat Siram 🌱', {
        body: body,
        tag: 'siram-' + p.id_tanaman,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        data: { id: p.id_tanaman }
      }));
    });

    return Promise.all(jobs).then(function () { return kv.set('notified', notified); });
  });
}

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'cek') e.waitUntil(checkDue());
});

// Web Push dari server (cron/send-reminders.php). Satu-satunya cara notifikasi
// sampai ke iPhone saat aplikasi tertutup.
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}

  e.waitUntil(
    kv.get('notified').then(function (n) {
      // Tandai agar pengecekan lokal tidak memunculkan notifikasi ganda.
      n = n || {};
      if (d.id) n[d.id] = d.ts;
      return kv.set('notified', n);
    }).catch(function () {}).then(function () {
      return self.registration.showNotification(d.title || 'Ingat Siram 🌱', {
        body: d.body || 'Ada tanaman yang perlu disiram 💧',
        tag: 'siram-' + (d.id || 'umum'),
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        data: { id: d.id || '' }
      });
    })
  );
});

self.addEventListener('periodicsync', function (e) {
  if (e.tag === 'cek-siram') e.waitUntil(checkDue());
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = 'app.html?siram=' + encodeURIComponent((e.notification.data || {}).id || '');
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (wins) {
      for (var i = 0; i < wins.length; i++) {
        if (wins[i].url.indexOf('app.html') !== -1 && 'navigate' in wins[i]) {
          return wins[i].navigate(url).then(function (w) { return w && w.focus(); });
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
