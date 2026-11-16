#!/usr/bin/env bash
# The demo builder now lives inside the ALL IN site's preview (shop/trip-builder/), and the two are published together by
# scripts/publish-preview.sh, so this old command runs that: an old habit can't publish one and leave the other behind.
exec bash "$(dirname "$0")/publish-preview.sh" "$@"
