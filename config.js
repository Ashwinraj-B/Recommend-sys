// ============================================================
// LOCAL CONFIGURATION
//
// Secrets are read from environment variables.
// Never put real API keys in this file or commit a .env file.
// ============================================================

module.exports = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash"
};
