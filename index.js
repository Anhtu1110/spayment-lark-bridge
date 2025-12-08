import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json()); // parse JSON body từ sPayment

const LARK_WEBHOOK_URL = process.env.LARK_WEBHOOK_URL;

if (!LARK_WEBHOOK_URL) {
  console.error("⚠️  Missing LARK_WEBHOOK_URL in .env");
  process.exit(1);
}

// Endpoint check sống
app.get("/", (req, res) => {
  res.send("sPayment ↔ Lark bridge is running");
});

// Endpoint sPayment gọi vào
app.post("/webhook/spayment", async (req, res) => {
  try {
    const payload = req.body;
    console.log("🔥 sPayment payload:", JSON.stringify(payload, null, 2));

    // ĐOÁN TÊN FIELD PHỔ BIẾN (cứ thêm dần nếu cần)
    const amount =
      payload.amount ||
      payload.money ||
      payload.amount_vnd ||
      payload.SoTien ||
      payload.so_tien ||
      payload.so_tien_giao_dich ||
      "";

    const content =
      payload.description ||
      payload.NoiDung ||
      payload.noi_dung ||
      payload.ghi_chu ||
      payload.content ||
      "";

    const transId =
      payload.trans_id ||
      payload.transactionId ||
      payload.transaction_id ||
      payload.trans_ref ||
      payload.MaGiaoDich ||
      payload.ma_giao_dich ||
      payload.trace_id ||
      "";

    // Build message gửi sang Lark
    const textLines = [
      "📩 Giao dịch mới từ sPayment",
      amount && `💰 Số tiền: ${amount}`,
      transId && `🔢 Mã giao dịch: ${transId}`,
      content && `📝 Nội dung: ${content}`,
      "",
      "📦 Payload (JSON):",
      JSON.stringify(payload, null, 2),
      "",
      "Nguồn: sPayment webhook",
    ].filter(Boolean);

    const text = textLines.join("\n");

    // Gửi message sang Lark
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

    // Trả lời cho sPayment (HTTP 200 là ổn)
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
