const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const NORMS = {
  full:  { label: "Ресторан полного цикла", norm: 30, max: 35 },
  fast:  { label: "Фастфуд / стритфуд",    norm: 25, max: 30 },
  cafe:  { label: "Кофейня / кафе",         norm: 22, max: 27 },
  bar:   { label: "Бар / паб",              norm: 25, max: 30 },
  other: { label: "Другое",                 norm: 28, max: 34 },
};

let state = { phase: "lobby", participants: {} };

function calcFC(p) {
  const rev = parseFloat(p.vyruchka) || 0;
  if (rev <= 0) return { fc: 0, loss: 0, deviation: 0, norm: 0, normMax: 0 };
  const normObj = NORMS[p.format] || NORMS.full;
  let fc = 0;
  if (p.fc_known && parseFloat(p.fc_direct) > 0) {
    fc = parseFloat(p.fc_direct);
  } else {
    const cats = ["sebestoimost","porcha","inventar","brakerage","kompliment","personal"];
    const total = cats.reduce((s, k) => s + (parseFloat(p[k]) || 0), 0);
    fc = total / rev * 100;
  }
  const deviation = fc - normObj.norm;
  const loss = deviation > 0 ? Math.round(deviation / 100 * rev) : 0;
  return { fc: +fc.toFixed(1), loss, deviation: +deviation.toFixed(1), norm: normObj.norm, normMax: normObj.max };
}

function broadcast() {
  const parts = Object.values(state.participants);
  const revealData = state.phase === "reveal"
    ? parts.filter(p => p.name).map(p => {
        const calc = calcFC(p);
        return {
          name: p.name, city: p.city || "", format: p.format || "full",
          formatLabel: (NORMS[p.format] || NORMS.full).label,
          vyruchka: parseFloat(p.vyruchka)||0,
          sebestoimost: parseFloat(p.sebestoimost)||0,
          porcha: parseFloat(p.porcha)||0,
          inventar: parseFloat(p.inventar)||0,
          brakerage: parseFloat(p.brakerage)||0,
          kompliment: parseFloat(p.kompliment)||0,
          personal: parseFloat(p.personal)||0,
          fc_known: p.fc_known||false,
          frequency: p.frequency||"",
          unsure: p.unsure||[],
          ...calc,
        };
      }).sort((a,b) => b.fc - a.fc)
    : null;

  io.emit("state", {
    phase: state.phase,
    participantCount: parts.length,
    submittedCount: parts.filter(p => p.submitted).length,
    revealData,
  });
}

io.on("connection", socket => {
  socket.emit("state", { phase: state.phase, participantCount: Object.keys(state.participants).length, submittedCount: 0, revealData: null });

  socket.on("register", ({ name, city, format }) => {
    if (!name?.trim()) return;
    state.participants[socket.id] = { name: name.trim().slice(0,40), city:(city||"").trim().slice(0,30), format: format||"full", submitted: false };
    broadcast();
    socket.emit("registered");
  });

  socket.on("submit_data", (data) => {
    const p = state.participants[socket.id];
    if (!p) return;
    Object.assign(p, data, { submitted: true });
    const calc = calcFC(p);
    broadcast();
    socket.emit("result", { ...calc, formatLabel: (NORMS[p.format]||NORMS.full).label, vyruchka: parseFloat(p.vyruchka)||0 });
  });

  socket.on("host:collecting", () => { state.phase = "collecting"; broadcast(); });
  socket.on("host:reveal",     () => { state.phase = "reveal";     broadcast(); });
  socket.on("host:lobby",      () => { state.phase = "lobby";      broadcast(); });
  socket.on("host:reset",      () => { state = { phase:"lobby", participants:{} }; broadcast(); });

  socket.on("disconnect", () => { delete state.participants[socket.id]; broadcast(); });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/host",   (_, res) => res.sendFile(path.join(__dirname, "public", "host.html")));
app.get("/reveal", (_, res) => res.sendFile(path.join(__dirname, "public", "reveal.html")));
app.get("*",       (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

server.listen(PORT, () => console.log(`Kitchen Live on port ${PORT}`));
