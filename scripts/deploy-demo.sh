#!/usr/bin/env bash
# Publishes the demo site (static, no server) to GitHub Pages from a separate `gh-pages` branch, so main stays clean.
# The demo lives under a sub-folder (https://<owner>.github.io/<repo>/), so the Google pages are rebuilt with that
# base path and a noindex tag. Run from the project folder after pushing main:   npm run deploy-demo
# Needs: git, the GitHub CLI (gh) signed in, Node 18+.
set -e
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner); NAME=${REPO#*/}
rm -rf .demo-build; git worktree prune
git worktree add -q -B gh-pages .demo-build HEAD
(
  cd .demo-build
  BASE_PATH="/$NAME" NOINDEX=1 node scripts/build-pages.mjs
  touch .nojekyll
  git add -A && git -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -qm "Demo site build ($(date -u +%Y-%m-%d))" || true
  git push -q -f origin gh-pages
)
git worktree remove --force .demo-build
echo "Pushed branch gh-pages. Site: https://${REPO%/*}.github.io/$NAME/"
