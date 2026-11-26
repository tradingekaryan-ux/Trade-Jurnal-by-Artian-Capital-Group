import { readFileSync } from "node:fs";

/** Isi data uji untuk akun ekaryan lewat API publik yang sama dengan UI. */
const base = "http://localhost:3000";
const imagePath = new URL("../apps/web/public/brand/artian-icon.png", import.meta.url);
const image = readFileSync(imagePath);

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

async function postJson(path, body, cookie) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  console.log(path, r.status, JSON.stringify(data).slice(0, 120));
  return data;
}

async function postForm(path, form, cookie) {
  const r = await fetch(base + path, { method: "POST", headers: { cookie }, body: form });
  const data = await r.json();
  console.log(path, r.status, JSON.stringify(data).slice(0, 120));
  return data;
}

await postJson(
  "/api/cfd-journal",
  { mode: "cfd", symbol: "EURUSD", side: "buy", size: 1, entry: 1.1, exit: 1.105, stopLoss: 1.095, takeProfit: 1.11, resultMode: "auto", openedAt: "2026-11-25T08:00:00Z" },
  ekaryan,
);
await postJson(
  "/api/cfd-journal",
  { mode: "cfd", symbol: "XAUUSD", side: "sell", size: 0.5, entry: 2010, stopLoss: 2020, takeProfit: 1980, resultMode: "auto", openedAt: "2026-11-26T09:30:00Z" },
  ekaryan,
);
await postJson(
  "/api/cfd-journal",
  { mode: "futures", symbol: "ES", side: "buy", size: 2, entry: 5000, exit: 5004, stopLoss: 4994, takeProfit: 5008, resultMode: "auto", openedAt: "2026-11-25T13:30:00Z" },
  ekaryan,
);
await postJson(
  "/api/cfd-journal",
  { mode: "futures", symbol: "MNQ", side: "sell", size: 3, entry: 18000, exit: 17994, stopLoss: 18012, takeProfit: 17982, resultMode: "auto", openedAt: "2026-11-26T14:00:00Z" },
  ekaryan,
);
await postJson(
  "/api/cfd-journal",
  { mode: "crypto-spot", symbol: "BTCUSD", side: "buy", size: 1000, entry: 60000, exit: 63000, stopLoss: 58000, takeProfit: 66000, resultMode: "auto", openedAt: "2026-11-24T10:00:00Z" },
  ekaryan,
);
await postJson(
  "/api/cfd-journal",
  { mode: "crypto-perp", symbol: "BTCUSDT", side: "buy", size: 5000, entry: 60000, exit: 63000, leverage: 5, stopLoss: 58000, takeProfit: 66000, resultMode: "auto", openedAt: "2026-11-25T16:00:00Z" },
  ekaryan,
);
await postJson(
  "/api/cfd-journal",
  { mode: "stock", symbol: "NVDA", side: "buy", size: 1000, entry: 120, exit: 132, stopLoss: 114, takeProfit: 138, resultMode: "auto", openedAt: "2026-11-23T15:00:00Z" },
  ekaryan,
);

const promoForm = new FormData();
promoForm.set("title", "Diskon 20% layanan trading");
promoForm.set("description", "Gunakan kode ini untuk potongan 20% pada paket bulanan. Berlaku sampai akhir bulan.");
promoForm.set("promoCode", "ARTIAN20");
promoForm.set("codeEnabled", "true");
promoForm.set("url", "https://www.luxalgo.com/");
promoForm.set("urlEnabled", "true");
promoForm.set("image", new Blob([image], { type: "image/png" }), "artian-icon.png");
const promo = await postForm("/api/promos", promoForm, ekaryan);

const ideaForm = new FormData();
ideaForm.set("kind", "idea");
ideaForm.set("title", "Setup breakout XAUUSD");
ideaForm.set("description", "Entry saat breakout resistance 2010 dengan konfirmasi volume. SL 1995, TP 2040. Hindari entry menjelang news.");
ideaForm.set("image", new Blob([image], { type: "image/png" }), "artian-icon.png");
const idea = await postForm("/api/promos", ideaForm, ekaryan);

await postJson("/api/promos/vote", { promoId: promo.id, value: "working" }, ekaryan);
await postJson("/api/promos/vote", { promoId: promo.id, value: "working" }, owner);
await postJson("/api/ideas/vote", { ideaId: idea.id, value: "take_profit" }, ekaryan);
await postJson("/api/ideas/vote", { ideaId: idea.id, value: "stop_loss" }, owner);

for (const mode of ["cfd", "futures", "crypto-spot,crypto-perp", "stock"]) {
  const r = await fetch(`${base}/api/cfd-journal?mode=${mode}`, { headers: { cookie: ekaryan } });
  const body = await r.json();
  console.log("list", mode, body.trades?.length);
}
const posts = await (await fetch(base + "/api/posts", { headers: { cookie: ekaryan } })).json();
console.log("posts", posts.posts.length);
const votes = await (await fetch(`${base}/api/promos/vote?ids=${promo.id},${idea.id}`, { headers: { cookie: ekaryan } })).json();
console.log("votes", JSON.stringify(votes));
