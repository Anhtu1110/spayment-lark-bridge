import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json()); // parse JSON body

const LARK_WEBHOOK_URL = process.env.LARK_WEBHOOK_URL;

if (!LARK_WEBHOOK_URL) {
  console.error("⚠️  Missing LARK_WEBHOOK_URL in .env");
  process.exit(1);
}

// Endpoint cho sPayment gọi vào
app.post("/webhook/spayment", async (req, res) => {
  try {
    const payload = req.body;
    console.log("🔥 sPayment payload:", JSON.stringify(payload, null, 2));

    // Tùy payload thực tế, tạm bắt vài field common
    const amount =
      payload.SoTien ||
      payload.amount ||
      payload.money ||
      "";
    const content =
      payload.NoiDung ||
      payload.description ||
      payload.content ||
      "";
    const transId =
      payload.MaGiaoDich ||
      payload.trans_id ||
      payload.trace_id ||
      payload.transactionId ||
      "";

    // Format message gửi sang Lark
    const textLines = [
      "📩 Giao dịch mới từ sPayment",
      amount && `💰 Số tiền: ${amount}`,
      transId && `🔢 Mã giao dịch: ${transId}`,
      content && `📝 Nội dung: ${content}`,
      "",
      "Nguồn: sPayment webhook",
    ].filter(Boolean);

    const text = textLines.join("\n");

    // Gửi sang Lark
    const larkResp = await fetch(LARK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: {
          text,
        },
      }),
    });

    const larkData = await larkResp.json().catch(() => ({}));
    console.log("✅ Lark response:", larkData);

    // (optional) check code của Lark
    if (larkData.code && larkData.code !== 0) {
      console.error("❌ Lark trả lỗi:", larkData);
    }

    // Trả về cho sPayment – chỉ cần 200 là thường ok
    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("💥 Error in /webhook/spayment:", err);
    return res.status(500).json({ status: "error", message: "internal error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 sPayment ↔ Lark bridge running on port ${PORT}`);
});
