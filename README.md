# Integrated Business Recommendation Engine

This project combines:

1. Chandru's Business Recommendation Engine
2. Map & Competitor Data Engine

## Project structure

```text
business-recommendation-integrated-final/
├── package.json
├── README.md
├── chandru-business-recommendation-engine/
│   ├── index.html
│   ├── results.html
│   ├── recommendation-engine.js
│   └── cli.js
└── competition-finder/
    ├── competition_finder.js
    └── server.js
```

## Web flow

index.html
→ competition_finder.js
→ Nominatim
→ latitude/longitude
→ local `/api/competition`
→ server.js
→ Overpass API
→ nearby shops
→ competitorCount
→ recommendation-engine.js
→ results.html

## Run

Requirements:
- Node.js
- Internet connection

From this project's root folder:

```cmd
npm start
```

Then open:

```text
http://localhost:8000/
```

Do not double-click `index.html`.

## API tests

Health:

```text
http://localhost:8000/api/health
```

Competition API example:

```text
http://localhost:8000/api/competition?lat=13.0836939&lon=80.270186&radius=5000
```

## Important

The browser does not call Overpass directly. `server.js` makes the Overpass request, avoiding the CORS problem that occurs when opening the HTML with `file://`.

The competition count is the number of OpenStreetMap `shop` objects returned within the 5 km search radius.

The recommendation engine receives that real count as:

```js
getRecommendations({
    location,
    capital,
    skills,
    experience,
    competitorCount
});
```


## Gemini API key

The project does not contain a real API key. `config.js` reads the key from
the `GEMINI_API_KEY` environment variable.

For local development, set the variable in PowerShell before starting:

```powershell
$env:GEMINI_API_KEY="YOUR_NEW_GEMINI_API_KEY"
npm start
```

You can also use `.env.example` as a template for your own local environment.
Never commit a real `.env` file or API key.


## Vercel deployment

This project is Vercel-ready. The public pages are `index.html` and `results.html` at the repository root. The backend routes are deployed as Vercel serverless functions under `/api/`.

Set `GEMINI_API_KEY` in Vercel Project Settings -> Environment Variables if Gemini features are required. Do not commit `.env` or real API keys.
