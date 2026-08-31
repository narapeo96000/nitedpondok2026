# ระบบนิเทศออนไลน์ สถาบันศึกษาปอเนาะ จ.นราธิวาส (2569)

โปรเจกต์พัฒนาแยกจากระบบตาดีกา — มี Apps Script project, ฐานข้อมูล และโฮสต์หน้าเว็บของตัวเอง

## โครงสร้าง

```
├── apps-script/          # โค้ด Google Apps Script (backend API)
│   ├── รหัส.js           # ตัวประมวลผล API (ปอเนาะล้วน ไม่มีโค้ดตาดีกา)
│   └── appsscript.json   # manifest
├── index.html            # หน้าเว็บหลัก (โฮสต์ผ่าน GitHub Pages)
├── .clasp.json           # กำหนด mapping กับ Apps Script project (clasp)
├── deploy.ps1            # สคริปต์ deploy อัตโนมัติ (push → version → redeploy)
└── tests/
    └── crud_test.ps1     # ทดสอบ CRUD กับ API จริง (สร้าง→แก้ไข→ลบ→คืน baseline)
```

## การ deploy

```powershell
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

- ต้อง `clasp login` บัญชีเจ้าของ project ก่อน
- ใช้ `.clasp.json` (`rootDir=apps-script`) push code ชุดเดียวกับใน repo
- หมายเลข version ใหม่ถูกสร้างและ redeploy ชี้ deployment เดิม (URL คงเดิม)

## พารามิเตอร์หลัก

| รายการ | ค่า |
|---|---|
| Apps Script project ID | `1130pkeITPJKmXlOi688E6lCK1UfmdrB98RpTWZFEgbfw5shmZyJUK_Zb` |
| Web App (API) | `https://script.google.com/macros/s/AKfycbzon0T2E0dxsoZH4NoiKFAFr-jiNgV9e_zpynCm5k0gDErNQSUgIJY2tI5pyp4g0S41/exec` |
| Google Sheets (ร่วมกับตาดีกา) | แท็บ `ADDR_PONDOK`, `DATA_PONDOK`, `USERS` |
| GitHub Pages | `https://narapeo96000.github.io/nitedpondok2026/` |

## ชุดเครื่องมือนิเทศปอเนาะ 7 ฉบับ

1. แบบสำรวจข้อมูลพื้นฐานและความพร้อมในการใช้หลักสูตร (ไม่ให้คะแนน)
2. ประเมินการบริหารและการใช้หลักสูตร (8 องค์ประกอบ, 4/3/2/1/N/A)
3. วิเคราะห์หน่วยและแผนการจัดการเรียนรู้ (เชิงคุณภาพ)
4. สังเกตการจัดการเรียนรู้ในชั้นเรียน (9 ด้าน, 0–3)
5. ติดตามการวัด ประเมินผล และพัฒนาการผู้เรียน (เชิงคุณภาพ)
6. สะท้อนผลและแผนพัฒนาหลังการนิเทศ AAR + Action Plan
7. นิเทศติดตามสำหรับผู้ที่ไม่ใช่ศึกษานิเทศก์ (12 ข้อ, 0/1/2)

วงรอบการนิเทศปีละ 3 ครั้ง: พฤษภาคม (แบบ 1,2,7) · กันยายน (แบบ 3,4,7) · มกราคม (แบบ 5,6,7)