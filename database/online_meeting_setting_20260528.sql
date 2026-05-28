USE cua_bookings;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value TEXT NULL,
  updated_by_user_id INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_settings_updated_by
    FOREIGN KEY (updated_by_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO app_settings (setting_key, setting_value, updated_by_user_id)
VALUES ('teams_meeting_link', NULL, NULL)
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);
