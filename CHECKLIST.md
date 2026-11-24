# ALL IN launch: go-live checklist

Who does what is in brackets. Nothing goes live until Ewan says go.

## Before launch day

- [x] The 2027 prices are set and approved by Kyle (18 Nov), and the pack is rebuilt with them. Today's trips keep their
      live prices.
- [x] Today's trips' addresses decided (Ewan, 19 Nov): `/vietnam-14`, `/cambodia-14`, `/indonesia-12`, `/laos-10`,
      `/thailand-11`; `/vietnam-7` and `/indonesia-7` keep theirs.
- [ ] One test booking of a today's trip on staging, with the site's key in the page and Stripe in test mode (Charlie).
- [ ] Optional: today's backend builds Stripe's "back" link and Admin's one-click links with the new addresses (Charlie).
- [ ] Each trip loaded into the booking system is switched on for instant booking in a rebuild of the pack (Ewan).
- [ ] The Island Hopper's $99 deposit, the free night yes or no, and the Ask Ewan question type are live and tested (Charlie,
      briefs in the launch switch doc).
- [x] (Checked 18 Nov: the live page sends no `Permissions-Policy` and Chrome allows the mic there. Check again on launch day.)
      The site's `Permissions-Policy` allows the microphone on `/all-in-trips/` (`microphone=(self)`), or sets nothing for it
      (Charlie or Dhany).
- [ ] A line in the privacy notice about talking instead of typing (whoever looks after it; wording in README).
- [x] The test requests MM-B2UDR5 and MM-WRHXG5 are cleared in Admin (Ewan, 18 Nov).
- [x] The trips' new names are in (Ewan, 21 Nov), with the same addresses and prices; The Big One is at `/all-asia`.
- [x] The ALL IN business WhatsApp, +66 96 689 4646, is on the page and in the trip builder's Ask Ewan (Ewan, 24 Nov).

## On the day

- [ ] Ewan says go.
- [ ] Upload `all-in-trips/`: `index.html` at `/all-in-trips`, the 13 trip addresses and today's 7, `v/` at `/all-in-trips/v/`
      (Charlie).
- [ ] The site's public key in the page's `<head>` (`window.ALLIN_LIVE`, README "Hosting it") (Charlie).
- [ ] Cookiebot and Google Tag Manager pasted where the page's comments say (Charlie).
- [ ] The builder switch: the two config lines, the sync, commit and deploy (Charlie).
- [ ] Cloudflare cleared for `/all-in-trips*` (Dhany).

## Checks, on a phone (iPhone Safari, Android Chrome) and a laptop (Chrome, Safari)

- [ ] `madmonkeyhostels.com/all-in-trips` opens the new site, with no "Concept" bar and no preview notes.
- [ ] `/all-in-trips/vietnam` (and a festival one, like `/all-in-trips/yipeng`) opens that trip; Back closes it.
- [ ] Vietnam's hero slide, card and trip page play Ewan's Ha Giang clip; photos are sharp.
- [ ] `/all-in-trips/cambodia-14` opens today's Cambodia trip with real dates and prices; pick a date, fill in the details,
      Continue to payment opens Stripe (don't pay), and Stripe's back link returns to the trip.
- [ ] "Not sure which one?": tap the mic, allow it, say "two weeks in March, love a waterfall, about 1,000 dollars". The words
      appear as you talk; tap to stop; Find my trip shows trips that fit.
- [ ] Say no to the mic (or on a phone where it's been turned off): the mic goes, and a note points to the keyboard's mic.
- [ ] In Firefox there's no mic, and typing works as before.
- [ ] "Make it yours" opens the trip builder with the trip in it, wearing the ALL IN bar and menu; "Back to the trip" comes back.
- [ ] Tell the finder something with a TikTok link in it, then send one test trip. In Admin, the notes show the link and the
      words, and the crew's text has them in full. Clear it.
- [ ] Send one Ask Ewan test question; check it in Admin and in Ewan's email; clear it.
- [ ] On a trip page, on a phone and a laptop: Ask Ewan and Book are in the bar at the bottom. Under the Ask Ewan form, "Rather
      WhatsApp?" opens WhatsApp to +66 96 689 4646 with the trip in the message; the footer's WhatsApp link opens the same chat.
      Send one test message and check it reaches the ALL IN WhatsApp.
- [ ] With Tag Manager's preview on: `view_item` when a trip opens, `generate_lead` when a trip is sent; the Cookiebot banner shows.

## After

- [ ] Watch Admin for the first real trips and questions (Ewan).
- [ ] Old links to `/all-in-trips/vietnam`, `/cambodia`, `/indonesia`, `/laos`, `/thailand` and `/all-asia` land on the new
      trip pages (`/all-asia` is The Big One).
