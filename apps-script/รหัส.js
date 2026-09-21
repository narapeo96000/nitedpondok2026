const SHEET_ID = '1qk9eLhwKgPvh2fLwWNSthV4JKyDkJGqJojhLDus5460';
// ============================================================
// ระบบนิเทศออนไลน์ สถาบันศึกษาปอเนาะ จ.นราธิวาส (แยกจากระบบตาดีกา)
// ใช้ชีต ADDR_PONDOK + DATA_PONDOK + USERS ภายใน Spreadsheet เดียวกับระบบตาดีกา
// หมายเหตุโครงสร้างฐานข้อมูลร่วม: ADDR_TADEKA เริ่มข้อมูลจริงที่แถว 6
// โครงสร้างชีต ADDR_PONDOK (เริ่มข้อมูลจริงที่แถว 3):
//   A=รหัส, B=ชื่อปอเนาะ, C=ที่อยู่, D=อำเภอ, E=ตำบล, F=โทรศัพท์,
//   G=จำนวนบุคลากร, H=จำนวนผู้เรียน, I=จำนวนผู้เรียนต่างชาติ, J=พิกัดแผนที่
// ============================================================
const SHEET_DATA_PONDOK = 'DATA_PONDOK';
const SHEET_ADDR_PONDOK = 'ADDR_PONDOK';
const SHEET_USERS = 'USERS';
const TYPE_PONDOK = 'ปอเนาะ';
const PONDOK_ADDR_COLS = 10;

// โครงสร้างชีต DATA (15 คอลัมน์ รองรับการประเมิน 4 ด้าน + สรุป)
const DATA_HEADERS = ['Timestamp', 'ID ศูนย์', 'ชื่อศูนย์', 'ประเภทการประเมิน', 'คะแนนแบบ1', 'คะแนนแบบ2', 'คะแนนแบบ3', 'คะแนนแบบ4', 'รวม/150', 'ร้อยละ', 'ระดับ', 'รายละเอียด', 'ผู้นิเทศ', 'แก้ไขครั้งล่าสุด', 'ผู้แก้ไขล่าสุด'];

function doGet(e) {
  // GET สำหรับงานอ่านข้อมูลแบบปลอดภัย; หากไม่มี action ให้แสดงหน้า API แบบย่อ
  const action = e && e.parameter ? String(e.parameter.action || '').trim() : '';
  if (action) {
    try {
      const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : (e.parameter.id || '');
      const readActions = ['getPondokList', 'getStatsPondok', 'getPondokData', 'getEvaluations'];
      if (readActions.indexOf(action) < 0) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'GET รองรับเฉพาะงานอ่านข้อมูล' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify(dispatchAction(action, payload)))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  // หน้าเว็บหลัก (เพื่อให้เปิด URL ได้ใน browser)
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>ระบบนิเทศออนไลน์ สถาบันศึกษาปอเนาะ จังหวัดนราธิวาส</title>' +
    '<style>body{font-family:"Sarabun",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#ecfdf5;color:#0f766e}.box{text-align:center;background:#fff;padding:48px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08)}a{display:inline-block;margin-top:16px;padding:12px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:10px}</style>' +
    '</head><body><div class="box">' +
    '<h1>🕌 ระบบนิเทศออนไลน์ สถาบันศึกษาปอเนาะ จ.นราธิวาส</h1>' +
    '<p>บริการนี้เป็น API ของระบบนิเทศออนไลน์ปอเนาะ</p>' +
    '<p style="color:#64748b;font-size:14px">หน้าเว็บหลักถูกเปิดใช้งานผ่านหน้าจอระบบแยกต่างหาก</p>' +
    '</div></body></html>'
  );
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const res = dispatchAction(req.action, req.payload);

    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function dispatchAction(action, payload) {
  if (action === 'login') return loginUser(payload);
  if (action === 'register') return registerUser(payload);
  if (action === 'getUsers') return getUsers(payload);
  if (action === 'setUserStatus') return setUserStatus(payload);
  if (action === 'getPondokList') return getPondokList();
  if (action === 'getStatsPondok') return getStatsPondok();
  if (action === 'getPondokData') return getPondokData(payload);
  if (action === 'getEvaluations') return getEvaluations(payload);
  if (action === 'savePondokEvaluation') return savePondokEvaluation(payload);
  if (action === 'savePondokPin') return savePondokPin(payload);
  if (action === 'deletePondokEvaluation') return deletePondokEvaluation(payload);
  if (action === 'chat') return processChatbot(payload);
  return { success: false, message: 'ไม่รู้จัก action: ' + action };
}

const USERS_HEADERS = ['Username','Password','ชื่อ-นามสกุล','เบอร์โทร','สถานะ','บทบาท'];

// --- เตรียมชีต USERS ให้มีคอลัมน์ สถานะ/บทบาท + สร้างบัญชี admin ถ้ายังไม่มี ---
function ensureUsersSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_USERS);
  if(!sheet) {
    sheet = ss.insertSheet(SHEET_USERS);
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setValues([USERS_HEADERS]);
    sheet.appendRow(['admin','admin123','ผู้ดูแลระบบ','-','ใช้งาน','ผู้ดูแลระบบ']);
    return sheet;
  }
  const head = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  if(String(head[0]).trim() !== 'Username' || String(head[4] || '').trim() !== 'สถานะ') {
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setValues([USERS_HEADERS]);
  }
  const lastRow = sheet.getLastRow();
  let hasAdmin = false;
  if(lastRow >= 1) {
    const rows = sheet.getRange(1, 1, lastRow, 6).getValues();
    for(let i = 1; i < rows.length; i++) {
      const u = String(rows[i][0]).trim();
      if(u === '') continue;
      if(u.toLowerCase() === 'admin') hasAdmin = true;
      if(String(rows[i][4] || '').trim() === '') sheet.getRange(i + 1, 5).setValue('ใช้งาน');
      if(String(rows[i][5] || '').trim() === '') {
        sheet.getRange(i + 1, 6).setValue(u.toLowerCase() === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้');
      }
    }
  }
  if(!hasAdmin) sheet.appendRow(['admin','admin123','ผู้ดูแลระบบ','-','ใช้งาน','ผู้ดูแลระบบ']);
  return sheet;
}

// --- ตรวจสอบ Login (ต้องมีสถานะ = ใช้งาน จึงจะเข้าได้) ---
function loginUser(data) {
  const sheet = ensureUsersSheet();
  const rows = sheet.getDataRange().getValues();
  const inputUser = String(data.username).trim();
  const inputPass = String(data.password).trim();

  for(let i = 1; i < rows.length; i++) {
    let sheetUser = String(rows[i][0]).trim();
    let sheetPass = String(rows[i][1]).trim();

    if(sheetUser === inputUser && sheetPass === inputPass) {
      const status = String(rows[i][4] || '').trim() || 'ใช้งาน';
      const role = String(rows[i][5] || '').trim() || (sheetUser.toLowerCase() === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้');
      if(status === 'รออนุมัติ') {
        return { success: false, message: 'บัญชีของคุณยังรอการอนุมัติจากผู้ดูแลระบบ กรุณารอผู้ดูแลระบบอนุมัติก่อนเข้าสู่ระบบ' };
      }
      if(status === 'ระงับ') {
        return { success: false, message: 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
      }
      return {
        success: true,
        userData: { username: sheetUser, fname: rows[i][2], tel: rows[i][3], role: role, status: status }
      };
    }
  }
  return {
    success: false,
    message: "Username หรือ Password ไม่ถูกต้อง"
  };
}

// --- สมัครสมาชิกใหม่ (บันทึกสถานะ = รออนุมัติ รอผู้ดูแลระบบ) ---
function registerUser(data) {
  const sheet = ensureUsersSheet();
  const rows = sheet.getDataRange().getValues();
  const u = String(data.username).trim();
  const p = String(data.password).trim();
  const f = String(data.fname).trim();
  const tel = String(data.tel || '').trim();

  if(!u || !p || !f) return {success: false, message: "กรอกข้อมูลไม่ครบถ้วน (ต้องมี Username, Password และชื่อ-นามสกุล)"};

  for(let i = 1; i < rows.length; i++) {
    if(String(rows[i][0]).trim().toLowerCase() === u.toLowerCase()) {
      return {success: false, message: "Username นี้ถูกใช้งานแล้ว กรุณาใช้ชื่ออื่น"};
    }
  }

  sheet.appendRow([u, p, f, tel, 'รออนุมัติ', 'ผู้ใช้']);
  return {success: true, message: "สมัครสมาชิกเรียบร้อย!<br>บัญชีของคุณ<b>รอการอนุมัติจากผู้ดูแลระบบ</b> จึงจะเข้าสู่ระบบได้"};
}

// --- ผู้ดูแลระบบ: ดึงรายชื่อผู้ใช้ทั้งหมด ---
function getUsers(data) {
  const sheet = ensureUsersSheet();
  const rows = sheet.getDataRange().getValues();
  const admin = String(data.username || '').trim();
  let isAdmin = false;
  for(let i = 1; i < rows.length; i++) {
    if(String(rows[i][0]).trim() === admin && String(rows[i][5] || '').trim() === 'ผู้ดูแลระบบ') { isAdmin = true; break; }
  }
  if(!isAdmin) return {success: false, message: 'ไม่มีสิทธิ์ใช้งาน (เฉพาะผู้ดูแลระบบ)'};
  const list = [];
  for(let i = 1; i < rows.length; i++) {
    if(String(rows[i][0]).trim() === '') continue;
    list.push({
      row: i + 1,
      username: rows[i][0],
      fname: rows[i][2],
      tel: rows[i][3],
      status: String(rows[i][4] || '').trim() || 'ใช้งาน',
      role: String(rows[i][5] || '').trim() || 'ผู้ใช้'
    });
  }
  return {success: true, data: list};
}

// --- ผู้ดูแลระบบ: อนุมัติ / ระงับ / เปิดใช้งานบัญชี ---
function setUserStatus(data) {
  const sheet = ensureUsersSheet();
  const rows = sheet.getDataRange().getValues();
  const admin = String(data.admin || '').trim();
  const target = String(data.username || '').trim();
  const status = String(data.status || '').trim();

  let isAdmin = false, targetRow = -1;
  for(let i = 1; i < rows.length; i++) {
    const u = String(rows[i][0]).trim();
    if(u === admin && String(rows[i][5] || '').trim() === 'ผู้ดูแลระบบ') isAdmin = true;
    if(u === target) targetRow = i + 1;
  }
  if(!isAdmin) return {success: false, message: 'ไม่มีสิทธิ์ใช้งาน (เฉพาะผู้ดูแลระบบ)'};
  if(targetRow < 1) return {success: false, message: 'ไม่พบบัญชีผู้ใช้นี้'};
  if(status === 'ใช้งาน' || status === 'ระงับ') {
    sheet.getRange(targetRow, 5).setValue(status);
    return {success: true, message: (status === 'ใช้งาน' ? '✅ เปิดใช้งาน' : '⛔ ระงับ') + 'บัญชี "' + target + '" เรียบร้อย'};
  }
  return {success: false, message: 'สถานะไม่ถูกต้อง'};
}

// --- เตรียมชีต DATA_PONDOK ให้มี Header ครบตาม DATA_HEADERS (15 คอลัมน์) ---
function ensureDataSheet(type) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_DATA_PONDOK);
  if(!sheet) {
    sheet = ss.insertSheet(SHEET_DATA_PONDOK);
    sheet.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS]);
    return sheet;
  }
  sheet.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS]);
  return sheet;
}

function formatDate(d) {
  if(!d) return '';
  if(!(d instanceof Date)) d = new Date(d);
  const pad = n => ('0' + n).slice(-2);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
         pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

// --- ดึงประวัติการนิเทศปอเนาะของสถาบันที่เลือก (จากชีต DATA_PONDOK) ---
function getEvaluations(pondokId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  pondokId = String(pondokId).trim();
  const list = [];

  const sheet = ss.getSheetByName(SHEET_DATA_PONDOK);
  if(sheet) {
    const lastRow = sheet.getLastRow();
    if(lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, DATA_HEADERS.length).getValues();
      for(let i = 0; i < rows.length; i++) {
        if(String(rows[i][1]).trim() === pondokId) {
          let details = null;
          try { details = JSON.parse(rows[i][11] || 'null'); } catch(e) { details = null; }
          list.push({
            row: i + 2,
            type: TYPE_PONDOK,
            timestamp: formatDate(rows[i][0]),
            id: rows[i][1],
            name: rows[i][2],
            formType: rows[i][3],
            score1: rows[i][4],
            score2: rows[i][5],
            score3: rows[i][6],
            score4: rows[i][7],
            totalScore: rows[i][8],
            pct: rows[i][9],
            level: rows[i][10],
            details: details,
            supervisor: rows[i][12],
            lastEdit: formatDate(rows[i][13]),
            lastEditor: rows[i][14]
          });
        }
      }
    }
  }
  list.sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);
  return {success: true, data: list};
}

// ============================================================
// แชทบอท "น้องศึกษา" — ใช้ Gemini API
// API Key เก็บที่: Apps Script > Project Settings > Script Properties
//   ชื่อคีย์: geminiKey หรือ GEMINI_API_KEY (รองรับทั้งสอง)
// (ไม่ฝัง key ในโค้ด เพื่อกันรั่วไหลบน GitHub สาธารณะ)
// ============================================================

// --- อ่านการตั้งค่าระบบจาก Script Properties (รองรับทั้ง geminiKey และ GEMINI_API_KEY) ---
function getGeminiApiKey() {
  const k = PropertiesService.getScriptProperties().getProperty('geminiKey') || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  return k ? String(k).trim() : '';
}

function getSystemSettings() {
  const p = PropertiesService.getScriptProperties();
  const geminiKey = p.getProperty('geminiKey') || p.getProperty('GEMINI_API_KEY') || '';
  return {
    geminiKey: String(geminiKey).trim(),
    models: ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-1.5-flash']
  };
}

function processChatbot(userMessage) {
  const msg = String(userMessage || '').toLowerCase();

  // อ่านการตั้งค่าระบบ (รวม Gemini API Key)
  const settings = getSystemSettings();

  // ถ้ายังไม่ได้ตั้ง API Key ให้ตอบแบบออฟไลน์ (ไม่ต้องใช้ Gemini)
  if (!settings.geminiKey || settings.geminiKey.trim() === '') {
    return { reply: offlineChatReply(msg) };
  }

  // ดึงข้อมูลสถิติ + รายละเอียดปอเนาะจาก Sheets มาเป็น Context ให้ AI ตอบเสมอ
  const contextData = fetchStatisticsForAI();

  // ส่งคำถามผู้ใช้ พร้อมข้อมูลบริบทไปให้ Gemini คิดคำตอบ
  return { reply: callGeminiAPI(userMessage, contextData, settings) };
}

// คำตอบสำรองเมื่อยังไม่ได้ตั้งค่า API Key หรือ API ขัดข้อง
function offlineChatReply(msg) {
  if (msg.includes('สวัสดี') || msg.includes('hello') || msg.includes('hi') || msg.includes('เป็นใคร') || msg.includes('อะไร') || msg.includes('ชื่ออะไร') || msg.length <= 10) {
    return 'อัสลามุอะลัยกุม! ขอสันติจงมีแด่ท่าน ฉันคือ "น้องศึกษา" ผู้ช่วย AI ยินดีให้คำปรึกษาเกี่ยวกับระบบนิเทศออนไลน์สถาบันศึกษาปอเนาะ จังหวัดนราธิวาสครับ<br>สอบถามเรื่องชุดเครื่องมือนิเทศ 7 ฉบับ เกณฑ์การให้คะแนน วงรอบการนิเทศ หรือข้อมูลสถาบันได้เลยครับ';
  }
  if (msg.includes('เกณฑ์') || msg.includes('คะแนน')) {
    return 'ชุดเครื่องมือนิเทศปอเนาะมี 7 ฉบับครับ:<br>• แบบที่ 1 สำรวจข้อมูลพื้นฐานและความพร้อมในการใช้หลักสูตร (ไม่ให้คะแนน)<br>• แบบที่ 2 การบริหารและการใช้หลักสูตร (8 องค์ประกอบ ให้ 4/3/2/1 หรือ N/A รวม 32)<br>• แบบที่ 3 วิเคราะห์หน่วยและแผนการจัดการเรียนรู้ (เชิงคุณภาพ)<br>• แบบที่ 4 สังเกตการจัดการเรียนรู้ในชั้นเรียน (9 ด้าน ให้ 0-3 รวม 27)<br>• แบบที่ 5 ติดตามการวัด ประเมินผล และพัฒนาการผู้เรียน (เชิงคุณภาพ)<br>• แบบที่ 6 สะท้อนผลและแผนพัฒนาหลังการนิเทศ AAR + Action Plan<br>• แบบที่ 7 นิเทศติดตามสำหรับผู้ที่ไม่ใช่ศึกษานิเทศก์ (12 ข้อ ให้ 0/1/2 รวม 24)';
  }
  if (msg.includes('ระดับ')) {
    return 'การจัดระดับผลการนิเทศครับ:<br>• ร้อยละ 80 ขึ้นไป → ดีมาก<br>• ร้อยละ 60-79 → ดี<br>• ร้อยละ 40-59 → พอใช้<br>• ต่ำกว่าร้อยละ 40 → ต้องปรับปรุง';
  }
  if (msg.includes('แบบที่ 7')) {
    return 'แบบที่ 7 สำหรับผู้ที่ไม่ใช่ศึกษานิเทศก์ (เช่น ผู้อำนวยการ ผู้ช่วย ศึกษานิเทศก์เขตพื้นที่ ครูผู้สอนร่วมนิเทศ) มี 12 ข้อ ให้คะแนนข้อละ 0/1/2 รวม 24 คะแนน ใช้ร่วมกับแบบ 1,2 (พฤษภาคม) / แบบ 3,4 (กันยายน) / แบบ 5,6 (มกราคม) ครับ';
  }
  if (msg.includes('แบบที่ 6') || msg.includes('aar') || msg.includes('สะท้อน') || msg.includes('แผนพัฒนา')) {
    return 'แบบที่ 6 เป็นการสะท้อนผลหลังการนิเทศ (AAR: After Action Review) ถามสิ่งที่ทำดี สิ่งที่ควรปรับปรุง บทเรียน และข้อตกลงร่วม พร้อมจัดทำ Action Plan (ประเด็นพัฒนา/กิจกรรม/ผู้รับผิดชอบ/กำหนดเสร็จ/หลักฐาน) ใช้ปุ่ม "ประมวลผลด้วย AI" ช่วยร่างได้ครับ';
  }
  if (msg.includes('รอบ') || msg.includes('ครั้งที่')) {
    return 'วงรอบการนิเทศปอเนาะปีละ 3 ครั้งครับ:<br>• ครั้งที่ 1 พฤษภาคม — รู้สภาพ ใช้แบบ 1, 2, 7<br>• ครั้งที่ 2 กันยายน — ติดตามความก้าวหน้า ใช้แบบ 3, 4, 7<br>• ครั้งที่ 3 มกราคม — ประเมินการเปลี่ยนแปลง ใช้แบบ 5, 6, 7';
  }
  if (msg.includes('กี่') || msg.includes('จำนวน') || msg.includes('สถิติ') || msg.includes('ทั้งหมด')) {
    return 'ขณะนี้ยังไม่ได้เชื่อมต่อ AI สำหรับข้อมูลสถิติ กรุณาตั้งค่า Gemini API Key ก่อนครับ (หรือถามเรื่องเกณฑ์การประเมินได้ทันที)';
  }
  return 'สวัสดีครับ ผมน้องศึกษา พร้อมให้คำแนะนำเรื่องชุดเครื่องมือนิเทศปอเนาะ 7 ฉบับ วงรอบการนิเทศ และเกณฑ์การประเมินได้เลยครับ';
}

// ---------------------------------------------------------
// ฟังก์ชันสำหรับคำนวณและสรุปสถิติปอเนาะจาก Sheet ให้เป็นข้อความ Text
//
// โครงสร้างชีต ADDR_PONDOK (เริ่มข้อมูลจริงที่แถว 3):
//   A=รหัส, B=ชื่อปอเนาะ, C=ที่อยู่, D=อำเภอ, E=ตำบล, F=โทรศัพท์,
//   G=จำนวนบุคลากร, H=จำนวนผู้เรียน, I=จำนวนผู้เรียนต่างชาติ, J=พิกัดแผนที่
// ---------------------------------------------------------
function fetchStatisticsForAI() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // --- ดึงข้อมูลปอเนาะ ---
  const sheetPondok = ss.getSheetByName(SHEET_ADDR_PONDOK);
  const pondokStats = { count: 0, staff: 0, students: 0, foreign: 0 };
  const pondokLines = [];

  if (sheetPondok) {
    const lastRow = sheetPondok.getLastRow();
    if (lastRow >= 3) {
      const dataP = sheetPondok.getRange(3, 1, lastRow - 2, PONDOK_ADDR_COLS).getValues();
      for (let i = 0; i < dataP.length; i++) {
        if (String(dataP[i][0]).trim() != "") { // นับเฉพาะแถวที่มีรหัส
          pondokStats.count++;
          pondokStats.staff    += Number(dataP[i][6]) || 0;
          pondokStats.students += Number(dataP[i][7]) || 0;
          pondokStats.foreign  += Number(dataP[i][8]) || 0;
          pondokLines.push(
            "• " + (dataP[i][1] || '-') +
            " | ที่ตั้ง: " + [dataP[i][4], dataP[i][3]].filter(Boolean).join(' ') +
            " | โทร: " + (dataP[i][5] || '-') +
            " | บุคลากร " + (dataP[i][6] || 0) + " คน | นร. " + (dataP[i][7] || 0) + " คน" +
            (Number(dataP[i][8]) ? " | ต่างชาติ " + dataP[i][8] + " คน" : "")
          );
        }
      }
    }
  }

  // สร้างข้อความ Context ส่งให้ AI รับรู้
  let contextText = "" +
    "[ข้อมูลจริงจากฐานข้อมูลของระบบนิเทศออนไลน์สถาบันศึกษาปอเนาะ — ใช้ตัวเลขเหล่านี้ตอบ ไม่ควรแต่งตัวเลข]\n\n" +
    "1. สถาบันปอเนาะ: ทั้งหมด " + pondokStats.count + " แห่ง\n" +
    "   - บุคลากรรวม " + pondokStats.staff + " คน\n" +
    "   - ผู้เรียนรวม " + pondokStats.students + " คน (ในนั้นเป็นผู้เรียนต่างชาติ " + pondokStats.foreign + " คน)\n\n" +
    "รายชื่อสถาบันปอเนาะ (ข้อมูลสำหรับตอบคำถามรายสถาบัน):\n" + pondokLines.join('\n');

  return contextText;
}

// ---------------------------------------------------------
// ฟังก์ชันเรียก Gemini API (ฝัง Context ไปด้วย)
// ---------------------------------------------------------
function callGeminiAPI(userMessage, contextData, settings) {
  const API_KEY = (settings && settings.geminiKey) ? settings.geminiKey : getGeminiApiKey();
  // ลำดับโมเดลที่ต้องการใช้ (ตัวแรกดีที่สุด ถ้าล้มเหลวจะถอยไปตัวถัดไปอัตโนมัติ)
  const MODELS = (settings && settings.models && settings.models.length) ? settings.models : ['gemini-3.5-flash', 'gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-1.5-flash'];

  const systemPrompt = 'คุณคือ "น้องศึกษา" ผู้ช่วยอัจฉริยะ AI บุคลิกสุภาพ เป็นมิตร กระตือรือร้น ให้เกียรติผู้ใช้งาน ใช้ภาษาไทยที่ถูกต้อง เป็นทางการแต่นุ่มนวล และลงท้ายประโยคด้วย "ครับ/ค่ะ" เสมอ ตอบให้กระชับ ตรงประเด็น ใช้ Bullet points จัดรูปแบบให้อ่านง่าย กฎสำคัญ: เมื่อใดก็ตามที่ผู้ใช้ทักทาย (เช่น "สวัสดี", "hello", "hi") หรือเป็นการสนทนาเริ่มต้น ให้เริ่มคำตอบด้วย "อัสลามุอะลัยกุม! ขอสันติจงมีแด่ท่าน" เสมอ ตามด้วยแนะนำตัว "ฉันคือ \'น้องศึกษา\' ผู้ช่วย AI ของระบบนิเทศออนไลน์สถาบันศึกษาปอเนาะ จังหวัดนราธิวาส" และเสนอความช่วยเหลือ\n\n' +
    "หน้าที่หลักของคุณคือ:\n" +
    "ให้ข้อมูล คำแนะนำ และตอบคำถามที่เกี่ยวข้องกับสถาบันศึกษาปอเนาะในจังหวัดนราธิวาส โดยอ้างอิงจากฐานข้อมูลและระเบียบปฏิบัติที่ถูกต้อง ดังนี้:\n\n" +
    "1. ข้อมูลสถิติสถานศึกษา (ต้องให้ข้อมูลตามที่ผู้ใช้ถาม ทั้งภาพรวมและรายสถาบัน):\n" +
    "- ข้อมูลจำนวนบุคลากรและผู้เรียน (รวมผู้เรียนต่างชาติ)\n" +
    "- ข้อมูลพื้นฐาน: ชื่อปอเนาะ, ที่ตั้ง, อำเภอ/ตำบล, เบอร์โทรศัพท์\n\n" +
    "2. ความรู้เกี่ยวกับประเภทสถานศึกษาเอกชน:\n" +
    "- โรงเรียนเอกชนในระบบ (สามัญศึกษา, อาชีวศึกษา)\n" +
    "- โรงเรียนเอกชนนอกระบบ (กวดวิชา, ศิลปะและกีฬา, วิชาชีพ, สร้างเสริมทักษะชีวิต)\n" +
    "- โรงเรียนเอกชนสอนศาสนาอิสลาม (ประเภท 15(1), 15(2))\n" +
    "- โรงเรียนเอกชนที่สอนควบคู่ (สามัญ-ศาสนา)\n" +
    "- สถาบันศึกษาปอเนาะ (ระดับการเปิดสอน: อิบติดาอียะฮฺ, มุตะวัซซิเฎาะฮฺ, อาลียะฮฺ; เน้นการจัดการเรียนรู้ 8 สาระการเรียนรู้พื้นฐาน; การรายงานผล ปอ.1, ปอ.2, ปอ.3 และการมีส่วนร่วมของครอบครัว/ชุมชน)\n" +
    "- ศูนย์การศึกษาอิสลามประจำมัสยิด (ตาดีกา)\n\n" +
    "3. กฎหมาย ระเบียบ และหลักสูตร:\n" +
    "- พ.ร.บ. โรงเรียนเอกชน พ.ศ. 2550 (และที่แก้ไขเพิ่มเติม)\n" +
    "- ระเบียบที่เกี่ยวข้องกับปอเนาะ, ตาดีกา และมัสยิด\n" +
    "- หลักสูตรอิสลามศึกษาที่ใช้สอนในตาดีกา (เช่น หลักสูตรฟัรฎูอีนประจำมัสยิด)\n" +
    "- หลักสูตรและการจัดการเรียนรู้ในปอเนาะ (8 สาระการเรียนรู้พื้นฐาน)\n\n" +
    "4. ระบบนิเทศออนไลน์สถาบันศึกษาปอเนาะ จังหวัดนราธิวาส (ชุดเครื่องมือนิเทศ 7 ฉบับ):\n" +
    "- แบบที่ 1 สำรวจข้อมูลพื้นฐานและความพร้อมในการใช้หลักสูตร (ไม่ใช้จัดอันดับ)\n" +
    "- แบบที่ 2 ประเมินการบริหารและการใช้หลักสูตร (8 องค์ประกอบ ให้ 4=เข้มแข็ง 3=ดำเนินการได้ 2=อยู่ระหว่างพัฒนา 1=ต้องสนับสนุน หรือ N/A)\n" +
    "- แบบที่ 3 วิเคราะห์หน่วยและแผนการจัดการเรียนรู้ก่อนลงชั้น (เชิงคุณภาพ)\n" +
    "- แบบที่ 4 สังเกตการจัดการเรียนรู้ในชั้นเรียน (9 ด้าน ให้ข้อละ 0-3)\n" +
    "- แบบที่ 5 ติดตามการวัด ประเมินผล และพัฒนาการผู้เรียน (เชิงคุณภาพ)\n" +
    "- แบบที่ 6 สะท้อนผลและแผนพัฒนาหลังการนิเทศ AAR + Action Plan\n" +
    "- แบบที่ 7 นิเทศติดตามสำหรับผู้ที่ไม่ใช่ศึกษานิเทศก์ (12 ข้อ ให้ 0/1/2 + สรุปผล)\n" +
    "- วงรอบการนิเทศปีละ 3 ครั้ง: พฤษภาคม (แบบ 1,2,7), กันยายน (แบบ 3,4,7), มกราคม (แบบ 5,6,7)\n" +
    "- เกณฑ์การจัดระดับ: 80%+ ดีมาก, 60-79% ดี, 40-59% พอใช้, ต่ำกว่า 40% ต้องปรับปรุง\n\n" +
    "ข้อควรระวังและขอบเขต (Boundaries):\n" +
    "- หากคำถามไม่อยู่ในขอบเขตการศึกษาเอกชน (ปอเนาะ/ตาดีกา) จังหวัดนราธิวาส ให้ตอบอย่างสุภาพว่า \"ขออภัยค่ะ น้องศึกษามีข้อมูลเฉพาะด้านสถาบันศึกษาปอเนาะ ตาดีกา และระบบนิเทศออนไลน์ของจังหวัดนราธิวาสเท่านั้นค่ะ\"\n" +
    "- หากผู้ใช้ถามข้อมูลสถิติ ให้ตอบเป็นตารางหรือ Bullet points เพื่อให้อ่านง่าย\n" +
    "- ห้ามให้คำแนะนำทางการแพทย์ การเงิน หรือเรื่องส่วนตัวเด็ดขาด\n" +
    "- หากไม่ทราบข้อมูลที่แน่ชัด ให้แนะนำผู้ใช้ติดต่อกลุ่มงานที่เกี่ยวข้องของสำนักงานการศึกษาเอกชนจังหวัดนราธิวาส\n\n" +
    "รูปแบบการตอบ (Output Format):\n" +
    "- ใช้ Markdown ในการจัดรูปแบบ (เช่น ทำตัวหนาที่หัวข้อ, ทำรายการ (List), หรือสร้างตารางถ้าจำเป็น)\n" +
    "- ตอบให้กระชับ ตรงประเด็น แต่อ่านแล้วรู้สึกถึงความช่วยเหลือและเป็นมิตร";

  // นำคำถามผู้ใช้ มารวมกับข้อมูลสถิติที่ดึงมาได้
  let promptText = systemPrompt + "\n\n";
  if (contextData !== "") {
    promptText += "โปรดใช้ข้อมูลความจริงต่อไปนี้ในการตอบคำถามผู้ใช้ หากตัวเลขเป็น 0 แปลว่ายังไม่ได้บันทึกข้อมูล:\n" + contextData + "\n\n";
  }
  promptText += "คำถามจากผู้ใช้: " + userMessage;

  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.3, // เน้นตอบตรงข้อมูลความจริง
      maxOutputTokens: 500,
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // ลองเรียกแต่ละโมเดลตามลำดับ: ตัวไหนตอบสำเร็จให้ใช้ทันที ถ้า error/quota ให้ถอยไปตัวถัดไป
  for (let i = 0; i < MODELS.length; i++) {
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODELS[i] + ':generateContent?key=' + API_KEY;
    try {
      const response = UrlFetchApp.fetch(API_URL, options);
      const data = JSON.parse(response.getContentText());
      if (data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text;
      }
      // ยังไม่สำเร็จ เก็บข้อความ error ของโมเดลสุดท้ายไว้แจ้งถ้าครบทุกตัวแล้ว
      if (i === MODELS.length - 1) {
        if (data.error) {
          return "AI แจ้งข้อผิดพลาด (รหัส " + (data.error.code || '?') + "): " + (data.error.message || 'ไม่ทราบสาเหตุ');
        }
        return "ขออภัยค่ะ ขณะนี้น้องศึกษาไม่สามารถดึงข้อมูลได้ค่ะ";
      }
    } catch (error) {
      if (i === MODELS.length - 1) {
        return "AI ขัดข้องชั่วคราว: " + error;
      }
      // ลองโมเดลถัดไป
    }
  }
  return "ขออภัยค่ะ ขณะนี้น้องศึกษาไม่สามารถดึงข้อมูลได้ค่ะ";
}

// ============================================================
// ระบบปอเนาะ — CRUD
// ============================================================

// --- ดึงรายชื่อสถาบันศึกษาปอเนาะทั้งหมด (Autocomplete/Directory) ---
function getPondokList() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let list = [];
  const sheet = ss.getSheetByName(SHEET_ADDR_PONDOK);
  if(sheet) {
    const lastRow = sheet.getLastRow();
    if(lastRow >= 3) {
      const rows = sheet.getRange(3, 1, lastRow - 2, PONDOK_ADDR_COLS).getValues();
      for(let i = 0; i < rows.length; i++) {
        if(String(rows[i][0]).trim() !== '') {
          list.push({
            id: rows[i][0],
            type: TYPE_PONDOK,
            name: rows[i][1],
            address: rows[i][2],
            dist: rows[i][3],
            subdist: rows[i][4],
            phone: rows[i][5],
            staff: rows[i][6],
            students: rows[i][7],
            foreign: rows[i][8],
            coords: String(rows[i][9] || '')
          });
        }
      }
    }
  }
  return {success: true, data: list};
}

// --- สถิติระบบนิเทศปอเนาะ (จาก ADDR_PONDOK + DATA_PONDOK) ---
function getStatsPondok() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let totalPondok = 0, totalEval = 0, totalUsers = 0;
  let staff = 0, students = 0, foreign = 0, sumPct = 0, sumPctN = 0;
  const levelCounts = { 'ดีมาก': 0, 'ดี': 0, 'พอใช้': 0, 'ต้องปรับปรุง': 0, 'ไม่ประเมิน': 0, 'ไม่ระบุ': 0 };
  const latest = [];

  const data = ss.getSheetByName(SHEET_DATA_PONDOK);
  if(data) {
    const lastRow = data.getLastRow();
    if(lastRow >= 2) {
      const vals = data.getRange(2, 1, lastRow - 1, DATA_HEADERS.length).getValues();
      totalEval = vals.length;
      vals.forEach(r => {
        const pct = Number(r[9]);
        let lvl = String(r[10] || '').trim();
        if(!lvl || !(lvl in levelCounts)) lvl = 'ไม่ระบุ';
        levelCounts[lvl]++;
        if(!isNaN(pct) && pct > 0) { sumPct += pct; sumPctN++; }
        latest.push({ name: String(r[2] || ''), timestamp: formatDate(r[0]), formType: String(r[3] || ''), pct: isNaN(pct) ? null : pct, level: lvl });
      });
    }
  }
  latest.sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);

  const addr = ss.getSheetByName(SHEET_ADDR_PONDOK);
  if(addr) {
    const lastRow = addr.getLastRow();
    if(lastRow >= 3) {
      const vals = addr.getRange(3, 1, lastRow - 2, PONDOK_ADDR_COLS).getValues();
      vals.forEach(r => {
        if(String(r[0]).trim() === '') return;
        totalPondok++;
        staff += Number(r[6]) || 0;
        students += Number(r[7]) || 0;
        foreign += Number(r[8]) || 0;
      });
    }
  }

  const users = ss.getSheetByName(SHEET_USERS);
  if(users) {
    const lastRow = users.getLastRow();
    if(lastRow >= 2) totalUsers = lastRow - 1;
  }

  return {
    success: true,
    data: {
      totalPondok: totalPondok,
      totalEval: totalEval,
      totalUsers: totalUsers,
      avgPct: sumPctN ? Math.round(sumPct / sumPctN) : 0,
      staff: staff,
      students: students,
      foreign: foreign,
      levelCounts: levelCounts,
      latest: latest.slice(0, 10)
    }
  };
}

// --- ดึงข้อมูลรายละเอียดของปอเนาะที่เลือก (รองรับ payload เป็น string หรือ {id}) ---
function getPondokData(id) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  id = String(typeof id === 'object' && id !== null ? (id.id || '') : id).trim();
  const sheet = ss.getSheetByName(SHEET_ADDR_PONDOK);
  if(sheet) {
    const lastRow = sheet.getLastRow();
    if(lastRow >= 3) {
      const rows = sheet.getRange(3, 1, lastRow - 2, PONDOK_ADDR_COLS).getValues();
      for(let i = 0; i < rows.length; i++) {
        if(String(rows[i][0]).trim() === id) {
          return {
            success: true,
            data: {
              row: i + 6,
              type: TYPE_PONDOK,
              id: rows[i][0], name: rows[i][1], address: rows[i][2],
              dist: rows[i][3], subdist: rows[i][4], phone: rows[i][5],
              staff: rows[i][6], students: rows[i][7], foreign: rows[i][8],
              coords: String(rows[i][9] || '')
            }
          };
        }
      }
    }
  }
  return {success: false, message: "ไม่พบข้อมูลปอเนาะ"};
}

// --- บันทึกพิกัดแผนที่ลงคอลัมน์ J ของ ADDR_PONDOK (ไม่แตะคอลัมน์อื่น) ---
function savePondokPin(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const p = (typeof payload === 'object' && payload !== null) ? payload : {};
  const id = String(p.id || '').trim();
  const coords = String(p.coords || '').trim();
  if (!id) return {success: false, message: 'ไม่พบรหัสปอเนาะ'};
  if (!coords) return {success: false, message: 'ไม่พบพิกัดแผนที่'};
  const sheet = ss.getSheetByName(SHEET_ADDR_PONDOK);
  if (!sheet) return {success: false, message: 'ไม่พบชีต ADDR_PONDOK'};
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return {success: false, message: 'ไม่มีข้อมูลปอเนาะ'};
  const ids = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === id) {
      sheet.getRange(3 + i, 10).setValue(coords);
      return {success: true, message: 'บันทึกพิกัดแผนที่เรียบร้อย'};
    }
  }
  return {success: false, message: 'ไม่พบรหัสปอเนาะในข้อมูล'};
}

// --- บันทึก/แก้ไขผลนิเทศปอเนาะ + อัปเดตข้อมูลปอเนาะ ---
// ⚠️ อัปเดต ADDR_PONDOK เฉพาะคอลัมน์ B-I (ต่างจาก saveEvaluation ของตาดีกาที่เขียน 22 คอลัมน์)
function savePondokEvaluation(payload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const t = payload.pondokData || {};
  const e = payload.evalData || {};

  const addrSheet = ss.getSheetByName(SHEET_ADDR_PONDOK);
  const addrRow = Number(t.row || 0);
  if (addrSheet && addrRow >= 3 && addrRow <= addrSheet.getLastRow()) {
    const rowId = String(addrSheet.getRange(addrRow, 1).getValue()).trim();
    if (rowId && rowId === String(t.id || '').trim()) {
      addrSheet.getRange(addrRow, 2, 1, 8).setValues([[
        t.name, t.address, t.dist, t.subdist, t.phone, t.staff, t.students, t.foreign
      ]]);
    }
  }

  const dataSheet = ensureDataSheet(TYPE_PONDOK);
  const supervisor = String(payload.supervisor || '');
  const now = new Date();
  const detailsJSON = JSON.stringify({
    formNo: e.formNo || '',
    round: e.round || '',
    answers: e.answers || {},
    notes: e.notes || {},
    summary: e.summary || {},
    actionPlan: e.actionPlan || [],
    strengths: e.strengths || '',
    improve: e.improve || '',
    support: e.support || '',
    agreements: e.agreements || '',
    comment: e.comment || ''
  });

  if(payload.editRow && !isNaN(payload.editRow)) {
    const row = Number(payload.editRow);
    dataSheet.getRange(row, 4).setValue(e.formType);
    dataSheet.getRange(row, 5).setValue(e.score1 !== undefined ? e.score1 : '');
    dataSheet.getRange(row, 6).setValue(e.score2 !== undefined ? e.score2 : '');
    dataSheet.getRange(row, 7).setValue(e.score3 !== undefined ? e.score3 : '');
    dataSheet.getRange(row, 8).setValue(e.score4 !== undefined ? e.score4 : '');
    dataSheet.getRange(row, 9).setValue(e.totalScore !== undefined ? e.totalScore : '');
    dataSheet.getRange(row, 10).setValue(e.pct !== undefined && e.pct !== null ? e.pct : '');
    dataSheet.getRange(row, 11).setValue(e.level);
    dataSheet.getRange(row, 12).setValue(detailsJSON);
    dataSheet.getRange(row, 14).setValue(now);
    dataSheet.getRange(row, 15).setValue(supervisor);
    return {
      success: true,
      message: 'แก้ไขผลการนิเทศเรียบร้อยแล้ว!<br>แก้ไขครั้งล่าสุด: ' + formatDate(now) + ' โดย ' + supervisor,
      lastEdit: formatDate(now),
      lastEditor: supervisor
    };
  }

  dataSheet.appendRow([now, t.id, t.name, e.formType,
    e.score1 !== undefined ? e.score1 : '', e.score2 !== undefined ? e.score2 : '',
    e.score3 !== undefined ? e.score3 : '', e.score4 !== undefined ? e.score4 : '',
    e.totalScore !== undefined ? e.totalScore : '',
    e.pct !== undefined && e.pct !== null ? e.pct : '', e.level,
    detailsJSON, supervisor, now, supervisor]);
  return {success: true, message: 'อัปเดตข้อมูลปอเนาะ และบันทึกผลการนิเทศเรียบร้อยแล้ว!', lastEdit: formatDate(now), lastEditor: supervisor};
}

// --- ผู้ดูแลระบบ: ลบบันทึกผลนิเทศปอเนาะ (แถวใน DATA_PONDOK) ---
function deletePondokEvaluation(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const requester = String(data && data.username ? data.username : '').trim();
  const row = Number(data && data.row ? data.row : 0);

  // ตรวจสิทธิ์: เฉพาะผู้ดูแลระบบ (ชีต USERS)
  let isAdmin = false;
  const users = ss.getSheetByName(SHEET_USERS);
  if(users) {
    const lastRow = users.getLastRow();
    if(lastRow >= 2) {
      const rows = users.getRange(2, 1, lastRow - 1, 6).getValues();
      for(let i = 0; i < rows.length; i++) {
        if(String(rows[i][0]).trim() === requester && String(rows[i][5] || '').trim() === 'ผู้ดูแลระบบ') { isAdmin = true; break; }
      }
    }
  }
  if(!isAdmin) return {success: false, message: 'ลบบันทึกได้เฉพาะผู้ดูแลระบบ'};

  const target = ss.getSheetByName(SHEET_DATA_PONDOK);
  if(!target) return {success: false, message: 'ไม่พบชีต DATA_PONDOK'};
  const lastRow = target.getLastRow();
  if(row < 2 || row > lastRow) return {success: false, message: 'เลขแถวไม่ถูกต้อง'};

  // กันลบพลาด: แถวต้องมี ID ศูนย์ (คอลัมน์ B) จึงเป็นข้อมูลนิเทศจริง
  // (โหมด force=true ของผู้ดูแลระบบ ใช้เก็บกวาดแถวขยะ/แถวเสียได้)
  const idVal = String(target.getRange(row, 2).getValue()).trim();
  if(idVal === '') {
    if(data.force !== true) return {success: false, message: 'แถวนี้ไม่ใช่ข้อมูลการนิเทศ (ต้องยืนยัน force)'};
  }
  const nameVal = String(target.getRange(row, 3).getValue()).trim();

  target.deleteRow(row);
  return {success: true, message: '🗑 ลบบันทึกนิเทศ "' + nameVal + '" (แถว ' + row + ') เรียบร้อย'};
}
