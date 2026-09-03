// ============================================================
// MAP & COMPETITOR DATA ENGINE
// Gets village coordinates from Nominatim and nearby shops
// through the local server API.
//
// IMPROVED: the engine used to ask the server for every single
// "shop=*" node inside the radius and mark ALL of them on the
// map as "competitors" -- a mobile-phone shop, a jewellery
// store, a hairdresser, etc. would all get flagged even if the
// user only cares about (say) opening a bakery. That produced
// a map full of markers that were never real competition.
//
// Now the engine looks at the skills the user selected, works
// out which real-world business categories those skills point
// to (see SKILL_TAGS below), and only asks the server for shops
// that match those categories. Everyone still gets the "general
// store" category by default, since a grocery/general store is
// a realistic option for any profile.
// ============================================================

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const COMPETITION_API_URL = "/api/competition";
const AI_COMPETITION_API_URL = "/api/ai-competitors";
const SEARCH_RADIUS = 5000;

// Tags that are always considered relevant, regardless of the
// user's skills, because a general/grocery store is a realistic
// option for almost any profile.
const DEFAULT_TAGS = [
    { key: "shop", value: "grocery" },
    { key: "shop", value: "supermarket" },
    { key: "shop", value: "convenience" },
    { key: "shop", value: "greengrocer" }
];

// Skill -> real-world OSM tags for the kind of business that
// skill points to, built from the single shared skills list in
// skills-config.js (loaded on the page before this file) so the
// skill list only has to be maintained in one place. Falls back
// to an empty mapping if skills-config.js wasn't loaded on this
// page -- getRelevantTags() still works, it just won't add any
// skill-specific tags beyond DEFAULT_TAGS.
function buildSkillTags(skills) {
    const map = {};
    (skills || []).forEach(skill => {
        if (skill && skill.id) {
            map[skill.id] = Array.isArray(skill.osmTags) ? skill.osmTags : [];
        }
    });
    return map;
}

const SKILL_TAGS = buildSkillTags(
    typeof window !== "undefined" ? window.SKILLS : undefined
);

// Work out which OSM tags are relevant given the skills the
// user selected. Always includes DEFAULT_TAGS.
function getRelevantTags(skills) {
    const tagMap = new Map();

    DEFAULT_TAGS.forEach(tag => tagMap.set(tag.key + "|" + tag.value, tag));

    (skills || []).forEach(skill => {
        const normalized = String(skill).toLowerCase().trim();
        const tags = SKILL_TAGS[normalized];
        if (tags) {
            tags.forEach(tag => tagMap.set(tag.key + "|" + tag.value, tag));
        }
    });

    return Array.from(tagMap.values());
}

async function geocodeVillage(village, locationDetails = {}) {
    if (!village || !village.trim()) {
        throw new Error("Village name is required.");
    }

    // Combine the village/area with district, state and country
    // (when provided) so Nominatim can disambiguate places that
    // share the same name in different parts of the country.
    const queryParts = [
        village.trim(),
        locationDetails.district,
        locationDetails.state,
        locationDetails.country
    ].filter(part => part && String(part).trim());

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set("q", queryParts.join(", "));
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        throw new Error(`Nominatim request failed: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`Location not found: ${queryParts.join(", ")}`);
    }

    return {
        latitude: Number(data[0].lat),
        longitude: Number(data[0].lon),
        displayName: data[0].display_name || village
    };
}

async function getNearbyShops(latitude, longitude, tags) {
    const url = new URL(COMPETITION_API_URL, window.location.origin);
    url.searchParams.set("lat", latitude);
    url.searchParams.set("lon", longitude);
    url.searchParams.set("radius", SEARCH_RADIUS);

    if (Array.isArray(tags) && tags.length > 0) {
        url.searchParams.set(
            "tags",
            tags.map(tag => `${tag.key}=${tag.value}`).join(",")
        );
    }

    const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" }
    });

    if (!response.ok) {
        let message = `Competition API failed: HTTP ${response.status}`;
        try {
            const error = await response.json();
            if (error.error) message = error.error;
        } catch (_) { }
        throw new Error(message);
    }

    const data = await response.json();

    if (!Array.isArray(data.shops)) {
        throw new Error("Competition API returned invalid shop data.");
    }

    return data.shops;
}

// Asks the server's Gemini-backed endpoint for real local
// businesses that OpenStreetMap may be missing. This is
// best-effort and optional: if the server has no Gemini key
// configured, or the request fails, this simply returns an
// empty list and the rest of the app carries on using
// OpenStreetMap data only.
async function getAiShops(latitude, longitude, radius, tags, place) {
    try {
        const url = new URL(AI_COMPETITION_API_URL, window.location.origin);
        url.searchParams.set("lat", latitude);
        url.searchParams.set("lon", longitude);
        url.searchParams.set("radius", radius);
        url.searchParams.set("place", place || "");

        if (Array.isArray(tags) && tags.length > 0) {
            url.searchParams.set(
                "tags",
                tags.map(tag => `${tag.key}=${tag.value}`).join(",")
            );
        }

        const response = await fetch(url.toString(), {
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            return { enabled: false, shops: [] };
        }

        const data = await response.json();

        return {
            enabled: Boolean(data.enabled),
            shops: Array.isArray(data.shops) ? data.shops : [],
            error: data.error || null
        };
    } catch (error) {
        console.log("AI-assisted competitor search unavailable:", error.message);
        return { enabled: false, shops: [] };
    }
}

// Rough distance in meters between two lat/lon points, used
// only to decide whether an AI-suggested business is likely the
// same one as a shop OpenStreetMap already returned.
function distanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = deg => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(a));
}

// Combines the OSM shop list with the AI-suggested shop list,
// dropping AI entries that are almost certainly the same
// business as one OSM already found (same-ish name, within
// ~150m).
function mergeShopSources(osmShops, aiShops) {
    const merged = [...osmShops];

    aiShops.forEach(aiShop => {
        const aiName = String(aiShop.name || "").toLowerCase();

        const isDuplicate = osmShops.some(osmShop => {
            const osmName = String(osmShop.name || "").toLowerCase();
            const namesOverlap =
                aiName && osmName &&
                (aiName.includes(osmName) || osmName.includes(aiName));

            const isClose =
                Number.isFinite(osmShop.latitude) &&
                Number.isFinite(osmShop.longitude) &&
                distanceMeters(
                    aiShop.latitude, aiShop.longitude,
                    osmShop.latitude, osmShop.longitude
                ) < 150;

            return namesOverlap && isClose;
        });

        if (!isDuplicate) merged.push(aiShop);
    });

    return merged;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function drawCompetitorMap(mapDivId, latitude, longitude, shops) {
    if (typeof L === "undefined") {
        throw new Error("Leaflet is not loaded.");
    }

    const mapElement = document.getElementById(mapDivId);
    if (!mapElement) {
        throw new Error(`Map element '${mapDivId}' was not found.`);
    }

    if (mapElement._leaflet_id) {
        mapElement._leaflet_map?.remove?.();
    }

    const map = L.map(mapDivId).setView([latitude, longitude], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup("<b>Selected location</b>")
        .openPopup();

    L.circle([latitude, longitude], {
        radius: SEARCH_RADIUS
    }).addTo(map);

    // The shops array coming into this function has already been
    // filtered server-side to relevant business categories, so
    // every marker drawn here is a genuine, relevant competitor.
    //
    // Shops found through OpenStreetMap (source: "osm") are drawn
    // as solid blue markers. Shops found through the optional
    // Gemini-assisted search (source: "ai") are drawn as dashed
    // orange markers and clearly labelled "AI suggested,
    // unverified" in the popup, since Gemini can be wrong or
    // out of date and these have not been confirmed on OSM.
    shops.forEach((shop) => {
        if (!Number.isFinite(shop.latitude) || !Number.isFinite(shop.longitude)) {
            return;
        }

        const isAiSourced = shop.source === "ai";

        L.circleMarker([shop.latitude, shop.longitude], {
            radius: 6,
            color: isAiSourced ? "#f97316" : "#2563eb",
            fillColor: isAiSourced ? "#f97316" : "#2563eb",
            fillOpacity: isAiSourced ? 0.5 : 0.8,
            dashArray: isAiSourced ? "4, 3" : null
        })
            .addTo(map)
            .bindPopup(
                `<b>${escapeHtml(shop.name || "Unnamed shop")}</b><br>` +
                `${escapeHtml(shop.shop || shop.type || "shop")}` +
                (isAiSourced
                    ? `<br><em>AI suggested &mdash; not on OpenStreetMap, please verify in person</em>`
                    : "")
            );
    });

    mapElement._leaflet_map = map;
    return map;
}

async function competitionFinder(village, options = {}) {
    // Backward-compatible: competitionFinder(village, "mapDivId")
    // used to be a valid call. Keep supporting that shape.
    if (typeof options === "string") {
        options = { mapDivId: options };
    }

    const {
        skills = [],
        mapDivId = null,
        district = "",
        state = "",
        country = ""
    } = options;

    const location = await geocodeVillage(village, { district, state, country });

    const relevantTags = getRelevantTags(skills);
    const osmShops = await getNearbyShops(
        location.latitude,
        location.longitude,
        relevantTags
    );

    // AI-assisted lookup is optional and best-effort -- if the
    // server has no Gemini key configured, or the call fails for
    // any reason, aiResult.shops is just an empty array and the
    // app behaves exactly as it did with OpenStreetMap alone.
    const aiResult = await getAiShops(
        location.latitude,
        location.longitude,
        SEARCH_RADIUS,
        relevantTags,
        location.displayName || village
    );

    const shops = mergeShopSources(osmShops, aiResult.shops);

    let map = null;
    if (mapDivId) {
        map = drawCompetitorMap(
            mapDivId,
            location.latitude,
            location.longitude,
            shops
        );
    }

    return {
        village: village.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        displayName: location.displayName,
        shops,
        competitorCount: shops.length,
        osmCompetitorCount: osmShops.length,
        aiCompetitorCount: shops.length - osmShops.length,
        aiEnabled: aiResult.enabled,
        aiError: aiResult.error || null,
        radiusMeters: SEARCH_RADIUS,
        map
    };
}

window.competitionFinder = competitionFinder;
window.getCompetitionData = competitionFinder;
window.drawCompetitorMap = drawCompetitorMap;
window.getRelevantTags = getRelevantTags;