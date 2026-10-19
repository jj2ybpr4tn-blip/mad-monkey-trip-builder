#!/bin/bash
# Runs the trip builder end-to-end checks against a checkout of the ALL IN backend. Needs Deno 2.
#   handoff/all-in-backend/e2e/run.sh /path/to/mm-squad-trips
# Nothing is sent, charged or stored anywhere: Supabase, Stripe and Resend are in-memory fakes (see the *-fake.ts files).
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: $0 /path/to/mm-squad-trips"; exit 2; }
REPO=$(cd "$1" && pwd); HERE=$(cd "$(dirname "$0")" && pwd); TMP=$(mktemp -d)
cp -R "$REPO/supabase/functions" "$TMP/functions"
# The repo's package.json makes Deno want a full npm install, so run from a copy, with the npm CORS import swapped for a stub.
echo 'export const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };' > "$TMP/functions/cors-stub.ts"
grep -rl "npm:@supabase/supabase-js@2/cors" "$TMP/functions" | while read -r f; do
  rel=$(python3 -c "import os,sys;print(os.path.relpath('$TMP/functions/cors-stub.ts', os.path.dirname('$f')))")
  sed -i.bak "s#npm:@supabase/supabase-js@2/cors#$rel#" "$f" && rm -f "$f.bak"
done
cp "$HERE"/*.ts "$HERE"/guest-payload.json "$HERE"/seed.json "$TMP"/
cat > "$TMP/import_map.json" <<JSON
{ "imports": { "https://esm.sh/@supabase/supabase-js@2.45.0": "$TMP/supabase-fake.ts", "https://esm.sh/stripe@18.5.0": "$TMP/stripe-fake.ts" } }
JSON
cd "$TMP"
MOCK_TAG=-pay ADMIN_PASSWORD=test-admin-pw STRIPE_SECRET_KEY=sk_test_fake SUPABASE_URL=http://fake.supabase.test SUPABASE_SERVICE_ROLE_KEY=fake-key RESEND_API_KEY=re_fake \
  deno run --no-check --no-lock -A --import-map=import_map.json e2e.ts
