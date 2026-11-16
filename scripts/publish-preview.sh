#!/usr/bin/env bash
# PUBLISH THE PREVIEW: the ALL IN site with the trip builder inside it, both in one go, on GitHub Pages (branch gh-pages).
#
#   https://<owner>.github.io/<repo>/shop/               the ALL IN shop, locked: it opens only with the key link
#                                                        (drafts/all-in-store/preview/LINK.txt on Ewan's Mac)
#   https://<owner>.github.io/<repo>/shop/trip-builder/  the trip builder, inside the site the way it will be at launch
#                                                        (madmonkeyhostels.com/all-in-trips/trip-builder/), with ALLIN_SITE '../'
#   https://<owner>.github.io/<repo>/                    where the builder used to be: it sends people on to shop/trip-builder/,
#                                                        keeping the rest of the link (?via=allin…#/build/…), and so does any old page
#
# One command for both, so publishing one can never wipe or break the other:
#   • the builder is always built from this checkout's last commit (HEAD)
#   • the shop: on the Mac that holds drafts/all-in-store, it's rebuilt from drafts/all-in-store/src with that same builder
#     inside it and locked with drafts/all-in-store/preview/.key (never a new key: the link would stop working). Anywhere
#     else it's kept exactly as it is on GitHub. SHOP_DIR=<folder with index.html and shop.bin> publishes those instead.
#   • everything else in shop/ (the 1080p videos in shop/v/, made by .github/workflows/shop-videos.yml) is carried over
#   • it adds one commit on top of gh-pages and never force-pushes, so nothing anyone else put there is lost
#
# Run it from the project folder, after pushing main:   npm run publish-preview
#   npm run publish-preview -- --dry-run      builds it all into .site/ to look at, and pushes nothing
# Needs: git (signed in to GitHub), Node 18+, and Python 3 on the Mac with the shop.
set -eo pipefail

DRY=0
for a in "$@"; do case "$a" in --dry-run) DRY=1 ;; *) echo "Unknown option: $a (the only one is --dry-run)" >&2; exit 2 ;; esac; done

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
URL="$(git remote get-url origin)"
SLUG="$(printf '%s' "$URL" | sed -E 's#^.*github\.com[:/]+##; s#\.git$##; s#/+$##')"
OWNER="${SLUG%%/*}"; NAME="${SLUG#*/}"
if [ -z "$OWNER" ] || [ -z "$NAME" ] || [ "$OWNER" = "$SLUG" ]; then echo "Can't tell the GitHub repo from origin ($URL)." >&2; exit 2; fi
BUILDER="shop/trip-builder"
HEADREV="$(git rev-parse --short HEAD)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then echo "Note: there are changes that aren't committed. The builder goes up as it is in the last commit ($HEADREV)."; fi

WORK="$(mktemp -d)"
cleanup() { git -C "$ROOT" worktree remove --force "$WORK/site" >/dev/null 2>&1 || true; rm -rf "$WORK"; git -C "$ROOT" worktree prune >/dev/null 2>&1 || true; }
trap cleanup EXIT

# ---------- 1. the builder, from the last commit ----------
mkdir -p "$WORK/b"
git archive HEAD | tar -x -C "$WORK/b"
(
  cd "$WORK/b"
  BASE_PATH="/$NAME/$BUILDER" NOINDEX=1 node scripts/build-pages.mjs >/dev/null
  rm -rf handoff .github                                   # the patches for the ALL IN backend and our workflows aren't part of the site
  # inside the site: the site's own bar and menu, and Back to the trip (docs/ALL-IN-SITE.md). main keeps ALLIN_SITE blank.
  sed -i.bak "s#^  ALLIN_SITE: '',#  ALLIN_SITE: '../',#" config.js && rm -f config.js.bak
  grep -q "^  ALLIN_SITE: '../'," config.js || { echo "config.js: couldn't set ALLIN_SITE to '../'." >&2; exit 3; }
  sed -i.bak 's#<html lang="en-GB" data-look="allin">#<html lang="en-GB" data-look="allin" data-site="allin">#' index.html && rm -f index.html.bak
  grep -q 'data-site="allin"' index.html || { echo "index.html: couldn't mark it as inside the site." >&2; exit 3; }
)
echo "Builder: built from $HEADREV for /$NAME/$BUILDER/"

# ---------- 2. the shop ----------
SRC="$ROOT/drafts/all-in-store"
mkdir -p "$WORK/shop"
if [ -n "${SHOP_DIR:-}" ]; then
  cp "$SHOP_DIR/index.html" "$SHOP_DIR/shop.bin" "$WORK/shop/"
  SHOPNOTE="shop from SHOP_DIR"
elif [ -f "$SRC/src/build.py" ]; then
  KEY="$SRC/preview/.key"
  if [ ! -s "$KEY" ]; then echo "There's no $KEY, so the shop can't be locked with the key its link uses. Nothing was published." >&2; exit 4; fi
  python3 "$SRC/src/build.py" "$ROOT/drafts/all-in-concept/ALL-IN-concept-v4.html" "$WORK/b" "$SRC/preview/shop.html"
  node "$SRC/src/lock.js" "$SRC/preview/shop.html" "$SRC/preview/shop/shop.bin" "$KEY" >/dev/null
  cp "$SRC/preview/shop/index.html" "$SRC/preview/shop/shop.bin" "$WORK/shop/"
  SHOPNOTE="shop rebuilt from drafts/all-in-store/src and locked"
  echo "Shop: rebuilt with this builder inside it and locked (unlocked copy: drafts/all-in-store/preview/shop.html)"
else
  SHOPNOTE="shop kept as it was"
  echo "Shop: kept exactly as it is on GitHub (drafts/all-in-store isn't on this machine)"
fi

# ---------- 3. put it together on top of what's on gh-pages ----------
git fetch -q origin gh-pages
git worktree add -q --detach "$WORK/site" FETCH_HEAD
cd "$WORK/site"
find . -mindepth 1 -maxdepth 1 ! -name .git ! -name shop -exec rm -rf {} +      # the old builder at the top goes; shop/ stays
rm -rf "$BUILDER"
mkdir -p shop "$BUILDER"
if [ -f "$WORK/shop/shop.bin" ]; then cp "$WORK/shop/index.html" "$WORK/shop/shop.bin" shop/; fi
if [ ! -f shop/index.html ] || [ ! -f shop/shop.bin ]; then echo "Warning: there's no shop in this build (none on GitHub and none built here)." >&2; fi
cp -R "$WORK/b/." "$BUILDER/"
touch .nojekyll

# where the builder used to be: the top of the site, and any old page under it (GitHub Pages serves 404.html for those)
cat > index.html <<'HTML'
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>The trip builder has moved · Mad Monkey</title>
<script>location.replace('shop/trip-builder/' + location.search + location.hash);</script>
<meta http-equiv="refresh" content="0; url=shop/trip-builder/">
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0E2B26;color:#F3F7F2;font:17px/1.5 system-ui,sans-serif;text-align:center">
<p>The trip builder has moved. <a href="shop/trip-builder/" style="color:#FFB238">Open it here</a>.</p>
</body>
</html>
HTML
cat > 404.html <<'HTML'
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Not here · Mad Monkey</title>
<script>
(function () {
  // The trip builder used to sit at the top of this site. Its old pages now live under shop/trip-builder/.
  var base = '/__NAME__/', p = location.pathname;
  if (p.indexOf(base) === 0 && p.indexOf(base + 'shop/') !== 0) location.replace(base + 'shop/trip-builder/' + p.slice(base.length) + location.search + location.hash);
})();
</script>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0E2B26;color:#F3F7F2;font:17px/1.5 system-ui,sans-serif;text-align:center">
<p>That page isn't here. <a href="/__NAME__/shop/trip-builder/" style="color:#FFB238">Open the trip builder</a>.</p>
</body>
</html>
HTML
sed -i.bak "s#__NAME__#$NAME#g" 404.html && rm -f 404.html.bak

if [ "$DRY" = 1 ]; then
  rm -rf "$ROOT/.site"; mkdir -p "$ROOT/.site/$NAME"
  tar --exclude=.git -cf - . | (cd "$ROOT/.site/$NAME" && tar -xf -)
  echo "Built into .site/$NAME/ and pushed nothing. To look at it: cd .site && python3 -m http.server 8000, then http://localhost:8000/$NAME/shop/"
  exit 0
fi

git add -A
if git diff --cached --quiet; then echo "The preview on GitHub is already up to date."; exit 0; fi
if [ -n "$(git config user.name || true)" ]; then git commit -qm "Preview: the ALL IN site with the trip builder inside it (builder $HEADREV, $SHOPNOTE)"
else git -c user.name="Trip Builder deploy" -c user.email="deploy@localhost" commit -qm "Preview: the ALL IN site with the trip builder inside it (builder $HEADREV, $SHOPNOTE)"; fi
if ! git push -q origin HEAD:gh-pages; then
  echo "GitHub has something newer on gh-pages (the shop video workflow, maybe). Nothing was overwritten: run this again." >&2; exit 6
fi
echo "Published. GitHub Pages takes a minute or two."
echo "  The shop:          https://$OWNER.github.io/$NAME/shop/   (open it with the key link)"
echo "  The trip builder:  https://$OWNER.github.io/$NAME/$BUILDER/"
