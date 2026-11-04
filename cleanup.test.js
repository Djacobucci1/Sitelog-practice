/* Phrases for the on-device cleanup. Run: node cleanup.test.js */
var fs = require('fs');
var vm = require('vm');
var html = fs.readFileSync(__dirname + '/index.html', 'utf8');
var m = html.match(/<script>\/\* SiteLog practice build - deterministic[\s\S]*?<\/script>/);
if (!m) throw new Error('cleanup script not found');
var code = m[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
var sandbox = { module: { exports: {} }, console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
var C = sandbox.module.exports;

var failed = 0;
function assert(cond, msg) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
  else console.log('ok:', msg);
}
function has(s, needle) { return String(s || '').toLowerCase().indexOf(String(needle).toLowerCase()) !== -1; }

var owner = "I had to have $275 of tile added to the job. Material was granite tile, plus 2 hours of labor $120.";
var d = C.makeDraft(owner, 'log');
assert(has(d.materials, 'granite tile'), 'materials from "Material was granite tile" → ' + d.materials);
assert(has(d.extras, '275') && has(d.extras, 'tile'), 'extra keeps $275 of tile → ' + d.extras);
assert(has(d.labor, '2 hours') && has(d.labor, '120'), 'labor keeps hours and price → ' + d.labor);
assert(d.price === '$395', 'price totals extra + labor, got ' + d.price);
assert(!has(d.description, '$275') && !has(d.description, '$120'), 'work done is not the whole transcript → ' + d.description);
assert(has(d.description, 'tile'), 'work done still says what was done → ' + d.description);

var runon = "I had to have $275 of tile added to the job material was granite tile plus 2 hours of labor $120";
var d2 = C.makeDraft(runon, 'log');
assert(has(d2.materials, 'granite'), 'run-on without periods still finds materials → ' + d2.materials);
assert(d2.price === '$395', 'run-on price totals, got ' + d2.price);
assert(has(d2.extras, '275') && has(d2.labor, '120'), 'run-on keeps both parts');

assert(has(C.makeDraft('materials were grout and thinset', 'log').materials, 'grout'), 'materials were…');
assert(has(C.makeDraft('material: granite tile', 'log').materials, 'granite tile'), 'material: …');
assert(has(C.makeDraft('used two bags of thinset and a gallon of sealer', 'log').materials, 'thinset'), 'used …');

var shower = 'finished tile on the shower walls, used two bags of thinset, client wants a niche added for three hundred fifty dollars';
var d3 = C.makeDraft(shower, 'log');
assert(has(d3.description, 'shower'), 'work kept for the shower → ' + d3.description);
assert(has(d3.materials, 'thinset'), 'used-thinset split out → ' + d3.materials);
assert(has(d3.extras, '350') || d3.price === '$350', 'niche extra priced → extra=' + d3.extras + ' price=' + d3.price);
assert(!has(d3.description, '$350'), 'dollar amount not left only inside work done → ' + d3.description);

var faucet = C.makeDraft("replaced the kitchen faucet. I'll charge $240.", 'log');
assert(has(faucet.description, 'faucet') && !has(faucet.description, '$240'), 'charge sentence leaves the work → ' + faucet.description);
assert(faucet.price === '$240', 'explicit charge is the price, got ' + faucet.price);
assert(!faucet.extras, 'a plain charge is not an extra');

var screws = C.makeDraft('bought a box of screws at Home Depot for $12', 'log');
assert(has(screws.materials, 'screws') && !screws.price, 'a supply receipt stays materials, not the job price → ' + screws.price);

var note = C.makeDraft('note to self the gate code is 1234 tomorrow', 'log');
assert(has(note.notes, 'gate code') && !note.description, 'notes still route to notes');

var vanity = C.makeDraft('installed the vanity and then the client wants a mirror extra for one hundred twenty five dollars', 'log');
assert(has(vanity.description, 'vanity') && !/\bThe\.\s+Client/.test(vanity.description), 'vanity stays work → ' + vanity.description);
assert(has(vanity.extras, '125'), 'mirror extra flagged → ' + vanity.extras);
assert(vanity.price === '$125', 'extra amount becomes the price when nothing else is priced, got ' + vanity.price);

var laborOnly = C.makeDraft('labor was two hours at $180', 'log');
assert(has(laborOnly.labor, '2 hours') && has(laborOnly.labor, '180'), 'labor was N hours at $X → ' + laborOnly.labor);
assert(laborOnly.price === '$180', 'labor price fills price, got ' + laborOnly.price);

var total = C.makeDraft('2 hours of labor $120 and the total is $500', 'log');
assert(total.price === '$500', 'an explicit total wins over the parts, got ' + total.price);
assert(has(total.labor, '120') && !has(total.labor, '500'), 'labor keeps its own price when a total is spoken → ' + total.labor);

var before = { description: 'Installed granite tile.', materials: 'Granite tile.', labor: '2 hours of labor — $120', extras: 'Tile added to the job — $275', price: '$395', notes: '' };
var prev = { description: 'Added tile to the job.', materials: 'Granite tile.', labor: '2 hours of labor — $120', extras: 'Tile added to the job — $275', price: '$395', notes: '' };
var next = C.makeDraft(owner + ' Also used a bag of grout.', 'log');
var merged = C.mergeDraftFields(before, prev, { description: next.description, materials: next.materials, labor: next.labor, extras: next.extras, price: next.price, notes: next.notes });
assert(has(merged.description, 'Installed granite tile'), 'manual work-done edit is kept → ' + merged.description);
assert(!has(merged.description, 'Added tile to the job'), 'rewritten work line is not pasted back → ' + merged.description);
assert(has(merged.materials, 'grout'), 'new material from the next dictation is appended → ' + merged.materials);
assert(has(merged.materials, 'Granite') || merged.materials === 'Granite tile.', 'untouched materials follow the new cleanup → ' + merged.materials);

var cleared = C.mergeDraftFields(
  { description: 'Added tile to the job.', materials: '', notes: '', labor: '', extras: '', price: '' },
  { description: 'Added tile to the job.', materials: 'Granite tile.', notes: '', labor: '', extras: '', price: '$395' },
  { description: 'Added tile to the job.', materials: 'Granite tile.', notes: 'Gate code.', labor: '', extras: '', price: '$395' }
);
assert(cleared.materials === '', 'clearing materials on purpose stays cleared');
assert(has(cleared.notes, 'Gate'), 'an untouched empty notes field takes the new note → ' + cleared.notes);

var priced = C.mergeDraftFields(
  { description: 'Added tile to the job.', materials: 'Granite tile.', labor: '', extras: '', price: '$10' },
  { description: 'Added tile to the job.', materials: 'Granite tile.', labor: '', extras: '', price: '$395' },
  { description: 'Added tile to the job.', materials: 'Granite tile.', labor: '', extras: '', price: '$500' }
);
assert(priced.price === '$10', 'a hand-edited price is not replaced, got ' + priced.price);

if (failed) { console.error('\n' + failed + ' failed'); process.exit(1); }
console.log('\nall passed');
