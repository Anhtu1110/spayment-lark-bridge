import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const LARK_WEBHOOK_URL = process.env.LARK_WEBHOOK_URL;

if (!LARK_WEBHOOK_URL) {
  console.error("⚠️ Missing LARK_WEBHOOK_URL");
  process.exit(1);
}

// Cache tránh gửi trùng
const processedTxIds = new Set();
const MAX_CACHE_SIZE = 1000;

function markProcessed(txId) {
  processedTxIds.add(txId);
  if (processedTxIds.size > MAX_CACHE_SIZE) {
    // xóa bớt cho đỡ phình, lấy phần tử đầu tiên trong Set
    const first = processedTxIds.values().next().value;
    processedTxIds.delete(first);
  }
}

// Health check
app.get("/", (req, res) => {
  res.send("sPayment ↔ Lark bridge is running");
});

// Webhook chính
app.post("/webhook/spayment", async (req, res) => {
  try {
    const payload = req.body;
    console.log("🔥 sPayment payload:", JSON.stringify(payload, null, 2));

    const tx = payload?.data?.[0];

    if (!tx) {
      console.warn("⚠️ No transaction data found");
      return res.status(200).json({ status: "no_data" });
    }

    const {
      id,
      type,
      transactionID,
      amount,
      description,
      bank,
    } = tx;

    const txKey = transactionID || id;

    // 🧱 CHẶN TRÙNG Ở ĐÂY
    if (txKey && processedTxIds.has(txKey)) {
      console.log("♻️ Duplicate transaction, skip send:", txKey);
      return res.status(200).json({ status: "duplicate" });
    }

    // đánh dấu đã xử lý
    if (txKey) {
      markProcessed(txKey);
    }

    const direction = type === "IN" ? "💸 Nhận tiền" : "💳 Giao dịch";
    const formattedAmount =
      Number(amount).toLocaleString("vi-VN") + " VND";

    const text = [
      "📩 Giao dịch mới từ sPayment",
      direction,
      `🏦 Ngân hàng: ${bank?.toUpperCase?.() || bank || "N/A"}`,
      `💰 Số tiền: ${formattedAmount}`,
      `🔢 Mã giao dịch: ${transactionID}`,
      `📝 Nội dung: ${description}`,
      "",
      "Nguồn: sPayment webhook",
    ].join("\n");

    const larkResp = await fetch(LARK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: { text },
      }),
    });

    const larkData = await larkResp.json().catch(() => ({}));
    console.log("✅ Lark response:", larkData);

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("💥 Webhook error:", err);
    return res.status(500).json({ status: "error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 sPayment ↔ Lark bridge running on port ${PORT}`);
});
