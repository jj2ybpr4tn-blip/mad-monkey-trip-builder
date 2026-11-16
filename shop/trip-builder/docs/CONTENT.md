# Keeping the facts fresh

The Trip Doctor, the visa check, the festival calendar and "Know before you go" are only as good as the facts behind them. They were drafted in October 2026 from public sources and need a person to own them.

| What | File | Re-check | Who should own it |
|---|---|---|---|
| Visa-free days and e-visa limits per passport | `data/rules.js` (`MM.STAY`), text in `data/entry.js` | Every 3 months, and the day any country announces a change | Ops |
| Festivals, closures and peak weeks | `data/rules.js` (`MM.CALENDAR`) | Each autumn for next year. Dates with `conf: false` are forecasts | Ops |
| Money, SIMs, scooters, safety, manners, health per country; local tips per hostel | `data/guide.js` | Every 6 months. Each country's crew should add what only a local knows | Country crews |
| One "don't miss" activity per hostel | `data/activities.js` (`MM.DONT_MISS`) | When products change | Product |
| Hostel address, check-in time, phone, directions (shown in the trip pack) | Crew console, **Hostel details** tab | Once, then when something changes | Each hostel |
| Hand-picked themed trips | `extras.js` (`MM.THEMES`) | Seasonally | Product |

## Rules of thumb

- If a rule matters (a visa, a licence, a closure), the app says "check the official site" and links to it. Don't remove that.
- Mark anything you're unsure of `conf: false` in the calendar. The app tells guests it's a forecast.
- After any change, run `npm test`, then `npm run build-pages` so the Google pages carry the same facts.

## Trip Doctor

`MM.doctor(state, { passport })` scores a trip and returns findings, each with an optional one-tap fix (add a night, swap an overnight bus, shift the start date). It flags back-to-back night journeys, very long single journeys, one-night stops, too many stops, odd-hour arrivals, long journeys right after a big activity, visa length and festival or closure clashes. Tune the thresholds in `extras.js`. The eight themed trips are tested to come out clean.
