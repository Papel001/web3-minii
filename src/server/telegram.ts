// src/server/telegram.ts

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function sendTelegramAlert(params: { title: string; lines: string[] }) {
  const token = mustEnv("TELEGRAM_BOT_TOKEN");
  const chatId = mustEnv("TELEGRAM_CHAT_ID");

  const text = [
    `🔔 <b>${escapeHtml(params.title)}</b>`,
    ...params.lines.map((l) => escapeHtml(l)),
  ].join("\n");

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  // never break rescue if telegram fails
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("Telegram sendMessage failed:", res.status, t);
  }
}
