// Konfigurasi sisi klien. Dipakai oleh halaman (window) dan Service Worker (self).
self.APP_CONFIG = {
  // Isi dengan Pixel ID Meta kamu. Kosongkan untuk mematikan Pixel.
  pixelId: '',

  // Produk afiliasi yang disisipkan di kartu tanaman dan notifikasi.
  // Ganti url dengan link afiliasi kamu (Shopee, Tokopedia, dll).
  products: [
    {
      id: 'cangkul-mini',
      title: 'Set Cangkul Mini 3-in-1',
      desc: 'Gemburkan tanah pot biar akar gampang nyerap air.',
      url: 'https://example.com/afiliasi/cangkul-mini',
      cta: 'Cek Harga'
    },
    {
      id: 'pupuk-cair',
      title: 'Pupuk Cair Organik 500ml',
      desc: 'Campur ke air siraman 2 minggu sekali, daun lebih hijau.',
      url: 'https://example.com/afiliasi/pupuk-cair',
      cta: 'Lihat Produk'
    },
    {
      id: 'semprotan',
      title: 'Botol Semprot Embun 1L',
      desc: 'Pas buat tanaman yang suka lembap seperti pakis & monstera.',
      url: 'https://example.com/afiliasi/semprotan',
      cta: 'Beli Sekarang'
    }
  ]
};

// Produk afiliasi untuk satu tanaman. Dipakai kartu dan notifikasi agar selalu sama.
self.productFor = function (plant) {
  var list = self.APP_CONFIG.products;
  if (!list.length) return null;
  var id = plant.id_tanaman, h = 0;
  for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return list[h % list.length];
};
