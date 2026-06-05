# LINE Sheet Bot

โปรเจกต์นี้ใช้สำหรับอ่านข้อความใน LINE group แล้วค้นหาข้อมูลจาก Google Sheet จากนั้นตอบกลับไปที่ LINE group อัตโนมัติ

## 1) ติดตั้ง Node.js package

```bash
npm install
```

## 2) สร้างไฟล์ .env

copy ไฟล์ `.env.example` แล้วเปลี่ยนชื่อเป็น `.env`

```bash
copy .env.example .env
```

จากนั้นใส่ค่าจริง:

```env
PORT=3000
LINE_CHANNEL_ACCESS_TOKEN=ใส่_CHANNEL_ACCESS_TOKEN_จาก_LINE
GOOGLE_SHEET_ID=ใส่_ID_ของ_GOOGLE_SHEET
GOOGLE_SHEET_NAME=contesttant
COL_ID=ID
COL_NO=number
COL_NAME=name
COL_NICKNAME=nickname
COL_STATUS=status
GOOGLE_CREDENTIALS_JSON={...}
```

## 3) เตรียม Google Sheet

แถวแรกต้องเป็นชื่อคอลัมน์ เช่น

| ID | number | name | nickname | status |
|---|---|---|---|---|
| JJ401 | 401 | น้องจริงใจ | จริงใจ | ลงทะเบียนแล้ว |

## 4) แชร์ Google Sheet ให้ Service Account

ใน JSON ของ Service Account จะมี `client_email` เช่น

```text
xxxx@xxxx.iam.gserviceaccount.com
```

ให้เอา email นี้ไป Share Google Sheet เป็น Viewer หรือ Editor

## 5) รันโปรแกรม

```bash
node index.js
```

ถ้ารันสำเร็จจะขึ้นประมาณนี้

```text
🚀 Server started on port 3000
✅ Webhook path: /webhook
```

## 6) เปิด Webhook ฟรีด้วย Cloudflare Tunnel

ติดตั้ง cloudflared:

```bash
npm install -g cloudflared
```

เปิด tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

จะได้ URL ประมาณนี้:

```text
https://xxxx.trycloudflare.com
```

เอา URL ไปใส่ใน LINE Webhook URL แบบนี้:

```text
https://xxxx.trycloudflare.com/webhook
```

## 7) ทดสอบใน LINE group

พิมพ์ในกลุ่ม:

```text
JJ401
```

บอทจะตอบกลับ:

```text
🎤 ข้อมูลผู้สมัคร
รหัส: JJ401
หมายเลข: 401
ชื่อ: น้องจริงใจ
ชื่อเล่น: จริงใจ
สถานะ: ลงทะเบียนแล้ว
```

## คำสั่งช่วยเหลือ

พิมพ์:

```text
help
```

หรือ

```text
วิธีใช้
```
