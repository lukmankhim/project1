// Data lead dibawa lewat hash URL (#l=...) saat pengguna pindah browser
// (misal dari browser bawaan Instagram ke Safari/Chrome). Hash tidak dikirim ke server.
self.LeadLink = {
  encode: function (lead) {
    return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(lead)))));
  },
  decode: function (s) {
    try { return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(s))))); } catch (e) { return null; }
  },
  // Simpan lead dari hash URL ke localStorage bila ada. Mengembalikan lead aktif.
  restore: function () {
    var m = location.hash.match(/[#&]l=([^&]+)/);
    var lead = m && this.decode(m[1]);
    try {
      if (lead && lead.nama) localStorage.setItem('lead', JSON.stringify(lead));
      return JSON.parse(localStorage.getItem('lead')) || lead || null;
    } catch (e) {
      return lead || null;
    }
  }
};
