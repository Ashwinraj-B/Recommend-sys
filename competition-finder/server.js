const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const config = require("../config.js");

const PORT = 8000;
const ROOT_DIR = path.resolve(__dirname, "..");

const OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
];

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

const GEMINI_API_KEY = String(config.GEMINI_API_KEY || "").trim();

const GEMINI_ENABLED =
    Boolean(GEMINI_API_KEY) &&
    GEMINI_API_KEY !== "PASTE_YOUR_GEMINI_API_KEY_HERE";

let GEMINI_MODEL = String(config.GEMINI_MODEL || "gemini-2.5-flash").trim();

// Common typo guard: someone edits config.js and accidentally
// leaves off the "-flash"/"-pro" suffix (e.g. "gemini-2.5"
// instead of "gemini-2.5-flash"), which Google's API rejects
// with a confusing 404 "model not found". Auto-correct that one
// specific shape rather than making the person hunt for it.
if (/^gemini-[\d.]+$/.test(GEMINI_MODEL)) {
    const corrected = `${GEMINI_MODEL}-flash`;
    console.log(`Note: GEMINI_MODEL "${GEMINI_MODEL}" in config.js looks incomplete, using "${corrected}" instead.`);
    GEMINI_MODEL = corrected;
}

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
};

function sendJson(res, statusCode, data) {
    const body = JSON.stringify(data);

    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
    });

    res.end(body);
}

function serveFile(res, filePath) {
    if (!fs.existsSync(filePath)) {
        sendJson(res, 404, {
            error: "File not found"
        });
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
        MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
        "Content-Type": contentType
    });

    fs.createReadStream(filePath).pipe(res);
}

function safeFilePath(urlPath) {
    if (
        urlPath === "/" ||
        urlPath === "/index.html"
    ) {
        return path.join(
            ROOT_DIR,
            "chandru-business-recommendation-engine",
            "index.html"
        );
    }

    if (urlPath === "/results.html") {
        return path.join(
            ROOT_DIR,
            "chandru-business-recommendation-engine",
            "results.html"
        );
    }

    const cleanPath = decodeURIComponent(urlPath)
        .replace(/^\/+/, "");

    const requestedPath = path.resolve(
        ROOT_DIR,
        cleanPath
    );

    if (
        requestedPath !== ROOT_DIR &&
        !requestedPath.startsWith(ROOT_DIR + path.sep)
    ) {
        return null;
    }

    return requestedPath;
}

function overpassRequest(
    overpassUrl,
    query
) {
    return new Promise((resolve, reject) => {
        const url = new URL(overpassUrl);

        const postData =
            "data=" + encodeURIComponent(query);

        const request = https.request(
            {
                hostname: url.hostname,
                path: url.pathname,
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",

                    "Content-Length":
                        Buffer.byteLength(postData),

                    "User-Agent":
                        "BusinessRecommendationEngine/1.0"
                },

                timeout: 45000
            },

            response => {
                let data = "";

                response.on(
                    "data",
                    chunk => {
                        data += chunk;
                    }
                );

                response.on(
                    "end",
                    () => {
                        if (
                            response.statusCode < 200 ||
                            response.statusCode >= 300
                        ) {
                            reject(
                                new Error(
                                    `Overpass returned HTTP ${response.statusCode}`
                                )
                            );

                            return;
                        }

                        try {
                            resolve(
                                JSON.parse(data)
                            );
                        } catch {
                            reject(
                                new Error(
                                    "Invalid JSON received from Overpass"
                                )
                            );
                        }
                    }
                );
            }
        );

        request.on(
            "timeout",
            () => {
                request.destroy(
                    new Error(
                        "Overpass request timed out"
                    )
                );
            }
        );

        request.on(
            "error",
            reject
        );

        request.write(postData);
        request.end();
    });
}

async function queryOverpass(query) {
    let lastError = null;

    for (
        const server of OVERPASS_SERVERS
    ) {
        try {
            console.log(
                `Trying Overpass: ${server}`
            );

            const result =
                await overpassRequest(
                    server,
                    query
                );

            console.log(
                `Overpass success: ${server}`
            );

            return result;
        } catch (error) {
            lastError = error;

            console.log(
                `Overpass failed: ${server}`
            );

            console.log(
                `Reason: ${error.message}`
            );
        }
    }

    throw lastError ||
    new Error(
        "All Overpass servers failed"
    );
}

// Only letters, digits and underscores are valid in the OSM tag
// values we build queries from (e.g. "car_repair", "fast_food").
// Anything else is stripped out before it goes anywhere near the
// Overpass query string.
function sanitizeTagValue(value) {
    return String(value || "").replace(/[^a-zA-Z0-9_]/g, "");
}

// Parses a "tags" query param shaped like:
//   "shop=bakery,shop=confectionery,amenity=cafe"
// into a map of key -> [values], e.g.:
//   { shop: ["bakery", "confectionery"], amenity: ["cafe"] }
function parseTagsParam(rawTags) {
    const grouped = {};

    String(rawTags || "")
        .split(",")
        .map(pair => pair.trim())
        .filter(Boolean)
        .forEach(pair => {
            const [rawKey, rawValue] = pair.split("=");
            const key = sanitizeTagValue(rawKey);
            const value = sanitizeTagValue(rawValue);

            if (!key || !value) return;

            if (!grouped[key]) grouped[key] = [];
            if (!grouped[key].includes(value)) grouped[key].push(value);
        });

    return grouped;
}

// Builds an Overpass query that only matches the requested
// key/value combinations, e.g. only bakeries + cafes instead of
// every single shop=* node. Falls back to the old "every shop"
// query when no valid tags are supplied, so the endpoint still
// works if it's ever called without a category filter.
function buildOverpassQuery(latitude, longitude, radius, groupedTags) {
    const keys = Object.keys(groupedTags);

    if (keys.length === 0) {
        return `
[out:json][timeout:40];

node["shop"]
(
    around:${radius},
    ${latitude},
    ${longitude}
);

out;
`;
    }

    const clauses = keys
        .map(key => {
            const values = groupedTags[key].join("|");
            return `    node["${key}"~"^(${values})$"](around:${radius},${latitude},${longitude});`;
        })
        .join("\n");

    return `
[out:json][timeout:40];

(
${clauses}
);

out;
`;
}

function normalizeShop(element) {
    let latitude = element.lat;
    let longitude = element.lon;

    if (
        latitude === undefined &&
        element.center
    ) {
        latitude =
            element.center.lat;

        longitude =
            element.center.lon;
    }

    const tags =
        element.tags || {};

    // The matched category can come from shop=, amenity=,
    // craft= or office= depending on which tag the Overpass
    // query matched on.
    const category =
        tags.shop ||
        tags.amenity ||
        tags.craft ||
        tags.office ||
        "shop";

    return {
        id:
            `${element.type}/${element.id}`,

        type:
            element.type,

        name:
            tags.name ||
            tags["name:en"] ||
            "Unnamed shop",

        shop:
            category,

        latitude,
        longitude,

        source: "osm"
    };
}

// ============================================================
// GEMINI-POWERED COMPETITOR DISCOVERY
//
// OpenStreetMap is crowdsourced, so plenty of real, well-known
// local shops (especially in smaller towns) are simply never
// added to it and never show up in the Overpass results above.
//
// To fill that gap, we optionally ask Gemini -- which has broad
// general knowledge about places -- to name real businesses of
// the requested categories near the given location. Each name
// Gemini returns is then geocoded through Nominatim to get an
// approximate map position, and returned to the client tagged
// source: "ai" so it can be shown distinctly (and clearly
// labelled "unverified") on the map.
//
// This is best-effort: Gemini can be wrong or out of date, and
// some entries may fail to geocode. Errors here never break the
// normal OpenStreetMap flow -- the client treats this endpoint
// as optional.
// ============================================================

function callGemini(prompt, jsonMode = true) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                ...(jsonMode ? { responseMimeType: "application/json" } : {}),
                temperature: 0.2
            }
        });

        const request = https.request(
            {
                hostname: "generativelanguage.googleapis.com",
                path: `/v1beta/models/${GEMINI_MODEL}:generateContent`,
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Length": Buffer.byteLength(body),
                    "x-goog-api-key": GEMINI_API_KEY
                },
                timeout: 30000
            },
            response => {
                let data = "";
                response.on("data", chunk => { data += chunk; });
                response.on("end", () => {
                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        reject(new Error(`Gemini returned HTTP ${response.statusCode}: ${data.slice(0, 300)}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        reject(new Error("Invalid JSON received from Gemini"));
                    }
                });
            }
        );

        request.on("timeout", () => request.destroy(new Error("Gemini request timed out")));
        request.on("error", reject);
        request.write(body);
        request.end();
    });
}

// Pulls the plain text out of a Gemini generateContent response.
function extractGeminiText(geminiResponse) {
    const parts =
        geminiResponse?.candidates?.[0]?.content?.parts || [];

    return parts.map(part => part.text || "").join("").trim();
}

// Nominatim usage policy asks for max 1 request/second and a
// descriptive User-Agent, so lookups below are done one at a
// time with a small delay rather than in parallel.
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function geocodeWithNominatim(query) {
    return new Promise((resolve, reject) => {
        const url = new URL(NOMINATIM_SEARCH_URL);
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "1");

        const request = https.request(
            {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: "GET",
                headers: {
                    "User-Agent": "BusinessRecommendationEngine/1.0",
                    Accept: "application/json"
                },
                timeout: 15000
            },
            response => {
                let data = "";
                response.on("data", chunk => { data += chunk; });
                response.on("end", () => {
                    if (response.statusCode < 200 || response.statusCode >= 300) {
                        reject(new Error(`Nominatim returned HTTP ${response.statusCode}`));
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            resolve({
                                latitude: Number(parsed[0].lat),
                                longitude: Number(parsed[0].lon)
                            });
                        } else {
                            resolve(null);
                        }
                    } catch {
                        reject(new Error("Invalid JSON received from Nominatim"));
                    }
                });
            }
        );

        request.on("timeout", () => request.destroy(new Error("Nominatim request timed out")));
        request.on("error", reject);
        request.end();
    });
}

// Turns the "shop=bakery,shop=confectionery,amenity=cafe" style
// tags param into a short list of plain-English category words
// for the Gemini prompt, e.g. ["bakery", "confectionery", "cafe"].
function categoriesFromGroupedTags(groupedTags) {
    const values = new Set();
    Object.values(groupedTags).forEach(list => {
        list.forEach(value => values.add(value.replace(/_/g, " ")));
    });
    return Array.from(values);
}

async function findAiCompetitors(req, res, url) {
    if (!GEMINI_ENABLED) {
        sendJson(res, 200, {
            enabled: false,
            shops: [],
            message: "Gemini API key is not configured (see config.js). Skipping AI-assisted search."
        });
        return;
    }

    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lon"));
    const radius = Number(url.searchParams.get("radius") || 5000);
    const place = String(url.searchParams.get("place") || "").trim();
    const groupedTags = parseTagsParam(url.searchParams.get("tags"));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !place) {
        sendJson(res, 400, { error: "Valid lat, lon and place are required" });
        return;
    }

    const categories = categoriesFromGroupedTags(groupedTags);

    if (categories.length === 0) {
        sendJson(res, 200, { enabled: true, shops: [] });
        return;
    }

    const prompt = `You are helping a local entrepreneur research real businesses.
List real, currently operating local businesses of these categories: ${categories.join(", ")}.
They must be located within about ${Math.round(radius / 1000)} km of: "${place}".
Only include businesses you are reasonably confident actually exist. If you don't know of any real ones nearby, return fewer entries or an empty list -- never invent a name.
Respond ONLY with a JSON array (no other text), max 8 items, each item shaped exactly like:
{"name": "Business Name", "category": "one of: ${categories.join(", ")}", "area": "street or neighborhood name if known, else empty string"}`;

    try {
        const geminiResponse = await callGemini(prompt);
        const text = extractGeminiText(geminiResponse);

        let businesses = [];
        try {
            businesses = JSON.parse(text.replace(/^```json\s*|```$/g, ""));
        } catch {
            businesses = [];
        }

        if (!Array.isArray(businesses)) businesses = [];
        businesses = businesses.slice(0, 8);

        console.log(`Gemini suggested ${businesses.length} businesses for categories [${categories.join(", ")}] near "${place}"`);
        if (businesses.length === 0) {
            console.log(`Gemini raw text was: ${text.slice(0, 300)}`);
        }

        const shops = [];

        for (const business of businesses) {
            const name = String(business?.name || "").trim();
            if (!name) continue;

            const queryParts = [name, business?.area, place].filter(Boolean);

            try {
                const coords = await geocodeWithNominatim(queryParts.join(", "));

                if (coords) {
                    shops.push({
                        id: `ai/${shops.length}`,
                        type: "ai",
                        name,
                        shop: String(business?.category || "shop").trim(),
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        source: "ai"
                    });
                }
            } catch (geocodeError) {
                console.log(`AI competitor geocode failed for "${name}": ${geocodeError.message}`);
            }

            // Stay well under Nominatim's 1 request/second limit.
            await sleep(1100);
        }

        console.log(`AI competitor search geocoded ${shops.length} of ${businesses.length} Gemini suggestions successfully`);

        sendJson(res, 200, { enabled: true, shops });
    } catch (error) {
        console.error("Gemini competitor search failed:", error.message);
        sendJson(res, 200, {
            enabled: true,
            shops: [],
            error: `AI-assisted search failed: ${error.message}`
        });
    }
}

// ============================================================
// GEMINI-POWERED PERSONALIZED INSIGHT
//
// Takes the profile + the scored recommendation list the
// existing recommendation-engine.js already produced, and asks
// Gemini for one short, personalized paragraph of practical
// advice. This does not replace the scoring engine -- it just
// adds a plain-language summary on top of it.
// ============================================================

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let data = "";
        req.on("data", chunk => {
            data += chunk;
            if (data.length > 200000) {
                reject(new Error("Request body too large"));
                req.destroy();
            }
        });
        req.on("end", () => resolve(data));
        req.on("error", reject);
    });
}

async function generateAiInsight(req, res) {
    if (!GEMINI_ENABLED) {
        sendJson(res, 200, {
            enabled: false,
            insight: "",
            message: "Gemini API key is not configured (see config.js)."
        });
        return;
    }

    let payload;
    try {
        const raw = await readRequestBody(req);
        payload = JSON.parse(raw || "{}");
    } catch {
        sendJson(res, 400, { error: "Invalid JSON request body" });
        return;
    }

    const { profile = {}, recommendations = [] } = payload;

    const topThree = (Array.isArray(recommendations) ? recommendations : [])
        .slice(0, 3)
        .map(item => `${item.name} (score ${item.score}/100, reasons: ${(item.reasons || []).join("; ")}, threats: ${(item.threats || []).join("; ")})`)
        .join("\n");

    const prompt = `A local entrepreneur has this profile:
Location type: ${profile.locationType || "unknown"}
Village/area: ${profile.village || "unknown"}
Available capital: ${profile.capital || "unknown"}
Skills: ${(profile.skills || []).join(", ") || "none listed"}
Experience: ${profile.experience || "unknown"}
Nearby competitors found on the map: ${profile.competitorCount ?? "unknown"} (note: this count is only as complete as OpenStreetMap/AI search data, real ground competition may be higher)

Top scored business options:
${topThree || "none"}

In 3-4 short sentences of plain, practical advice, help them decide between these options and mention one concrete next step they should take before committing. Do not repeat the scores back verbatim. Respond with plain text only, no markdown, no JSON.`;

    try {
        const geminiResponse = await callGemini(prompt, false);
        const insight = extractGeminiText(geminiResponse);
        sendJson(res, 200, { enabled: true, insight });
    } catch (error) {
        console.error("Gemini insight generation failed:", error.message);
        sendJson(res, 200, {
            enabled: true,
            insight: "",
            error: "AI insight could not be generated right now."
        });
    }
}

async function competitionApi(
    req,
    res,
    url
) {
    const latitude =
        Number(
            url.searchParams.get(
                "lat"
            )
        );

    const longitude =
        Number(
            url.searchParams.get(
                "lon"
            )
        );

    const radius =
        Number(
            url.searchParams.get(
                "radius"
            ) || 5000
        );

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {
        sendJson(
            res,
            400,
            {
                error:
                    "Valid lat and lon are required"
            }
        );

        return;
    }

    if (
        !Number.isFinite(radius) ||
        radius <= 0
    ) {
        sendJson(
            res,
            400,
            {
                error:
                    "Radius must be a positive number"
            }
        );

        return;
    }

    /*
     * Only search for shop/amenity/craft/office nodes that
     * actually match the business categories the client asked
     * for (derived from the user's selected skills), instead of
     * every single shop=* node in the radius. This is what keeps
     * the map from marking places that aren't real competition.
     */

    const groupedTags = parseTagsParam(
        url.searchParams.get("tags")
    );

    const query = buildOverpassQuery(
        latitude,
        longitude,
        radius,
        groupedTags
    );

    try {
        const result =
            await queryOverpass(
                query
            );

        const shops =
            (result.elements || [])
                .map(
                    normalizeShop
                )
                .filter(
                    shop =>
                        Number.isFinite(
                            shop.latitude
                        ) &&
                        Number.isFinite(
                            shop.longitude
                        )
                );

        console.log(
            `Found ${shops.length} shops`
        );

        sendJson(
            res,
            200,
            {
                latitude,
                longitude,
                radiusMeters:
                    radius,

                shops,

                competitorCount:
                    shops.length
            }
        );
    } catch (error) {
        console.error(
            "All Overpass servers failed:",
            error.message
        );

        sendJson(
            res,
            502,
            {
                error:
                    "Could not retrieve nearby shops",

                details:
                    error.message
            }
        );
    }
}

const handler = async (req, res) => {
            try {
                const url =
                    new URL(
                        req.url,
                        `http://${req.headers.host}`
                    );

                if (
                    req.method ===
                    "OPTIONS"
                ) {
                    res.writeHead(
                        204,
                        {
                            "Access-Control-Allow-Origin":
                                "*",

                            "Access-Control-Allow-Methods":
                                "GET, POST, OPTIONS",

                            "Access-Control-Allow-Headers":
                                "Content-Type"
                        }
                    );

                    res.end();

                    return;
                }

                if (
                    url.pathname ===
                    "/api/health"
                ) {
                    sendJson(
                        res,
                        200,
                        {
                            status: "ok"
                        }
                    );

                    return;
                }

                if (
                    url.pathname ===
                    "/api/competition"
                ) {
                    await competitionApi(
                        req,
                        res,
                        url
                    );

                    return;
                }

                if (url.pathname === "/api/ai-competitors") {
                    await findAiCompetitors(req, res, url);
                    return;
                }

                if (url.pathname === "/api/ai-insight" && req.method === "POST") {
                    await generateAiInsight(req, res);
                    return;
                }

                const filePath =
                    safeFilePath(
                        url.pathname
                    );

                if (!filePath) {
                    sendJson(
                        res,
                        403,
                        {
                            error:
                                "Forbidden"
                        }
                    );

                    return;
                }

                serveFile(
                    res,
                    filePath
                );

            } catch (error) {
                console.error(
                    error
                );

                if (
                    !res.headersSent
                ) {
                    sendJson(
                        res,
                        500,
                        {
                            error:
                                "Internal server error"
                        }
                    );
                }
            }
        };

module.exports = handler;

if (require.main === module) {
const server = http.createServer(handler);
server.listen(
    PORT,
    "127.0.0.1",
    () => {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            " Business Recommendation Server"
        );
        console.log(
            "========================================"
        );
        console.log(
            `Server: http://localhost:${PORT}`
        );
        console.log(
            `Home:   http://localhost:${PORT}/`
        );
        console.log(
            `Health: http://localhost:${PORT}/api/health`
        );
        console.log(
            `Gemini AI features: ${GEMINI_ENABLED ? "ENABLED" : "disabled (add a key in config.js to enable)"}`
        );
        if (GEMINI_ENABLED) {
            const preview =
                GEMINI_API_KEY.length > 10
                    ? `${GEMINI_API_KEY.slice(0, 4)}...${GEMINI_API_KEY.slice(-4)} (length ${GEMINI_API_KEY.length})`
                    : "(too short to be a real key)";
            console.log(`Gemini key preview: ${preview}`);
            if (!GEMINI_API_KEY.startsWith("AIza")) {
                console.log(
                    "Note: this key doesn't start with the common 'AIza' prefix. " +
                    "That's not necessarily wrong -- Google does issue other valid formats -- " +
                    "but if requests fail with API_KEY_INVALID, re-check it came from https://aistudio.google.com/app/apikey."
                );
            }
        }
        console.log(
            "========================================"
        );
        console.log("");
    }
);
}
