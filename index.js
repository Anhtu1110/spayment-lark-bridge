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

// Health check
app.get("/", (req, res) => {
  res.send("sPayment ↔ Lark bridge is running");
});

// Webhook chính
app.post("/webhook/spayment", async (req, res) => {
  try {
    const payload = req.body;
    console.log("🔥 sPayment payload:", JSON.stringify(payload, null, 2));

    // ✅ sPayment gửi data dạng mảng
    const tx = payload?.data?.[0];

    if (!tx) {
      console.warn("⚠️ No transaction data found");
      return res.status(200).json({ status: "no_data" });
    }

    const {
      type,
      transactionID,
      amount,
      description,
      bank,
    } = tx;

    const direction = type === "IN" ? "💸 Nhận tiền" : "💳 Giao dịch";
    const formattedAmount = Number(amount).toLocaleString("vi-VN") + " VND";

    const text = [
      "📩 Giao dịch mới từ sPayment",
      direction,
      `🏦 Ngân hàng: ${bank.toUpperCase()}`,
      `💰 Số tiền: ${formattedAmount}`,
      `🔢 Mã giao dịch: ${transactionID}`,
      `📝 Nội dung: ${description}`,
      "",
      "Nguồn: sPayment webhook",
    ].join("\n");

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
