# ============================================================
#  crud_test.ps1 - ทดสอบ CRUD ระบบนิเทศปอเนาะกับชีตจริง
#  วิธีใช้: powershell -ExecutionPolicy Bypass -File crud_test.ps1
#  (จะสร้างข้อมูลทดสอบ -> แก้ไข -> ลบทิ้ง จนชีตกลับสู่ baseline)
# ============================================================
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$API = 'https://script.google.com/macros/s/AKfycbzon0T2E0dxsoZH4NoiKFAFr-jiNgV9e_zpynCm5k0gDErNQSUgIJY2tI5pyp4g0S41/exec'
$ADMIN_USER = 'admin'
$ADMIN_PASS = 'admin123'   # รหัส seed เริ่มต้นของระบบ (แก้ถ้าผู้ดูแลเปลี่ยนแล้ว)

function Post($o) {
  $json = $o | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Uri $API -Method Post `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) `
    -ContentType 'text/plain;charset=utf-8' -TimeoutSec 120
}
function Log($m) { Write-Host ("  " + $m) }

Write-Host "=== [0] BASELINE ===" -ForegroundColor Cyan
$stats = Post @{ action = 'getStatsPondok' }
$baseline = [int]$stats.data.totalEval
Log "totalEval=$baseline totalPondok=$($stats.data.totalPondok)"

Write-Host "=== [1] READ: getPondokList + getPondokData ===" -ForegroundColor Cyan
$list = Post @{ action = 'getPondokList' }
$c = $list.data[0]
Log "list=$($list.data.Count) centers | first id=$($c.id) name=$($c.name)"
$d = Post @{ action = 'getPondokData'; payload = [string]$c.id }
$t = $d.data
if (-not $t) { throw "getPondokData failed" }
Log "data row=$($t.row) type=$($t.type) dist=$($t.dist) staff=$($t.staff) students=$($t.students) foreign=$($t.foreign)"

# ข้อมูลศูนย์แบบส่งคืนค่าเดิมทั้งหมด (ไม่ให้การทดสอบไปแก้ ADDR_PONDOK)
$pond = @{
  row      = [int]$t.row; type = 'ปอเนาะ'; id = [string]$t.id; name = [string]$t.name
  address  = [string]$t.address; dist = [string]$t.dist; subdist = [string]$t.subdist
  phone    = [string]$t.phone; staff = $t.staff; students = $t.students; foreign = $t.foreign
}

# เคลียร์ขยะจากรอบทดสอบก่อนหน้า (ถ้ามี)
Write-Host "=== [2] CLEANUP stray rows (จากรอบก่อน) ===" -ForegroundColor Cyan
$h0 = Post @{ action = 'getEvaluations'; payload = [string]$c.id }
$stray = @($h0.data | Where-Object { $_.type -eq 'ปอเนาะ' })
if ($stray.Count -gt 0) {
  $lg = Post @{ action = 'login'; payload = @{ username = $ADMIN_USER; password = $ADMIN_PASS } }
  if ($lg.success -and $lg.userData.role -eq 'ผู้ดูแลระบบ') {
    foreach ($r in ($stray | Sort-Object { [int]$_.row } -Descending)) {
      $del = Post @{ action = 'deletePondokEvaluation'; payload = @{ username = $ADMIN_USER; row = [int]$r.row } }
      Log "deleted row $($r.row): $($del.success)"
    }
  } else {
    Write-Host "  !! login admin ไม่สำเร็จ - ลบขยะเองไม่ได้" -ForegroundColor Yellow
  }
}

Write-Host "=== [3] CREATE (แบบที่ 7, 19/24 = 79% = ดี) ===" -ForegroundColor Cyan
$eval = @{
  formNo = 7; formType = 'แบบที่ 7'; round = 'ครั้งที่ 1 (พฤษภาคม)'
  score1 = 10; score2 = 9; score3 = ''; score4 = ''
  totalScore = 19; pct = 79; level = 'ดี'
  answers = @{ 'F7.A.0'=2;'F7.A.1'=2;'F7.A.2'=2;'F7.A.3'=2;'F7.A.4'=2;'F7.A.5'=0;'F7.B.0'=2;'F7.B.1'=2;'F7.B.2'=1;'F7.B.3'=2;'F7.B.4'=1;'F7.B.5'=1 }
  notes = @{ 'F7.A.5' = 'ทดสอบหมายเหตุ' }
  summary = @{ good='ทดสอบระบบ'; develop='-'; support='-'; agreement='ข้อตกลงทดสอบ' }
  actionPlan = @(); strengths=''; improve=''; support=''; agreements=''; comment=''
}
$save = Post @{ action = 'savePondokEvaluation'; payload = @{ supervisor = 'ทดสอบระบบอัตโนมัติ'; pondokData = $pond; evalData = $eval } }
Log "success=$($save.success) | $($save.message)"
if (-not $save.success) { throw "CREATE failed" }

$h1 = Post @{ action = 'getEvaluations'; payload = [string]$c.id }
$p1 = @($h1.data | Where-Object { $_.type -eq 'ปอเนาะ' })[0]
$rowNo = [int]$p1.row
Log "verify: sheetRow=$rowNo form=$($p1.formType) round=$(($p1.details).round) total=$($p1.totalScore) pct=$($p1.pct) level=$($p1.level)"
$s1 = Post @{ action = 'getStatsPondok' }
Log "totalEval=$($s1.data.totalEval) (expect $($baseline + 1))"

Write-Host "=== [4] UPDATE (editRow=$rowNo -> 20/24 = 83% = ดีมาก) ===" -ForegroundColor Cyan
$eval.level = 'ดีมาก'; $eval.totalScore = 20; $eval.pct = 83; $eval.score2 = 10
$u = Post @{ action = 'savePondokEvaluation'; payload = @{ supervisor = 'ทดสอบระบบอัตโนมัติ'; editRow = [string]$rowNo; pondokData = $pond; evalData = $eval } }
Log "success=$($u.success) | lastEdit=$($u.lastEdit) by $($u.lastEditor)"
$h2 = Post @{ action = 'getEvaluations'; payload = [string]$c.id }
$p2 = @($h2.data | Where-Object { $_.type -eq 'ปอเนาะ' })[0]
Log "verify: total=$($p2.totalScore) pct=$($p2.pct) level=$($p2.level) lastEditor=$($p2.lastEditor)"
$s2 = Post @{ action = 'getStatsPondok' }
Log "totalEval=$($s2.data.totalEval) (expect $($baseline + 1) - ไม่เพิ่มแถว)"

Write-Host "=== [5] SECURITY: non-admin delete ต้องถูกปฏิเสธ ===" -ForegroundColor Cyan
$sec = Post @{ action = 'deletePondokEvaluation'; payload = @{ username = '__not_admin__'; row = $rowNo } }
Log "success=$($sec.success) (expect False) | $($sec.message)"

Write-Host "=== [6] DELETE by admin ===" -ForegroundColor Cyan
$lg = Post @{ action = 'login'; payload = @{ username = $ADMIN_USER; password = $ADMIN_PASS } }
Log "login admin success=$($lg.success) role=$($lg.userData.role)"
if ($lg.success -and $lg.userData.role -eq 'ผู้ดูแลระบบ') {
  $bad = Post @{ action = 'deletePondokEvaluation'; payload = @{ username = $ADMIN_USER; row = 999999 } }
  Log "delete wrong-row success=$($bad.success) (expect False) | $($bad.message)"
  $del = Post @{ action = 'deletePondokEvaluation'; payload = @{ username = $ADMIN_USER; row = $rowNo } }
  Log "delete row ${rowNo}: success=$($del.success) | $($del.message)"
} else {
  Write-Host "  !! ไม่มีสิทธิ์ admin - ข้าม (ข้อมูลทดสอบยังอยู่ใน DATA_PONDOK!)" -ForegroundColor Yellow
}

Write-Host "=== [7] FINAL STATE ===" -ForegroundColor Cyan
$h3 = Post @{ action = 'getEvaluations'; payload = [string]$c.id }
$left = @($h3.data | Where-Object { $_.type -eq 'ปอเนาะ' }).Count
$s3 = Post @{ action = 'getStatsPondok' }
Log "remaining pondok records for center = $left"
Log "totalEval=$($s3.data.totalEval) (baseline=$baseline)"
if ([int]$s3.data.totalEval -eq $baseline) {
  Write-Host "`n=== PASS: CRUD ครบ + ชีตกลับสู่ baseline ===" -ForegroundColor Green
} else {
  Write-Host "`n=== WARN: ยังมีข้อมูลทดสอบค้าง ตรวจ DATA_PONDOK ===" -ForegroundColor Yellow
}
