-- Tabel prospek dari landing page.
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama            VARCHAR(100) NOT NULL,
  whatsapp_email  VARCHAR(191) NOT NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_campaign VARCHAR(191) NULL,
  PRIMARY KEY (id),
  KEY idx_created_at (created_at),
  KEY idx_source_campaign (source_campaign)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alamat Web Push tiap perangkat yang mengizinkan notifikasi.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NULL,
  endpoint      VARCHAR(1000) NOT NULL,
  endpoint_hash CHAR(64)     NOT NULL,
  p256dh        VARCHAR(255) NOT NULL,
  auth          VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_endpoint_hash (endpoint_hash),
  KEY idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Salinan jadwal siram, hanya untuk perangkat yang berlangganan push.
-- Sumber data utama tetap localStorage di HP pengguna; tabel ini ditimpa setiap sinkronisasi.
CREATE TABLE IF NOT EXISTS plant_schedules (
  subscription_id          INT UNSIGNED      NOT NULL,
  id_tanaman               VARCHAR(40)       NOT NULL,
  nama_tanaman             VARCHAR(60)       NOT NULL,
  interval_siram           SMALLINT UNSIGNED NOT NULL,
  timestamp_terakhir_siram BIGINT UNSIGNED   NOT NULL,
  due_ms                   BIGINT UNSIGNED   NOT NULL,
  tips                     VARCHAR(200)      NULL,
  notified_for             BIGINT UNSIGNED   NULL,
  PRIMARY KEY (subscription_id, id_tanaman),
  KEY idx_due_ms (due_ms),
  CONSTRAINT fk_schedule_subscription FOREIGN KEY (subscription_id)
    REFERENCES push_subscriptions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Satu baris setiap tombol "Sudah Disiram" ditekan. Dipakai untuk penghitung di landing page.
CREATE TABLE IF NOT EXISTS siram_events (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_hash CHAR(64)        NOT NULL,
  id_tanaman  VARCHAR(40)     NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_device_tanaman (device_hash, id_tanaman, created_at),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
