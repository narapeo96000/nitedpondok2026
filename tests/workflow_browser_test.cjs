// Playwright on NODE_PATH; application API requests are always intercepted.
// No test creates, edits or deletes records in the real spreadsheet.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const round = 'ครั้งที่ 1 (พฤษภาคม)';
const institutions = [
  {id:'TEST-A',name:'ปอเนาะทดสอบ ก',address:'ที่อยู่จำลอง',dist:'อำเภอทดสอบ',subdist:'ตำบลทดสอบ',row:3,staff:2,students:20},
  {id:'TEST-B',name:'ปอเนาะทดสอบ ข',address:'ที่อยู่จำลอง',row:4}
];

// Check text against its actual solid/gradient background, including inherited
// backgrounds. Selected, unselected, disabled and helper text use the same floor.
async function checkContrast(locator, label) {
  const pairs = await locator.evaluateAll(nodes => {
    const rgba = css => {const v=css.match(/[\d.]+/g).map(Number); return [v[0],v[1],v[2],v[3]??1];};
    const over = (foreground,background) => foreground.slice(0,3).map((v,i)=>v*foreground[3]+background[i]*(1-foreground[3]));
    const backgrounds = el => {
      if (!el) return [[255,255,255]];
      const style=getComputedStyle(el);
      const base=backgrounds(el.parentElement).map(bg=>over(rgba(style.backgroundColor),bg));
      const stops=style.backgroundImage.match(/rgba?\([^)]+\)/g);
      // SweetAlert hover uses a translucent black gradient over its button fill.
      return stops ? base.flatMap(bg=>stops.map(stop=>over(rgba(stop),bg))) : base;
    };
    return nodes.flatMap(node=>backgrounds(node).map(background=>({color:over(rgba(getComputedStyle(node).color),background),background})));
  });
  assert(pairs.length, 'Missing contrast sample: '+label);
  const luminance = values => {
    const rgb=values.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
    return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  };
  for(const {color,background} of pairs) {
    const a=luminance(color),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    assert(ratio>=4.5, `${label}: ${color} on ${background} = ${ratio.toFixed(2)}:1`);
  }
}

(async () => {
  const browser = await chromium.launch({channel:process.env.PONDOK_BROWSER_CHANNEL || 'msedge',headless:true});
  try {
  for (const mobile of [false,true]) {
    institutions.length = 2;
    const context = await browser.newContext({viewport:mobile ? {width:390,height:844} : {width:1280,height:900}, reducedMotion:'reduce'});
    let records = [
      {row:20,id:'TEST-A',type:'ปอเนาะ',formType:'แบบที่ 8',timestamp:'2026-09-30T09:00:00',supervisor:'ผู้ทดสอบ',totalScore:2,pct:6,details:{formNo:8,round,answers:{'F8.A.0':2,'F8.C.0':0},summary:{good:'รายละเอียดเดิม',support:['การพัฒนาครู/ผู้สอน']}}},
      {row:21,id:'TEST-A',type:'ปอเนาะ',formType:'แบบที่ 1',timestamp:'2026-09-29T09:00:00',supervisor:'ผู้ทดสอบ',details:{formNo:1,round:'รอบ <ทดสอบ>',answers:{'F1.A.0':['อิบติดาอียะฮฺ','อาลียะฮฺ'],'F1.B.0':'จัดครบทุกสาระ'},notes:{'F1.B.0':'หมายเหตุเดิม'}}}
    ];
    const requests = [], errors = [];
    let failHistory = false, failSave = false, delayHistory = false;
    await context.route('**/*', async route => {
      const req = route.request();
      if (req.url() === 'http://pondok.test/') return route.fulfill({contentType:'text/html',body:html});
      if (req.url().startsWith('https://script.google.com/')) {
        const {action,payload} = JSON.parse(req.postData());
        requests.push({action,payload});
        let result;
        if (action === 'login') result={success:true,userData:{username:'fixture',fname:'ผู้ทดสอบ',role:'user',addPondokToken:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}};
        else if (action === 'getPondokList') result={success:true,data:institutions};
        else if (action === 'getPondokData') result={success:true,data:institutions.find(x=>x.id===payload.id)};
        else if (action === 'getEvaluations') {
          if (delayHistory && payload === 'TEST-A') await new Promise(r=>setTimeout(r,600));
          result=failHistory ? {success:false,message:'จำลองโหลดไม่สำเร็จ'} : {success:true,data:records.filter(x=>x.id===payload)};
        } else if (action === 'savePondokEvaluation') {
          await new Promise(r=>setTimeout(r,120));
          if (failSave) result={success:false,message:'จำลองบันทึกไม่สำเร็จ'};
          else {
            const record={...payload.evalData,row:payload.editRow || 30+records.length,id:payload.pondokData.id,type:'ปอเนาะ',timestamp:'2026-09-30T10:00:00',supervisor:payload.supervisor,details:payload.evalData};
            records=records.filter(x=>x.row!==record.row); records.unshift(record); result={success:true};
          }
        } else if(action==='deletePondokEvaluation') { records=records.filter(x=>x.row!==payload.row);result={success:true,message:'ลบเรียบร้อย'}; }
        else if(action==='addPondok') {
          const item={...payload.institution,id:payload.institution.id,row:5,type:'ปอเนาะ'};
          institutions.push(item); result={success:true,message:'เพิ่มสถาบันเรียบร้อย',data:item};
        }
        else if(action==='generateInspectionReport') result={success:true,reply:'### สรุปจากข้อมูลทดสอบ\n- มีบันทึกการนิเทศ'};
        else throw new Error('Unexpected mocked action: '+action);
        return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
      }
      // Exercise real SweetAlert dialogs, but block every other external request.
      if (req.url().startsWith('https://cdn.jsdelivr.net/npm/sweetalert2@11.7.20/')) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', e=>errors.push(e.message));
    const visible = async id => assert(await page.locator('#'+id).isVisible(), id+' visible');
    const hidden = async id => assert(await page.locator('#'+id).isHidden(), id+' hidden');
    const waitVisible = id => page.locator('#'+id).waitFor({state:'visible'});
    const confirm = async () => {await page.locator('.swal2-confirm').click(); await page.locator('.swal2-container').waitFor({state:'hidden'});};
    const cancel = async () => {await page.locator('.swal2-cancel').click(); await page.locator('.swal2-container').waitFor({state:'hidden'});};
    const home = async () => {await page.locator('#appHeader').getByRole('button',{name:'หน้าแรก',exact:true}).click(); await waitVisible('modeCard');};
    const pick = async (name='ปอเนาะทดสอบ ก') => {
      await page.locator('#selPondokSearch').fill(name);
      await page.locator('.suggest-item').filter({hasText:name}).click();
      await page.waitForFunction(()=>!document.getElementById('histCount').textContent.includes('กำลังโหลด'));
    };
    const saves = ()=>requests.filter(x=>x.action==='savePondokEvaluation');
    await page.goto('http://pondok.test/');
    await page.waitForFunction(()=>typeof Swal!=='undefined');
    await checkContrast(page.locator('#loginBtn'),'login action');
    await hidden('selectionCard');
    await page.locator('#loginUser').fill('fixture');
    await page.locator('#loginPass').fill('fixture-password');
    await page.locator('#loginBtn').click();
    await waitVisible('modeCard');
    await page.locator('.swal2-container').waitFor({state:'hidden'});
    await hidden('selectionCard'); await hidden('adminCard');
    await checkContrast(page.locator('.mode-choice strong'),'mode headings');
    await checkContrast(page.locator('.workflow-step .step-label'),'workflow labels');
    await checkContrast(page.locator('.workflow-step .step-dot'),'workflow numbers');
    const modeColors=await page.locator('.mode-choice').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundColor));
    assert.notEqual(modeColors[0],modeColors[1],'Two modes have distinct colors');
    await page.getByRole('button',{name:'นิเทศทั่วไป',exact:false}).click();
    await visible('selectionCard');
    await page.locator('#selPondokSearch').fill('ปอเนาะใหม่จากผู้ใช้งาน');
    await visible('newPondokPrompt');
    await page.locator('#openNewPondokBtn').click();
    await page.locator('#new_id').fill('NEW-001');
    await page.locator('#new_name').fill('ปอเนาะใหม่จากผู้ใช้งาน');
    await page.locator('#new_dist').fill('อำเภอทดสอบ');
    await page.locator('#newPondokSubmitBtn').click(); await confirm();
    await waitVisible('historyCard');
    assert.equal(await page.locator('#selName').innerText(),'NEW-001 · ปอเนาะใหม่จากผู้ใช้งาน');
    await pick();
    assert.equal(await page.locator('#histBody button').count(),4);
    await checkContrast(page.locator('#histBody .btn-edit'),'edit action');
    await checkContrast(page.locator('#histBody .btn-danger'),'delete action');
    await checkContrast(page.locator('#startBtn'),'start action');
    await checkContrast(page.locator('#selectionCard .btn-outline2'),'back action');
    assert((await page.locator('#historyTitle').innerText()).includes('ปอเนาะทดสอบ ก'));
    await visible('reportsCard');
    const historyLoads=requests.filter(x=>x.action==='getEvaluations').length;
    await page.locator('#startBtn').click(); await waitVisible('evaluationSection');
    await page.locator('.swal2-container').waitFor({state:'hidden'});
    await hidden('selectionCard'); await hidden('historyCard'); await hidden('reportsCard');
    assert.equal(requests.filter(x=>x.action==='getEvaluations').length,historyLoads,'No duplicate history load on opening');
    assert.equal(await page.locator('#formPanels .q-scale').count(),16);
    assert.deepEqual(await page.locator('#formPanels .q-scale').first().locator('button').allTextContents(),['2','1','0','N/A']);
    await checkContrast(page.locator('#formPanels .q-scale button'),'unselected ratings');
    await checkContrast(page.locator('#instituteCard > summary,#pinCard > summary'),'secondary menu');
    await checkContrast(page.locator('#finalSubmitBtn'),'save action');
    const firstRating=page.locator('#formPanels .q-scale').first();
    for(const value of ['2','1','0','NA']) {
      const button=firstRating.locator(`[data-v="${value}"]`);
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'),'true');
      assert.equal(await firstRating.locator('[aria-pressed="true"]').count(),1);
      await checkContrast(button,'selected '+value);
      assert.equal(await button.evaluate(el=>getComputedStyle(el,'::after').content),'"✓"','Selection has a non-color cue');
      if(process.env.PONDOK_SCREENSHOT_DIR && value==='2') await firstRating.screenshot({path:path.join(process.env.PONDOK_SCREENSHOT_DIR,`ratings-${mobile?'mobile':'desktop'}.png`)});
      await button.click(); assert.equal(await button.getAttribute('aria-pressed'),'false');
    }
    if(process.env.PONDOK_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.PONDOK_SCREENSHOT_DIR,`form-${mobile?'mobile':'desktop'}.png`)});
    await page.locator('#evalRound').selectOption('อื่นๆ');
    await page.locator('#finalSubmitBtn').click(); await confirm();
    assert.equal(saves().length,0,'Blank custom round cannot save');
    await page.locator('#evalRoundOther').fill('นิเทศพิเศษ');
    await page.locator('[data-code="F8.A.0"][data-v="2"]').click();
    await page.locator('[data-code="F8.C.0"][data-v="0"]').click();
    await page.locator('#f7_good').fill('ข้อความหลายบรรทัด\nทดสอบการคงข้อมูล');
    await page.locator('#appHeader').getByRole('button',{name:'หน้าแรก',exact:true}).click();
    await cancel(); await visible('evaluationSection');
    assert.equal(await page.locator('#f7_good').inputValue(),'ข้อความหลายบรรทัด\nทดสอบการคงข้อมูล');
    await page.locator('#finalSubmitBtn').click(); await cancel();
    assert.equal(saves().length,0,'Cancel keeps draft');
    // A second submit during the confirmation must not replace it or send twice.
    await page.locator('#finalSubmitBtn').click();
    await checkContrast(page.locator('.swal2-confirm'),'confirm save');
    await checkContrast(page.locator('.swal2-cancel'),'cancel save');
    await page.evaluate(()=>submitFinal({preventDefault(){}}));
    assert.equal(await page.locator('.swal2-container').count(),1);
    await cancel(); assert.equal(saves().length,0);
    failSave=true;
    await page.locator('#finalSubmitBtn').click(); await page.locator('.swal2-confirm').click();
    await page.getByText('บันทึกไม่สำเร็จ',{exact:true}).waitFor(); await confirm();
    await visible('evaluationSection'); assert(await page.locator('#f7_good').inputValue());
    failSave=false; failHistory=true;
    await page.locator('#finalSubmitBtn').click(); await confirm(); await waitVisible('savedCard');
    await hidden('evaluationSection');
    assert.equal(saves().at(-1).payload.evalData.formNo,8);
    assert.equal(saves().at(-1).payload.evalData.answers['F8.C.0'],0);
    assert.equal(saves().at(-1).payload.pondokData.row,3);
    if(process.env.PONDOK_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.PONDOK_SCREENSHOT_DIR,`saved-${mobile?'mobile':'desktop'}.png`)});
    await page.getByRole('button',{name:'ดูประวัติ / รายงาน',exact:true}).click(); await waitVisible('retryHistoryBtn');
    assert.equal(saves().length,2,'History errors cannot resubmit data');
    failHistory=false; await page.locator('#retryHistoryBtn').click();
    await page.waitForFunction(()=>document.getElementById('histCount').textContent==='3 รายการ');
    await page.locator('#histBody tr').filter({hasText:'2026-09-30 09:00'}).getByRole('button',{name:'แก้ไข',exact:true}).click();
    await waitVisible('evaluationSection');
    assert.equal(await page.locator('#f7_good').inputValue(),'รายละเอียดเดิม');
    assert(await page.locator('[data-f7-support="การพัฒนาครู/ผู้สอน"]').isChecked());
    await page.locator('#f7_good').fill('รายละเอียดแก้ไข');
    await page.locator('#finalSubmitBtn').click(); await confirm(); await waitVisible('savedCard');
    assert.equal(saves().at(-1).payload.editRow,20);
    await home();
    assert.equal(requests.filter(x=>x.action==='login').length,1,'Home needs no re-login');
    await page.reload(); await waitVisible('modeCard');
    assert.equal(requests.filter(x=>x.action==='login').length,1,'Session survives reload');
    await page.getByRole('button',{name:'นิเทศเต็มรูปแบบ',exact:false}).click();
    assert.equal(await page.locator('.mode-choice[data-mode="full"]').getAttribute('aria-pressed'),'true');
    await checkContrast(page.locator('#fullFormPicker .btn-purple'),'full mode next');
    await page.locator('#fullFormChoice').selectOption('0');
    await page.getByRole('button',{name:'ถัดไป',exact:true}).click(); await pick();
    await page.locator('#histBody tr').filter({hasText:'2026-09-29'}).getByRole('button',{name:'แก้ไข',exact:true}).click();
    await waitVisible('evaluationSection');
    assert.equal(await page.locator('#formPanels input[type=checkbox]:checked').count(),2);
    assert.equal(await page.locator('[data-note="F1.B.0"]').inputValue(),'หมายเหตุเดิม');
    assert.equal(await page.locator('#evalRoundOther').inputValue(),'รอบ <ทดสอบ>');
    await page.locator('[data-note="F1.B.0"]').fill('ยังไม่บันทึก');
    await page.getByRole('button',{name:'ยกเลิกการแก้ไข',exact:true}).click(); await cancel();
    assert.equal(await page.locator('[data-note="F1.B.0"]').inputValue(),'ยังไม่บันทึก');
    await page.getByRole('button',{name:'ยกเลิกการแก้ไข',exact:true}).click(); await confirm(); await visible('selectionCard');
    // Full route: all seven instruments; reuse institution and inspection round.
    for(let no=1;no<=7;no++) {
      if(no===1) await page.locator('#startBtn').click();
      else {
        await page.locator('#nextFullBtn').click();
        await page.locator('#fullFormChoice').selectOption(String(no-1));
        await page.getByRole('button',{name:'ถัดไป',exact:true}).click();
      }
      await waitVisible('evaluationSection');
      assert((await page.locator('#evaluationTitle').innerText()).startsWith(`แบบที่ ${no}`));
      await checkContrast(page.locator('#formPanels .section-head .title'), 'form '+no+' section headings');
      if(no===1) await page.locator('#evalRound').selectOption(round);
      else assert.equal(await page.locator('#evalRound').inputValue(),round);
      if(no===6) {await page.locator('#f6_strengths').fill('จุดแข็งทดสอบ'); await hidden('progressBox');}
      else if([2,4,7].includes(no)) await page.locator('#formPanels .q-scale').first().locator('button').first().click();
      else await page.locator('#formPanels select[data-sel]').first().selectOption({index:1});
      if(no===1) await page.locator('#formPanels input[type=checkbox]').first().check();
      if([2,4,7].includes(no)) await checkContrast(page.locator('#formPanels .q-scale button.sel'),'form '+no+' selected score');
      await page.locator('#finalSubmitBtn').click(); await confirm(); await waitVisible('savedCard');
      const payload=saves().at(-1).payload;
      assert.equal(payload.evalData.formNo,no); assert.equal(payload.pondokData.id,'TEST-A'); assert(!payload.editRow);
      if(no===1) assert.equal(payload.evalData.answers['F1.A.0'].length,1);
    }
    await page.getByRole('button',{name:'ดูประวัติ / รายงาน',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('histCount').textContent==='10 รายการ');
    await page.locator('#reportsCard > summary').click();
    await checkContrast(page.locator('#generateReportBtn'),'AI report action');
    await checkContrast(page.locator('#printReportBtn'),'disabled print action');
    await page.locator('#reportKind').selectOption('4'); await page.locator('#generateReportBtn').click(); await visible('reportPreview');
    assert((await page.locator('#reportPreview').innerText()).includes('สังเกตชั้นเรียน'));
    await page.locator('#reportKind').selectOption('summary'); await page.locator('#generateReportBtn').click();
    await page.getByText('สรุปจากข้อมูลทดสอบ',{exact:true}).waitFor();
    await page.evaluate(() => {
      window.__printCalled = false;
      window.print = () => { window.__printCalled = true; };
      document.getElementById('reportsCard').open = false;
      printInspectionReport();
    });
    await page.waitForFunction(() => window.__printCalled === true);
    assert.equal(await page.locator('#reportsCard').getAttribute('open'), '');
    assert(await page.locator('#reportPreview').isVisible(), 'Report remains visible for PDF print');
    await home(); // Report choices must not mark a form dirty.
    await page.getByRole('button',{name:'นิเทศทั่วไป',exact:false}).click(); await pick();
    await page.locator('#histBody').getByRole('button',{name:'ลบ',exact:true}).first().click(); await cancel();
    assert.equal(requests.filter(x=>x.action==='deletePondokEvaluation').length,0);
    await page.locator('#histBody').getByRole('button',{name:'ลบ',exact:true}).first().click(); await confirm();
    await page.waitForFunction(()=>document.getElementById('histCount').textContent==='9 รายการ');
    assert.equal(requests.filter(x=>x.action==='deletePondokEvaluation').length,1);
    await pick('ปอเนาะทดสอบ ข');
    assert((await page.locator('#historyStatus').innerText()).includes('ยังไม่มีประวัติ')); await hidden('reportsCard');
    delayHistory=true;
    await page.locator('#selPondokSearch').fill('ปอเนาะทดสอบ ก'); await page.locator('.suggest-item').click();
    await pick('ปอเนาะทดสอบ ข'); await page.waitForTimeout(800);
    assert.equal(await page.locator('#histCount').innerText(),'0 รายการ');
    assert((await page.locator('#historyTitle').innerText()).includes('ปอเนาะทดสอบ ข'));
    if(process.env.PONDOK_SCREENSHOT_DIR) {await home(); await page.screenshot({path:path.join(process.env.PONDOK_SCREENSHOT_DIR,`home-${mobile?'mobile':'desktop'}.png`)});}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page-level horizontal overflow');
    assert.deepEqual(errors,[],'No uncaught browser errors');
    console.log(`PASS ${mobile?'mobile':'desktop'}: login, both modes, 8 forms, rounds, edit/restore, delete confirm, dirty guard, save failure, success/home, reports, stale history, semantic colors/contrast/selected cues`);
    await context.close();
  }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
