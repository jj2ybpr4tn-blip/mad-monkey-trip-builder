# Group mode: backend contract

Group mode (plan with mates, vote on stops, Squad Leader perk ticks up) works out of the box in **demo mode**:
votes are stored in the browser and sync between tabs of the *same* browser, so you can see it live, but friends on other phones
will not see each other. To make it real, point `GROUP_ENDPOINT` in `config.js` at a service implementing this REST contract.
Every operation is **per member** on purpose: two mates voting at the same instant must not overwrite each other.

| Call | Body | Returns |
|---|---|---|
| `POST /groups` | `{ id, trip, organiser:{id,name}, created, members:[] }` | `{ id }` (or echo the group) |
| `GET /groups/:id` | | the group (below) or `404` |
| `POST /groups/:id/members` | `{ name }` | `{ member:{ id, name, in:false, votes:{} } }` |
| `PATCH /groups/:id/members/:memberId` | `{ in?: boolean, votes?: { "<key>": "y"\|"m"\|"n" } }` (votes are **merged**) | `200` |

```jsonc
{
  "id": "bud3vh",
  "trip": "i=a.vietnam~s.saigon.3&c=0",          // the builder's share-link state: open with #/build/<trip>
  "organiser": { "id": "k3m9x2pq", "name": "Ewan" },
  "created": "2026-10-15T08:00:00.000Z",
  "members": [ { "id": "z8c4nw2a", "name": "Sam", "in": true, "votes": { "0:allin-vietnam": "y", "1:saigon": "m" } } ]
}
```

- Vote keys are `<stop index>:<place id>` (or `<index>:allin-<trip id>` for an ALL IN block).
- The client polls `GET /groups/:id` every 5 seconds. A websocket / SSE push would be nicer later.
- The organiser is whoever created it on their device (an id kept in `localStorage`). This is a friendly-trust model, not security. Don't put anything private in a group.
- The Squad Leader perk (3 mates = 50% off, 6 = free) only applies to **ALL IN** trips and to the leader's own ticket; the app shows it but never grants it. Your booking engine does.
- CORS for the site's origin is required. Add your own rate limiting and expiry (e.g. delete after 90 days).


## Plan together, Route A/B and meet-ups (added Oct 2026)

Group shape now also carries:

```
alt: '<encodeState>' | ''                 Route B, put up for a vote by the organiser
members[].wants: ['p:<place>', 'a:<actId>']   stops suggested + activities hearted ("Sam wants Pai")
members[].votes.route: 'a' | 'b'          vote between Route A (trip) and Route B (alt)
members[].trip: '<encodeState>'           a mate's own route, for "where you cross"
```

Endpoints:

- `PATCH /groups/:id/members/:mid` accepts `wants` (max 24, `p:`/`a:` keys only), `trip`, and `votes.route`.
- `PATCH /groups/:id` with `{ org, trip?, alt?, clearRouteVotes? }`. Organiser only: `org` must equal the organiser id returned when the group was created. `GET` never returns that id.

The organiser is also added as a member when they create a group, so they can vote and suggest too.
