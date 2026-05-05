-- Persisted store for short-lived LINE notification tracking tokens.
-- Replaces the in-memory globalThis.lineTokenStore Map (lost on server restart).

CREATE TABLE IF NOT EXISTS line_tracking_tokens (
  token       VARCHAR(64)  NOT NULL PRIMARY KEY,
  report_id   INT          NOT NULL,
  expires_at  TIMESTAMP    NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_line_tracking_expires (expires_at),
  INDEX idx_line_tracking_report  (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
