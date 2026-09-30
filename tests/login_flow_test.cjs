// Offline model tests. No requests are sent to Apps Script or Google Sheets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert(!html.includes('lgPondokSearch'), 'No location selection before login');
assert(!html.includes('id="formTabs"'), 'One active form, not eight competing tabs');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const elements = new Map();
const element = id => {
  if (!elements.has(id)) {
    const classes = new Set();
    elements.set(id, {value:'', textContent:'', innerHTML:'', checked:false,
      classList:{add:c=>classes.add(c), remove:c=>classes.delete(c), contains:c=>classes.has(c), toggle:(c,on)=>on?classes.add(c):classes.delete(c)},
      setAttribute(){}, removeAttribute(){}, focus(){}, scrollIntoView(){}, reset(){}, checkValidity(){return true;}
    });
  }
  return elements.get(id);
};
const ctx = vm.createContext({console, document:{getElementById:element, querySelectorAll:()=>[], addEventListener(){}}, window:{scrollTo(){}}, Swal:{fire:async()=>({isConfirmed:true})}});
vm.runInContext(script.slice(0, script.indexOf('// ===================== Boot')), ctx);
const run = code => vm.runInContext(code, ctx);
run("inspectionMode='general'; switchForm(ACTIVE_FORM_INDEX)");
assert.equal(run('FORMS[curForm].no'), 8);
run('switchForm(0)');
assert.equal(run('FORMS[curForm].no'), 8, 'General route only allows form 8');
assert.deepEqual(Array.from(run('SC3NA.map(o=>o.t)')), ['2','1','0','N/A']);
for (let no = 1; no <= 8; no++) {
  run("inspectionMode=" + JSON.stringify(no===8?'general':'full') + "; resetEvalState(); switchForm("+(no-1)+");");
  assert.equal(run('FORMS[curForm].no'), no);
  run("FORMS[curForm].sections.forEach(sec=>sec.items.forEach((it,i)=>{if(it.scale) answers[sec.code+'.'+i]=Math.max(...it.scale.filter(o=>typeof o.v==='number').map(o=>o.v));})); recalc();");
  if ([2,4,7,8].includes(no)) {
    assert.equal(element('totalScore').value, run('FORMS[curForm].max'), 'Maximum score for form '+no);
    assert.equal(element('pctScore').value, 100);
  }
  const report = run("reportRecordData({details:{formNo:"+no+",answers:{}},formType:'แบบที่ "+no+"'})");
  assert.equal(report.formNo, no);
  assert(report.formName);
}
for (const [value, text] of [[2,'ทำได้ชัดเจน'],[1,'กำลังพัฒนา'],[0,'ต้องช่วยเหลือ'],['NA','ไม่นำมาพิจารณา']]) {
  assert.equal(run("reportRecordData({details:{formNo:8,answers:{'F8.C.0':"+JSON.stringify(value)+"}}}).observations[12].result"), text);
}
run("inspectionMode='general'; resetEvalState(); switchForm(7); answers={'F8.A.0':'NA','F8.A.1':0}; recalc()");
assert.equal(element('totalScore').value, 0, 'Zero is an answer');
assert.equal(element('maxLabel').textContent, '30 (หัก N/A)');
assert.equal(element('answerProgress').value, 2);
assert.equal(run('secPts(FORMS[7].sections[0],FORMS[7])'), '12 คะแนน');
run("setRoundValue('การนิเทศเฉพาะกิจ');");
assert.equal(element('evalRound').value, 'อื่นๆ');
assert.equal(run('getRoundValue()'), 'การนิเทศเฉพาะกิจ');
run("setRoundValue('ครั้งที่ 2 การติดตามและสนับสนุนการพัฒนา')");
assert.equal(run('getRoundValue()'), 'ครั้งที่ 2 (กันยายน)');

// The address sheet starts at row 3, not the Tadika sheet's row 6.
const backend = fs.readFileSync(path.join(__dirname, '../apps-script/รหัส.js'), 'utf8');
const rows = [['A','ตัวอย่าง ก'],['B','ตัวอย่าง ข']];
const backendCtx = vm.createContext({SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getLastRow:()=>4, getRange:(start,col,count)=>{
  assert.equal(start,3); assert.equal(col,1); assert.equal(count,2); return {getValues:()=>rows};
}})})}});
vm.runInContext(backend, backendCtx);
assert.equal(vm.runInContext("getPondokData({id:'A'}).data.row", backendCtx), 3);
assert.equal(vm.runInContext("getPondokData({id:'B'}).data.row", backendCtx), 4);
assert.equal(vm.runInContext("getPondokData({id:'missing'}).success", backendCtx), false);
console.log('PASS: 8 form definitions, mode guards, score maxima, zero/NA, progress, reports, rounds, address row mapping');
