# Where next?

A step in hostel check-in that sells ALL IN trips. The guest sees our trips, the most likely first, each with its first departure after they check out, and ticks the ones they'd like details on. That's all they're asked. The crew then has one list of who ticked what, leaving soonest first, with the message written, so someone can reach them while they're still with us and before they book their next stop somewhere else.

Look: the ALL IN trip guide (black page, a neon strip, Bungee headings, a row per trip with a photo, a days badge and a price block in the trip's colour).

## The guest's page

`#/wherenext/h=<hostel>&out=<YYYY-MM-DD>&b=<booking ref>&n=<first name>&back=<check-in URL>`

| Value | What it is | If it's missing or wrong |
| --- | --- | --- |
| `h` | The hostel's id in `data/places.js` (`hanoi`, `hoi-an`, `phnom-penh`…) | The page is the demo (Hanoi, a few days out, with a bar to change hostel and date) |
| `out` | Their check-out date | "You're all checked in", and departures count from today |
| `b` | The booking reference, so the answer joins up with the booking (and its contact details) | Saved without one |
| `n` | Their first name, for "Hey Sam" | No name |
| `back` | Where to send them to finish checking in | Only followed when its host is in `WHERENEXT_RETURN`; anything else is ignored, so the page can't send a guest to a stranger's site |

What they see:

- **Every live ALL IN as a row**, ordered for that hostel: trips that start there first, then the nearest start, nudged by where Mad Monkey guests go next from there. Each row has the days, the route, the next departure ("Sun 13 Dec · 4 days after you check out": the same day when it starts at this hostel, a day later at the earliest when they'd have to get there) and that month's price. Dates not on sale yet are left out.
- **"Plan my own"** at the end, for anyone heading somewhere without an ALL IN.
- One line: *"We'll message you about the trips you tick, and only those. Nothing is booked, and flights are never included."* The tick is their permission for those trips only.
- **Not interested** and **Next**, side by side and always on screen. Next with nothing ticked asks them to tick a trip or press Not interested. Either way check-in carries on: "Sorted. We'll be in touch." (or "No worries. Enjoy Hanoi."), then back to check-in after 3 seconds, or straight away with the button.

The builder's menus are hidden on this page, so it reads as part of check-in.

What is saved, per guest: `{ hostel, booking, checkout, name, trips: ['laos', 'loop', 'builder'…], consent, at }`. `trips` is empty for "Not interested" (and `consent` is blank). If sending fails, check-in still carries on; the worst case is one missed answer.

## The crew's list

`#/wherenext-crew`: everyone who ticked something and hasn't checked out yet, soonest first.

- **Stats:** answered, the share who ticked a trip, the most wanted trip, and how many leave in the next 3 days.
- **Filters:** hostel and trip.
- **Each guest:** their hostel, check-out and booking, each trip they ticked with its next departure after they check out, a **WhatsApp** or **Email** button (their channel from the booking) with the message written, **Copy the message**, and where they are: *Not messaged yet, Messaged, Booked, Not now*.
- **The message** (`MM.whereNextMsg`): signed with the name in "I'm…", each ticked trip's next date, length, price and link, "$99 holds your spot", and **"Flights to get there aren't included."** Links are tagged `utm_source=checkin&utm_medium=where-next`, so a booking can be traced back to check-in.

Follow-up we'd suggest: one message the day after check-in, a nudge two days before check-out, then stop.

## Switching it on

- **Demo** (`WHERENEXT_ENDPOINT` blank): answers stay on this device, and the list shows made-up sample guests (example.com addresses, UK drama-range numbers) plus anything answered on this device.
- **Live** needs:
  1. **Check-in:** a step before check-in completes that shows this page, or a link to it, with the values above. **`WHERENEXT_RETURN`** = the check-in system's host name(s).
  2. **`WHERENEXT_ENDPOINT`**: a POST of the answer above. Store it, joined to the booking by `booking` for the guest's contact details and channel. Keep the consent line with it.
  3. **`trip-builder-admin`** (`CREW_ENDPOINT`, admin password), like Find your crew's calls:

     | Action | Sends | Answers |
     | --- | --- | --- |
     | `wherenext-list` | `{ password }` | `{ ok, guests: [{ id, name, hostel, checkout, booking, via, email, whatsapp, trips, status, at }] }` for answers whose check-out hasn't passed. 401 for a wrong password. |
     | `wherenext-status` | `{ password, id, status, by }`, status one of `new`, `messaged`, `booked`, `no` | `{ ok }` |

     The list cleans everything again (known hostels and trips only, plain text), so a backend that sends a little too much can't show anything it shouldn't.
  4. **Permission:** check-in is compulsory, so the tick must stay optional and only cover the trips ticked. Have whoever handles legal check the wording for the countries the hostels are in. Message from a WhatsApp Business number, by a person.

## Tests

`test/logic.test.js` (the order, departures, prices, sales window and the message) and, in a browser on the builder, `test/ui-wherenext.js`: `await import('/test/ui-wherenext.js?' + Date.now()); await __wherenext()` (the page from a real link, ticks, Next / Not interested, what is saved, the way back, hostile link values, the demo controls, and the crew's list).
