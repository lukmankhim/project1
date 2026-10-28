// Penghitung siram "live" di landing page: ambil angka dari server tiap 15 detik.
(function () {
  var box = document.getElementById('stats');
  var elSiram = document.getElementById('st-siram');
  var elPengguna = document.getElementById('st-pengguna');
  if (!box) return;

  var min = (window.APP_CONFIG && APP_CONFIG.statsMinPengguna) || 0;
  var fmt = new Intl.NumberFormat('id-ID');

  function animate(el, to) {
    var from = parseInt(el.dataset.n || '0', 10);
    el.dataset.n = to;
    if (from === to) return;
    var start = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - start) / 800);
      el.textContent = fmt.format(Math.round(from + (to - from) * t));
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  function refresh() {
    if (document.hidden) return;
    fetch('api/stats.php')
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (!d.ok || d.total_pengguna < min) return;
        box.classList.remove('hidden');
        animate(elSiram, d.total_siram);
        animate(elPengguna, d.total_pengguna);
      })
      .catch(function () {});
  }

  refresh();
  setInterval(refresh, 15000);
  document.addEventListener('visibilitychange', refresh);
})();
