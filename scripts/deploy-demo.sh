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
  rm -rf handoff                       # the patches for the ALL IN site aren't part of the demo
  git add -A
  if git diff --cached --quiet; then echo "Nothing changed in the demo build."; else
    # use your git identity if you have one, otherwise a neutral one so the commit can't fail quietly
    NAME_ARG=(); [ -z "$(git config user.name)" ] && NAME_ARG=(-c user.name="Trip Builder deploy" -c user.email="deploy@localhost")
    git "${NAME_ARG[@]}" commit -qm "Demo site build ($(date -u +%Y-%m-%d))"
  fi
  git push -q -f origin gh-pages
)
git worktree remove --force .demo-build
echo "Pushed branch gh-pages. Site: https://${REPO%/*}.github.io/$NAME/"
