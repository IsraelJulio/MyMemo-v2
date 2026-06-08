import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import confetti from "canvas-confetti";
import {
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Download,
  Edit3,
  Flame,
  LogIn,
  LogOut,
  Medal,
  Moon,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Trophy,
  Upload,
  X
} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL ?? "/api";

type Player = "player-one" | "israel";
type Direction = "FRONT" | "BACK";
type GameMode = "BASE" | "SPACED_LIST" | "SPACED_GLOBAL" | "BASE_WRITTEN" | "SPACED_LIST_WRITTEN" | "SPACED_GLOBAL_WRITTEN";
type Card = { id: string; front: string; back: string; listId: string; list?: List };
type List = { id: string; title: string; color: string; _count?: { cards: number }; cards?: Card[] };
type Session = { id: string; listTitle: string; mode: GameMode; direction: Direction; points: number; accuracy: number; playedAt: string; user: { displayName: string }; correctCount: number; totalCount: number; antiGrind: boolean };
type Dashboard = {
  sessions: Session[];
  lists: List[];
  stats: { direction: Direction; points: number; accuracy: number }[];
  calendar: { date: string; sessions: number; points: number; accuracy: number }[];
  achievements: { id: string; title: string; description: string }[];
  unlocks: { userId: string; achievementId: string; unlockedAt: string }[];
  goals: { id: string; target: number; achievedAt?: string; list?: List | null; user: { displayName: string } }[];
};

const modes: { id: GameMode; label: string; short: string }[] = [
  { id: "BASE", label: "Base", short: "Clique" },
  { id: "SPACED_LIST", label: "Spaced Lista", short: "Clique" },
  { id: "SPACED_GLOBAL", label: "Spaced Geral", short: "Clique" },
  { id: "BASE_WRITTEN", label: "Base Escrita", short: "Escrita" },
  { id: "SPACED_LIST_WRITTEN", label: "Spaced Lista Escrita", short: "Escrita" },
  { id: "SPACED_GLOBAL_WRITTEN", label: "Spaced Geral Escrita", short: "Escrita" }
];

function authHeaders(player: Player) {
  return { "x-mymemo-player": player };
}

async function request<T>(path: string, options: RequestInit = {}, player: Player = "player-one"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...authHeaders(player), ...options.headers }
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Erro na API.");
  if (res.status === 204) return undefined as T;
  return res.json();
}

function App() {
  const [player, setPlayer] = useState<Player>((localStorage.getItem("mymemo-player") as Player) ?? "player-one");
  const [dark, setDark] = useState(localStorage.getItem("mymemo-theme") === "dark");
  const [lists, setLists] = useState<List[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [view, setView] = useState<"play" | "dashboard" | "import" | "manage">("play");
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("mymemo-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem("mymemo-player", player);
    refresh();
  }, [player]);

  useEffect(() => {
    if (player !== "israel" && (view === "import" || view === "manage")) setView("play");
  }, [player, view]);

  async function refresh() {
    const [freshLists, freshDash] = await Promise.all([request<List[]>("/lists", {}, player), request<Dashboard>("/dashboard", {}, player)]);
    setLists(freshLists);
    setDashboard(freshDash);
  }

  function celebrate(message: string) {
    setToast(message);
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.18 } });
    window.setTimeout(() => setToast(""), 3200);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo"><Sparkles size={22} /></div>
          <div>
            <strong>MyMemo</strong>
            <span>{player === "israel" ? "Israel" : "Player One"}</span>
          </div>
        </div>
        <div className="top-actions">
          <button className="icon" title="Alternar tema" onClick={() => setDark((value) => !value)}>{dark ? <Sun /> : <Moon />}</button>
          <LoginButton player={player} setPlayer={setPlayer} />
        </div>
      </header>

      <nav className="tabs">
        <button className={view === "play" ? "active" : ""} onClick={() => setView("play")}><BookOpen /> Jogar</button>
        <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><BarChart3 /> Dashboard</button>
        {player === "israel" && <button className={view === "import" ? "active" : ""} onClick={() => setView("import")}><Upload /> Importar arquivos</button>}
        {player === "israel" && <button className={view === "manage" ? "active" : ""} onClick={() => setView("manage")}><Edit3 /> Listas</button>}
      </nav>

      {toast && <div className="toast"><Trophy /> {toast}</div>}
      {view === "play" && <Play lists={lists} player={player} refresh={refresh} celebrate={celebrate} />}
      {view === "dashboard" && dashboard && <DashboardView data={dashboard} />}
      {view === "import" && player === "israel" && <ImportFiles lists={lists} player={player} refresh={refresh} celebrate={celebrate} />}
      {view === "manage" && player === "israel" && <Manage lists={lists} player={player} refresh={refresh} celebrate={celebrate} />}
    </main>
  );
}

function LoginButton({ player, setPlayer }: { player: Player; setPlayer: (player: Player) => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  if (player === "israel") {
    return <button className="pill" onClick={() => setPlayer("player-one")}><LogOut /> Logout</button>;
  }
  async function login() {
    try {
      await request("/login", { method: "POST", body: JSON.stringify({ password }) });
      setPlayer("israel");
      setOpen(false);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <div className="login">
      <button className="pill" onClick={() => setOpen((value) => !value)}><LogIn /> Israel</button>
      {open && (
        <div className="popover">
          <input type="password" placeholder="Senha" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && login()} />
          <button onClick={login}><Check /> Entrar</button>
          {error && <small>{error}</small>}
        </div>
      )}
    </div>
  );
}

function Play({ lists, player, refresh, celebrate }: { lists: List[]; player: Player; refresh: () => Promise<void>; celebrate: (message: string) => void }) {
  const [listId, setListId] = useState("");
  const [mode, setMode] = useState<GameMode>("BASE");
  const [direction, setDirection] = useState<Direction>("FRONT");
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [answers, setAnswers] = useState<{ cardId: string; correct: boolean }[]>([]);
  const activeList = lists.find((list) => list.id === listId);
  const card = cards[index];
  const written = mode.includes("WRITTEN");

  useEffect(() => {
    if (!listId && lists[0]) setListId(lists[0].id);
  }, [lists, listId]);

  async function start() {
    const qs = new URLSearchParams({ mode, direction, ...(mode.includes("GLOBAL") ? {} : { listId }) });
    const nextCards = await request<Card[]>(`/play/cards?${qs}`, {}, player);
    setCards(nextCards);
    setIndex(0);
    setAnswers([]);
    setRevealed(false);
    setTyped("");
  }

  async function answer(correct: boolean) {
    const nextAnswers = [...answers, { cardId: card.id, correct }];
    if (index < cards.length - 1) {
      setAnswers(nextAnswers);
      setIndex(index + 1);
      setRevealed(false);
      setTyped("");
      return;
    }
    const result = await request<{ session: Session; unlocked: unknown[] }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ listId: card.listId ?? listId, listTitle: activeList?.title ?? card.list?.title, mode, direction, answers: nextAnswers })
    }, player);
    setCards([]);
    await refresh();
    celebrate(`${result.session.points} pontos, ${result.session.accuracy}% de acerto`);
  }

  return (
    <section className="play-grid">
      <div className="launcher">
        <label>Lista</label>
        <select value={listId} onChange={(event) => setListId(event.target.value)} disabled={mode.includes("GLOBAL")}>
          {lists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}
        </select>
        <label>Modo</label>
        <div className="mode-grid">{modes.map((item) => <button key={item.id} className={mode === item.id ? "selected" : ""} onClick={() => setMode(item.id)}>{item.label}<span>{item.short}</span></button>)}</div>
        <label>Direcao</label>
        <div className="segmented">
          <button className={direction === "FRONT" ? "active" : ""} onClick={() => setDirection("FRONT")}>Frente</button>
          <button className={direction === "BACK" ? "active" : ""} onClick={() => setDirection("BACK")}>Verso</button>
        </div>
        <button className="primary" disabled={!listId && !mode.includes("GLOBAL")} onClick={start}><ChevronRight /> Comecar</button>
      </div>

      <div className="table">
        {!card && <div className="empty"><Flame size={42} /> Escolha uma lista e comece uma sessao.</div>}
        {card && (
          <>
            <div className="session-meta"><span>{index + 1}/{cards.length}</span><span>{modeLabel(mode)}</span><span>{direction === "FRONT" ? "Frente" : "Verso"}</span></div>
            <button className={`flashcard ${revealed ? "flipped" : ""}`} onClick={() => setRevealed(true)}>
              <div className="face front">{direction === "FRONT" ? card.front : card.back}</div>
              <div className="face back">{direction === "FRONT" ? card.back : card.front}</div>
            </button>
            {written && <textarea placeholder="Digite sua resposta antes de revelar" value={typed} onChange={(event) => setTyped(event.target.value)} />}
            <button className="ghost" onClick={() => setRevealed(true)}><RotateCcw /> Revelar resposta</button>
            {revealed && <div className="answer-row"><button className="danger" onClick={() => answer(false)}><X /> Errei</button><button className="success" onClick={() => answer(true)}><Check /> Acertei</button></div>}
          </>
        )}
      </div>
    </section>
  );
}

function DashboardView({ data }: { data: Dashboard }) {
  const [user, setUser] = useState("todos");
  const [list, setList] = useState("todos");
  const [mode, setMode] = useState("todos");
  const [direction, setDirection] = useState("todos");
  const [day, setDay] = useState<string | null>(null);
  const filtered = data.sessions.filter((row) =>
    (user === "todos" || row.user.displayName === user) &&
    (list === "todos" || row.listTitle === list) &&
    (mode === "todos" || row.mode === mode) &&
    (direction === "todos" || row.direction === direction)
  );
  const unlocked = new Set(data.unlocks.map((row) => row.achievementId));
  const selectedDay = data.calendar.find((row) => row.date === day);
  const summary = useMemo(() => {
    const points = filtered.reduce((total, row) => total + row.points, 0);
    const accuracy = filtered.length ? Math.round(filtered.reduce((total, row) => total + row.accuracy, 0) / filtered.length) : 0;
    const antiGrind = filtered.filter((row) => row.antiGrind).length;
    return { points, accuracy, antiGrind, sessions: filtered.length };
  }, [filtered]);
  const scoreByDay = useMemo(() => {
    const byDate = filtered.reduce<Record<string, number>>((acc, row) => {
      const date = row.playedAt.slice(0, 10);
      acc[date] = (acc[date] ?? 0) + row.points;
      return acc;
    }, {});
    return Object.entries(byDate)
      .map(([date, points]) => ({ date, points }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [filtered]);

  return (
    <section className="dashboard">
      <div className="dashboard-hero">
        <div>
          <span>Visao geral</span>
          <strong>{summary.sessions} sessoes filtradas</strong>
        </div>
        <div className="hero-metrics">
          <div><small>Pontos</small><b>{summary.points}</b></div>
          <div><small>Acerto medio</small><b>{summary.accuracy}%</b></div>
          <div><small>Anti-grind</small><b>{summary.antiGrind}</b></div>
        </div>
      </div>

      <div className="stat-row">{data.stats.map((stat) => <div className="stat" key={stat.direction}><span>{stat.direction === "FRONT" ? "Frente" : "Verso"}</span><strong>{stat.points}</strong><small>{stat.accuracy}% acerto</small></div>)}</div>

      <div className="dashboard-main">
        <div className="panel filters-panel">
          <div className="panel-title"><strong>Filtros</strong><small>Refine o historico sem perder contexto.</small></div>
          <div className="filters">
            <select value={user} onChange={(e) => setUser(e.target.value)}><option value="todos">Usuarios</option><option>Player One</option><option>Israel</option></select>
            <select value={list} onChange={(e) => setList(e.target.value)}><option value="todos">Listas</option>{data.lists.map((item) => <option key={item.id}>{item.title}</option>)}</select>
            <select value={mode} onChange={(e) => setMode(e.target.value)}><option value="todos">Modos</option>{modes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
            <select value={direction} onChange={(e) => setDirection(e.target.value)}><option value="todos">Direcao</option><option value="FRONT">Frente</option><option value="BACK">Verso</option></select>
          </div>
        </div>

        <ScoreByDayChart data={scoreByDay} />

        <div className="panel history-panel">
          <div className="panel-title"><strong>Historico recente</strong><small>{filtered.length} registros encontrados</small></div>
          <div className="history">
            {filtered.map((row) => (
              <article key={row.id}>
                <div><strong>{row.points} pts</strong><span>{row.accuracy}%</span></div>
                <p>{row.user.displayName} jogou {row.listTitle}</p>
                <small>{new Date(row.playedAt).toLocaleString()} - {modeLabel(row.mode)} - {row.direction === "FRONT" ? "Frente" : "Verso"}{row.antiGrind ? " - anti-grind" : ""}</small>
              </article>
            ))}
          </div>
        </div>
      </div>

      <aside className="dashboard-side">
        <div className="panel calendar-panel">
          <div className="panel-title"><strong>Calendario</strong><small>Ultimos 42 dias</small></div>
          <div className="calendar">
            {Array.from({ length: 42 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (41 - i));
              const key = d.toISOString().slice(0, 10);
              const item = data.calendar.find((row) => row.date === key);
              const level = item ? Math.max(1, Math.ceil(item.accuracy / 25)) : 0;
              return <button key={key} className={`heat level-${level}`} title={key} onClick={() => setDay(key)} />;
            })}
          </div>
          {selectedDay && <div className="day-detail">{selectedDay.date}: {selectedDay.sessions} sessoes, {selectedDay.points.toFixed(1)} pts, {selectedDay.accuracy}%.</div>}
        </div>

        <div className="panel">
          <div className="panel-title"><strong>Metas</strong><small>Progresso por lista e usuario</small></div>
          <div className="goal-grid">{data.goals.map((goal) => <div className="goal" key={goal.id}><span>{goal.list?.title ?? "Global"} - {goal.user.displayName}</span><div><i style={{ width: `${goal.achievedAt ? 100 : Math.min(goal.target, 96)}%` }} /></div><strong>{goal.target}%</strong></div>)}</div>
        </div>

        <div className="panel">
          <div className="panel-title"><strong>Conquistas</strong><small>{data.unlocks.length} liberadas</small></div>
          <div className="badges">{data.achievements.map((item) => <div className={unlocked.has(item.id) ? "badge unlocked" : "badge"} key={item.id}><Medal /><strong>{item.title}</strong><small>{item.description}</small></div>)}</div>
        </div>
      </aside>
    </section>
  );
}

function ScoreByDayChart({ data }: { data: { date: string; points: number }[] }) {
  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 18, bottom: 42, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxPoints = Math.max(1, ...data.map((item) => item.points));
  const xFor = (index: number) => padding.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const yFor = (points: number) => padding.top + plotHeight - (points / maxPoints) * plotHeight;
  const linePath = data.map((item, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(item.points)}`).join(" ");
  const areaPath = data.length ? `${linePath} L ${xFor(data.length - 1)} ${padding.top + plotHeight} L ${xFor(0)} ${padding.top + plotHeight} Z` : "";
  const labelStep = data.length > 7 ? 2 : 1;

  return (
    <div className="panel score-chart">
      <div className="panel-title"><strong>Dias x pontuacao</strong><small>Ultimos 14 dias com sessoes filtradas</small></div>
      {data.length === 0 ? (
        <div className="empty chart-empty">Sem pontuacao para os filtros atuais.</div>
      ) : (
        <svg className="score-chart-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico de dias por pontuacao">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + plotHeight - ratio * plotHeight;
            const value = Math.round(maxPoints * ratio);
            return (
              <g key={ratio}>
                <line className="chart-grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                <text className="chart-label chart-y" x={padding.left - 10} y={y + 4}>{value}</text>
              </g>
            );
          })}
          <path className="chart-area" d={areaPath} />
          <path className="chart-line" d={linePath} />
          {data.map((item, index) => {
            const x = xFor(index);
            const y = yFor(item.points);
            const label = new Date(`${item.date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            return (
              <g key={item.date}>
                <circle className="chart-dot" cx={x} cy={y} r="4.5">
                  <title>{label}: {item.points} pontos</title>
                </circle>
                <text className="chart-value" x={x} y={y - 10}>{item.points}</text>
                {index % labelStep === 0 && <text className="chart-label" x={x} y={height - 14}>{label}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function ImportFiles({ lists, player, refresh, celebrate }: { lists: List[]; player: Player; refresh: () => Promise<void>; celebrate: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState("");

  async function importCsv() {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    if (selected) form.append("listId", selected);
    else form.append("title", title || "Lista importada");
    const result = await request<{ imported: number }>("/import", { method: "POST", body: form }, player);
    setFile(null);
    setTitle("");
    celebrate(`${result.imported} cards importados`);
    refresh();
  }

  return (
    <section className="import-view">
      <div className="tools import-panel">
        <div className="panel-title">
          <strong>Importar arquivos</strong>
          <small>CSV sem cabecalho: coluna A = frente, coluna B = verso.</small>
        </div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Criar nova lista no import</option>{lists.map((list) => <option value={list.id} key={list.id}>{list.title}</option>)}</select>
        {!selected && <input placeholder="Nome da nova lista" value={title} onChange={(e) => setTitle(e.target.value)} />}
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button disabled={!file} onClick={importCsv}><Upload /> Importar CSV</button>
      </div>
    </section>
  );
}

function Manage({ lists, player, refresh, celebrate }: { lists: List[]; player: Player; refresh: () => Promise<void>; celebrate: (message: string) => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(90);
  const [selected, setSelected] = useState("");

  async function createList() {
    await request("/lists", { method: "POST", body: JSON.stringify({ title, cards: [] }) }, player);
    setTitle("");
    refresh();
  }

  async function addGoal() {
    await request("/goals", { method: "POST", body: JSON.stringify({ target, listId: selected || null }) }, player);
    celebrate("Meta criada");
    refresh();
  }

  return (
    <section className="manage">
      <div className="tools">
        <input placeholder="Nome da nova lista" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button onClick={createList}><Plus /> Criar lista</button>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Meta global</option>{lists.map((list) => <option value={list.id} key={list.id}>{list.title}</option>)}</select>
        <div className="goal-editor"><input type="number" min={1} max={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} /><button onClick={addGoal}><Trophy /> Meta</button></div>
      </div>
      <div className="list-admin">
        {lists.map((list) => (
          <ListAdminItem key={list.id} list={list} player={player} refresh={refresh} />
        ))}
      </div>
    </section>
  );
}

function ListAdminItem({ list, player, refresh }: { list: List; player: Player; refresh: () => Promise<void> }) {
  const [cards, setCards] = useState<Card[]>(list.cards ?? []);
  const [listTitle, setListTitle] = useState(list.title);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => {
    setListTitle(list.title);
  }, [list.title]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    request<List>(`/lists/${list.id}`, {}, player)
      .then((detail) => {
        if (active) setCards(detail.cards ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [list.id, player]);

  function updateDraft(cardId: string, field: "front" | "back", value: string) {
    setCards((current) => current.map((card) => card.id === cardId ? { ...card, [field]: value } : card));
  }

  async function addCard() {
    if (!front.trim() || !back.trim()) return;
    const card = await request<Card>(`/lists/${list.id}/cards`, { method: "POST", body: JSON.stringify({ front, back }) }, player);
    setCards((current) => [...current, card]);
    setFront("");
    setBack("");
    refresh();
  }

  async function saveCard(card: Card) {
    setSavingId(card.id);
    try {
      const saved = await request<Card>(`/cards/${card.id}`, { method: "PUT", body: JSON.stringify({ front: card.front, back: card.back }) }, player);
      setCards((current) => current.map((item) => item.id === card.id ? saved : item));
    } finally {
      setSavingId("");
    }
  }

  async function saveListTitle() {
    const title = listTitle.trim();
    if (!title || title === list.title) return;
    setSavingTitle(true);
    try {
      await request<List>(`/lists/${list.id}`, { method: "PUT", body: JSON.stringify({ title, color: list.color }) }, player);
      await refresh();
    } finally {
      setSavingTitle(false);
    }
  }

  async function deleteCard(cardId: string) {
    await request(`/cards/${cardId}`, { method: "DELETE" }, player);
    setCards((current) => current.filter((card) => card.id !== cardId));
    refresh();
  }

  return (
    <article style={{ borderColor: list.color }}>
      <div className="list-heading">
        <div className="list-title-editor">
          <input
            aria-label="Nome da lista"
            value={listTitle}
            onChange={(e) => setListTitle(e.target.value)}
            onBlur={saveListTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveListTitle();
              if (e.key === "Escape") setListTitle(list.title);
            }}
          />
          <small>{cards.length || list._count?.cards || 0} cards</small>
        </div>
        <div className="list-heading-actions">
          <button disabled={savingTitle || !listTitle.trim() || listTitle.trim() === list.title} onMouseDown={(e) => e.preventDefault()} onClick={saveListTitle}><Check /> Salvar nome</button>
          <button className="danger ghostline" onClick={async () => { await request(`/lists/${list.id}`, { method: "DELETE" }, player); refresh(); }}><Trash2 /> Apagar lista</button>
        </div>
      </div>

      <div className="inline">
        <input placeholder="Frente" value={front} onChange={(e) => setFront(e.target.value)} />
        <input placeholder="Verso" value={back} onChange={(e) => setBack(e.target.value)} />
        <button disabled={!front.trim() || !back.trim()} onClick={addCard} title="Adicionar card"><Plus /></button>
      </div>

      <div className="card-editor">
        {loading && <small>Carregando cards...</small>}
        {!loading && cards.length === 0 && <small>Nenhum card nesta lista ainda.</small>}
        {cards.map((card) => (
          <div className="card-row" key={card.id}>
            <textarea aria-label="Frente do card" value={card.front} onChange={(e) => updateDraft(card.id, "front", e.target.value)} />
            <textarea aria-label="Verso do card" value={card.back} onChange={(e) => updateDraft(card.id, "back", e.target.value)} />
            <div className="card-actions">
              <button disabled={savingId === card.id || !card.front.trim() || !card.back.trim()} onClick={() => saveCard(card)}><Check /> Salvar</button>
              <button className="danger ghostline" onClick={() => deleteCard(card.id)}><Trash2 /></button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function modeLabel(mode: GameMode) {
  return modes.find((item) => item.id === mode)?.label ?? mode;
}

createRoot(document.getElementById("root")!).render(<App />);
