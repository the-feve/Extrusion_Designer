import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stepInfo, partFromFileName, guessFields, mergeLibrary } from '../app/engine/stepinfo.js';
import { makeCatalog } from '../app/engine/catalog.js';
import { buildCart } from '../app/engine/cart.js';
import { validate } from '../app/engine/validate.js';

const catalogData = JSON.parse(fs.readFileSync(new URL('../app/data/catalog.json', import.meta.url)));

// A tiny hand-written STEP (our own, not a vendor file): a 2 x 3 x 4.5 in box.
const tiny = (unitLine, k = 1) => `ISO-10303-21;
HEADER;
FILE_DESCRIPTION (( 'STEP AP203' ), '1' );
FILE_NAME ('12345T67_Test Caster.STEP', '2026-10-27', ( '' ), ( '' ), '', '', '' );
FILE_SCHEMA (( 'CONFIG_CONTROL_DESIGN' ));
ENDSEC;
DATA;
#1 = CARTESIAN_POINT ( 'NONE',  ( ${-1 * k}, ${0 * k}, ${0 * k} ) ) ;
#2 = CARTESIAN_POINT ( 'NONE',  ( ${1 * k}, ${3 * k}, ${4.5 * k} ) ) ;
#3 = CARTESIAN_POINT ( 'NONE',  ( ${0.2 * k}, ${1.5 * k}, ${2 * k} ) ) ;
${unitLine}
ENDSEC;
END-ISO-10303-21;
`;

test('stepInfo: inch and mm files give the size in inches', () => {
  const a = stepInfo(tiny("#9 = ( CONVERSION_BASED_UNIT ( 'INCH', #10 ) LENGTH_UNIT ( ) NAMED_UNIT ( #11 ) );"));
  assert.equal(a.unit, 'inch');
  assert.deepEqual(a.size, [2, 3, 4.5]);
  assert.deepEqual(a.sorted, [4.5, 3, 2]);
  assert.equal(a.fileName, '12345T67_Test Caster.STEP');
  const b = stepInfo(tiny('#9 = ( LENGTH_UNIT ( ) NAMED_UNIT ( * ) SI_UNIT ( .MILLI., .METRE. ) );', 25.4));
  assert.equal(b.unit, 'mm');
  assert.deepEqual(b.size, [2, 3, 4.5]);
  assert.throws(() => stepInfo('hello'), /Not a STEP file/);
});

test('part number and name from McMaster file names', () => {
  assert.deepEqual(partFromFileName('4658N49_T-Slotted Framing Rail.STEP'), { pn: '4658N49', name: 'T-Slotted Framing Rail' });
  assert.deepEqual(partFromFileName('C:\\dl\\47065T845_Silver_Corner_Bracket.pdf'), { pn: '47065T845', name: 'Silver Corner Bracket' });
  assert.equal(partFromFileName('my bracket.step').pn, '');
});

test('a library caster shows up in the catalog and builds a cart at its real height', () => {
  const entry = { id: 'c1', kind: 'caster', pn: '12345T67', name: 'Test caster', fields: guessFields('caster', { sorted: [4.5, 3, 2], size: [2, 3, 4.5] }) };
  assert.equal(entry.fields.mountHeight, 4.5);
  const cat = makeCatalog(mergeLibrary(catalogData, [entry]));
  const part = cat.part('lib:c1');
  assert.equal(part.pn, '12345T67');
  assert.equal(part.verified, false);
  const d = buildCart(cat, { caster: 'lib:c1' });
  assert.ok(validate(d).ok);
  for (const p of d.members.filter((m) => m.role === 'post')) assert.equal(p.length, 30 - 4.5);
  // The shipped catalog data is not changed.
  assert.ok(!catalogData.parts['lib:c1']);
});

test('a library rail stick adds a stock length to the matching profile', () => {
  const entry = { id: 'r1', kind: 'rail', pn: '4658N47', name: '8 ft rail', fields: { section: [1.5, 1.5], lengthIn: 96 } };
  const data = mergeLibrary(catalogData, [entry]);
  assert.ok(data.profiles['1515'].stock.some((s) => s.lengthIn === 96 && s.pn === '4658N47'));
});

test('the real McMaster files, if present locally (git-ignored), measure as published', { skip: !fs.existsSync(new URL('../reference/mcmaster/4658N49_T-Slotted_Framing_Rail.STEP', import.meta.url)) }, () => {
  const rail = stepInfo(fs.readFileSync(new URL('../reference/mcmaster/4658N49_T-Slotted_Framing_Rail.STEP', import.meta.url), 'utf8'));
  assert.deepEqual(rail.sorted.map((v) => Math.round(v * 100) / 100), [120, 1.5, 1.5]);
  const br = stepInfo(fs.readFileSync(new URL('../reference/mcmaster/47065T845_Silver_Corner_Bracket.STEP', import.meta.url), 'utf8'));
  const g = guessFields('corner-bracket', br);
  assert.ok(Math.abs(g.legLength - 1.5) < 0.01 && Math.abs(g.width - 1.31) < 0.01, JSON.stringify(br.size));
});
