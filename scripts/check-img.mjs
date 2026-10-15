// Run: node --experimental-strip-types scripts/check-img.mjs (from 06-build)
import assert from "node:assert/strict";
const { img, asset, altOf } = await import("../src/lib/assets.ts");
const id = "etang-rayon-de-sologne-496x372";
const r = img(id, { box: 248, sizes: "248px" });
assert.ok(r.sources.length && r.src.startsWith("/media/art/") && r.width >= 248 && r.alt.length > 0);
console.log(JSON.stringify(r));
assert.throws(() => img(id, { box: 9999, sizes: "9999px" }));
assert.throws(() => asset("img-20221110-145732-286"));
assert.throws(() => asset("nope"));
const bl = "etang-rayon-de-sologne-field";
const b = img(bl, { box: 1440, sizes: "100vw", blurred: true });
assert.ok(b.width >= 640);
assert.throws(() => img(bl, { box: 1440, sizes: "100vw" }));
assert.throws(() => img(id, { box: 9999, sizes: "1px", blurred: true }));
asset("grange-salle-mobilier-7");
console.log("check-img: ok");

const a = JSON.parse((await import('node:fs')).readFileSync('../05-assets/assets.json','utf8'));
const prod = a.filter((q) => q.status === 'produced');
const dec = prod.find((q) => /^missing \(decorative/.test(q.alt_source ?? ''));
const srcOnly = altOf('img-0885-960x720');
console.log('alt_source-only img-0885-960x720:', JSON.stringify(srcOnly));
assert.ok(srcOnly.length > 0);
assert.equal(altOf(id), "L'étang du domaine dans la brume");
assert.equal(altOf(dec.id), '');
const empty = prod.filter((q) => altOf(q.id) === '').map((q) => q.id);
console.log('empty alt:', empty.length, 'of', prod.length); console.log(empty.join(', '));
