# Editing your trip, and the AI chat

After the quiz a traveller isn't stuck with what they were given. Everything about the trip can be changed on the screen, and there is a chat where they say what they want and watch it happen.

## What a traveller can do

On the trip screen (`#/build/...`):

| To | They |
|---|---|
| Take something out | `×` on a stop, or on a tour in the day-by-day plan |
| Add a stop | "+ Add a stop in between" between two stops, "+ Stop at the start", or the map |
| Swap a stop for another place | `⇄` on the stop (keeps the nights) |
| Reorder | `↑` / `↓` on a stop, or drag |
| Change nights | `+` / `−` on the stop |
| Move a tour to another day | the day picker beside it, in "Day by day" |
| Add a tour to a particular day | "+ Add a tour on this day…" in "Day by day" |
| Take anything back | **Undo** / **Redo** in the bar above the itinerary, the Undo on every toast, or Cmd/Ctrl+Z (Shift for redo) |
| Change it by talking | **Chat to change it** (the pink button; floats bottom right) |

Nothing is ever lost: "Start over", removing a stop and every chat change all have Undo. History is 60 steps long and lives in the browser only.

## How the editing works (`edit.js`)

One module, `MM.edit`, is the only way the trip changes shape. The buttons, the day-by-day editor, the quick helper and the AI all call it.

- `MM.edit.apply(state, ops)` applies a list of operations **all or nothing**. If any fails you get the reasons and the original is untouched.
- Operations: `add_stop`, `remove_stop`, `move_stop`, `set_nights`, `swap_stop`, `add_tour`, `remove_tour`, `move_tour`, `unpin_tour`, `set_start`, `set_style`, `set_travel`, `set_spending`, `set_budget`, `clear`.
- Stops and days are numbered the way the traveller sees them (stop 2, day 6). Places and tours are ids or plain names ("Ho Chi Minh", "cooking class").
- ALL IN trips are packaged by the crew: they can be removed or moved but their nights and tours can't be edited.
- A tour moved to a particular day is *pinned* (`item.pins`). The scheduler honours pins first, warns if the tour doesn't run that weekday, and pins ride along in share links (`code@N`).
- Tests: `test/logic.test.js` ("editing").

## The chat

```
traveller's browser                      Edge Function                    Claude
ui-chat.js + chat.js   --{messages}-->   trip-builder-chat   --request-->   (claude-opus-5-5 by default)
 runs the tool calls   <--{content}---   adds system prompt, tools,  <--response--
 against MM.edit                         model, limits, API key
```

- **The browser only sends the conversation.** The system prompt, tools, model, effort and limits are all on the server (`chat-spec.json` is the single source for the prompt and tools; the sync script copies it into the function). Nobody can use the endpoint as a general Claude.
- **The tools run in the browser.** `get_trip`, `search_places`, `search_tours`, `get_travel` and `edit_trip` all work on the traveller's own trip on their own screen, through `MM.edit`. The server holds no conversation and no data. Every AI change is validated the same way a button press is, and shows up as a receipt with an Undo.
- **The trip is told to the AI as `<trip_state>`** at the top of the message, and again whenever it has changed since (including when the traveller edits by hand).
- **History only ever grows.** Claude's thinking blocks are only valid if the conversation is replayed exactly, so nothing earlier is rewritten. If the server ever can't read a history it answers 422 and the builder starts the conversation again with the trip as it is.
- **If the AI can't be reached** (not switched on, down, rate limited) the builder says so and uses the **quick helper** (`MM.chat.local`): short instructions in plain words ("remove Hoi An", "add Bangkok for 3 nights", "swap Hanoi for Bangkok", "start on 3 March", "budget $2000"). It needs no AI and is also what the demo site uses.

### Files

| File | |
|---|---|
| `edit.js` | the operations (above), the trip as text, the tool executors |
| `chat.js` | the quick helper and the AI conversation loop (no screen code; tested in Node) |
| `ui-chat.js` | the panel, the button, receipts and Undo |
| `chat-spec.json` | the system prompt and tool definitions the server uses |
| `config.js` | `CHAT_ENDPOINT` (blank = quick helper only) |
| `test/chat.test.js` | helper, loop and spec checks |

### Switching the AI on (ALL IN site)

The function, its migration and its tests are patch `0004` in `handoff/all-in-backend/`.

1. Apply the `trip_builder_chat_usage` migration (it holds the daily counters).
2. Set the secret `ANTHROPIC_API_KEY` for the project (Supabase > Edge Functions > Secrets), from the Anthropic Console. Someone has to own the bill: see Cost.
3. Deploy `trip-builder-chat`.
4. The live `config.js` already points `CHAT_ENDPOINT` at it (the sync script adds it). Until the key is set the function answers `503 not_configured` and the builder quietly uses the quick helper, so the order doesn't matter and nothing breaks.

Optional secrets: `TRIP_CHAT_MODEL` (default `claude-opus-5-5`), `TRIP_CHAT_EFFORT` (`low` / `medium` / `high`, default `medium`), `TRIP_CHAT_MAX_TOKENS` (default 6000, thinking counts), `TRIP_CHAT_IP_DAILY` (default 60 calls per person a day), `TRIP_CHAT_DAILY` (default 1500 a day across everyone), `TRIP_CHAT_ORIGINS` (comma list of allowed site origins), `TRIP_CHAT_ENABLED=false` (off switch).

### Cost

Charged by Anthropic per token. A chat message is one to four calls to the model (it looks things up, then edits, then talks). Roughly 5–8 thousand tokens in and under 1.5 thousand out per call, with the system prompt and tools cached.

| Model (`TRIP_CHAT_MODEL`) | $ per million tokens in / out | Roughly per chat message |
|---|---|---|
| `claude-opus-5-5` (default) | 4 / 20 | 5 to 15 cents |
| `claude-sonnet-5-5` | 2 / 10 | 2 to 8 cents |
| `claude-haiku-5-5` | 0.10 / 0.50 | well under a cent |

Those are estimates from the size of the prompts, not measured on real traffic; the function logs one line per call (`trip_chat`, with token counts) so the real figure is easy to read from the function logs. The daily limits are the ceiling: at the defaults the worst case is 1500 calls a day, so keep an eye on it for the first week and lower `TRIP_CHAT_DAILY` or move to Sonnet if needed. Opus and Fable models also get server-side refusal fallbacks (`fallbacks: "default"`); the cheaper models don't.

### Privacy

The chat sends the traveller's messages and their trip (stops, tours, dates, budget) to Anthropic to write the answers, and says so under the message box. It never asks for or forwards contact details, and the function doesn't log message text. People are counted by a salted hash of their IP, never the address.

### Tests

- `npm test` runs `test/chat.test.js` (70 checks: the quick helper, the conversation loop against a scripted model, failure handling, the spec).
- In the ALL IN repo: the function's checks are `supabase/functions/_shared/trip-builder-chat.test.ts` (Deno), and `handoff/all-in-backend/e2e/run.sh <repo>` runs the real builder code against the real function against a fake Claude on localhost (37 checks).
- Not tested: a real call to Claude. Nothing here has talked to the live API, so the first real conversation is the first real test. Try a few messages with the key set before telling anyone.
