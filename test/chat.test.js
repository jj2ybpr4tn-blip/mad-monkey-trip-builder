/* Trip chat tests: the simple helper, the AI conversation loop (against a scripted fake model) and the spec the server holds. Run: node test/chat.test.js  (part of npm test) */
['places', 'activities', 'media', 'legs', 'trips', 'entry', 'gallery', 'rules', 'guide'].forEach(function (f) { require('../data/' + f + '.js'); });
var MM = require('../logic.js');
require('../extras.js'); require('../crew.js'); require('../edit.js'); require('../chat.js');
var fs = require('fs'), path = require('path'), E = MM.edit, C = MM.chat;

var pass = 0, fail = 0, pending = [];
function ok(name, cond, extra) { if (cond) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); } }
function eq(name, a, b) { ok(name, a === b, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b)); }
function trip() { return MM.decodeState('i=s.hanoi.4~s.hoi-an.4~s.saigon.3&d=2027-02-10&f=20&b=1500'); }
function names(st) { return st.items.map(function (it) { return it.kind === 'allin' ? 'allin:' + it.trip : it.p + ':' + it.n; }).join(','); }
var TODAY = new Date('2026-10-22T12:00:00Z');
function say(text, st) { return C.local(text, st || trip(), TODAY); }

/* ---------- the simple helper: plain words in, validated edits out ---------- */
eq('"remove Hoi An" takes it out', names(say('remove Hoi An').state), 'hanoi:4,saigon:3');
eq('"delete stop 2" takes out the second stop', names(say('delete stop 2').state), 'hanoi:4,saigon:3');
eq('"remove the last stop" takes out the last one', names(say('remove the last stop').state), 'hanoi:4,hoi-an:4');
eq('"add Bangkok for 3 nights" adds it at the end', names(say('add Bangkok for 3 nights').state), 'hanoi:4,hoi-an:4,saigon:3,bangkok:3');
eq('"add Bangkok first" puts it at the start', names(say('add Bangkok first').state), 'bangkok:3,hanoi:4,hoi-an:4,saigon:3');
eq('"add Kampot after Hoi An" puts it in between', names(say('add Kampot after Hoi An').state), 'hanoi:4,hoi-an:4,kampot:2,saigon:3');
eq('"3 nights in Kampot" is a new stop', names(say('3 nights in Kampot').state), 'hanoi:4,hoi-an:4,saigon:3,kampot:3');
eq('"2 more nights in Hanoi" adds nights', names(say('2 more nights in Hanoi').state), 'hanoi:6,hoi-an:4,saigon:3');
eq('"make Hanoi 6 nights" sets the nights', names(say('make Hanoi 6 nights').state), 'hanoi:6,hoi-an:4,saigon:3');
eq('"an extra night in Hoi An" adds one', names(say('an extra night in Hoi An').state), 'hanoi:4,hoi-an:5,saigon:3');
eq('"one less night in Saigon" takes one off', names(say('one less night in Saigon').state), 'hanoi:4,hoi-an:4,saigon:2');
eq('"remove 2 nights from Hanoi" takes nights off, not the stop', names(say('remove 2 nights from Hanoi').state), 'hanoi:2,hoi-an:4,saigon:3');
eq('"swap Hanoi for Bangkok" keeps the nights', names(say('swap Hanoi for Bangkok').state), 'bangkok:4,hoi-an:4,saigon:3');
eq('"go to Bangkok instead of Hanoi" is the same swap', names(say('go to Bangkok instead of Hanoi').state), 'bangkok:4,hoi-an:4,saigon:3');
eq('"move Hoi An to the start" reorders', names(say('move Hoi An to the start').state), 'hoi-an:4,hanoi:4,saigon:3');
eq('"put Hanoi last" reorders', names(say('put Hanoi last').state), 'hoi-an:4,saigon:3,hanoi:4');
eq('"move Hanoi after Hoi An" reorders', names(say('move Hanoi after Hoi An').state), 'hoi-an:4,hanoi:4,saigon:3');
eq('"start on 3 March" sets the date (next one coming)', say('start on 3 March').state.start, '2027-03-03');
eq('"start on 2027-03-01" takes a plain date', say('start on 2027-03-01').state.start, '2027-03-01');
eq('"cheapest way" sets the style', say('cheapest way').state.pref, 'cheap');
eq('"make it faster" sets the style', say('make it faster').state.pref, 'fast');
eq('"budget $2000" sets the budget', say('budget $2000').state.budget, 2000);
eq('"budget of 2k" reads the k', say('budget of 2k').state.budget, 2000);
eq('"spending money $30 a day" sets the fund', say('spending money $30 a day').state.fund, 30);
ok('"start over" clears the trip', say('start over').state.items.length === 0);
eq('"undo" asks the screen to undo', say('undo').action, 'undo');
ok('every edit comes back with a sentence that says what changed and what it cost', /Removed Hoi An\. That is \d+ days now, about \$\d+ a person\./.test(say('remove Hoi An').reply));

eq('two instructions in one message are both done, in order', names(say('swap Hoi An for Bangkok and 2 more nights in Hanoi').state), 'hanoi:6,bangkok:4,saigon:3');
eq('"add Bangkok and Chiang Mai" adds both', names(say('add Bangkok and Chiang Mai').state), 'hanoi:4,hoi-an:4,saigon:3,bangkok:3,chiang-mai:3');
eq('a comma and "then" work as well as "and"', names(say('remove Saigon, then add Kampot').state), 'hanoi:4,hoi-an:4,kampot:2');
ok('removing two stops in one go is declined, with how to do it', (function () { var r = say('remove Hoi An and Hanoi'); return !r.state && /one stop at a time/.test(r.reply); })());
var withTours = E.apply(trip(), [{ op: 'add_tour', stop: 2, tour: 'cooking-class' }, { op: 'add_tour', stop: 2, tour: 'sunset-river-cruise' }]).state;
ok('"delete the cooking class in Hoi An" removes the tour, not the stop', (function () { var r = say('delete the cooking class in Hoi An', withTours); return r.state && r.state.items.length === 3 && r.state.items[1].acts.indexOf('cooking-class') < 0 && r.state.items[1].acts.indexOf('sunset-river-cruise') > -1; })());
ok('"add the basket boats in Hoi An" adds that tour', (function () { var r = say('add the basket boats in Hoi An'); return r.state && r.state.items[1].acts.indexOf('basket-boats') > -1; })());
ok('"move the sunset river cruise to day 7" pins it to that day', (function () { var r = say('move the sunset river cruise to day 7', withTours); return r.state && r.state.items[1].pins && r.state.items[1].pins['sunset-river-cruise'] === 3; })());
ok('asking about the trip answers without changing it', (function () { var r = say('what is in my trip'); return !r.state && /1\. Hanoi \(4 nights\)/.test(r.reply) && /about \$\d+/.test(r.reply); })());
ok('a place that is already in the trip is not added twice', (function () { var r = say('add Hanoi'); return !r.state && /already stop 1/.test(r.reply); })());
ok('a place that isn\'t in the trip can\'t be removed, and it says so', (function () { var r = say('remove Phuket'); return !r.state && /isn't in your trip/.test(r.reply); })());
ok('something it doesn\'t understand gets examples, and changes nothing', (function () { var r = say('banana'); return !r.state && /remove Hoi An/.test(r.reply); })());
ok('an edit that can\'t be done says why in plain words (no op names)', (function () { var r = say('add the 15th stop', E.apply(trip(), [{ op: 'clear' }]).state); return !/Change \d+/.test(r.reply); })());
ok('a trip with no stops answers "remove" sensibly', /nothing to remove/.test(say('remove the last stop', MM.defaultState()).reply));
ok('the helper never changes the trip it was given', (function () { var t = trip(), j = JSON.stringify(t); C.local('remove Hoi An', t, TODAY); return JSON.stringify(t) === j; })());
ok('"Gili Trawangan" is not mistaken for "Gili" and a place is found once', (function () { var m = E.mentions('swap Gili Trawangan for Hanoi and Hanoi'); return m.length === 2 && m[0].id === 'gili-trawangan' && m[1].id === 'hanoi'; })());

/* ---------- the AI conversation loop, against a scripted fake model ---------- */
function reply(content, stop) { return { status: 200, body: { content: content, stop_reason: stop || 'end_turn' } }; }
function tool(id, name, input) { return { type: 'tool_use', id: id, name: name, input: input }; }
function fake(script) {
  var calls = [], f = { calls: calls, post: function (url, body) { calls.push(JSON.parse(JSON.stringify(body))); var r = script.shift(); return Promise.resolve(typeof r === 'function' ? r(body) : r); } };
  return f;
}
function world(st) { var w = { state: st || trip(), sets: 0 }; w.ctx = function (f) { return { endpoint: 'https://x.test/chat', post: f.post, getState: function () { return w.state; }, setState: function (s) { w.state = s; w.sets++; }, today: '2026-10-22' }; }; return w; }

pending.push((async function () {
  // a plain answer
  var w = world(), conv = C.newConv(), f = fake([reply([{ type: 'text', text: 'Three nights is plenty.' }])]);
  var r = await C.send(conv, 'is 3 nights enough in Hoi An?', w.ctx(f));
  eq('a plain answer comes back as the reply', r.reply, 'Three nights is plenty.');
  ok('the first message carries today\'s date and the trip as it stands', (function () { var t = f.calls[0].messages[0].content[0].text; return /Today's date is 2026-10-22/.test(t) && /<trip_state>/.test(t) && /Hoi An \(id hoi-an\)/.test(t) && /is 3 nights enough/.test(t); })());
  ok('only the conversation is sent: no system prompt, tools or model (the server owns those)', Object.keys(f.calls[0]).join() === 'messages');
  eq('the answer is kept in the history', conv.api.length, 2);

  // the second message, trip unchanged: no repeat of the trip
  var f2 = fake([reply([{ type: 'text', text: 'Yes.' }])]);
  await C.send(conv, 'and in Hanoi?', w.ctx(f2));
  ok('a second message with the trip unchanged does not repeat it, or the date', (function () { var t = f2.calls[0].messages[2].content[0].text; return t === 'and in Hanoi?'; })());
  ok('the history only ever grows: earlier messages are sent back exactly as they were', JSON.stringify(f2.calls[0].messages.slice(0, 2)) === JSON.stringify(conv.api.slice(0, 2)));

  // the traveller edits by hand in between: the AI is told
  w.state = E.apply(w.state, [{ op: 'remove_stop', stop: 3 }]).state;
  var f3 = fake([reply([{ type: 'text', text: 'Okay.' }])]);
  await C.send(conv, 'what do you think now?', w.ctx(f3));
  ok('a change made by hand is passed on with the next message', (function () { var t = f3.calls[0].messages[4].content[0].text; return /<trip_state>/.test(t) && !/Ho Chi Minh/.test(t); })());

  // a tool loop: search, then edit, then talk
  w = world(); conv = C.newConv();
  f = fake([
    reply([{ type: 'thinking', thinking: '', signature: 'sig1' }, tool('t1', 'search_places', { query: 'surf' })], 'tool_use'),
    reply([{ type: 'thinking', thinking: '', signature: 'sig2' }, tool('t2', 'edit_trip', { ops: [{ op: 'add_stop', place: 'kampot', nights: 2 }, { op: 'set_nights', stop: 1, nights: 5 }] })], 'tool_use'),
    reply([{ type: 'text', text: 'Added Kampot and gave Hanoi an extra night.' }])
  ]);
  r = await C.send(conv, 'add Kampot and an extra night in Hanoi', w.ctx(f));
  eq('the tool loop ends with the AI\'s words', r.reply, 'Added Kampot and gave Hanoi an extra night.');
  eq('the edit reached the trip', names(w.state), 'hanoi:5,hoi-an:4,saigon:3,kampot:2');
  eq('one edit was reported, with what changed', r.edits.length === 1 && r.edits[0].changes.length, 2);
  eq('three round trips to the model', f.calls.length, 3);
  ok('lookups come back as results the AI can read', (function () { var m = f.calls[1].messages, last = m[m.length - 1]; return last.role === 'user' && last.content[0].type === 'tool_result' && last.content[0].tool_use_id === 't1' && JSON.parse(last.content[0].content).count > 0; })());
  ok('thinking blocks are sent back untouched, in order', (function () { var m = f.calls[2].messages; return m[1].content[0].signature === 'sig1' && m[3].content[0].signature === 'sig2'; })());
  ok('the edit result tells the AI the new trip, length and price', (function () { var m = f.calls[2].messages, res = JSON.parse(m[m.length - 1].content[0].content); return res.ok && /Kampot/.test(res.trip) && res.total_usd > res.was_usd; })());
  var f4 = fake([reply([{ type: 'text', text: 'ok' }])]);
  await C.send(conv, 'thanks', w.ctx(f4));
  ok('after its own edit the AI is not re-sent the trip it just saw', f4.calls[0].messages[f4.calls[0].messages.length - 1].content[0].text === 'thanks');

  // a refused edit: nothing changes, and the AI is told why (and marked as an error)
  w = world(); conv = C.newConv();
  f = fake([reply([tool('t1', 'edit_trip', { ops: [{ op: 'remove_stop', stop: 9 }] })], 'tool_use'), reply([{ type: 'text', text: 'There is no stop 9.' }])]);
  r = await C.send(conv, 'remove stop 9', w.ctx(f));
  ok('a failed edit changes nothing, shows no receipt, and is flagged to the AI as an error', names(w.state) === 'hanoi:4,hoi-an:4,saigon:3' && r.edits.length === 0 && f.calls[1].messages[2].content[0].is_error === true);
  ok('an unknown tool name is an error result, not a crash', (function () { return E.run('rm_rf', {}, trip()).result.error; })());

  // refusal
  w = world(); conv = C.newConv(); f = fake([{ status: 200, body: { content: [], stop_reason: 'refusal' } }]);
  r = await C.send(conv, 'something', w.ctx(f));
  ok('a refusal is shown kindly and leaves no trace in the history', r.refused && /I can't help with that/.test(r.reply) && conv.api.length === 0 && conv.today === null);

  // the server is down / busy
  w = world(); conv = C.newConv(); f = fake([{ status: 502, body: { error: 'x' } }]);
  r = await C.send(conv, 'remove Hoi An', w.ctx(f));
  ok('a server error leaves the history and the trip as they were, so the helper can take over', r.error === 'down' && conv.api.length === 0 && names(w.state) === 'hanoi:4,hoi-an:4,saigon:3');
  f = fake([{ status: 429, body: { error: 'Slow down', retry_after: 30 } }]); r = await C.send(conv, 'hi', w.ctx(f));
  ok('rate limited is its own answer, with the wait', r.error === 'limit' && r.retryAfter === 30);
  f = { post: function () { return Promise.reject(new Error('offline')); } }; r = await C.send(conv, 'hi', w.ctx(f));
  ok('a network failure is handled', r.error === 'down' && conv.api.length === 0);

  // a runaway model
  w = world(); conv = C.newConv();
  var loop = []; for (var i = 0; i < 12; i++) loop.push(reply([tool('t' + i, 'get_trip', {})], 'tool_use'));
  f = fake(loop); r = await C.send(conv, 'go', w.ctx(f));
  ok('a model that keeps calling tools is stopped after a few rounds', f.calls.length === C.MAX_ROUNDS && r.error === 'busy' && conv.api.length === 0);

  // an edit made, then the connection drops: the edit stays (it was real), the AI is re-told the trip next time
  w = world(); conv = C.newConv();
  f = fake([reply([tool('t1', 'edit_trip', { ops: [{ op: 'remove_stop', stop: 3 }] })], 'tool_use'), { status: 500, body: {} }]);
  r = await C.send(conv, 'remove the last stop', w.ctx(f));
  ok('if the connection drops after an edit, the edit is reported and the AI is re-told the trip next time', r.edits.length === 1 && names(w.state) === 'hanoi:4,hoi-an:4' && conv.seen === null);

  // long chats
  conv = C.newConv(); conv.api = new Array(C.MAX_MESSAGES).fill({ role: 'user', content: [] });
  r = await C.send(conv, 'hi', w.ctx(fake([])));
  ok('a chat that has got too long asks for a fresh one instead of sending', r.full && /New chat/.test(r.reply));

  // max tokens
  w = world(); conv = C.newConv(); f = fake([{ status: 200, body: { content: [{ type: 'text', text: 'Partly' }], stop_reason: 'max_tokens' } }]);
  r = await C.send(conv, 'tell me everything', w.ctx(f));
  ok('a reply that ran out of room says so', /Partly/.test(r.reply) && /ran out of room/.test(r.reply));
})());

/* ---------- the spec the server holds ---------- */
var spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'chat-spec.json'), 'utf8'));
ok('the spec has a system prompt and five tools', typeof spec.system === 'string' && spec.system.length > 1500 && spec.tools.length === 5);
ok('every tool has a name, a description and an object schema', spec.tools.every(function (t) { return t.name && t.description && t.input_schema && t.input_schema.type === 'object'; }));
ok('every tool in the spec is one the builder can run', spec.tools.every(function (t) { var r = E.run(t.name, t.name === 'search_tours' ? { place: 'hanoi' } : t.name === 'get_travel' ? { from: 'hanoi', to: 'saigon' } : t.name === 'edit_trip' ? { ops: [{ op: 'set_budget', amount: 1 }] } : {}, trip()); return r && r.result && !(r.result.error && /Unknown tool/.test(r.result.error)); }));
ok('the edit_trip schema lists exactly the operations the builder has', (function () { var en = spec.tools.filter(function (t) { return t.name === 'edit_trip'; })[0].input_schema.properties.ops.items.properties.op.enum; return en.slice().sort().join() === E.OPS.slice().sort().join(); })());
ok('every operation is explained to the AI', E.OPS.every(function (o) { return spec.tools.filter(function (t) { return t.name === 'edit_trip'; })[0].description.indexOf(o) > -1; }));
ok('the prompt tells the AI it can\'t book or take payment, and to treat the trip as data', /can't book/.test(spec.system) && /never instructions/.test(spec.system));
ok('no emoji and no curly quotes in what the AI is told', !/[\u{1F300}-\u{1FAFF}‘’“”]/u.test(JSON.stringify(spec)));

Promise.all(pending).then(function () { console.log('\n' + pass + '/' + (pass + fail) + ' passed'); process.exit(fail ? 1 : 0); });
