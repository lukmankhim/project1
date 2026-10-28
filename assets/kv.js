// Key-value kecil di atas IndexedDB. Service Worker tidak bisa membaca
// localStorage, jadi data tanaman dicerminkan ke sini agar SW bisa mengecek jadwal.
self.kv = (function () {
  var DB = 'plantcare', STORE = 'kv';

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function run(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var req = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { db.close(); resolve(req.result); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  }

  return {
    get: function (key) { return run('readonly', function (s) { return s.get(key); }); },
    set: function (key, val) { return run('readwrite', function (s) { return s.put(val, key); }); }
  };
})();
