// ============================================================
// BUSINESS RECOMMENDATION ENGINE
// COMMAND LINE VERSION
// ============================================================

const readline =
    require("readline");

const {
    getRecommendations
} =
    require(
        "./recommendation-engine.js"
    );

// ------------------------------------------------------------
// COLORS
// ------------------------------------------------------------

const colors = {

    reset:
        "\x1b[0m",

    bold:
        "\x1b[1m",

    red:
        "\x1b[31m",

    green:
        "\x1b[32m",

    yellow:
        "\x1b[33m",

    cyan:
        "\x1b[36m",

    white:
        "\x1b[37m",

    black:
        "\x1b[30m",

    dim:
        "\x1b[2m",

    bgGreen:
        "\x1b[42m",

    bgCyan:
        "\x1b[46m"
};

// ------------------------------------------------------------
// UI HELPERS
// ------------------------------------------------------------

function boxTop(text) {

    return (
        "\n" +
        colors.cyan +
        colors.bold +
        "╔" +
        "═".repeat(
            Math.max(
                10,
                text.length
            )
        ) +
        "╗" +
        colors.reset +
        "\n" +

        colors.cyan +
        colors.bold +
        "║" +
        text +
        "║" +
        colors.reset +
        "\n" +

        colors.cyan +
        colors.bold +
        "╚" +
        "═".repeat(
            Math.max(
                10,
                text.length
            )
        ) +
        "╝" +
        colors.reset
    );
}

function sectionHeader(text) {

    return (
        "\n" +
        colors.cyan +
        colors.bold +
        "► " +
        text +
        colors.reset +
        "\n"
    );
}

function infoLine(
    label,
    value
) {

    const labelWidth =
        20;

    return (
        "  " +
        colors.dim +
        label.padEnd(
            labelWidth
        ) +
        colors.reset +
        ": " +
        colors.white +
        value +
        colors.reset
    );
}

function bullet(
    text,
    symbol = "•"
) {

    return (
        "  " +
        colors.cyan +
        symbol +
        " " +
        colors.reset +
        text
    );
}

function successBullet(
    text
) {

    return (
        "  " +
        colors.green +
        "✓ " +
        colors.reset +
        text
    );
}

function warningBullet(
    text
) {

    return (
        "  " +
        colors.yellow +
        "⚠ " +
        colors.reset +
        text
    );
}

function errorLine(
    text
) {

    return (
        "  " +
        colors.red +
        "✖ " +
        colors.reset +
        text
    );
}

function printCentered(
    text,
    width = 70
) {

    const padding =
        Math.max(
            0,
            Math.floor(
                (
                    width -
                    text.length
                ) / 2
            )
        );

    return (
        " ".repeat(
            padding
        ) +
        text
    );
}

// ------------------------------------------------------------
// READLINE
// ------------------------------------------------------------

const rl =
    readline.createInterface({

        input:
            process.stdin,

        output:
            process.stdout
    });

function ask(question) {

    return new Promise(
        (resolve) => {

            rl.question(
                question,
                (answer) => {

                    resolve(
                        answer.trim()
                    );
                }
            );
        }
    );
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------

async function main() {

    console.clear();

    console.log(
        boxTop(
            "  BUSINESS RECOMMENDATION ENGINE  "
        )
    );

    console.log(

        colors.dim +

        printCentered(
            "Find the best business based on your location,"
        ) +

        "\n" +

        printCentered(
            "capital, skills, experience and competition."
        ) +

        colors.reset +

        "\n"
    );

    // --------------------------------------------------------
    // LOCATION
    // --------------------------------------------------------

    console.log(
        sectionHeader(
            "  STEP 1 – YOUR BASIC DETAILS"
        )
    );

    let location =
        await ask(
            colors.white +
            "  Enter your location (rural / urban): " +
            colors.reset
        );

    location =
        location.toLowerCase();

    while (
        location !== "rural" &&
        location !== "urban"
    ) {

        console.log(
            errorLine(
                "Please enter only 'rural' or 'urban'."
            )
        );

        location =
            (
                await ask(
                    colors.white +
                    "  Enter your location (rural / urban): " +
                    colors.reset
                )
            ).toLowerCase();
    }

    // --------------------------------------------------------
    // CAPITAL
    // --------------------------------------------------------

    let capital =
        Number(
            await ask(
                colors.white +
                "  Enter your available capital (₹): " +
                colors.reset
            )
        );

    while (
        isNaN(capital) ||
        capital < 0
    ) {

        console.log(
            errorLine(
                "Please enter a valid capital amount."
            )
        );

        capital =
            Number(
                await ask(
                    colors.white +
                    "  Enter your available capital (₹): " +
                    colors.reset
                )
            );
    }

    // --------------------------------------------------------
    // SKILLS
    // --------------------------------------------------------

    console.log(
        sectionHeader(
            "  STEP 2 – YOUR SKILLS"
        )
    );

    console.log(

        [
            "  1. Animal Care",
            "  2. Cooking",
            "  3. Tailoring",
            "  4. Technology",
            "  5. Marketing",
            "  6. Management",
            "  7. Farming",
            "  8. Repair"
        ].join("\n")
    );

    console.log(

        "\n" +

        colors.dim +

        "  Enter skill numbers separated by commas." +

        "\n  Example: 1,5,6" +

        colors.reset +

        "\n"
    );

    const skillInput =
        await ask(
            colors.white +
            "  Your skills: " +
            colors.reset
        );

    const skillMap = {

        "1":
            "animal care",

        "2":
            "cooking",

        "3":
            "tailoring",

        "4":
            "technology",

        "5":
            "marketing",

        "6":
            "management",

        "7":
            "farming",

        "8":
            "repair"
    };

    const skills =
        skillInput
            .split(",")
            .map(
                item =>
                    item.trim()
            )
            .filter(
                item =>
                    skillMap[item]
            )
            .map(
                item =>
                    skillMap[item]
            );

    // --------------------------------------------------------
    // EXPERIENCE
    // --------------------------------------------------------

    console.log(
        sectionHeader(
            "  STEP 3 – YOUR EXPERIENCE"
        )
    );

    console.log(

        [
            "  1. Beginner",
            "  2. Intermediate",
            "  3. Experienced"
        ].join("\n")
    );

    let experienceInput =
        await ask(
            colors.white +
            "  Select experience (1-3): " +
            colors.reset
        );

    const experienceMap = {

        "1":
            "beginner",

        "2":
            "intermediate",

        "3":
            "experienced"
    };

    while (
        !experienceMap[
        experienceInput
        ]
    ) {

        console.log(
            errorLine(
                "Please select 1, 2 or 3."
            )
        );

        experienceInput =
            await ask(
                colors.white +
                "  Select experience (1-3): " +
                colors.reset
            );
    }

    const experience =
        experienceMap[
        experienceInput
        ];

    // --------------------------------------------------------
    // COMPETITION
    // --------------------------------------------------------

    console.log(
        sectionHeader(
            "  STEP 4 – COMPETITION AROUND YOU"
        )
    );

    let competitorCount =
        Number(
            await ask(
                colors.white +
                "  Number of competitors nearby: " +
                colors.reset
            )
        );

    while (
        isNaN(
            competitorCount
        ) ||
        competitorCount < 0
    ) {

        console.log(
            errorLine(
                "Please enter a valid number."
            )
        );

        competitorCount =
            Number(
                await ask(
                    colors.white +
                    "  Number of competitors nearby: " +
                    colors.reset
                )
            );
    }

    // --------------------------------------------------------
    // PROFILE
    // --------------------------------------------------------

    console.log(
        sectionHeader(
            "  YOUR PROFILE"
        )
    );

    console.log(
        infoLine(
            "Location",
            colors.bold +
            location +
            colors.reset
        )
    );

    console.log(
        infoLine(
            "Capital",
            colors.bold +
            "₹" +
            capital.toLocaleString(
                "en-IN"
            ) +
            colors.reset
        )
    );

    console.log(
        infoLine(
            "Skills",
            colors.bold +
            (
                skills.length > 0
                    ? skills.join(", ")
                    : "None"
            ) +
            colors.reset
        )
    );

    console.log(
        infoLine(
            "Experience",
            colors.bold +
            experience +
            colors.reset
        )
    );

    console.log(
        infoLine(
            "Competitors",
            colors.bold +
            String(
                competitorCount
            ) +
            colors.reset
        )
    );

    // --------------------------------------------------------
    // ENGINE
    // --------------------------------------------------------

    const businesses =
        getRecommendations({

            location,

            capital,

            skills,

            experience,

            competitorCount
        });

    const topBusinesses =
        businesses.slice(
            0,
            5
        );

    // --------------------------------------------------------
    // RESULTS
    // --------------------------------------------------------

    console.log(
        sectionHeader(
            "  TOP BUSINESS RECOMMENDATIONS"
        )
    );

    topBusinesses.forEach(
        (
            business,
            index
        ) => {

            console.log(

                "\n" +

                colors.bgCyan +
                colors.black +
                colors.bold +

                `  ${index + 1}. ${business.name}  ` +

                colors.reset
            );

            console.log(

                "  " +

                colors.yellow +

                "Score: " +

                colors.bold +

                `${business.score}/100` +

                colors.reset
            );

            console.log(
                "  " +
                "─".repeat(60)
            );

            console.log(

                colors.green +
                colors.bold +

                "  WHY THIS BUSINESS IS RECOMMENDED:" +

                colors.reset
            );

            business.reasons.forEach(
                reason => {

                    console.log(
                        successBullet(
                            reason
                        )
                    );
                }
            );

            console.log(

                "\n" +

                colors.red +
                colors.bold +

                "  POTENTIAL THREATS:" +

                colors.reset
            );

            business.threats.forEach(
                threat => {

                    console.log(
                        warningBullet(
                            threat
                        )
                    );
                }
            );

            console.log(
                "  " +
                "─".repeat(60)
            );
        }
    );

    // --------------------------------------------------------
    // SCORE TABLE
    // --------------------------------------------------------

    console.log(
        sectionHeader(
            "  COMPLETE SCORE TABLE"
        )
    );

    console.log(
        "\n" +
        colors.bold +
        "  Business".padEnd(30) +
        "Score" +
        colors.reset
    );

    console.log(
        "  " +
        "─".repeat(40)
    );

    businesses.forEach(
        business => {

            const nameCol =

                (
                    business ===
                        topBusinesses[0]

                        ? colors.green +
                        colors.bold

                        : colors.white
                ) +

                business.name.padEnd(
                    30
                ) +

                colors.reset;

            const scoreCol =

                (
                    business.score >= 70
                        ? colors.green

                        : business.score >= 40
                            ? colors.yellow
                            : colors.red
                ) +

                colors.bold +

                `${business.score}/100` +

                colors.reset;

            console.log(
                "  " +
                nameCol +
                scoreCol
            );
        }
    );

    // --------------------------------------------------------
    // FINAL RESULT
    // --------------------------------------------------------

    const bestBusiness =
        topBusinesses[0];

    console.log(
        sectionHeader(
            "  FINAL RESULT"
        )
    );

    console.log(

        "\n" +

        colors.bgGreen +
        colors.black +
        colors.bold +

        `  🏆 BEST BUSINESS FOR YOU: ${bestBusiness.name}  ` +

        colors.reset
    );

    console.log(

        "  " +

        colors.yellow +

        "⭐ RECOMMENDATION SCORE: " +

        colors.bold +

        `${bestBusiness.score}/100` +

        colors.reset
    );

    console.log(
        "\n" +
        colors.dim +
        "  Based on:" +
        colors.reset
    );

    console.log(
        bullet(
            `Location: ${location}`
        )
    );

    console.log(
        bullet(
            `Capital: ₹${capital.toLocaleString("en-IN")}`
        )
    );

    console.log(
        bullet(
            `Skills: ${skills.length > 0
                ? skills.join(", ")
                : "None"
            }`
        )
    );

    console.log(
        bullet(
            `Experience: ${experience}`
        )
    );

    console.log(
        bullet(
            `Nearby competitors: ${competitorCount}`
        )
    );

    console.log(

        "\n" +

        boxTop(
            "  BUSINESS RECOMMENDATION COMPLETE  "
        ) +

        "\n"
    );

    rl.close();
}

// ------------------------------------------------------------
// ERROR HANDLING
// ------------------------------------------------------------

main().catch(
    error => {

        console.error(
            "\n" +
            colors.red +
            "An error occurred:" +
            colors.reset
        );

        console.error(
            error
        );

        rl.close();
    }
);