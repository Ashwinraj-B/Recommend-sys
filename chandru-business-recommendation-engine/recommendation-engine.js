// ============================================================
// BUSINESS RECOMMENDATION ENGINE
//
// Input:
// location
// capital
// skills
// experience
// competitorCount
//
// Output:
// Sorted list of business recommendations
// ============================================================

// ============================================================
// SKILL MATCHING
//
// Skills are now entered as free text (with suggestions, not a
// fixed list), so we can no longer rely on exact string matches
// against the business database's skill keywords. Instead, each
// business skill keyword (e.g. "cooking") has a list of related
// terms someone might actually type ("baking", "chef", "food
// prep", ...). A typed skill counts as a match if it overlaps
// with any of those terms.
// ============================================================

const SKILL_KEYWORDS = {
    "animal care": ["animal care", "animal", "livestock", "cattle", "dairy", "poultry", "veterinary", "pet care", "pet"],
    "farming": ["farming", "agriculture", "farmer", "crop", "horticulture", "cultivation"],
    "cooking": ["cooking", "cook", "baking", "baker", "bakery", "chef", "culinary", "food prep", "catering", "confectionery", "pastry"],
    "tailoring": ["tailoring", "tailor", "sewing", "stitching", "embroidery", "fashion design", "garment", "dress making", "dressmaking"],
    "technology": ["technology", "tech", "computer", "software", "programming", "coding", "electronics", "mobile repair", "web design", "app development", "it services"],
    "marketing": ["marketing", "sales", "advertising", "promotion", "branding", "social media"],
    "management": ["management", "administration", "operations", "business management", "planning", "organizing", "supervision"],
    "repair": ["repair", "mechanic", "fixing", "maintenance", "servicing", "electronics repair", "appliance repair", "handyman"]
};

function skillMatchesKeyword(typedSkill, keyword) {
    const normalizedSkill = String(typedSkill || "").toLowerCase().trim();
    const normalizedKeyword = String(keyword || "").toLowerCase().trim();

    if (!normalizedSkill || !normalizedKeyword) return false;

    return (
        normalizedSkill === normalizedKeyword ||
        normalizedSkill.includes(normalizedKeyword) ||
        normalizedKeyword.includes(normalizedSkill)
    );
}

function skillMatchesBusinessKeyword(typedSkill, businessKeyword) {
    const relatedTerms =
        SKILL_KEYWORDS[businessKeyword] || [businessKeyword];

    return relatedTerms.some(
        term => skillMatchesKeyword(typedSkill, term)
    );
}

function getRecommendations({
    location: locationType,
    capital,
    skills,
    experience,
    competitorCount
}) {

    // --------------------------------------------------------
    // NORMALIZE INPUT
    // --------------------------------------------------------

    locationType =
        String(
            locationType || ""
        ).toLowerCase();

    capital =
        Number(capital) || 0;

    skills =
        Array.isArray(skills)
            ? skills.map(
                skill =>
                    String(skill)
                        .toLowerCase()
                        .trim()
            )
            : [];

    experience =
        String(
            experience || ""
        ).toLowerCase();

    competitorCount =
        Number(
            competitorCount
        ) || 0;

    // --------------------------------------------------------
    // BUSINESS DATABASE
    // --------------------------------------------------------

    const businesses = [

        {
            name: "Dairy Farming",

            baseScore: 50,

            capital: {
                min: 50000,
                ideal: 300000
            },

            skills: [
                "animal care",
                "farming",
                "management"
            ],

            locations: [
                "rural"
            ],

            experience: [
                "beginner",
                "intermediate",
                "experienced"
            ],

            reasons: [
                "Good fit for rural areas.",
                "Can generate regular income.",
                "Animal care and farming skills are useful."
            ],

            threats: []
        },

        {
            name: "Poultry Farming",

            baseScore: 50,

            capital: {
                min: 30000,
                ideal: 200000
            },

            skills: [
                "animal care",
                "farming",
                "management"
            ],

            locations: [
                "rural"
            ],

            experience: [
                "beginner",
                "intermediate",
                "experienced"
            ],

            reasons: [
                "Suitable for rural locations.",
                "Demand for eggs and poultry products can be consistent.",
                "Can start on a smaller scale."
            ],

            threats: []
        },

        {
            name: "Bakery",

            baseScore: 50,

            capital: {
                min: 50000,
                ideal: 500000
            },

            skills: [
                "cooking",
                "marketing",
                "management"
            ],

            locations: [
                "rural",
                "urban"
            ],

            experience: [
                "beginner",
                "intermediate",
                "experienced"
            ],

            reasons: [
                "Food products have regular demand.",
                "Cooking skills directly support the business.",
                "Can expand product variety over time."
            ],

            threats: []
        },

        {
            name: "Tailoring",

            baseScore: 50,

            capital: {
                min: 10000,
                ideal: 100000
            },

            skills: [
                "tailoring",
                "marketing",
                "management"
            ],

            locations: [
                "rural",
                "urban"
            ],

            experience: [
                "beginner",
                "intermediate",
                "experienced"
            ],

            reasons: [
                "Can be started with relatively low capital.",
                "Tailoring skills provide a strong advantage.",
                "Can serve local customers."
            ],

            threats: []
        },

        {
            name: "Grocery Store",

            baseScore: 50,

            capital: {
                min: 50000,
                ideal: 500000
            },

            skills: [
                "marketing",
                "management"
            ],

            locations: [
                "rural",
                "urban"
            ],

            experience: [
                "beginner",
                "intermediate",
                "experienced"
            ],

            reasons: [
                "Daily-use products create regular demand.",
                "Management skills are useful.",
                "Can serve nearby households."
            ],

            threats: []
        },

        {
            name: "Ice Cream Shop",

            baseScore: 50,

            capital: {
                min: 50000,
                ideal: 300000
            },

            skills: [
                "cooking",
                "marketing",
                "management"
            ],

            locations: [
                "rural",
                "urban"
            ],

            experience: [
                "beginner",
                "intermediate",
                "experienced"
            ],

            reasons: [
                "Can benefit from strong seasonal demand.",
                "Marketing can attract local customers.",
                "Can be combined with other food products."
            ],

            threats: []
        },

        {
            name: "Digital Services",

            baseScore: 50,

            capital: {
                min: 10000,
                ideal: 150000
            },

            skills: [
                "technology",
                "marketing",
                "management"
            ],

            locations: [
                "rural",
                "urban"
            ],

            experience: [
                "beginner",
                "intermediate",
                "experienced"
            ],

            reasons: [
                "Requires comparatively low starting capital.",
                "Technology skills provide a strong advantage.",
                "Can offer multiple digital services."
            ],

            threats: []
        },

        {
            name: "Restaurant",

            baseScore: 50,

            capital: {
                min: 100000,
                ideal: 1000000
            },

            skills: [
                "cooking",
                "marketing",
                "management"
            ],

            locations: [
                "rural",
                "urban"
            ],

            experience: [
                "beginner",
                "intermediate",
                "experienced"
            ],

            reasons: [
                "Food services can have strong local demand.",
                "Cooking skills are directly useful.",
                "Marketing can help build a customer base."
            ],

            threats: []
        }
    ];

    // --------------------------------------------------------
    // SCORE EACH BUSINESS
    // --------------------------------------------------------

    const results =
        businesses.map(
            business => {

                let score =
                    business.baseScore;

                const reasons =
                    [...business.reasons];

                const threats =
                    [...business.threats];

                // ------------------------------------------------
                // LOCATION SCORE
                // ------------------------------------------------

                if (
                    business.locations.includes(
                        locationType
                    )
                ) {
                    score += 10;

                    reasons.push(
                        `The business is suitable for ${locationType} areas.`
                    );
                }

                // ------------------------------------------------
                // CAPITAL SCORE
                // ------------------------------------------------

                if (
                    capital >=
                    business.capital.ideal
                ) {
                    score += 15;

                    reasons.push(
                        "Your available capital comfortably supports this business."
                    );
                }

                else if (
                    capital >=
                    business.capital.min
                ) {
                    score += 8;

                    reasons.push(
                        "Your available capital can support starting this business."
                    );
                }

                else {
                    score -= 15;

                    threats.push(
                        "Your current capital may be insufficient."
                    );
                }

                // ------------------------------------------------
                // SKILL SCORE
                // ------------------------------------------------

                let matchingSkills = 0;

                for (
                    const skill of skills
                ) {

                    const matchesThisBusiness =
                        business.skills.some(
                            businessKeyword =>
                                skillMatchesBusinessKeyword(
                                    skill,
                                    businessKeyword
                                )
                        );

                    if (matchesThisBusiness) {
                        matchingSkills++;
                    }
                }

                if (
                    matchingSkills >= 2
                ) {
                    score += 15;

                    reasons.push(
                        "Your skills strongly match this business."
                    );
                }

                else if (
                    matchingSkills === 1
                ) {
                    score += 8;

                    reasons.push(
                        "At least one of your skills matches this business."
                    );
                }

                else {
                    score -= 5;

                    threats.push(
                        "Your current skills have limited direct overlap with this business."
                    );
                }

                // ------------------------------------------------
                // EXPERIENCE SCORE
                // ------------------------------------------------

                if (
                    business.experience.includes(
                        experience
                    )
                ) {

                    if (
                        experience ===
                        "experienced"
                    ) {
                        score += 10;

                        reasons.push(
                            "Your experience level is suitable for this business."
                        );
                    }

                    else if (
                        experience ===
                        "intermediate"
                    ) {
                        score += 7;

                        reasons.push(
                            "Your experience level provides a useful foundation."
                        );
                    }

                    else {
                        score += 4;

                        reasons.push(
                            "This business can be approached by a beginner."
                        );
                    }
                }

                // ------------------------------------------------
                // COMPETITION
                // ------------------------------------------------

                if (
                    competitorCount > 5
                ) {
                    threats.push(
                        "High competition nearby"
                    );

                    score -= 10;
                }

                else if (
                    competitorCount >= 3
                ) {
                    threats.push(
                        "Moderate competition nearby"
                    );

                    score -= 5;
                }

                else {
                    score += 5;

                    reasons.push(
                        "Competition nearby appears relatively low."
                    );
                }

                // ------------------------------------------------
                // ICE CREAM SPECIAL THREAT
                // ------------------------------------------------

                if (
                    business.name
                        .toLowerCase()
                        .includes("ice cream")
                ) {
                    threats.push(
                        "Seasonal demand drop in winter"
                    );
                }

                // ------------------------------------------------
                // LIMIT SCORE
                // ------------------------------------------------

                score =
                    Math.max(
                        0,
                        Math.min(
                            100,
                            Math.round(score)
                        )
                    );

                return {
                    name:
                        business.name,

                    score,

                    reasons,

                    threats
                };
            }
        );

    // --------------------------------------------------------
    // SORT HIGHEST FIRST
    // --------------------------------------------------------

    results.sort(
        (a, b) =>
            b.score - a.score
    );

    return results;
}

// ------------------------------------------------------------
// BROWSER EXPORT
// ------------------------------------------------------------

if (
    typeof window !==
    "undefined"
) {
    window.getRecommendations =
        getRecommendations;
}

// ------------------------------------------------------------
// NODE EXPORT
// ------------------------------------------------------------

if (
    typeof module !==
    "undefined" &&
    module.exports
) {
    module.exports = {
        getRecommendations
    };
}