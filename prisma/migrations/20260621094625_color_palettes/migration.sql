-- Add palettes column
ALTER TABLE "brand_kits" ADD COLUMN "palettes" JSONB NOT NULL DEFAULT '[]';

-- Migrate existing flat colors into a default palette
UPDATE "brand_kits"
SET "palettes" = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', 'Meine Farben',
    'colors', to_json(colors)::jsonb
  )
)
WHERE array_length(colors, 1) > 0;

-- Drop old column
ALTER TABLE "brand_kits" DROP COLUMN "colors";
