require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

const COL_ID = process.env.COL_ID || "ID";
const COL_NO = process.env.COL_NO || "number";
const COL_NAME = process.env.COL_NAME || "name";
const COL_NICKNAME = process.env.COL_NICKNAME || "nickname";
const COL_USERNAME = process.env.COL_USERNAME || "username";
const COL_STATUS = process.env.COL_STATUS || "status";

function checkEnv() {
  const missing = [];
  if (!LINE_CHANNEL_ACCESS_TOKEN) missing.push("LINE_CHANNEL_ACCESS_TOKEN");
  if (!APPS_SCRIPT_URL) missing.push("APPS_SCRIPT_URL");

  if (missing.length > 0) {
    console.log("❌ ยังขาดค่าใน .env:", missing.join(", "));
    return false;
  }
  return true;
}

function normalizeText(text) {
  return String(text || "").trim();
}

function toKey(text) {
  return normalizeText(text).toLowerCase();
}

async function findContestant(keyword) {
  const res = await axios.get(APPS_SCRIPT_URL, {
    params: { q: keyword },
    timeout: 10000
  });

  return res.data.data || null;
}

function buildContestantMessage(row, keyword) {
  if (!row) {
    return `ไม่พบข้อมูลจากคำว่า "${keyword}" นะคะ\n\nลองพิมพ์รหัส เช่น JJ401 หรือชื่อผู้สมัครอีกครั้งค่ะ`;
  }

  const id = row[COL_ID] || "-";
  const no = row[COL_NO] || "-";
  const name = row[COL_NAME] || "-";
  const nickname = row[COL_NICKNAME] || "-";
  const username = row[COL_USERNAME] || "-";
  const status = row[COL_STATUS] || "-";

  return [
    "🎤 ข้อมูลผู้สมัคร",
    `รหัส: ${id}`,
    `หมายเลข: ${no}`,
    `ชื่อ: ${name}`,
    `Username: ${username}`,
    `สถานะ: ${status}`
  ].join("\n");
}

async function replyLine(replyToken, text) {
  if (!replyToken) return;

  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken,
      messages: [
        {
          type: "text",
          text: String(text).slice(0, 4900)
        }
      ]
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      },
      timeout: 10000
    }
  );
}

app.get("/", (req, res) => {
  res.send("LINE Sheet Bot is running ✅");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "line-sheet-bot" });
});

app.post("/webhook", async (req, res) => {
  res.status(200).json({ ok: true });

  try {
    if (!checkEnv()) return;

    const events = req.body.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (!event.message || event.message.type !== "text") continue;

      const text = normalizeText(event.message.text);
      const replyToken = event.replyToken;

      console.log("📩 ได้ข้อความ:", text);

      if (["help", "วิธีใช้", "ช่วยเหลือ"].includes(toKey(text))) {
        await replyLine(
          replyToken,
          "วิธีใช้บอท\n\nพิมพ์รหัสผู้สมัคร เช่น JJ401\nหรือพิมพ์ชื่อ / ชื่อเล่น เพื่อค้นหาข้อมูลจาก Google Sheet"
        );
        continue;
      }

// รับเฉพาะ JJ401 - JJ480
const searchCode = text.toUpperCase();

const match = searchCode.match(/^JJ(\d{3})$/);

if (!match) {
  continue;
}

const number = parseInt(match[1], 10);

if (number < 401 || number > 480) {
  continue;
}

const contestant = await findContestant(searchCode);
const message = buildContestantMessage(contestant, searchCode);
await replyLine(replyToken, message);
    }
  } catch (err) {
    console.error("❌ webhook error:", err.response?.data || err.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  checkEnv();
  console.log(`✅ Webhook path: /webhook`);
});