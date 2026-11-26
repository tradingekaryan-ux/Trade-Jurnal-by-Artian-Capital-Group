import { readFileSync } from "node:fs";

/** Isi data uji notebook / playbook / progress lewat API untuk akun ekaryan. */
const base = "http://localhost:3000";

const login = await fetch(`${base}/api/auth`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "ekaryan", password: "Ekaryan443!" }),
});
if (!login.ok) throw new Error(`login gagal: ${await login.text()}`);
const cookie = login.headers.get("set-cookie").split(";")[0];

async function post(path, body) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  console.log(path, r.status, JSON.stringify(data).slice(0, 140));
  return data;
}

// --- Notebook notes ---
await post("/api/notes", {
  folderId: "my-notes",
  title: "Checklist sesi Asia",
  content:
    "# Checklist sesi Asia\n\n- Cek arah DXY sebelum entry forex\n- Tunggu konfirmasi 15m\n- Max 2 trade per sesi\n\n**Pelajaran:** entry cepat di awal sesi sering kena spread.",
  tags: [" checklist", "forex", "Asia"].map((t) => t.trim()),
});
await post("/api/notes", {
  folderId: "trade-notes",
  title: "Review EURUSD +50 pips",
  content:
    "Entry 1.1000, exit 1.1050. Konfirmasi breakout dan volume bagus. R:R 2.0 sesuai rencana.",
  tags: ["EURUSD", "CFD", "review"],
});
await post("/api/notes", {
  folderId: "daily-journal",
  title: "Refleksi 26 November",
  content:
    "Disiplin terjaga, tidak ada revenge trading. Perlu mengurangi ukuran pada setup yang belum teruji.",
  tags: ["refleksi", "disiplin"],
});
await post("/api/workspace/templates", {
  name: "Trade review harian",
  content: "## Setup\n\n## Eksekusi\n\n## Emosi\n\n## Pelajaran",
});

// --- Playbooks ---
await post("/api/playbooks", {
  name: "Breakout London Session",
  description: "Setup breakout pada instrumen forex dan indeks saat sesi London dibuka.",
  rules: [
    "Hanya entry setelah candle 15m close di atas resistance",
    "Stop loss di bawah candle breakout",
    "Risk maksimal 1% per trade",
    "Tidak entry 10 menit sebelum high-impact news",
  ],
});
await post("/api/playbooks", {
  name: "Pullback Trend Continuation",
  description: "Entry pullback pada trend yang sudah terkonfirmasi.",
  rules: [
    "Market structure harus higher-high / higher-low",
    "Entry pada retracement 38.2–61.8%",
    "TP minimal 2R",
  ],
});

// --- Progress routines ---
const routines = [
  { title: "Review chart sebelum sesi", stage: "Before trading", weekdays: [1, 2, 3, 4, 5] },
  { title: "Cek risk per trade", stage: "During trading", weekdays: [1, 2, 3, 4, 5] },
  { title: "Jurnal & evaluasi harian", stage: "After trading", weekdays: [1, 2, 3, 4, 5] },
];
for (const r of routines) await post("/api/workspace/progress", r);

const progress = await (
  await fetch(`${base}/api/workspace/progress`, { headers: { cookie } })
).json();
for (const rule of progress.rules) {
  for (const [date, done] of [
    ["2026-11-23", true],
    ["2026-11-24", true],
    ["2026-11-25", false],
    ["2026-11-26", true],
  ]) {
    await post("/api/workspace/progress", { ruleId: rule.id, date, done });
  }
}

const notes = await (await fetch(`${base}/api/notes`, { headers: { cookie } })).json();
const books = await (await fetch(`${base}/api/playbooks`, { headers: { cookie } })).json();
const prog = await (await fetch(`${base}/api/workspace/progress`, { headers: { cookie } })).json();
console.log("RESULT", {
  notes: notes.notes.length,
  folders: notes.folders.length,
  templates: (
    await (await fetch(`${base}/api/workspace/templates`, { headers: { cookie } })).json()
  ).templates.length,
  playbooks: books.playbooks.length,
  routines: prog.rules.length,
  checks: prog.checks.length,
});
