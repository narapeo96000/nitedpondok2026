const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
assert(!html.includes('lgPondokSearch'), 'Login must not contain a location picker');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script); // Check the complete inline script, including boot.
const elements = new Map();
for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
  const classes = new Set(['section-hidden']);
  elements.set(id, { value: '', checked: false, disabled: false, textContent: '',
    classList: { add: c => classes.add(c), remove: c => classes.delete(c),
      contains: c => classes.has(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c) },
    reset() {}, scrollIntoView() {}, focus() {} });
}
const storage = new Map();
const ctx = vm.createContext({ console, document: {
  getElementById: id => { assert(elements.has(id), `Unknown element: ${id}`); return elements.get(id); },
  addEventListener() {}
}, window: { scrollTo() {} }, localStorage: {
  getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k)
}, Swal: { fire: async () => ({ isConfirmed: true }) } });
vm.runInContext(script.slice(0, script.indexOf('// ===================== Boot')), ctx);
async function run(code) { return await vm.runInContext(code, ctx); }
(async () => {
  await run(`api = async () => ({success: true, userData: {username: 'tester', fname: 'Test', role: 'user'}});
    $('loginUser').value = 'tester'; $('loginPass').value = 'test';`);
  await run('handleLogin()');
  assert.equal(await run('session.username'), 'tester');
  assert.equal(await run('selectedPondok'), null);
  assert.equal(elements.get('appSection').classList.contains('section-hidden'), false);
  assert.equal(elements.get('startBtn').disabled, true);
  await run(`pondokList = [{id: 'A', name: 'A'}, {id: 'B', name: 'B'}]; pickPondok('sel', 0)`);
  assert.equal(await run('selectedPondok.id'), 'A');
  await run(`$('evaluationSection').classList.remove('section-hidden'); answers = {test: 3};
    Swal.fire = async () => ({isConfirmed: false});`);
  await run("pickPondok('sel', 1)");
  assert.equal(await run('selectedPondok.id'), 'A');
  await run('Swal.fire = async () => ({isConfirmed: true})');
  await run("pickPondok('sel', 1)");
  assert.equal(await run('selectedPondok.id'), 'B');
  assert.equal(await run('Object.keys(answers).length'), 0);
  assert.equal(await run('session.username'), 'tester');
  assert(storage.has('pondok_session'));
  assert.equal(elements.get('evaluationSection').classList.contains('section-hidden'), true);
  await run('backToSelect()');
  assert.equal(await run('selectedPondok'), null);
  assert.equal(await run('session.username'), 'tester');
  await run(`pickPondok('sel', 0)`);
  await run(`let finishRequest; api = () => new Promise(resolve => {finishRequest = resolve});
    let pendingStart = startEvaluation();`);
  await run('backToSelect()');
  await run(`finishRequest({success: true, data: {id: 'A'}}); pendingStart`);
  assert.equal(await run('selectedPondok'), null, 'Late response must not restore old selection');
  await run(`
    const levelCode = FORMS[0].sections[0].code + '.0';
    const levelInputs = ['อิบติดาอียะฮฺ', 'มุตะวัซซิเฎาะฮฺ', 'อาลียะฮฺ'].map(value => {
      const label = {dataset: {o: value}, classList: {toggle(name, checked) { this.on = checked; }}};
      const input = {checked: true, parentElement: label};
      label.querySelector = () => input;
      toggleMulti(input, levelCode);
      return input;
    });
  `);
  assert.equal(await run('multiVals[levelCode].length'), 3, 'Multiple levels can be selected');
  await run('toggleMulti(levelInputs[0], levelCode)');
  assert.equal(await run('multiVals[levelCode].length'), 3, 'Repeated change does not deselect');
  await run('levelInputs[1].checked = false; toggleMulti(levelInputs[1], levelCode)');
  assert.equal(await run('multiVals[levelCode].length'), 2, 'One level can be deselected');
  await run(`
    document.querySelectorAll = selector => selector === '#formPanels .multi-box[data-multi]'
      ? [{dataset: {multi: levelCode}, querySelectorAll: () => levelInputs.map(i => i.parentElement)}] : [];
    levelInputs.forEach(i => { i.checked = false; });
    applyState(FORMS[0]);
  `);
  assert.equal(await run('levelInputs.map(i => i.checked).join()'), 'true,false,true', 'Restore checked state');
  await run(`
    selectedPondok = {id: 'A'}; $('evalRound').value = '1'; curForm = 0;
    let savedPayload;
    api = async (action, payload) => { savedPayload = payload; return {success: false}; };
    submitFinal({preventDefault() {}});
  `);
  assert.deepEqual(Array.from(await run('savedPayload.evalData.answers[levelCode]')).sort(), ['อิบติดาอียะฮฺ', 'อาลียะฮฺ'].sort(), 'Save selected levels');
  await run('doLogout()');
  assert.equal(await run('session.username'), '');
  assert(!storage.has('pondok_session'));
  console.log('PASS: login; switch location; session; stale response; multi-select/deselect/restore/save; logout');
})().catch(e => { console.error(e); process.exitCode = 1; });
