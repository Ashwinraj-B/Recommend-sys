// ============================================================
// SKILLS CONFIG
//
// Single source of truth for the "Your Skills" checkboxes.
//
// Previously the skill list was hardcoded in three separate
// places (the checkboxes in index.html, SKILL_TAGS in
// competition_finder.js, and the "skills" arrays inside
// recommendation-engine.js's business database) which meant
// adding a new skill meant editing HTML and JS by hand and
// easy to get out of sync.
//
// Now the checkboxes on index.html and the OSM tag lookup in
// competition_finder.js are both generated from this one array.
// To add a new skill, add one entry below -- nothing else needs
// to change for it to show up as a checkbox and (if you give it
// osmTags) be used in the competitor map search.
//
// Each entry:
//   id      - the value stored/sent for this skill (lowercase,
//             matches what recommendation-engine.js's business
//             database expects in each business's "skills" array)
//   label   - text shown next to the checkbox
//   osmTags - OpenStreetMap shop/amenity/craft/office tags that
//             a business needing this skill would show up under
//             on the competitor map. Leave as [] for general
//             skills (like "marketing" or "management") that
//             apply to many kinds of business rather than one
//             specific storefront category -- mapping those to
//             tags would just bring back "every shop" results.
//
// NOTE: adding a skill here only makes it selectable and (where
// relevant) affects the competitor map search. To have that
// skill actually influence which business gets recommended, it
// also needs to be added to the relevant "skills" array(s) in
// recommendation-engine.js's business database, or added as a
// new business entry there.
// ============================================================

const SKILLS = [
    {
        id: "animal care",
        label: "Animal Care",
        osmTags: [
            { key: "shop", value: "dairy" },
            { key: "shop", value: "farm" },
            { key: "craft", value: "dairy" }
        ]
    },
    {
        id: "cooking",
        label: "Cooking",
        osmTags: [
            { key: "shop", value: "bakery" },
            { key: "shop", value: "confectionery" },
            { key: "shop", value: "pastry" },
            { key: "shop", value: "ice_cream" },
            { key: "amenity", value: "ice_cream" },
            { key: "amenity", value: "restaurant" },
            { key: "amenity", value: "fast_food" },
            { key: "amenity", value: "cafe" }
        ]
    },
    {
        id: "tailoring",
        label: "Tailoring",
        osmTags: [
            { key: "shop", value: "tailor" },
            { key: "shop", value: "clothes" },
            { key: "shop", value: "fabric" }
        ]
    },
    {
        id: "technology",
        label: "Technology",
        osmTags: [
            { key: "shop", value: "computer" },
            { key: "shop", value: "mobile_phone" },
            { key: "shop", value: "electronics" },
            { key: "office", value: "it" }
        ]
    },
    {
        id: "marketing",
        label: "Marketing",
        osmTags: []
    },
    {
        id: "management",
        label: "Management",
        osmTags: []
    },
    {
        id: "farming",
        label: "Farming",
        osmTags: [
            { key: "shop", value: "dairy" },
            { key: "shop", value: "farm" },
            { key: "craft", value: "dairy" }
        ]
    },
    {
        id: "repair",
        label: "Repair",
        osmTags: [
            { key: "shop", value: "car_repair" },
            { key: "shop", value: "bicycle" },
            { key: "shop", value: "electronics_repair" },
            { key: "craft", value: "electronics_repair" }
        ]
    }
];

if (typeof window !== "undefined") {
    window.SKILLS = SKILLS;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SKILLS };
}