// Meta Pixel sisi klien. Setiap event memakai event_id yang sama dengan
// kiriman CAPI di PHP agar Meta bisa menghapus duplikatnya.
(function () {
  var id = self.APP_CONFIG && self.APP_CONFIG.pixelId;

  if (id) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', id);
    fbq('track', 'PageView');
  }

  function cookie(name) {
    var m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }

  window.Track = {
    newEventId: function (prefix) {
      return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    },
    // Data browser yang dibutuhkan CAPI untuk mencocokkan pengguna.
    browserIds: function () {
      return { fbp: cookie('_fbp'), fbc: cookie('_fbc'), page_url: location.href };
    },
    standard: function (name, params, eventId) {
      if (window.fbq) fbq('track', name, params || {}, { eventID: eventId });
    },
    custom: function (name, params, eventId) {
      if (window.fbq) fbq('trackCustom', name, params || {}, { eventID: eventId });
    }
  };
})();
