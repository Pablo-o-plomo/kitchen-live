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
    id: 5, type: "poll", phase: "🎤 ПОСЛЕ ВЫСТУПЛЕНИЯ",
    text: "Что внедрите в первую очередь после сегодняшнего выступления?",
    options: ["Еженедельную инвентаризацию", "Обучение персонала", "Систему подсчёта FC%", "Аудит зон хранения"],
    correct: null, dataKey: "first_action", postTalk: true,
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
    steps: STEPS.map(({ id, type, phase, postTalk }) => ({ id, type, phase, postTalk: !!postTalk })),
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



function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function seedParticipants(count = 50) {
  const cities = ["Москва", "СПб", "Казань", "Екатеринбург", "Новосибирск", "Краснодар"];
  for (let i = 1; i <= count; i++) {
    const id = `seed-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;
    const rev = randomInt(1200000, 6000000);
    const seb = Math.round(rev * (randomInt(22, 34) / 100));
    const por = randomInt(15000, 180000);
    const inv = randomInt(10000, 120000);
    const bra = randomInt(5000, 70000);
    const kom = randomInt(3000, 50000);
    const per = randomInt(7000, 90000);
    state.participants[id] = {
      name: `Тест-ресторан ${i}`,
      city: cities[i % cities.length],
      data: { vyruchka: rev, sebestoimost: seb, porcha: por, inventar: inv, brakerage: bra, kompliment: kom, personal: per },
      score: randomInt(0, 4000),
      stepAnswers: { 0: randomInt(0, 3), 1: randomInt(0, 3), 4: randomInt(0, 3), 5: randomInt(0, 3) },
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
      score: 0,
      stepAnswers: {},
    };
    broadcast();
  });

  // Audience submit step answer / data
  socket.on("submit", ({ stepId, value }) => {
    const p = state.participants[socket.id];
    if (!p) return;
    if (state.phase !== "step") return;
    if (stepId !== state.stepIndex) return;
    if (state.stepSubmissions[socket.id]) return;
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
  socket.on("host:next", () => {
    const nextIndex = STEPS.findIndex((st, idx) => idx > state.stepIndex && !st.postTalk);
    if (nextIndex === -1) return;
    state.stepIndex = nextIndex;
    state.phase = "step";
    state.showResults = false;
    state.stepSubmissions = {};
    broadcast();
  });

  socket.on("host:posttalk", () => {
    const postTalkIndex = STEPS.findIndex(st => st.postTalk);
    if (postTalkIndex === -1) return;
    state.stepIndex = postTalkIndex;
    state.phase = "step";
    state.showResults = false;
    state.stepSubmissions = {};
    broadcast();
  });
  socket.on("host:results",    () => { state.showResults = true; broadcast(); });
  socket.on("host:reveal",     () => { state.phase = "reveal"; broadcast(); });
  socket.on("host:lobby",      () => { state.phase = "lobby"; broadcast(); });
  socket.on("host:seed50", () => {
    if (Object.keys(state.participants).length === 0) seedParticipants(50);
    broadcast();
  });

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
