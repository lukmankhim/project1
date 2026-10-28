(function () {
  var DAY = 24 * 60 * 60 * 1000;
  var KEY = 'tanaman';
  var list = document.getElementById('list');
  var empty = document.getElementById('empty');
  var tpl = document.getElementById('card-tpl');
  var dialog = document.getElementById('add-dialog');
  var addForm = document.getElementById('add-form');
  var addErr = document.getElementById('add-err');

  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  // PWA di layar utama iPhone punya penyimpanan terpisah dari Safari, jadi lead bisa kosong
  // di sana walau pengguna sudah daftar. Hanya pengunjung browser biasa yang diarahkan ke landing.
  var lead = LeadLink.restore();
  if (!lead && !standalone) { location.replace('index.html'); return; }
  lead = lead || { id: 0, nama: '', kontak: '' };
  if (lead.nama) document.getElementById('sapaan').textContent = 'Hai, ' + lead.nama.split(' ')[0];

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }

  // --- Data tanaman (localStorage, dicerminkan ke IndexedDB untuk SW) ---

  function load() { return readJSON(KEY, []); }

  function save(plants) {
    localStorage.setItem(KEY, JSON.stringify(plants));
    kv.set(KEY, plants).then(askSwToCheck).catch(function () {});
    syncPushSoon();
  }

  function uid() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function statusOf(plant, now) {
    var due = plant.timestamp_terakhir_siram + plant.interval_siram * DAY;
    var left = due - now;
    var pct = Math.min(100, Math.max(0, 100 - (left / (plant.interval_siram * DAY)) * 100));
    var text;
    if (left <= 0) {
      var late = Math.floor(-left / DAY);
      text = late > 0 ? 'Telat ' + late + ' hari, ayo siram sekarang!' : 'Waktunya siram hari ini!';
    } else if (left < DAY) {
      text = 'Siram dalam ' + Math.ceil(left / (60 * 60 * 1000)) + ' jam lagi';
    } else {
      text = 'Siram ' + Math.ceil(left / DAY) + ' hari lagi · tiap ' + plant.interval_siram + ' hari';
    }
    return { due: left <= 0, pct: pct, text: text };
  }

  function render() {
    var plants = load();
    var now = Date.now();
    list.textContent = '';
    empty.classList.toggle('hidden', plants.length > 0);

    plants
      .slice()
      .sort(function (a, b) {
        return (a.timestamp_terakhir_siram + a.interval_siram * DAY) - (b.timestamp_terakhir_siram + b.interval_siram * DAY);
      })
      .forEach(function (plant) {
        var node = tpl.content.firstElementChild.cloneNode(true);
        var st = statusOf(plant, now);
        node.dataset.id = plant.id_tanaman;
        node.classList.toggle('due', st.due);
        node.querySelector('.name').textContent = plant.nama_tanaman;
        node.querySelector('.status').textContent = st.text;
        node.querySelector('.bar span').style.width = st.pct + '%';
        node.querySelector('.cal').href = 'api/ics.php?' + new URLSearchParams({
          n: plant.nama_tanaman,
          i: plant.interval_siram,
          s: plant.timestamp_terakhir_siram + plant.interval_siram * DAY
        });

        var prod = productFor(plant);
        var promo = node.querySelector('.promo');
        if (prod) {
          promo.querySelector('.p-title').textContent = prod.title;
          promo.querySelector('.p-desc').textContent = prod.desc;
          var link = promo.querySelector('.p-link');
          link.href = prod.url;
          link.textContent = prod.cta || 'Lihat';
          link.dataset.product = prod.id;
        } else {
          promo.remove();
          node.querySelector('.more').remove();
        }
        list.appendChild(node);
      });
  }

  // --- Interaksi kartu ---

  list.addEventListener('click', function (e) {
    var card = e.target.closest('.card');
    if (!card) return;
    var id = card.dataset.id;

    if (e.target.closest('.water')) {
      save(load().map(function (p) {
        if (p.id_tanaman === id) p.timestamp_terakhir_siram = Date.now();
        return p;
      }));
      render();
      catatSiram(id);
    } else if (e.target.closest('.del')) {
      var plant = load().filter(function (p) { return p.id_tanaman === id; })[0];
      if (plant && confirm('Hapus "' + plant.nama_tanaman + '"?')) {
        save(load().filter(function (p) { return p.id_tanaman !== id; }));
        render();
      }
    } else if (e.target.closest('.p-link')) {
      trackAffiliate(e.target.closest('.p-link').dataset.product, 'kartu');
    } else if (e.target.closest('.more')) {
      openRekom();
    }
  });

  // --- Semua rekomendasi ---

  var rekomDialog = document.getElementById('rekom-dialog');
  var rekomList = document.getElementById('rekom-list');

  function openRekom() {
    rekomList.textContent = '';
    APP_CONFIG.products.forEach(function (prod) {
      var item = document.createElement('div');
      item.className = 'promo';
      var info = document.createElement('div');
      var title = document.createElement('strong');
      title.textContent = prod.title;
      var desc = document.createElement('p');
      desc.textContent = prod.desc;
      info.appendChild(title);
      info.appendChild(desc);
      var link = document.createElement('a');
      link.className = 'p-link';
      link.href = prod.url;
      link.target = '_blank';
      link.rel = 'sponsored noopener';
      link.textContent = prod.cta || 'Lihat';
      link.dataset.product = prod.id;
      item.appendChild(info);
      item.appendChild(link);
      rekomList.appendChild(item);
    });
    rekomDialog.showModal();
  }

  rekomList.addEventListener('click', function (e) {
    var link = e.target.closest('.p-link');
    if (link) trackAffiliate(link.dataset.product, 'daftar');
  });
  document.getElementById('rekom-close').addEventListener('click', function () { rekomDialog.close(); });

  // Catat siram ke server untuk penghitung di landing page. ID perangkat acak, bukan data pribadi.
  function catatSiram(idTanaman) {
    var device = localStorage.getItem('device_id');
    if (!device) {
      device = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
      localStorage.setItem('device_id', device);
    }
    var body = JSON.stringify({ device: device, id_tanaman: idTanaman });
    if (!(navigator.sendBeacon && navigator.sendBeacon('api/siram.php', new Blob([body], { type: 'application/json' })))) {
      fetch('api/siram.php', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(function () {});
    }
  }

  function trackAffiliate(productId, placement) {
    var eventId = Track.newEventId('aff');
    var ids = Track.browserIds();
    Track.custom('ClickAffiliate', { content_ids: [productId], placement: placement }, eventId);
    var body = JSON.stringify({
      event_id: eventId, product_id: productId, placement: placement,
      nama: lead.nama, kontak: lead.kontak,
      fbp: ids.fbp, fbc: ids.fbc, page_url: ids.page_url
    });
    // sendBeacon tetap terkirim walau halaman berpindah ke link afiliasi.
    if (!(navigator.sendBeacon && navigator.sendBeacon('api/click.php', new Blob([body], { type: 'application/json' })))) {
      fetch('api/click.php', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(function () {});
    }
  }

  // --- Tambah tanaman ---

  document.getElementById('add-btn').addEventListener('click', function () {
    addForm.reset();
    addErr.textContent = '';
    dialog.showModal();
    addForm.nama_tanaman.focus();
  });
  document.getElementById('cancel-btn').addEventListener('click', function () { dialog.close(); });

  addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var nama = addForm.nama_tanaman.value.trim();
    var interval = parseInt(addForm.interval_siram.value, 10);
    if (!nama) { addErr.textContent = 'Nama tanaman wajib diisi.'; return; }
    if (!(interval >= 1 && interval <= 60)) { addErr.textContent = 'Interval 1–60 hari.'; return; }

    var plants = load();
    plants.push({
      id_tanaman: uid(),
      nama_tanaman: nama,
      interval_siram: interval,
      timestamp_terakhir_siram: Date.now()
    });
    save(plants);
    dialog.close();
    render();
    maybeAskNotif();
  });

  // --- Notifikasi & Service Worker ---

  var notifBox = document.getElementById('notif-box');

  function maybeAskNotif() {
    var show = 'Notification' in window && Notification.permission === 'default' && load().length > 0;
    notifBox.classList.toggle('hidden', !show);
  }

  document.getElementById('notif-btn').addEventListener('click', function () {
    Notification.requestPermission().then(function () {
      maybeAskNotif();
      registerPeriodicSync();
      askSwToCheck();
      subscribePush();
    });
  });

  // --- Web Push: jadwal disalin ke server agar notifikasi tetap terkirim saat app tertutup ---

  function urlBase64ToUint8Array(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function subscribePush() {
    if (!('PushManager' in window) || !('Notification' in window) || Notification.permission !== 'granted') return;
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (existing) {
        if (existing) return existing;
        return fetch('api/push-key.php')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d.ok) throw new Error('push off');
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(d.publicKey) });
          });
      });
    }).then(syncPush).catch(function () {});
  }

  function syncPush() {
    if (!('PushManager' in window) || !navigator.serviceWorker) return Promise.resolve();
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription();
    }).then(function (sub) {
      if (!sub) return;
      var plants = load().map(function (p) {
        var prod = productFor(p);
        return Object.assign({}, p, { tips: prod ? prod.title + ' – ' + prod.desc : '' });
      });
      return fetch('api/push-sync.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), plants: plants, lead_id: lead.id || 0 })
      });
    }).catch(function () {});
  }

  var syncTimer = null;
  function syncPushSoon() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPush, 800);
  }

  function askSwToCheck() {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'cek' });
    }
  }

  function registerPeriodicSync() {
    // Chrome/Android untuk PWA terpasang: SW dibangunkan berkala tanpa server.
    navigator.serviceWorker.ready.then(function (reg) {
      if (!reg.periodicSync) return;
      return navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (s) {
        if (s.state === 'granted') return reg.periodicSync.register('cek-siram', { minInterval: 6 * 60 * 60 * 1000 });
      });
    }).catch(function () {});
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function () {
      registerPeriodicSync();
      return navigator.serviceWorker.ready;
    }).then(function () {
      // Pastikan salinan IndexedDB selalu sama dengan localStorage.
      return kv.set(KEY, load());
    }).then(function () {
      askSwToCheck();
      subscribePush();
    }).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', askSwToCheck);
  }

  // --- Prompt pasang PWA ---

  var installBox = document.getElementById('install-box');
  var installBtn = document.getElementById('install-btn');
  var deferred = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    installBox.classList.remove('hidden');
  });
  installBtn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; installBox.classList.add('hidden'); });
  });
  window.addEventListener('appinstalled', function () { installBox.classList.add('hidden'); });

  // iOS tidak punya beforeinstallprompt: tampilkan petunjuk manual.
  if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
    document.getElementById('install-text').textContent =
      'Ketuk tombol Bagikan lalu "Tambahkan ke Layar Utama" supaya notifikasi bisa jalan.';
    installBtn.classList.add('hidden');
    installBox.classList.remove('hidden');
  }

  // --- Mulai ---

  render();
  maybeAskNotif();

  // Dari klik notifikasi: sorot kartu tanaman yang dimaksud.
  var target = new URLSearchParams(location.search).get('siram');
  if (target) {
    var card = list.querySelector('[data-id="' + CSS.escape(target) + '"]');
    if (card) {
      card.classList.add('flash');
      card.scrollIntoView({ block: 'center' });
    }
    history.replaceState(null, '', 'app.html');
  }

  // Perbarui hitung mundur dan cek jadwal selama aplikasi terbuka.
  setInterval(function () { render(); askSwToCheck(); }, 60 * 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { render(); askSwToCheck(); }
  });
})();
