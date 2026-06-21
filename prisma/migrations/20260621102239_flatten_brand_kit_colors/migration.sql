-- Flatten palettes (nested [{id, name, colors[]}]) into a top-level colors TEXT[].
-- A brand kit IS a colour palette — no nested structure needed.

ALTER TABLE "brand_kits" ADD COLUMN "colors" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing data: extract all hex values from all palettes into the flat colors array.
UPDATE "brand_kits"
SET "colors" = ARRAY(
  SELECT DISTINCT jsonb_array_elements_text(palette -> 'colors')
  FROM jsonb_array_elements("palettes") AS palette
  WHERE palette ? 'colors' AND jsonb_array_length(palette -> 'colors') > 0
)
WHERE jsonb_array_length("palettes") > 0;

ALTER TABLE "brand_kits" DROP COLUMN "palettes";
