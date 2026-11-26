import { readFileSync } from "node:fs";

/**
 * Smoke test yang tersebar di banyak tanggal, instrumen, dan hasil.
 * Semua ditulis ke tabel Supabase (cfd_trades, promos, promo_votes)
 * melalui API aplikasi — tidak ke file lokal.
 */
const base = "http://localhost:3000";
const image = readFileSync(new URL("../apps/web/public/brand/artian-icon.png", import.meta.url));

async function login(username, password) {
  const r = await fetch(`${base}/api/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(`login ${username}: ${await r.text()}`);
  return r.headers.get("set-cookie").split(";")[0];
}

const ekaryan = await login("ekaryan", "Ekaryan443!");
const owner = await login("artian", "Artian443!");

const api = async (path, body, cookie = ekaryan, method = "POST") => {
  const r = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
  return r.json();
};

const postForm = async (path, data, cookie = ekaryan) => {
  const r = await fetch(base + path, { method: "POST", headers: { cookie }, body: data });
  if (!r.ok) throw new Error(`${path}: ${await r.text()}`);
  return r.json();
};

const imagePart = () => new Blob([image], { type: "image/png" });

// --- Bersihkan smoke lama di Supabase ---
for (const mode of ["cfd", "futures", "crypto-spot", "crypto-perp", "stock"])
  await api(`/api/cfd-journal?mode=${mode}`, undefined, ekaryan, "DELETE");
for (const post of (
  await (await fetch(`${base}/api/posts`, { headers: { cookie: ekaryan } })).json()
).posts)
  await api(`/api/promos?id=${encodeURIComponent(post.id)}`, undefined, ekaryan, "DELETE");

// --- Jurnal: tanggal, instrumen, dan hasil bervariasi ---
const t = [];
const add = (mode, symbol, side, size, entry, exit, sl, tp, date, extra = {}) =>
  t.push({ mode, symbol, side, size, entry, exit, sl, tp, date, ...extra });

// CFD — profit, loss, breakeven, manual, running
add("cfd", "EURUSD", "buy", 1, 1.084, 1.089, 1.081, 1.092, "2026-08-04T08:15:00Z"); // TP-ish +500
add("cfd", "GBPUSD", "sell", 0.7, 1.276, 1.272, 1.28, 1.268, "2026-08-19T11:30:00Z"); // +280
add("cfd", "XAUUSD", "buy", 0.5, 1875.2, 1871.7, 1872.5, 1880, "2026-09-02T14:00:00Z"); // kena SL -175
add("cfd", "USDJPY", "sell", 1, 149.2, 149.65, 148.9, 150.1, "2026-09-15T01:45:00Z"); // -450
add("cfd", "US30", "buy", 1, 34200, 34200, 34150, 34280, "2026-09-28T13:30:00Z", {
  resultMode: "breakeven",
});
add("cfd", "WTIUSD", "buy", 1, 82.4, 83.1, 81.9, 83.4, "2026-10-06T16:20:00Z"); // +700
add("cfd", "XAGUSD", "sell", 1, 22.15, 21.98, 22.3, 21.8, "2026-10-17T15:40:00Z"); // +170
add("cfd", "AUDUSD", "sell", 1.2, 0.658, 0.6595, 0.66, 0.654, "2026-10-29T03:15:00Z"); // -180
add("cfd", "US500", "buy", 1, 4180, null, 4165, 4210, "2026-11-10T14:30:00Z", { running: true });
add("cfd", "EURUSD", "sell", 1, 1.072, 1.0695, 1.075, 1.067, "2026-11-21T09:10:00Z"); // +250
add("cfd", "NATGAS", "buy", 1, 2.95, 2.9, 2.88, 3.05, "2026-11-25T18:00:00Z", { manual: -120 });

// Futures — standard / mini / micro, TP & SL berbeda
add("futures", "ES", "buy", 2, 4150, 4153, 4146, 4156, "2026-08-08T13:35:00Z"); // +12 tick
add("futures", "NQ", "sell", 1, 15200, 15212, 15188, 15230, "2026-08-26T14:10:00Z"); // kena SL
add("futures", "MES", "buy", 3, 4142, 4140.5, 4139, 4146, "2026-09-12T15:05:00Z"); // -6 tick
add("futures", "MNQ", "buy", 4, 15080, 15095, 15068, 15105, "2026-09-30T13:45:00Z"); // +60 tick
add("futures", "RTY", "sell", 2, 1875.4, 1873.9, 1877.5, 1871, "2026-10-14T14:20:00Z"); // +30 tick
add("futures", "MGC", "buy", 2, 1880.1, 1878.6, 1877, 1884, "2026-10-31T16:00:00Z"); // -30 tick
add("futures", "SPX", "buy", 1, 4160, 4169, 4153, 4172, "2026-11-18T15:30:00Z"); // +36 tick
add("futures", "NQ100N", "sell", 5, 15120, null, 15135, 15090, "2026-11-24T14:00:00Z", {
  running: true,
});

// Crypto spot — nominal masuk USD
add("crypto-spot", "BTCUSD", "buy", 1000, 58500, 61000, 57000, 63000, "2026-08-15T07:20:00Z"); // +4.3%
add("crypto-spot", "ETHUSD", "sell", 800, 2850, 2920, 2800, 2750, "2026-09-21T19:45:00Z"); // -2.5%
add("crypto-spot", "SOLUSD", "buy", 500, 138, 146, 132, 152, "2026-10-11T12:00:00Z"); // +5.8%
add("crypto-spot", "XRPUSD", "sell", 600, 0.58, 0.56, 0.595, 0.54, "2026-11-02T08:30:00Z"); // +3.4%
add("crypto-spot", "DOGEUSD", "buy", 400, 0.14, 0.132, 0.128, 0.155, "2026-11-16T17:10:00Z"); // -5.7%

// Crypto perpetual — nominal setelah leverage
add("crypto-perp", "BTCUSDT", "buy", 5000, 61000, 58500, 59500, 65000, "2026-08-29T21:15:00Z", {
  leverage: 5,
}); // -4.1%
add("crypto-perp", "ETHUSDT", "sell", 3000, 2900, 2790, 2970, 2680, "2026-09-17T08:30:00Z", {
  leverage: 3,
}); // +3.8%
add("crypto-perp", "SOLUSDT", "buy", 2000, 142, 151, 136, 158, "2026-10-23T17:10:00Z", {
  leverage: 4,
}); // +6.3%
add("crypto-perp", "XRPUSDT", "buy", 1500, 0.52, 0.5, 0.5, 0.57, "2026-11-05T10:00:00Z", {
  leverage: 2,
}); // kena SL
add("crypto-perp", "DOGEUSDT", "sell", 1200, 0.16, 0.152, 0.168, 0.145, "2026-11-22T22:40:00Z", {
  leverage: 3,
}); // +5%

// US Stock — nominal masuk USD
add("stock", "NVDA", "buy", 1200, 118, 127, 112, 132, "2026-08-21T15:30:00Z"); // +7.6%
add("stock", "AAPL", "sell", 900, 224, 230, 229, 215, "2026-09-24T16:00:00Z"); // kena SL
add("stock", "MSFT", "buy", 1000, 402, 395, 393, 415, "2026-10-13T15:45:00Z"); // -1.7%
add("stock", "TSLA", "buy", 800, 245, 268, 232, 275, "2026-10-30T16:00:00Z"); // +9.4%
add("stock", "AMD", "sell", 700, 168, 164, 172, 158, "2026-11-14T15:30:00Z"); // +2.4%
add("stock", "GOOGL", "buy", 1000, 172, 176, 168, 180, "2026-11-26T16:00:00Z"); // +2.3%

for (const x of t) {
  await api("/api/cfd-journal", {
    mode: x.mode,
    symbol: x.symbol,
    side: x.side,
    size: x.size,
    entry: x.entry,
    exit: x.running ? undefined : x.exit,
    leverage: x.leverage,
    stopLoss: x.sl,
    takeProfit: x.tp,
    resultMode: x.manual !== undefined ? "manual" : (x.resultMode ?? "auto"),
    manualPnl: x.manual,
    openedAt: x.date,
  });
}

// --- Postingan & voting di Supabase ---
const makePromo = async (title, description, code, enabled, url, urlEnabled, cookie = ekaryan) => {
  const form = new FormData();
  form.set("title", title);
  form.set("description", description);
  form.set("promoCode", code);
  form.set("codeEnabled", String(enabled));
  form.set("url", url);
  form.set("urlEnabled", String(urlEnabled));
  form.set("image", imagePart(), "artian-icon.png");
  return postForm("/api/promos", form, cookie);
};
const makeIdea = async (title, description, cookie = ekaryan) => {
  const form = new FormData();
  form.set("kind", "idea");
  form.set("title", title);
  form.set("description", description);
  form.set("image", imagePart(), "artian-icon.png");
  return postForm("/api/promos", form, cookie);
};

const p1 = await makePromo(
  "Diskon 20% paket bulanan",
  "Kode berlaku untuk paket bulanan.",
  "ARTIAN20",
  true,
  "https://www.luxalgo.com/",
  true,
);
const p2 = await makePromo(
  "Gratis 1 bulan VPS",
  "Untuk pengguna baru yang mendaftar bulan ini.",
  "VPSFREE",
  true,
  "",
  false,
);
const p3 = await makePromo(
  "Diskon 50% seeding",
  "Promo khusus komunitas, terbatas.",
  "SEED50",
  false,
  "https://github.com/",
  true,
);
const i1 = await makeIdea(
  "Breakout XAUUSD sesi London",
  "Entry setelah close 15m di atas resistance. SL di bawah candle breakout, TP minimal 2R.",
);
const i2 = await makeIdea(
  "Pullback BTCUSDT",
  "Entry pullback ke EMA20 pada trend naik. SL di bawah swing low, TP 3R.",
);

// Postingan owner — menampilkan badge centang kuning di promo & trade idea.
const p4 = await makePromo(
  "Promo resmi Artian Capital Group",
  "Penawaran resmi dari owner. Hubungi komunitas untuk detailnya.",
  "ARTIANOFFICIAL",
  true,
  "https://www.luxalgo.com/",
  true,
  owner,
);
const i3 = await makeIdea(
  "Setup resmi XAUUSD session New York",
  "Ide dari owner: tunggu konfirmasi engulfing di H1, SL di bawah swing low, TP 2R.",
  owner,
);

await api("/api/promos/vote", { promoId: p1.id, value: "working" });
await api("/api/promos/vote", { promoId: p1.id, value: "not_working" }, owner);
await api("/api/promos/vote", { promoId: p2.id, value: "working" }, owner);
await api("/api/promos/vote", { promoId: p3.id, value: "not_working" });
await api("/api/ideas/vote", { ideaId: i1.id, value: "take_profit" });
await api("/api/ideas/vote", { ideaId: i1.id, value: "stop_loss" }, owner);
await api("/api/ideas/vote", { ideaId: i2.id, value: "take_profit" }, owner);
await api("/api/promos/vote", { promoId: p4.id, value: "working" });
await api("/api/ideas/vote", { ideaId: i3.id, value: "take_profit" });

await api("/api/snapshot", {});
const summary = {
  trades: t.length,
  dates: new Set(t.map((x) => x.date.slice(0, 10))).size,
  instruments: new Set(t.map((x) => x.symbol)).size,
  promos: 4,
  ideas: 3,
  votes: 9,
};
console.log("DONE", summary);
