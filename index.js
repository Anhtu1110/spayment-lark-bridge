import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json()); // parse JSON body

const LARK_WEBHOOK_URL = process.env.LARK_WEBHOOK_URL;

if (!LARK_WEBHOOK_URL) {
  console.error("❌ Missing LARK_WEBHOOK_URL in .env");
  process.exit(1);
}

// Health check
app.get("/", (req, res) => {
  res.send("sPayment ↔ Lark bridge is running");
});

// Main webhook
app.post("/webhook/spayment", async (req, res) => {
  console.log("🔥 Incoming sPayment payload:", JSON.stringify(req.body, null, 2));

  try {
    // sPayment payload dạng:
    // { status: true, data: [ { ...giao_dich... } ] }
    const tx = req.body?.data?.[0] || req.body;

    if (!tx) {
      console.warn("⚠️ No transaction object found in payload");
      // vẫn trả 200 cho sPayment
      return res.sendStatus(200);
    }

    const type = tx.type || "UNKNOWN";
    const bank = (tx.bank || "").toUpperCase();
    const transactionID = tx.transactionID || tx.trans_id || tx.id || "";
    const amountRaw = tx.amount || tx.amount_vnd || "0";
    const description = tx.description || tx.content || "";

    const amountNumber = Number(amountRaw) || 0;
    const formattedAmount =
      amountNumber.toLocaleString("vi-VN") + " VND";

    const direction =
      type === "IN"
        ? "💸 Nhận tiền"
        : type === "OUT"
        ? "💳 Chuyển tiền"
        : "🔁 Giao dịch";

    const lines = [
      "📩 Giao dịch mới từ sPayment",
      direction,
      bank && `🏦 Ngân hàng: ${bank}`,
      `💰 Số tiền: ${formattedAmount}`,
      transactionID && `🔢 Mã giao dịch: ${transactionID}`,
      description && `📝 Nội dung: ${description}`,
      "",
      "Nguồn: sPayment webhook",
    ].filter(Boolean);

    const text = lines.join("\n");

    // Gửi sang Lark
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

    // Trả về cho sPayment: luôn 200 nếu xử lý xong tới đây
    return res.sendStatus(200);
  } catch (err) {
    console.error("💥 Error handling webhook:", err);
    // Nếu toang nặng thì cho sPayment biết
    return res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 sPayment ↔ Lark bridge running on port ${PORT}`);
});
