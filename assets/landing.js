(function () {
  var form = document.getElementById('lead-form');
  var kontak = document.getElementById('kontak');
  var label = document.getElementById('kontak-label');
  var err = document.getElementById('err');
  var submit = document.getElementById('submit');

  form.addEventListener('change', function (e) {
    if (e.target.name !== 'tipe') return;
    var isWa = e.target.value === 'wa';
    label.textContent = isWa ? 'Nomor WhatsApp' : 'Alamat Email';
    kontak.type = isWa ? 'tel' : 'email';
    kontak.inputMode = isWa ? 'tel' : 'email';
    kontak.autocomplete = isWa ? 'tel' : 'email';
    kontak.placeholder = isWa ? '08xxxxxxxxxx' : 'nama@email.com';
    kontak.value = '';
  });

  function validate(nama, tipe, value) {
    if (nama.length < 2) return 'Nama minimal 2 huruf.';
    if (tipe === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Format email belum benar.';
    } else {
      var digits = value.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) return 'Nomor WhatsApp belum benar.';
    }
    return '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var nama = form.nama.value.trim();
    var tipe = form.tipe.value;
    var value = kontak.value.trim();

    var msg = validate(nama, tipe, value);
    err.textContent = msg;
    if (msg) return;

    var params = new URLSearchParams(location.search);
    var eventId = Track.newEventId('lead');
    var ids = Track.browserIds();

    submit.disabled = true;
    submit.textContent = 'Menyimpan...';

    fetch('api/lead.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama: nama,
        kontak: value,
        tipe: tipe,
        website: form.website.value,
        source_campaign: params.get('utm_campaign') || params.get('campaign') || '',
        event_id: eventId,
        fbp: ids.fbp,
        fbc: ids.fbc,
        fbclid: params.get('fbclid') || '',
        page_url: ids.page_url
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.ok) throw new Error(data.error || 'Gagal menyimpan, coba lagi.');
        });
      })
      .then(function () {
        Track.standard('Lead', {}, eventId);
        try {
          localStorage.setItem('lead', JSON.stringify({ nama: nama, kontak: value, tipe: tipe }));
        } catch (e) {}
        // Beri waktu Pixel mengirim event sebelum pindah halaman.
        setTimeout(function () { location.href = 'app.html?baru=1'; }, 400);
      })
      .catch(function (e) {
        err.textContent = e.message || 'Koneksi bermasalah, coba lagi.';
        submit.disabled = false;
        submit.textContent = 'Buat Jadwal Siram Saya';
      });
  });
})();
