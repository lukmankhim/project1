-- Tabel prospek. Data tanaman tidak disimpan di server (ada di localStorage pengguna).
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
