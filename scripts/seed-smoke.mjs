import { readFileSync } from "node:fs";

/** Data uji jurnal yang tersebar di banyak tanggal, instrumen, dan hasil. */
const base = "http://localhost:3000";
const image = readFileSync(new URL("../apps/web/public/brand/artian-icon.png", import.meta.url));

const login = await fetch(`${base}/api/auth`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "ekaryan", password: "Ekaryan443!" }),
});
if (!login.ok) throw new Error(`login gagal: ${await login.text()}`);
const cookie = login.headers.get("set-cookie").split(";")[0];

async function postJson(path, body, method = "POST") {
  const r = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
  return r.json();
}

async function postForm(path, form) {
  const r = await fetch(base + path, { method: "POST", headers: { cookie }, body: form });
  if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
  return r.json();
}

// Hapus smoke lama supaya tidak terkonsentrasi di tanggal tertentu.
for (const mode of ["cfd", "futures", "crypto-spot", "crypto-perp", "stock"]) {
  await postJson(`/api/cfd-journal?mode=${mode}`, {}, "DELETE");
}

const trades = [
  // ---- CFD: forex, komoditas, indeks ----
  { mode: "cfd", symbol: "EURUSD", side: "buy", size: 1, entry: 1.084, exit: 1.089, sl: 1.081, tp: 1.092, date: "2026-09-03T08:15:00Z" },
  { mode: "cfd", symbol: "GBPUSD", side: "sell", size: 0.7, entry: 1.276, exit: 1.272, sl: 1.28, tp: 1.268, date: "2026-09-11T11:30:00Z" },
  { mode: "cfd", symbol: "XAUUSD", side: "buy", size: 0.5, entry: 1875.2, exit: 1877.7, sl: 1872, tp: 1880, date: "2026-09-24T14:00:00Z" },
  { mode: "cfd", symbol: "USDJPY", side: "sell", size: 1, entry: 149.2, exit: 149.65, sl: 148.9, tp: 150.1, date: "2026-10-02T01:45:00Z" },
  { mode: "cfd", symbol: "US30", side: "buy", size: 1, entry: 34200, exit: 34160, sl: 34150, tp: 34280, date: "2026-10-08T13:30:00Z" },
  { mode: "cfd", symbol: "WTIUSD", side: "buy", size: 1, entry: 82.4, exit: 83.1, sl: 81.9, tp: 83.4, date: "2026-10-19T16:20:00Z" },
  { mode: "cfd", symbol: "EURUSD", side: "sell", size: 1.2, entry: 1.072, exit: 1.0695, sl: 1.075, tp: 1.067, date: "2026-11-04T09:10:00Z" },
  { mode: "cfd", symbol: "XAGUSD", side: "buy", size: 1, entry: 22.15, exit: 21.98, sl: 21.9, tp: 22.45, date: "2026-11-12T15:40:00Z" },
  { mode: "cfd", symbol: "US500", side: "buy", size: 1, entry: 4180, stop: 4165, target: 4210, date: "2026-11-24T14:30:00Z", running: true },
  { mode: "cfd", symbol: "AUDUSD", side: "sell", size: 1, entry: 0.658, exit: 0.657, sl: 0.66, tp: 0.654, date: "2026-11-25T03:15:00Z" },

  // ---- Futures: standard / mini / micro ----
  { mode: "futures", symbol: "ES", side: "buy", size: 2, entry: 4150, exit: 4153, sl: 4146, tp: 4156, date: "2026-09-08T13:35:00Z" },
  { mode: "futures", symbol: "NQ", side: "sell", size: 1, entry: 15200, exit: 15212, sl: 15188, tp: 15230, date: "2026-09-18T14:10:00Z" },
  { mode: "futures", symbol: "MES", side: "buy", size: 3, entry: 4142, exit: 4140.5, sl: 4139, tp: 4146, date: "2026-10-06T15:05:00Z" },
  { mode: "futures", symbol: "MNQ", side: "buy", size: 4, entry: 15080, exit: 15095, sl: 15068, tp: 15105, date: "2026-10-21T13:45:00Z" },
  { mode: "futures", symbol: "RTY", side: "sell", size: 2, entry: 1875.4, exit: 1873.9, sl: 1877.5, tp: 1871, date: "2026-11-03T14:20:00Z" },
  { mode: "futures", symbol: "MGC", side: "buy", size: 2, entry: 1880.1, exit: 1878.6, sl: 1877, tp: 1884, date: "2026-11-17T16:00:00Z" },
  { mode: "futures", symbol: "SPX", side: "buy", size: 1, entry: 4160, exit: 4169, sl: 4153, tp: 4172, date: "2026-11-23T15:30:00Z" },

  // ---- Crypto spot & perpetual ----
  { mode: "crypto-spot", symbol: "BTCUSD", side: "buy", size: 1000, entry: 58500, exit: 61000, sl: 57000, tp: 63000, date: "2026-09-15T07:20:00Z" },
  { mode: "crypto-spot", symbol: "ETHUSD", side: "sell", size: 800, entry: 2850, exit: 2920, sl: 2800, tp: 2750, date: "2026-10-11T19:45:00Z" },
  { mode: "crypto-spot", symbol: "SOLUSD", side: "buy", size: 500, entry: 138, exit: 146, sl: 132, tp: 152, date: "2026-11-06T12:00:00Z" },
  { mode: "crypto-perp", symbol: "BTCUSDT", side: "buy", size: 5000, leverage: 5, entry: 61000, exit: 58500, sl: 59500, tp: 65000, date: "2026-09-29T21:15:00Z" },
  { mode: "crypto-perp", symbol: "ETHUSDT", side: "sell", size: 3000, leverage: 3, entry: 2900, exit: 2790, sl: 2970, tp: 2680, date: "2026-10-16T08:30:00Z" },
  { mode: "crypto-perp", symbol: "SOLUSDT", side: "buy", size: 2000, leverage: 4, entry: 142, exit: 151, sl: 136, tp: 158, date: "2026-11-09T17:10:00Z" },
  { mode: "crypto-perp", symbol: "XRPUSDT", side: "buy", size: 1500, leverage: 2, entry: 0.52, stop: 0.5, target: 0.57, date: "2026-11-26T10:00:00Z", running: true },

  // ---- US Stock ----
  { mode: "stock", symbol: "NVDA", side: "buy", size: 1200, entry: 118, exit: 127, sl: 112, tp: 132, date: "2026-09-21T15:30:00Z" },
  { mode: "stock", symbol: "AAPL", side: "sell", size: 900, entry: 224, exit: 230, sl: 229, tp: 215, date: "2026-10-13T16:00:00Z" },
  { mode: "stock", symbol: "MSFT", side: "buy", size: 1000, entry: 402, exit: 395, sl: 393, tp: 415, date: "2026-10-27T15:45:00Z" },
  { mode: "stock", symbol: "TSLA", side: "buy", size: 800, entry: 245, exit: 268, sl: 232, tp: 275, date: "2026-11-05T16:00:00Z" },
  { mode: "stock", symbol: "AMD", side: "sell", size: 700, entry: 168, exit: 164, sl: 172, tp: 158, date: "2026-11-19T15:30:00Z" },
  { mode: "stock", symbol: "GOOGL", side: "buy", size: 1000, entry: 172, exit: 176, sl: 168, tp: 180, date: "2026-11-24T16:00:00Z" },
];

for (const t of trades) {
  await postJson("/api/cfd-journal", {
    mode: t.mode,
    symbol: t.symbol,
    side: t.side,
    size: t.size,
    entry: t.entry,
    exit: t.running ? undefined : t.exit,
    leverage: t.leverage,
    stopLoss: t.sl ?? t.stop,
    takeProfit: t.tp ?? t.target,
    resultMode: "auto",
    openedAt: t.date,
  });
}

const oldPromos = await (await fetch(`${base}/api/promos`, { headers: { cookie } })).json();
for (const p of oldPromos.promos ?? []) {
  await fetch(`${base}/api/promos?id=${encodeURIComponent(p.id)}`, { method: "DELETE", headers: { cookie } });
}

const promoForm = new FormData();
promoForm.set("title", "Diskon 20% layanan trading");
promoForm.set("description", "Gunakan kode ini untuk potongan 20% pada paket bulanan.");
promoForm.set("promoCode", "ARTIAN20");
promoForm.set("codeEnabled", "true");
promoForm.set("url", "https://www.luxalgo.com/");
promoForm.set("urlEnabled", "true");
promoForm.set("image", new Blob([image], { type: "image/png" }), "artian-icon.png");
const promo = await postForm("/api/promos", promoForm);

const ideaForm = new FormData();
ideaForm.set("kind", "idea");
ideaForm.set("title", "Setup breakout XAUUSD");
ideaForm.set("description", "Entry saat breakout resistance dengan konfirmasi volume. SL di bawah candle, TP minimal 2R.");
ideaForm.set("image", new Blob([image], { type: "image/png" }), "artian-icon.png");
const idea = await postForm("/api/promos", ideaForm);

await postJson("/api/promos/vote", { promoId: promo.id, value: "working" });
await postJson("/api/ideas/vote", { ideaId: idea.id, value: "take_profit" });

const summary = await postJson("/api/snapshot", {}, "POST");
console.log("DONE", {
  trades: trades.length,
  dates: new Set(trades.map((t) => t.date.slice(0, 10))).size,
  instruments: new Set(trades.map((t) => t.symbol)).size,
  snapshot: summary,
});
