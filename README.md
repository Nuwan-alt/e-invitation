# Dilshi & Nuwan – Wedding Invitation

A single-page, mobile-first wedding invitation site. Plain HTML/CSS/JS, no build step, no framework.

## Project structure

```
index.html                     the whole page
styles.css
script.js                      guest-name logic, countdown, gallery, calendar, RSVP form, animations
images/                        original source images (untouched)
images/optimized/              processed assets actually used by the site
scripts/build_images.py        regenerates everything in images/optimized/
google-apps-script/Code.gs     RSVP backend — deploy this into a Google Sheet (see "RSVP setup" below)
```

## Run it locally

No build step — just serve the folder over HTTP (opening `index.html` directly with
`file://` will break the Google Maps iframe and some relative-path fetches, so use a
local server):

```bash
# any of these work
python -m http.server 8000
npx serve .
php -S localhost:8000
```

Then open `http://localhost:8000/`.

## Deploy for free

**GitHub Pages**
1. Push this folder to a GitHub repo.
2. Repo → Settings → Pages → Source → deploy from the `main` branch, `/ (root)`.
3. Your site is live at `https://<username>.github.io/<repo>/`.

**Netlify**
1. Drag-and-drop the project folder onto [app.netlify.com/drop](https://app.netlify.com/drop), or
2. `netlify deploy` from the project root with the Netlify CLI (publish directory: `.`).

No environment variables, no server, no database — it's static files.

## RSVP setup

The RSVP form on the site saves every response as a row in a Google Sheet,
using a small free script (Google Apps Script) as the "backend." No coding
knowledge is needed — just follow these steps once.

1. **Create a Google Sheet.** Go to [sheets.google.com](https://sheets.google.com)
   and create a new blank spreadsheet. Name it something like
   "Dilshi & Nuwan Wedding RSVPs."
2. **Open the script editor.** In the Sheet, go to **Extensions → Apps
   Script**. This opens a new tab with a code editor.
3. **Paste in the code.** Delete anything already in the editor (e.g. the
   default `function myFunction() {}`), then copy the entire contents of
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs) from this
   project and paste it in. Click the save icon (or press Ctrl/Cmd+S).
4. **Deploy it as a web app.** Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: anything, e.g. "RSVP endpoint."
   - **Execute as:** Me (your Google account).
   - **Who has access:** Anyone.
   - Click **Deploy**.
5. **Authorise the script.** The first time you deploy, Google will ask you
   to authorise it. Click **Authorize access**, choose your Google account,
   click **Advanced** if you see a warning screen, then **Go to (project
   name) (unsafe)**, and **Allow**. This warning appears only because the
   script isn't published in the Google marketplace — it's expected for a
   script you wrote/pasted yourself.
6. **Copy the web app URL.** After deploying, you'll see a URL ending in
   `/exec` — copy it.
7. **Paste the URL into the site.** Open `script.js`, find this line near
   the top:
   ```js
   var RSVP_ENDPOINT = "PASTE_GOOGLE_APPS_SCRIPT_URL_HERE";
   ```
   Replace the placeholder with the URL you copied (keep the quotes), save,
   and redeploy/republish the site.
8. **Test the form.** Open the live site, submit a test RSVP, and check
   that a new row appears in a sheet tab named "RSVP" in your spreadsheet
   (it's created automatically on the first submission).

**If you edit `Code.gs` later:** don't create a new deployment — that would
give you a new URL and break the one already in `script.js`. Instead go to
**Deploy → Manage deployments**, click the pencil/edit icon on the existing
deployment, change **Version** to **New version**, and click **Deploy**.
The web app URL stays exactly the same.

You can optionally set a response deadline shown under the RSVP heading by
editing `RSVP_DEADLINE` in `script.js` (leave it as `""` to hide the line).

## Personalised guest links

Add `?to=` to the URL with the guest's name, e.g.:

```
https://your-domain/?to=Mr%20%26%20Mrs%20Perera
```

- The name appears in gold script on the cover screen ("Dear Mr & Mrs Perera") and on the
  invitation's dotted guest line.
- With no `to` parameter, the page shows "You & Your Family" as a friendly default.
- The value is inserted as plain text (`textContent`), never HTML, so it can't be used to
  inject scripts or markup — safe to share widely.
- To generate links for a guest list, just URL-encode each name and append it to your
  site's base URL (e.g. with `encodeURIComponent("Mr & Mrs Perera")` in a spreadsheet
  formula or small script).

## Replacing the photos

Open `script.js` and edit the `PHOTOS` array near the top:

```js
var PHOTOS = [
  { file: "ps1", alt: "…", position: "50% 22%" },
  { file: "ps2", alt: "…", position: "50% 28%" },
  { file: "ps3", alt: "…", position: "50% 30%" }
];
```

- `file` maps to `images/optimized/<file>.jpg` / `.webp` — add your new image under both
  names in that folder (see below for how to generate them), or point `file` at whatever
  filename you used.
- `position` is a CSS `object-position` value — tweak it so faces aren't cropped in the
  4:5 gallery frame.
- The array order is the slide order in the "Our Moments" carousel.

### Regenerating optimized images

`scripts/build_images.py` is the single source of truth for everything in
`images/optimized/`: the gold monogram + favicons (from `images/D-N.jpg`), a deeper-gold
monogram/names variant used only on the cover screen (where it sits on a solid
background instead of a photo), the foliage corner crops (from
`images/Wedding_Invitation_OptionB_Centered.png`), the pre-shoot photos (resized
≤1600px, WebP + JPG), and the social-share preview image. It never touches the
original files in `images/`.

```bash
pip install pillow
python scripts/build_images.py
```

Add new pre-shoot photos to `images/` (e.g. `ps4.jpg`), add a `build_photos()` entry for
it in the script (or just drop a pre-sized `.jpg`/`.webp` pair straight into
`images/optimized/`), then add it to the `PHOTOS` array in `script.js` as above.

## Notes on the build

- **Fonts**: Great Vibes (script names), Cinzel (uppercase headings), Cormorant Garamond
  (numerals/body) — loaded from Google Fonts.
- **Libraries** (all via CDN, pinned versions, loaded with `defer`): GSAP + ScrollTrigger
  for animation, Swiper for the photo carousel and the fullscreen photo
  viewer. If any of them fail to load (offline CDN, ad-blocker, etc.) the page still
  shows all of its content — animations and the fancy carousel/lightbox interactions
  are progressive enhancements only, never a requirement to see the invitation.
- **Countdown** target is 25 Nov 2026, 10:00 Asia/Colombo (UTC+5:30), computed with an
  explicit UTC offset so it's correct regardless of the visitor's own timezone.
- Respects `prefers-reduced-motion`: animations are skipped and content appears
  immediately.
