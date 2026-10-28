// Konfigurasi sisi klien. Dipakai oleh halaman (window) dan Service Worker (self).
self.APP_CONFIG = {
  // Isi dengan Pixel ID Meta kamu. Kosongkan untuk mematikan Pixel.
  pixelId: '',

  // Penghitung siram di landing page baru tampil setelah jumlah pengguna mencapai angka ini,
  // supaya tidak terlihat sepi di awal. Isi 0 untuk selalu tampil.
  statsMinPengguna: 10,

  // Produk afiliasi yang disisipkan di kartu tanaman dan notifikasi.
  // Ganti url dengan link afiliasi kamu (Shopee, Tokopedia, dll).
  products: [
    {
      id: 'peace-lily',
      title: 'Peace Lily (Spathiphyllum)',
      desc: 'Tanaman hias tahan teduh & gampang dirawat, cocok buat pemula.',
      url: 'https://s.shopee.co.id/6VOzHjX2s0',
      cta: 'Cek Harga'
    },
    {
      id: 'media-tanam',
      title: 'Media Tanam Organik Siap Pakai',
      desc: 'Tanah gembur & subur, tinggal tuang ke pot. Air siraman nggak menggenang.',
      url: 'https://s.shopee.co.id/BUvkDeS0Z',
      cta: 'Cek Harga'
    },
    {
      id: 'paket-media-air',
      title: 'Paket Tanaman Hias Media Air',
      desc: 'Lengkap dengan vas kaca & batu hias. Cukup ganti airnya seminggu sekali.',
      url: 'https://s.shopee.co.id/4qGlIqYXCB',
      cta: 'Lihat Produk'
    },
    {
      id: 'bugenvil-5-warna',
      title: 'Bugenvil 5 Warna Siap Berbunga',
      desc: 'Satu pohon 5 warna bunga, tahan panas & cocok buat teras.',
      url: 'https://s.shopee.co.id/2LZQKIC2eL',
      cta: 'Cek Harga'
    },
    {
      id: 'pot-vertikultur',
      title: 'Pot Vertikultur 50cm 12 Lubang',
      desc: 'Tanam 12 tanaman di satu tiang, hemat tempat buat lahan sempit.',
      url: 'https://s.shopee.co.id/60Sih4JcLF',
      cta: 'Lihat Produk'
    },
    {
      id: 'kemuning-melati',
      title: 'Bunga Kemuning Melati Super Wangi',
      desc: 'Bunga putih kecil yang harum, wanginya kerasa sampai dalam rumah.',
      url: 'https://s.shopee.co.id/60Sih7nLD4',
      cta: 'Cek Harga'
    }
  ]
};

// Produk afiliasi untuk satu tanaman hari ini. Bergilir tiap tengah malam (jam HP), jadi semua
// produk sempat tampil; kartu dan notifikasi di hari yang sama tetap menampilkan produk yang sama.
self.productFor = function (plant, now) {
  var list = self.APP_CONFIG.products;
  if (!list.length) return null;
  var id = plant.id_tanaman, h = 0;
  for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  var d = new Date(now || Date.now());
  var hari = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  return list[(h + hari) % list.length];
};
