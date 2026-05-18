const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// ── Steps definition ───────────────────────────────────────────
const STEPS = [
  {
    id: 0, type: "poll", phase: "🔥 РАЗМИНКА",
    text: "Как вы сейчас контролируете потери на кухне?",
    options: ["Считаем вручную каждый день", "Инвентаризация раз в месяц", "Работаем на глаз", "Есть автоматизация"],
    correct: null, dataKey: "control_method",
  },
  {
    id: 1, type: "quiz", phase: "📦 ПОТЕРИ",
    text: "Какой % выручки в среднем теряет ресторан из-за потерь?",
    options: ["3–5%", "10–15%", "15–30%", "Больше 40%"],
    correct: 2, dataKey: "quiz1",
    explanation: "15–30% — реальная цифра по аудитам. Большинство этого не знают.",
  },
  {
    id: 2, type: "input", phase: "💰 ВАШИ ДАННЫЕ",
    text: "Введите выручку вашего заведения за последний месяц",
    field: { key: "vyruchka", label: "Выручка", placeholder: "2000000", unit: "₽" },
  },
  {
    id: 3, type: "multi", phase: "📊 FOOD COST",
    text: "Введите суммы потерь за последний месяц",
    fields: [
      { key: "sebestoimost", label: "Себестоимость реализации", icon: "🍽️" },
      { key: "porcha",       label: "Порча",                    icon: "⚠️" },
      { key: "inventar",     label: "Отриц. инвентаризация",    icon: "📦" },
      { key: "brakerage",    label: "Бракераж",                 icon: "🚫" },
      { key: "kompliment",   label: "Комплименты",              icon: "🎁" },
      { key: "personal",     label: "Питание персонала",        icon: "👥" },
    ],
  },
  {
    id: 4, type: "quiz", phase: "❄️ ХРАНЕНИЕ",
    text: "Что такое принцип FIFO на кухне?",
    options: ["Система инвентаризации", "First In First Out", "Программа учёта", "Метод оценки поставщиков"],
    correct: 1, dataKey: "quiz2",
    explanation: "FIFO — старый товар берётся первым. Нарушение FIFO = главная причина порчи.",
  },
  {
    id: 5, type: "poll", phase: "🎯 ИТОГ",
    text: "Что внедрите в первую очередь после сегодняшнего выступления?",
    options: ["Еженедельную инвентаризацию", "Обучение персонала", "Систему подсчёта FC%", "Аудит зон хранения"],
    correct: null, dataKey: "first_action",
  },
];

// ── State ──────────────────────────────────────────────────────
let state = {
  phase: "lobby",      // lobby | step | reveal
  stepIndex: -1,
  showResults: false,
  participants: {},    // id -> { name, city, data:{}, score, stepAnswers:{} }
  stepSubmissions: {}, // id -> submitted for current step
};

function broadcast() {
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
    // Reveal data: all participants with their FC data
    revealData: state.phase === "reveal" ? buildRevealData() : null,
  };
}

function buildRevealData() {
  return Object.values(state.participants).map(p => {
    const d = p.data || {};
    const rev = parseFloat(d.vyruchka) || 0;
    const seb = parseFloat(d.sebestoimost) || 0;
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
      score: p.score || 0,
      vyruchka: rev,
      sebestoimost: seb,
      porcha: por,
      inventar: inv,
      brakerage: bra,
      kompliment: kom,
      personal: per,
      totalFC: total,
      losses,
      fc,
      control_method: p.stepAnswers[0] ?? null,
      first_action: p.stepAnswers[5] ?? null,
    };
  }).sort((a, b) => b.fc - a.fc);
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
      score: 0,
      stepAnswers: {},
    };
    broadcast();
  });

  // Audience submit step answer / data
  socket.on("submit", ({ stepId, value }) => {
    const p = state.participants[socket.id];
    if (!p) return;
    const step = STEPS[stepId];
    if (!step) return;

    // Store answer
    if (step.type === "poll" || step.type === "quiz") {
      p.stepAnswers[stepId] = value;
      if (step.type === "quiz" && step.correct !== null && value === step.correct) {
        p.score += 1000;
      }
    } else if (step.type === "input") {
      p.data[step.field.key] = value;
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
  socket.on("host:next",       () => { state.stepIndex = Math.min(state.stepIndex + 1, STEPS.length - 1); state.phase = "step"; state.showResults = false; state.stepSubmissions = {}; broadcast(); });
  socket.on("host:results",    () => { state.showResults = true; broadcast(); });
  socket.on("host:reveal",     () => { state.phase = "reveal"; broadcast(); });
  socket.on("host:lobby",      () => { state.phase = "lobby"; broadcast(); });
  socket.on("host:reset",      () => {
    state = { phase: "lobby", stepIndex: -1, showResults: false, participants: {}, stepSubmissions: {} };
    broadcast();
  });

  socket.on("disconnect", () => {
    delete state.participants[socket.id];
    delete state.stepSubmissions[socket.id];
    broadcast();
  });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/host",   (_, res) => res.sendFile(path.join(__dirname, "public", "host.html")));
app.get("/reveal", (_, res) => res.sendFile(path.join(__dirname, "public", "reveal.html")));
app.get("*",       (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

server.listen(PORT, () => console.log(`Live on port ${PORT}`));
