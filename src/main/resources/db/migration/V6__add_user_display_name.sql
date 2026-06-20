ALTER TABLE users
ADD COLUMN IF NOT EXISTS display_name VARCHAR(80);

UPDATE users
SET display_name = username
WHERE display_name IS NULL;
