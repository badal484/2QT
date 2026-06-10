-- kitchen_zones: many-to-many join between kitchens and zones
CREATE TABLE IF NOT EXISTS kitchen_zones (
    kitchen_id UUID NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
    zone_id    UUID NOT NULL REFERENCES zones(id)    ON DELETE CASCADE,
    PRIMARY KEY (kitchen_id, zone_id)
);
