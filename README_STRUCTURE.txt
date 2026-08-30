Tom's Trails - restructured static site (v2 draft)

index.html            Page structure only
css/styles.css        Site styles
js/app.js             Site behaviour
data/routes_2026.js   2026 trail metadata + simplified display coordinates
data/peaks.js         Peak database
data/wesen.js         Wesen im Wald metadata; image paths only
assets/headers/       Header panorama/image files
assets/wesen/         Wesen im Wald photographs
favicon.svg           Site favicon (same mountain logo)

Why this structure:
- No large embedded base64 images in index.html.
- Route data is separated by year, so future years can use routes_2027.js etc.
- Each individual file remains far below GitHub's browser-upload limit.
- Data files are JavaScript globals rather than fetched JSON, so index.html still works when opened directly from disk for local checks.

Random hero headers
-------------------
Header panoramas live in assets/headers/.
Metadata lives in data/headers.js, including date/location/season.
A random panorama is selected on every page load/refresh. Consecutive repeats are avoided when sessionStorage is available.
Approximate dates supplied by the site owner use the 15th of the month and datePrecision: 'month'.
The two WIW-0003 images remain only in assets/wesen/ and are not header candidates.
