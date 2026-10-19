# For Charlie: the new-trip email and review page, for the ALL IN backend

This is one commit on top of `CFSiteDesign/mm-squad-trips` (`ced803c`, "Trip builder: Ewan's WhatsApp, plus a test send to Ewan").
Ewan asked for a clearer email when a guest sends a trip (everything they built, not a table and a text dump) with Approve / Not approved / Edit it buttons.

```bash
git checkout -b trip-builder-crew-review
git am --3way /path/to/0001-Trip-builder-new-trip-email-with-the-whole-trip-Appr.patch
```

What it touches (17 files): `supabase/functions/_shared/{email,trip-builder,trip-builder-crew,trip-builder-sample}.ts`,
`trip-builder-admin`, `trip-builder-request`, `trip-builder-test-emails`, `src/components/admin/TripBuilderAdmin.tsx`, and
`public/trip-builder/` (the builder copy). `docs/trip-builder-crew-review.md` in the patch explains it for the team.

To ship it:
1. Deploy the three functions above (the shared files go with them) and the site.
2. Optional secret `TRIP_BUILDER_TEAM_EMAILS` to copy the team on every new-trip email.
3. Press the test send: it emails Ewan the five trip builder emails and creates a sample request `MM-SAMPLE` so the buttons work.

No database change. No new secret is needed (links are signed with `ADMIN_PASSWORD`; `TRIP_BUILDER_LINK_SECRET` overrides it if you prefer).
Tested: `deno test supabase/functions/_shared/`, `tsc --noEmit -p tsconfig.app.json`, `vitest run`, and the real request / paid / admin handlers run
end to end against in-memory fakes for Supabase, Stripe and Resend (approve, decline, edit, bad and expired keys, wrong trip, list refused for a crew key).
