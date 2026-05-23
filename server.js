const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const workflowStore = {};
const workflowTemplates = [
  { id: "tpl_daily_owner", name: "Ежедневный отчет собственнику", nodes:["TriggerNode","ReportNode","AiAnalysisNode","TelegramNode"] },
  { id: "tpl_high_fc", name: "Высокий фудкост", nodes:["DataImportNode","MetricNode","ConditionNode","AlertNode","TaskNode","TelegramNode"] },
  { id: "tpl_open_kitchen_photo", name: "Фото открытия кухни", nodes:["TriggerNode","TaskNode","PhotoCheckNode","ConditionNode","AlertNode","TelegramNode"] },
];

// ── Steps definition ───────────────────────────────────────────
const STEPS = [
  {
    id: 0, type: "poll", phase: "🔥 РАЗМИНКА",
    text: "Как сейчас у вас устроен контроль потерь на кухне?",
    options: ["Ежедневный контроль + отчёт", "Еженедельная инвентаризация", "Разовый/нерегулярный контроль", "Автоматизированный учёт (iiko/Poster и т.п.)"],
    correct: null, dataKey: "control_method",
  },
  {
    id: 1, type: "quiz", phase: "📦 ПОТЕРИ",
    text: "Какой диапазон потерь к выручке чаще всего встречается в ресторанах?",
    options: ["до 3%", "3–7%", "7–15%", "15%+"],
    correct: null, dataKey: "quiz1",
  },
  {
    id: 2, type: "input", phase: "💰 ВАШИ ДАННЫЕ",
    text: "Введите выручку кухни за последний месяц",
    field: { key: "vyruchka", label: "Выручка кухни", placeholder: "20", unit: "млн ₽" },
  },
  {
    id: 3, type: "input", phase: "📊 FOOD COST",
    text: "FC % из марочника (% к выручке)",
    field: { key: "fc_percent", label: "FC % ИЗ МАРОЧНИКА", placeholder: "28", unit: "%" },
  },
  {
    id: 4, type: "input", phase: "📊 ПОТЕРИ",
    text: "Введите Порчу за последний месяц",
    field: { key: "porcha", scale: "k", label: "Порча", placeholder: "50", unit: "тыс ₽" },
  },
  {
    id: 5, type: "input", phase: "📊 ПОТЕРИ",
    text: "Введите Отрицательную инвентаризацию за месяц",
    field: { key: "inventar", scale: "k", label: "Отриц. инвентаризация", placeholder: "30", unit: "тыс ₽" },
  },
  {
    id: 6, type: "input", phase: "📊 ПОТЕРИ",
    text: "Введите Бракераж за последний месяц",
    field: { key: "brakerage", scale: "k", label: "Бракераж", placeholder: "20", unit: "тыс ₽" },
  },
  {
    id: 7, type: "input", phase: "📊 ПОТЕРИ",
    text: "Введите Комплименты за последний месяц",
    field: { key: "kompliment", scale: "k", label: "Комплименты", placeholder: "10", unit: "тыс ₽" },
  },
  {
    id: 8, type: "input", phase: "📊 ПОТЕРИ",
    text: "Введите Питание персонала за последний месяц",
    field: { key: "personal", scale: "k", label: "Питание персонала", placeholder: "25", unit: "тыс ₽" },
  },
  {
    id: 9, type: "quiz", phase: "❄️ ХРАНЕНИЕ",
    text: "Где чаще всего «прячутся» потери в операционке кухни?",
    options: ["Закупки и входящие цены", "Хранение и порча", "Списания и бракераж", "Во всех зонах сразу"],
    correct: null, dataKey: "quiz2",
  },
];

// ── State ──────────────────────────────────────────────────────
let state = {
  phase: "lobby",      // lobby | step | reveal
  stepIndex: -1,
  showResults: false,
  participants: {},    // id -> { name, city, data:{}, stepAnswers:{} }
  stepSubmissions: {}, // id -> submitted for current step
};

const SNAPSHOT_DIR = path.join(__dirname, "data");
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, "session-state.json");
function persistState() {
  try {
    if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(state), "utf8");
  } catch (e) { console.error("persistState error", e.message); }
}
function restoreState() {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return;
    const raw = fs.readFileSync(SNAPSHOT_FILE, "utf8");
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object" && saved.participants) {
      state = {
        phase: saved.phase || "lobby",
        stepIndex: Number.isInteger(saved.stepIndex) ? saved.stepIndex : -1,
        showResults: !!saved.showResults,
        participants: saved.participants || {},
        stepSubmissions: saved.stepSubmissions || {},
      };
      console.log(`Restored session: ${Object.keys(state.participants).length} participants`);
    }
  } catch (e) { console.error("restoreState error", e.message); }
}
restoreState();

function broadcast() {
  persistState();
  const pub = buildPublic();
  io.emit("state", pub);
}

function buildPublic() {
  const step = STEPS[state.stepIndex] || null;
  const submissions = Object.keys(state.stepSubmissions).length;
  const total = Object.keys(state.participants).length;

  // Aggregate step results for display
  let results = null;
  if (state.showResults && step) {
    if (step.type === "poll" || step.type === "quiz") {
      const counts = [0, 0, 0, 0];
      Object.values(state.participants).forEach(p => {
        const v = p.stepAnswers[step.id];
        if (v !== undefined && v >= 0) counts[v]++;
      });
      results = { counts, total: submissions };
    }
  }

  return {
    phase: state.phase,
    stepIndex: state.stepIndex,
    step,
    showResults: state.showResults,
    results,
    participantCount: total,
    submittedCount: submissions,
    steps: STEPS.map(({ id, type, phase, postTalk }) => ({ id, type, phase, postTalk: !!postTalk })),
    // Reveal data: all participants with their FC data
    revealData: state.phase === "reveal" ? buildRevealData() : null,
  };
}

function buildRevealData() {
  return Object.values(state.participants).map(p => {
    const d = p.data || {};
    const rev = parseFloat(d.vyruchka) || 0;
    const rawFcInput = parseFloat(d.fc_percent) || 0;
    const legacySebInput = parseFloat(d.sebestoimost) || 0;
    // Backward compatibility: old clients could send себестоимость in ₽ into fc_percent field.
    const fcPercentInput = rawFcInput > 0 && rawFcInput <= 100 ? rawFcInput : 0;
    const sebFromPercent = fcPercentInput > 0 ? (rev * fcPercentInput / 100) : 0;
    const seb = sebFromPercent > 0 ? sebFromPercent : (rawFcInput > 100 ? rawFcInput : legacySebInput);
    const por = parseFloat(d.porcha) || 0;
    const inv = parseFloat(d.inventar) || 0;
    const bra = parseFloat(d.brakerage) || 0;
    const kom = parseFloat(d.kompliment) || 0;
    const per = parseFloat(d.personal) || 0;
    const total = seb + por + inv + bra + kom + per;
    const losses = por + inv + bra + kom + per;
    const fc = rev > 0 ? (total / rev) * 100 : 0;
    return {
      name: p.name,
      city: p.city || "",
      vyruchka: rev,
      sebestoimost: seb,
      fc_percent: fcPercentInput,
      porcha: por,
      inventar: inv,
      brakerage: bra,
      kompliment: kom,
      personal: per,
      totalFC: total,
      losses,
      fc,
      control_method: p.stepAnswers[0] ?? null,
    };
  }).filter(r => (r.vyruchka + r.sebestoimost + r.porcha + r.inventar + r.brakerage + r.kompliment + r.personal) > 0)
    .sort((a, b) => b.fc - a.fc);
}



function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function seedParticipants(count = 50) {
  const cities = ["Москва", "СПб", "Казань", "Екатеринбург", "Новосибирск", "Краснодар"];
  for (let i = 1; i <= count; i++) {
    const id = `seed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
    const rev = randomInt(1200000, 6000000);
    const fcPercent = randomInt(22, 34);
    const seb = Math.round(rev * (fcPercent / 100));
    const por = randomInt(15000, 180000);
    const inv = randomInt(10000, 120000);
    const bra = randomInt(5000, 70000);
    const kom = randomInt(3000, 50000);
    const per = randomInt(7000, 90000);
    state.participants[id] = {
      name: `Тест-ресторан ${i}`,
      city: cities[i % cities.length],
      data: { vyruchka: rev, fc_percent: fcPercent, sebestoimost: seb, porcha: por, inventar: inv, brakerage: bra, kompliment: kom, personal: per },
      stepAnswers: { 0: randomInt(0, 3), 1: randomInt(0, 3), 9: randomInt(0, 3) },
    };
  }
}

// ── Socket.io ──────────────────────────────────────────────────
io.on("connection", socket => {
  socket.emit("state", buildPublic());

  // Audience join
  socket.on("join", ({ name, city }) => {
    if (!name?.trim()) return;
    state.participants[socket.id] = {
      name: name.trim().slice(0, 40),
      city: (city || "").trim().slice(0, 30),
      data: {},
      stepAnswers: {},
    };
    broadcast();
  });

  // Audience submit step answer / data
  socket.on("submit", ({ stepId, value }) => {
    const p = state.participants[socket.id];
    if (!p) return;
    if (state.phase !== "step") {
      socket.emit("submit:rejected", { reason: "phase_closed", stepId, activeStepId: state.stepIndex });
      return;
    }
    if (stepId !== state.stepIndex) {
      socket.emit("submit:rejected", { reason: "step_changed", stepId, activeStepId: state.stepIndex });
      return;
    }
    if (state.stepSubmissions[socket.id]) {
      const step = STEPS[state.stepIndex];
      socket.emit("submitted", { stepId: state.stepIndex, value: p.stepAnswers[state.stepIndex] ?? null, correct: step && step.correct !== null ? step.correct : null, duplicate: true });
      return;
    }
    const step = STEPS[stepId];
    if (!step) return;

    // Store answer
    if (step.type === "poll" || step.type === "quiz") {
      p.stepAnswers[stepId] = value;
    } else if (step.type === "input") {
      let storedValue = value;
      if (step.field.key === "vyruchka") storedValue = value * 1000000;
      if (step.field.scale === "k") storedValue = value * 1000;
      p.data[step.field.key] = storedValue;
      p.stepAnswers[stepId] = 1; // mark as done
    } else if (step.type === "multi") {
      Object.assign(p.data, value);
      p.stepAnswers[stepId] = 1;
    }

    state.stepSubmissions[socket.id] = true;
    socket.emit("submitted", { stepId, value, correct: step.correct !== null ? step.correct : null });
    broadcast();
  });

  // Host controls
  socket.on("host:next", () => {
    const nextIndex = STEPS.findIndex((st, idx) => idx > state.stepIndex);
    if (nextIndex === -1) {
      state.phase = "reveal";
      state.showResults = false;
      broadcast();
      return;
    }
    state.stepIndex = nextIndex;
    state.phase = "step";
    state.showResults = false;
    state.stepSubmissions = {};
    broadcast();
  });

  socket.on("host:results", () => {
    state.showResults = true;
    if (state.stepIndex >= STEPS.length - 1) {
      state.phase = "reveal";
    }
    broadcast();
  });

  socket.on("host:reveal",     () => { state.phase = "reveal"; broadcast(); });
  socket.on("host:lobby",      () => { state.phase = "lobby"; broadcast(); });
  socket.on("host:seed50", () => {
    if (Object.keys(state.participants).length === 0) seedParticipants(50);
    broadcast();
  });

  socket.on("host:reset",      () => {
    state = { phase: "lobby", stepIndex: -1, showResults: false, participants: {}, stepSubmissions: {} };
    try { if (fs.existsSync(SNAPSHOT_FILE)) fs.unlinkSync(SNAPSHOT_FILE); } catch (e) {}
    broadcast();
  });

  socket.on("disconnect", () => {
    // Keep participant data for final reveal even if phone goes offline/locks screen.
    delete state.stepSubmissions[socket.id];
    broadcast();
  });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/host",   (_, res) => res.sendFile(path.join(__dirname, "public", "host.html")));
app.get("/reveal", (_, res) => res.sendFile(path.join(__dirname, "public", "reveal.html")));
app.get("/workflows/:id/builder", (_, res) => res.sendFile(path.join(__dirname, "public", "builder.html")));
app.get("/api/workflows/templates", (_, res) => res.json(workflowTemplates));
app.post("/api/workflows/:id/builder", express.json(), (req, res) => { workflowStore[req.params.id] = req.body || {}; res.json({ ok: true }); });
app.post("/api/workflows/:id/run-test", (req, res) => res.json({ status: "success", workflowId: req.params.id, executedNodes: (workflowStore[req.params.id]?.nodes || []).length }));
app.get("/export", (_, res) => res.json({ savedAt: new Date().toISOString(), participantCount: Object.keys(state.participants).length, revealData: buildRevealData() }));
app.get("*",       (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

server.listen(PORT, () => console.log(`Live on port ${PORT}`));
