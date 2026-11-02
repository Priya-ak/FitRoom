CREATE TABLE IF NOT EXISTS fits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  selfie_url TEXT NOT NULL,
  garment_url TEXT NOT NULL,
  garment_name TEXT NOT NULL,
  garment_category TEXT NOT NULL,
  result_url TEXT NOT NULL,
  note TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fits_user_id_idx ON fits(user_id);
