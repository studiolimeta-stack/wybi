-- Product visuals are intentionally stored as ordered upload paths rather than
-- a separate table: a test has at most five images and they are only read with
-- the test itself. Keep image_url as the first-image compatibility field for
-- existing links and reports.
ALTER TABLE tests
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE tests
SET image_urls = jsonb_build_array(image_url)
WHERE image_urls = '[]'::jsonb
  AND image_url IS NOT NULL
  AND image_url <> '';
