(function () {
  var ua = navigator.userAgent;
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /android/i.test(ua);
  var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|musical_ly|TikTok|BytedanceWebview/i.test(ua);

  var lead = LeadLink.restore();
  if (standalone) { location.replace('app.html'); return; }
  if (!lead) { location.replace('index.html'); return; }

  // Link yang membawa data lead, untuk dibuka di browser lain.
  var carryUrl = location.origin + location.pathname + '#l=' + LeadLink.encode(lead);

  function show(mode) {
    document.querySelectorAll('[data-mode]').forEach(function (el) {
      el.classList.toggle('hidden', el.dataset.mode !== mode);
    });
  }

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});

  if (inApp && isAndroid) {
    var u = new URL(carryUrl);
    document.getElementById('open-chrome').href =
      'intent://' + u.host + u.pathname + u.hash + '#Intent;scheme=https;package=com.android.chrome;end';
    show('inapp-android');
  } else if (inApp && isIOS) {
    show('inapp-ios');
  } else if (isIOS) {
    show('ios');
  } else {
    show('manual');
  }

  document.querySelectorAll('.copy-link').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var done = function () { btn.textContent = 'Link tersalin ✓'; };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(carryUrl).then(done, function () { prompt('Salin link ini:', carryUrl); });
      } else {
        prompt('Salin link ini:', carryUrl);
      }
    });
  });

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (!inApp) show('prompt');
  });

  document.getElementById('install-btn').addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function (r) {
      if (r.outcome === 'accepted') show('installed');
      deferred = null;
    });
  });

  window.addEventListener('appinstalled', function () { show('installed'); });
})();
