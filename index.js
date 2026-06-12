require("dotenv").config();

const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const tiktokUsername = process.env.TIKTOK_USERNAME;
const webhookUrl = process.env.GAS_WEBHOOK_URL;
const secret = process.env.SECRET;
const liveId = process.env.LIVE_ID || "live";

const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const lineGroupId = process.env.LINE_GROUP_ID;

const seenVotes = new Set();

const validCandidates = (process.env.VALID_CANDIDATES || "")
  .split(",")
  .map(x => x.trim().toUpperCase())
  .filter(Boolean);

console.log("กำลังชม TikTok:", tiktokUsername);
console.log("Google Sheet Webhook:", webhookUrl ? "มีแล้ว" : "ไม่มี");
console.log("LINE Token:", lineToken ? "มีแล้ว" : "ไม่มี");
console.log("LINE Group ID:", lineGroupId ? lineGroupId : "ไม่มี");
console.log("Valid candidates:", validCandidates);

const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername, {
  disableEulerFallbacks: true
});

function extractCandidate(comment) {
  const text = String(comment || "").trim().toUpperCase();

  console.log("คอมเม้นที่พิมพ์มา:", text);

  const match = text.match(/^โหวต\s*JJ(\d{3})$/i);

  if (!match) return null;

  const candidateCode = `โหวตJJ${match[1]}`.toUpperCase();

  if (validCandidates.length > 0 && !validCandidates.includes(candidateCode)) {
    console.log("ไม่รับผู้เข้าแข่งขันหมายเลขนี้:", candidateCode);
    return null;
  }

  return candidateCode;
}

async function sendVoteToSheet(payload) {
  console.log("ส่งไปอัพเดทที่ sheet:", payload);

  const res = await axios.post(webhookUrl, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 10000
  });

  console.log("sheet response:", res.data);

  if (!res.data || res.data.ok !== true) {
    throw new Error("Google Sheet save failed");
  }

  return res.data;
}

async function replyLineMessage(replyToken, message) {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken,
      messages: [{ type: "text", text: message }]
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lineToken}`
      },
      timeout: 10000
    }
  );
}

async function getRandomWinners(count) {
  const res = await axios.get(webhookUrl, {
    params: {
      action: "random",
      count,
      secret
    },
    timeout: 10000
  });

  if (!res.data || res.data.ok !== true) {
    throw new Error("Random winners failed");
  }

  return res.data.winners || [];
}


app.get("/", (req, res) => {
  res.send("Jadjan bot is running ✅");
});

app.post("/line-webhook", async (req, res) => {
  console.log("LINE WEBHOOK RECEIVED:", JSON.stringify(req.body));
  res.sendStatus(200);

  try {
    const events = req.body.events || [];

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const text = String(event.message.text || "").trim();
      const match = text.match(/^สุ่ม(\d+)$/);

      if (!match) continue;

      const count = Number(match[1]);
      const winners = await getRandomWinners(count);

      if (winners.length === 0) {
        await replyLineMessage(event.replyToken, "ยังไม่มีข้อมูลสำหรับสุ่ม");
        continue;
      }

      const message =
        `🎉 ผู้โชคดี ${winners.length} ท่าน\n\n` +
        winners.map((w, i) =>
          `${i + 1}. ${w.nickname || "-"}\n` +
          `TikTok: ${w.username || "-"}\n` +
          `โหวตให้: ${w.candidateNo || "-"}`
        ).join("\n\n");

      await replyLineMessage(event.replyToken, message);
    }
  } catch (err) {
    console.error("LINE webhook error:", err.message);
  }
});

tiktokLiveConnection
  .connect()
  .then(state => {
    console.log(`Connected to TikTok Live roomId: ${state.roomId}`);
    console.log("รอ comments...");
  })
  .catch(err => {
    console.error("เชื่อมต่อ TikTok ไม่ได้:", err);
  });

tiktokLiveConnection.on("chat", async data => {
  console.log("CHAT EVENT RECEIVED");
  console.log({
    username: data.uniqueId,
    nickname: data.nickname,
    comment: data.comment
  });

  try {
    const comment = data.comment || "";
    const candidateNo = extractCandidate(comment);

    if (!candidateNo) {
      console.log("ไม่พบเลขลงทะเบียนในคอมเม้น");
      return;
    }

    const username = data.uniqueId || "";
    const nickname = data.nickname || "";
    const userId = data.userId || username;

    const voteKey = `${liveId}:${userId}`;

    if (seenVotes.has(voteKey)) {
      console.log(`โหวตซ้ำ ignored: ${username}`);
      return;
    }

    seenVotes.add(voteKey);

    const payload = {
      secret,
      candidateNo,
      nickname,
      username,
      comment,
      liveId,
      userId,
      raw: {
        createTime: data.createTime,
        msgId: data.msgId
      }
    };

    await sendVoteToSheet(payload);

    console.log(`Vote saved: ${username} -> ${candidateNo}`);
  } catch (err) {
    console.error("Chat handler error:", err.message);
  }
});

tiktokLiveConnection.on("disconnected", () => {
  console.log("Disconnected from TikTok Live");
});

app.listen(PORT, () => {
  console.log(`LINE webhook server running on port ${PORT}`);
});