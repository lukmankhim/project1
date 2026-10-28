(function () {
  var DAY = 24 * 60 * 60 * 1000;
  var KEY = 'tanaman';
  var list = document.getElementById('list');
  var empty = document.getElementById('empty');
  var tpl = document.getElementById('card-tpl');
  var dialog = document.getElementById('add-dialog');
  var addForm = document.getElementById('add-form');
  var addErr = document.getElementById('add-err');

  var lead = readJSON('lead', null);
  if (!lead) { location.replace('index.html'); return; }
  document.getElementById('sapaan').textContent = 'Hai, ' + lead.nama.split(' ')[0];

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }

  // --- Data tanaman (localStorage, dicerminkan ke IndexedDB untuk SW) ---

  function load() { return readJSON(KEY, []); }

  function save(plants) {
    localStorage.setItem(KEY, JSON.stringify(plants));
    kv.set(KEY, plants).then(askSwToCheck).catch(function () {});
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
    } else if (e.target.closest('.del')) {
      var plant = load().filter(function (p) { return p.id_tanaman === id; })[0];
      if (plant && confirm('Hapus "' + plant.nama_tanaman + '"?')) {
        save(load().filter(function (p) { return p.id_tanaman !== id; }));
        render();
      }
    } else if (e.target.closest('.p-link')) {
      trackAffiliate(e.target.closest('.p-link').dataset.product, 'kartu');
    }
  });

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
    });
  });

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
    navigator.serviceWorker.register('sw.js').then(function () {
      registerPeriodicSync();
      return navigator.serviceWorker.ready;
    }).then(function () {
      // Pastikan salinan IndexedDB selalu sama dengan localStorage.
      return kv.set(KEY, load());
    }).then(askSwToCheck).catch(function () {});
    navigator.serviceWorker.addEventListener('controllerchange', askSwToCheck);
  }

  // --- Prompt pasang PWA ---

  var installBox = document.getElementById('install-box');
  var installBtn = document.getElementById('install-btn');
  var deferred = null;
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

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
