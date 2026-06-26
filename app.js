/* ============================================================
   NpStudio — application logic
   Real auth + shared database via Supabase.
   ============================================================ */
(function () {
  "use strict";

  const cfg = window.NP_CONFIG || {};
  if (!window.supabase) { document.getElementById("app").innerHTML = errorScreen("Supabase library failed to load."); return; }
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) { document.getElementById("app").innerHTML = errorScreen("Missing Supabase URL or key in config.js."); return; }

  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const root = document.getElementById("app");

  /* ---------- constants ---------- */
  const STATUSES = ["Lead", "Contacted", "In Progress", "Awaiting Reply", "Paused", "Delivered"];
  const STATUS_COLOR = { "Lead": "#3b82f6", "Contacted": "#d97706", "In Progress": "#6d4aff", "Awaiting Reply": "#9333ea", "Paused": "#6b7280", "Delivered": "#16a34a" };
  const NAV = [
    { key: "dashboard", num: "01", label: "Dashboard" },
    { key: "tasks", num: "02", label: "Tasks" },
    { key: "chat", num: "03", label: "Chat" },
    { key: "clients", num: "04", label: "Clients" },
    { key: "calendar", num: "05", label: "Calendar" },
    { key: "revenue", num: "06", label: "Revenue" },
    { key: "notes", num: "07", label: "Notes" }
  ];

  /* ---------- state ---------- */
  const state = {
    user: null, profile: null,
    tab: "dashboard",
    clients: [], tasks: [], messages: [], notes: [], events: [], profiles: [],
    clientFilter: "All", taskFilter: "All",
    chatDraft: "", modal: null,
    authMode: "signin", authError: "", authNotice: "", authBusy: false
  };

  /* ---------- utils ---------- */
  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function money(n) { return "$" + Number(n || 0).toLocaleString("en-US"); }
  function moneyK(n) { n = Number(n || 0); return n >= 1000 ? "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : "$" + n; }
  function hx(hex, a) { const n = hex.replace("#", ""); return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`; }
  function personColor(name) {
    if (!name) return "#6d4aff";
    const people = cfg.PEOPLE || {};
    for (const k in people) { if (k.toLowerCase() === String(name).toLowerCase()) return people[k]; }
    const cs = ["#6d4aff", "#ec4899", "#3b82f6", "#16a34a", "#d97706"];
    let h = 0; const s = String(name).toLowerCase(); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return cs[h % cs.length];
  }
  function initial(name) { return name ? name.trim()[0].toUpperCase() : "?"; }
  function avatar(name, size) {
    const c = personColor(name);
    return `<div class="avatar" style="width:${size}px;height:${size}px;background:${hx(c, 0.13)};color:${c};font-size:${Math.round(size * 0.4)}px">${esc(initial(name))}</div>`;
  }
  function chip(status) {
    const c = STATUS_COLOR[status] || "#6b7280";
    return `<span class="chip" style="color:${c};background:${hx(c, 0.11)}">${esc(status)}</span>`;
  }
  function myName() { return state.profile?.name || (state.user?.email ? state.user.email.split("@")[0] : "You"); }
  function partner() {
    const others = state.profiles.filter(p => p.id !== state.user?.id && p.name);
    return others[0]?.name || "your cofounder";
  }
  function everyone() {
    const names = state.profiles.map(p => p.name).filter(Boolean);
    Object.keys(cfg.PEOPLE || {}).forEach(n => { if (!names.includes(n)) names.push(n); });
    if (!names.length) names.push(myName());
    return [...new Set(names)];
  }
  function todayISO() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function addDaysISO(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dueLabel(d) {
    if (!d) return "";
    if (d === todayISO()) return "Today";
    if (d === addDaysISO(1)) return "Tomorrow";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function timeOf(ts) { return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function relTime(ts) {
    const s = (Date.now() - new Date(ts).getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " hr ago";
    return Math.floor(s / 86400) + "d ago";
  }
  function errorScreen(msg) { return `<div class="boot" style="flex-direction:column;gap:10px"><b style="color:#c2185b">NpStudio</b><span>${esc(msg)}</span></div>`; }
  const LOGO = `<svg width="20" height="20" viewBox="0 0 28 28"><circle cx="11" cy="14" r="7.5" fill="#6d4aff"></circle><circle cx="17" cy="14" r="7.5" fill="#ec4899" style="mix-blend-mode:multiply"></circle></svg>`;
  const LOGO_W = `<svg width="21" height="21" viewBox="0 0 28 28"><circle cx="11" cy="14" r="7.5" fill="#6d4aff"></circle><circle cx="17" cy="14" r="7.5" fill="#ec4899" style="mix-blend-mode:multiply"></circle></svg>`;

  /* ============================================================
     AUTH
     ============================================================ */
  async function init() {
    const { data: { session } } = await sb.auth.getSession();
    await handleSession(session);
    sb.auth.onAuthStateChange(async (_e, session) => { await handleSession(session); });
  }

  async function handleSession(session) {
    if (session && session.user) {
      const email = session.user.email || "";
      const allow = (cfg.ALLOWED_EMAILS || []).map(e => e.toLowerCase());
      if (allow.length && !allow.includes(email.toLowerCase())) {
        await sb.auth.signOut();
        state.user = null; state.authError = "That email isn't on the workspace allowlist.";
        render(); return;
      }
      state.user = session.user;
      await ensureProfile();
      await loadAll();
      subscribe();
      render();
    } else {
      state.user = null; state.profile = null;
      render();
    }
  }

  async function ensureProfile() {
    const u = state.user;
    const { data } = await sb.from("profiles").select("*").eq("id", u.id).maybeSingle();
    if (data) { state.profile = data; return; }
    const name = (u.user_metadata && (u.user_metadata.name || u.user_metadata.full_name)) || (u.email ? u.email.split("@")[0] : "User");
    const prof = { id: u.id, name, email: u.email, color: personColor(name) };
    await sb.from("profiles").upsert(prof);
    state.profile = prof;
  }

  async function signInEmail(email, password) {
    state.authBusy = true; state.authError = ""; render();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    state.authBusy = false;
    if (error) { state.authError = error.message; render(); }
  }
  async function signUpEmail(name, email, password) {
    state.authBusy = true; state.authError = ""; state.authNotice = ""; render();
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
    state.authBusy = false;
    if (error) { state.authError = error.message; render(); return; }
    if (data && data.user && !data.session) {
      state.authNotice = "Account created — check your email to confirm, then sign in. (You can also turn off email confirmation in Supabase → Authentication → Providers → Email for instant access.)";
      state.authMode = "signin"; render();
    }
  }
  async function signInGoogle() {
    state.authError = "";
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) { state.authError = error.message; render(); }
  }
  async function signOut() { await sb.auth.signOut(); }

  /* ============================================================
     DATA
     ============================================================ */
  async function loadAll() {
    await Promise.all([reload("clients"), reload("tasks"), reload("messages"), reload("notes"), reload("events"), reloadProfiles()]);
  }
  async function reloadProfiles() { const { data } = await sb.from("profiles").select("*"); state.profiles = data || []; }
  async function reload(table) {
    const order = { clients: ["created_at", false], tasks: ["created_at", false], messages: ["created_at", true], notes: ["updated_at", false], events: ["date", true] }[table];
    let q = sb.from(table).select("*");
    if (order) q = q.order(order[0], { ascending: order[1] });
    const { data } = await q;
    state[table] = data || [];
  }

  let channel = null;
  function subscribe() {
    if (channel) return;
    channel = sb.channel("np-db");
    ["clients", "tasks", "messages", "notes", "events", "profiles"].forEach(t => {
      channel.on("postgres_changes", { event: "*", schema: "public", table: t }, async () => {
        if (t === "profiles") await reloadProfiles(); else await reload(t);
        render();
      });
    });
    channel.subscribe();
  }

  /* ---------- CRUD ---------- */
  const addTask = (title, who, due) => sb.from("tasks").insert({ title, who: who || null, due: due || null, done: false }).then(after);
  const toggleTask = (id, done) => sb.from("tasks").update({ done: !done }).eq("id", id).then(after);
  const delTask = (id) => sb.from("tasks").delete().eq("id", id).then(after);
  const addClient = (c) => sb.from("clients").insert(c).then(after);
  const setClientStatus = (id, status) => sb.from("clients").update({ status }).eq("id", id).then(after);
  const delClient = (id) => sb.from("clients").delete().eq("id", id).then(after);
  const sendMsg = (text) => sb.from("messages").insert({ text, sender_id: state.user.id, sender_name: myName() }).then(after);
  const addNote = (n) => sb.from("notes").insert(n).then(after);
  const delNote = (id) => sb.from("notes").delete().eq("id", id).then(after);
  const togglePin = (id, pinned) => sb.from("notes").update({ pinned: !pinned }).eq("id", id).then(after);
  const addEvent = (e) => sb.from("events").insert(e).then(after);
  const delEvent = (id) => sb.from("events").delete().eq("id", id).then(after);
  // optimistic refresh fallback (realtime will also fire)
  async function after() { await loadAll(); render(); }

  /* ============================================================
     RENDER
     ============================================================ */
  function render() {
    if (!state.user) { root.innerHTML = renderLogin(); bindLogin(); return; }
    root.innerHTML = renderShell();
    bindShell();
    if (state.modal) { renderModal(); }
    if (state.tab === "chat") { const b = document.querySelector(".chat-body"); if (b) b.scrollTop = b.scrollHeight; const i = document.getElementById("chatInput"); if (i) { i.value = state.chatDraft; i.focus(); } }
  }

  /* ---------- LOGIN ---------- */
  function renderLogin() {
    const signup = state.authMode === "signup";
    return `
    <div class="login">
      <div class="brand">
        <div class="grid"></div>
        <div class="brand-top row">
          <div class="logo-tile on-violet">${LOGO_W}</div>
          <span class="brand-wordmark">NpStudio</span>
          <span class="brand-tag">STUDIO OS</span>
        </div>
        <div class="row">
          <div class="eyebrow">DESIGN · ANIMATE · SHIP</div>
          <h1>The operating system for your studio.</h1>
          <p>Plan the work, talk it through, and keep every client moving — built for the two of you, nothing more.</p>
        </div>
        <div class="brand-stats row">
          <div><div class="n">2</div><div class="l">FOUNDERS</div></div>
          <div><div class="n">1</div><div class="l">SHARED WORKSPACE</div></div>
          <div><div class="n">∞</div><div class="l">CLIENTS</div></div>
        </div>
      </div>
      <div class="form-wrap">
        <div class="form">
          <h2>${signup ? "Create your account" : "Welcome back"}</h2>
          <p class="sub">${signup ? "Set up your NpStudio login." : "Sign in to the NpStudio workspace."}</p>
          ${state.authError ? `<div class="auth-error">${esc(state.authError)}</div>` : ""}
          ${state.authNotice ? `<div class="auth-notice">${esc(state.authNotice)}</div>` : ""}
          <button class="btn" id="googleBtn" style="width:100%">
            <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.5l-6.6-5.6C29.7 34.6 27 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.6 5.6C41.9 35.9 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
            Continue with Google
          </button>
          <div class="divider"><div class="line"></div><span>OR EMAIL</span><div class="line"></div></div>
          ${signup ? `<div style="margin-bottom:14px"><label class="label">Name</label><input class="field" id="auName" placeholder="e.g. Nate"></div>` : ""}
          <div style="margin-bottom:14px"><label class="label">Email</label><input class="field" id="auEmail" type="email" placeholder="you@npstudio.co"></div>
          <div style="margin-bottom:18px"><label class="label">Password</label><input class="field" id="auPass" type="password" placeholder="••••••••"></div>
          <button class="btn btn-primary" id="emailBtn" style="width:100%" ${state.authBusy ? "disabled" : ""}>${state.authBusy ? "Please wait…" : (signup ? "Create account" : "Sign in")} ${state.authBusy ? "" : "→"}</button>
          <div class="auth-toggle">${signup ? "Already have an account?" : "First time here?"} <b id="toggleMode">${signup ? "Sign in" : "Create one"}</b></div>
        </div>
      </div>
    </div>`;
  }

  function bindLogin() {
    const g = document.getElementById("googleBtn"); if (g) g.onclick = signInGoogle;
    const t = document.getElementById("toggleMode"); if (t) t.onclick = () => { state.authMode = state.authMode === "signup" ? "signin" : "signup"; state.authError = ""; state.authNotice = ""; render(); };
    const e = document.getElementById("emailBtn");
    if (e) e.onclick = () => {
      const email = (document.getElementById("auEmail") || {}).value || "";
      const pass = (document.getElementById("auPass") || {}).value || "";
      if (!email || !pass) { state.authError = "Enter your email and password."; render(); return; }
      if (state.authMode === "signup") {
        const name = (document.getElementById("auName") || {}).value || email.split("@")[0];
        signUpEmail(name.trim(), email.trim(), pass);
      } else signInEmail(email.trim(), pass);
    };
    ["auEmail", "auPass", "auName"].forEach(id => { const el = document.getElementById(id); if (el) el.onkeydown = ev => { if (ev.key === "Enter") document.getElementById("emailBtn").click(); }; });
  }

  /* ---------- SHELL ---------- */
  function renderShell() {
    const meta = NAV.find(n => n.key === state.tab) || NAV[0];
    const dueToday = state.tasks.filter(t => !t.done && t.due === todayISO()).length;
    const unread = ""; // not tracked
    return `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand-row">
          <div class="logo-tile">${LOGO}</div>
          <span class="wordmark">NpStudio</span>
        </div>
        <div class="nav-head">WORKSPACE</div>
        <nav class="nav">
          ${NAV.map(n => {
            let badge = "";
            if (n.key === "tasks" && dueToday) badge = `<span class="badge">${dueToday}</span>`;
            return `<div class="nav-item ${state.tab === n.key ? "active" : ""}" data-action="nav" data-tab="${n.key}"><span class="num">${n.num}</span><span class="label">${n.label}</span>${badge}</div>`;
          }).join("")}
        </nav>
        <div class="user">
          ${avatar(myName(), 34)}
          <div style="flex:1;min-width:0">
            <div class="name">${esc(myName())}</div>
            <div class="role">${esc((state.user.email || "").toUpperCase())}</div>
          </div>
          <div class="out" data-action="signout" title="Sign out">⏻</div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="title"><span class="pnum">${meta.num}</span><h2>${meta.label}</h2></div>
          <div class="right">
            <div class="date">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</div>
            <div class="avatars">${everyone().slice(0, 2).map(n => avatar(n, 30)).join("")}</div>
          </div>
        </header>
        <div class="content scroll">${renderPage()}</div>
      </main>
    </div>`;
  }

  function renderPage() {
    switch (state.tab) {
      case "dashboard": return renderDashboard();
      case "tasks": return renderTasks();
      case "chat": return renderChat();
      case "clients": return renderClients();
      case "calendar": return renderCalendar();
      case "revenue": return renderRevenue();
      case "notes": return renderNotes();
      default: return "";
    }
  }

  function emptyState(icon, title, sub, action) {
    return `<div class="empty"><div class="ic">${icon}</div><h4>${esc(title)}</h4><p>${esc(sub)}</p>${action || ""}</div>`;
  }

  /* ---------- DASHBOARD ---------- */
  function renderDashboard() {
    const hr = new Date().getHours();
    const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const dueToday = state.tasks.filter(t => !t.done && t.due === todayISO()).length;
    const activeClients = state.clients.filter(c => c.status !== "Delivered" && c.status !== "Paused").length;
    const pipeline = state.clients.filter(c => c.status !== "Delivered").reduce((s, c) => s + Number(c.value || 0), 0);
    const booked = state.clients.filter(c => c.status === "Delivered").reduce((s, c) => s + Number(c.value || 0), 0);
    const soon = state.tasks.filter(t => t.due === todayISO() || t.due === addDaysISO(1)).slice(0, 6);
    const pipePrev = state.clients.filter(c => c.status !== "Delivered").slice(0, 5);
    const activity = recentActivity();

    return `
    <div class="page">
      <div style="margin-bottom:24px">
        <h1 class="section-title">${greet}, ${esc(myName())}.</h1>
        <p class="section-sub">You have ${dueToday} task${dueToday === 1 ? "" : "s"} due today across ${state.clients.length} client${state.clients.length === 1 ? "" : "s"}.</p>
      </div>
      <div class="grid-4" style="margin-bottom:22px">
        <div class="stat"><div class="l">TASKS DUE TODAY</div><div class="n accent">${dueToday}</div></div>
        <div class="stat"><div class="l">ACTIVE CLIENTS</div><div class="n">${activeClients}</div></div>
        <div class="stat"><div class="l">BOOKED</div><div class="n">${moneyK(booked)}</div></div>
        <div class="stat"><div class="l">PIPELINE</div><div class="n">${moneyK(pipeline)}</div></div>
      </div>
      <div class="dash-cols">
        <div class="card">
          <div class="card-head"><h3>Today &amp; tomorrow</h3><span class="card-link" data-action="nav" data-tab="tasks">ALL TASKS →</span></div>
          ${soon.length ? soon.map(taskRowHTML).join("") : `<p class="section-sub" style="padding:18px 4px">Nothing due today or tomorrow. <b style="color:var(--violet);cursor:pointer" data-action="nav" data-tab="tasks">Add a task →</b></p>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card">
            <div class="card-head"><h3>Client pipeline</h3><span class="card-link" data-action="nav" data-tab="clients">VIEW →</span></div>
            ${pipePrev.length ? `<div style="display:flex;flex-direction:column;gap:11px">${pipePrev.map(c => `<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.name)}</div></div>${chip(c.status)}</div>`).join("")}</div>` : `<p class="section-sub">No clients yet. <b style="color:var(--violet);cursor:pointer" data-action="nav" data-tab="clients">Add one →</b></p>`}
          </div>
          <div class="card">
            <h3 style="margin-bottom:14px">Recent activity</h3>
            ${activity.length ? `<div style="display:flex;flex-direction:column;gap:13px">${activity.map(a => `<div style="display:flex;gap:11px"><div style="width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${a.color}"></div><div style="flex:1"><div style="font-size:13px;line-height:1.45">${esc(a.text)}</div><div class="mono" style="font-size:10px;color:var(--faint);margin-top:2px">${esc(a.time)}</div></div></div>`).join("")}</div>` : `<p class="section-sub">Activity from you and ${esc(partner())} will show up here.</p>`}
          </div>
        </div>
      </div>
    </div>`;
  }

  function recentActivity() {
    const items = [];
    state.clients.slice(0, 5).forEach(c => items.push({ ts: c.created_at, text: `${esc(c.owner || "Someone")} added ${esc(c.name)}`, color: personColor(c.owner) }));
    state.tasks.slice(0, 5).forEach(t => items.push({ ts: t.created_at, text: `New task: ${esc(t.title)}`, color: "#6d4aff" }));
    state.messages.slice(-3).forEach(m => items.push({ ts: m.created_at, text: `${esc(m.sender_name || "Someone")}: ${esc((m.text || "").slice(0, 40))}`, color: personColor(m.sender_name) }));
    return items.filter(i => i.ts).sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 4).map(i => ({ text: i.text, color: i.color, time: relTime(i.ts) }));
  }

  /* ---------- TASKS ---------- */
  function taskRowHTML(t, bordered) {
    const label = dueLabel(t.due);
    return `<div class="task ${t.done ? "done" : ""} ${bordered ? "bordered" : ""}" data-action="toggle-task" data-id="${t.id}" data-done="${t.done}">
      <div class="check ${t.done ? "done" : ""}">${t.done ? "✓" : ""}</div>
      <div style="flex:1;min-width:0">
        <div class="title">${esc(t.title)}</div>
        ${t.who ? `<div class="who">${esc(t.who)}</div>` : ""}
      </div>
      ${label ? `<span class="due ${t.due === todayISO() && !t.done ? "today" : ""}">${esc(label)}</span>` : ""}
      ${t.who ? avatar(t.who, 22) : ""}
      <span class="del" data-action="del-task" data-id="${t.id}" title="Delete">×</span>
    </div>`;
  }
  function renderTasks() {
    const filters = ["All", ...everyone(), "Done"];
    let list = state.tasks.slice();
    if (state.taskFilter === "Done") list = list.filter(t => t.done);
    else if (state.taskFilter !== "All") list = list.filter(t => t.who === state.taskFilter);
    const open = state.tasks.filter(t => !t.done).length, done = state.tasks.filter(t => t.done).length;
    return `
    <div class="page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div class="filters">${filters.map(f => `<span class="filter ${state.taskFilter === f ? "active" : ""}" data-action="tfilter" data-filter="${esc(f)}">${esc(f)}</span>`).join("")}</div>
        <div class="mono" style="font-size:11px;color:var(--faint)">${open} OPEN · ${done} DONE</div>
      </div>
      <div class="addbar">
        <input class="field" id="taskTitle" placeholder="Add a task…">
        <select class="field sm" id="taskWho"><option value="">Assignee</option>${everyone().map(n => `<option>${esc(n)}</option>`).join("")}</select>
        <input class="field sm" id="taskDue" type="date">
        <button class="btn btn-primary" data-action="add-task">Add</button>
      </div>
      <div class="table">
        ${list.length ? list.map(t => taskRowHTML(t, true)).join("") : emptyState(checkIcon(), "No tasks here", "Add your first task above — it'll sync to " + partner() + " instantly.")}
      </div>
    </div>`;
  }

  /* ---------- CHAT ---------- */
  function renderChat() {
    const msgs = state.messages;
    let body;
    if (!msgs.length) {
      body = `<div class="chat-empty">No messages yet.<br>Say hi to ${esc(partner())} 👋</div>`;
    } else {
      let lastDay = "";
      body = msgs.map(m => {
        const me = m.sender_id === state.user.id;
        const day = new Date(m.created_at).toDateString();
        let pill = "";
        if (day !== lastDay) { lastDay = day; pill = `<div class="day-pill">${new Date(m.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}</div>`; }
        return pill + `<div class="msg ${me ? "me" : "them"}"><div class="bubble">${esc(m.text)}</div><div class="meta">${esc(m.sender_name || "")} · ${timeOf(m.created_at)}</div></div>`;
      }).join("");
    }
    return `
    <div class="chat">
      <div class="chat-head">
        ${avatar(partner(), 38)}
        <div style="flex:1"><div class="who">${esc(partner())}</div><div class="online"><span class="dot"></span>WORKSPACE CHAT</div></div>
        <div class="mono" style="font-size:10px;letter-spacing:.1em;color:var(--faint)">${msgs.length} MSGS</div>
      </div>
      <div class="chat-body scroll">${body}</div>
      <div class="chat-foot">
        <div class="chat-input-row">
          <input class="field" id="chatInput" placeholder="Message ${esc(partner())}…">
          <button class="send" data-action="send">→</button>
        </div>
      </div>
    </div>`;
  }

  /* ---------- CLIENTS ---------- */
  function renderClients() {
    const filters = ["All", ...STATUSES];
    let list = state.clients.slice();
    if (state.clientFilter !== "All") list = list.filter(c => c.status === state.clientFilter);
    return `
    <div class="page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px">
        <div class="filters">${filters.map(f => `<span class="filter ${state.clientFilter === f ? "active" : ""}" data-action="cfilter" data-status="${esc(f)}">${esc(f)}</span>`).join("")}</div>
        <button class="btn btn-primary btn-sm" data-action="new-client" style="white-space:nowrap">+ New client</button>
      </div>
      ${state.clients.length === 0 ? `<div class="table">${emptyState(usersIcon(), "No clients yet", "Add your first client to start tracking projects and status.", `<button class="btn btn-primary btn-sm" data-action="new-client">+ New client</button>`)}</div>` : `
      <div class="table">
        <div class="thead"><span>CLIENT</span><span>PROJECT</span><span>VALUE</span><span>STATUS</span><span>NEXT STEP</span><span></span></div>
        ${list.map(c => {
          const col = STATUS_COLOR[c.status] || "#6b7280";
          return `<div class="trow">
            <div class="cname">${avatar(c.owner, 30)}${esc(c.name)}</div>
            <div class="cproj">${esc(c.project || "—")}</div>
            <div class="cval">${c.value ? money(c.value) : "—"}</div>
            <div><select class="status-select" data-action="client-status" data-id="${c.id}" style="color:${col};background:${hx(col, 0.11)}">${STATUSES.map(s => `<option value="${s}" ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
            <div><div class="cnext">${esc(c.next_step || "—")}</div>${c.owner ? `<div class="cowner">${esc(c.owner)}</div>` : ""}</div>
            <span class="del" data-action="del-client" data-id="${c.id}" title="Delete">×</span>
          </div>`;
        }).join("")}
      </div>`}
    </div>`;
  }

  /* ---------- CALENDAR ---------- */
  function weekDays() {
    const d = new Date(); const dow = (d.getDay() + 6) % 7; // Monday=0
    const monday = new Date(d); monday.setDate(d.getDate() - dow);
    const days = [];
    for (let i = 0; i < 7; i++) { const x = new Date(monday); x.setDate(monday.getDate() + i); const iso = x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); days.push({ iso, dow: x.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(), num: x.getDate(), today: iso === todayISO() }); }
    return days;
  }
  function renderCalendar() {
    const days = weekDays();
    const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return `
    <div class="page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap">
        <h3 class="grotesk" style="font-weight:600;font-size:17px;margin:0">${monthLabel} · This week</h3>
        <div style="display:flex;gap:16px" class="mono">${everyone().map(n => `<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)"><span style="width:8px;height:8px;border-radius:2px;background:${personColor(n)}"></span>${esc(n)}</span>`).join("")}</div>
      </div>
      <div class="addbar">
        <input class="field" id="evTitle" placeholder="New event…">
        <input class="field sm" id="evDate" type="date" value="${todayISO()}">
        <input class="field sm" id="evTime" type="time">
        <select class="field sm" id="evWho"><option value="">Who</option>${everyone().map(n => `<option>${esc(n)}</option>`).join("")}</select>
        <button class="btn btn-primary" data-action="add-event">Add</button>
      </div>
      <div class="cal-grid">
        ${days.map(d => {
          const evs = state.events.filter(e => e.date === d.iso).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
          return `<div class="cal-day ${d.today ? "today" : ""}">
            <div class="dh"><span class="dow">${d.dow}</span><span class="dnum">${d.num}</span></div>
            <div class="cal-events">${evs.map(e => { const c = personColor(e.who); return `<div class="cal-event" style="background:${hx(c, 0.11)};border-left:2px solid ${c};color:${c}">${e.time ? `<div class="et">${esc(fmtTime(e.time))}</div>` : ""}<div class="ev">${esc(e.title)}</div><span class="del" data-action="del-event" data-id="${e.id}" style="position:absolute;top:4px;right:6px;color:${c}">×</span></div>`; }).join("")}</div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }
  function fmtTime(t) { if (!t) return ""; const [h, m] = t.split(":"); const hr = parseInt(h, 10); return (hr % 12 || 12) + ":" + m + (hr < 12 ? "am" : "pm"); }

  /* ---------- REVENUE ---------- */
  function renderRevenue() {
    const booked = state.clients.filter(c => c.status === "Delivered").reduce((s, c) => s + Number(c.value || 0), 0);
    const pipeline = state.clients.filter(c => c.status !== "Delivered").reduce((s, c) => s + Number(c.value || 0), 0);
    const count = state.clients.length;
    const avg = count ? (booked + pipeline) / count : 0;
    const openDeals = state.clients.filter(c => c.status !== "Delivered").sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    // bars: total value per stage
    const byStage = STATUSES.map(s => ({ stage: s, val: state.clients.filter(c => c.status === s).reduce((a, c) => a + Number(c.value || 0), 0) }));
    const maxV = Math.max(1, ...byStage.map(b => b.val));
    return `
    <div class="page">
      <div class="grid-3" style="margin-bottom:16px">
        <div class="stat"><div class="l">BOOKED (DELIVERED)</div><div class="n green">${moneyK(booked)}</div><div class="mono" style="font-size:11px;color:var(--faint);margin-top:6px">${state.clients.filter(c => c.status === "Delivered").length} delivered</div></div>
        <div class="stat"><div class="l">OPEN PIPELINE</div><div class="n">${moneyK(pipeline)}</div><div class="mono" style="font-size:11px;color:var(--faint);margin-top:6px">${openDeals.length} active deals</div></div>
        <div class="stat"><div class="l">AVG PROJECT</div><div class="n">${moneyK(avg)}</div><div class="mono" style="font-size:11px;color:var(--faint);margin-top:6px">across ${count} client${count === 1 ? "" : "s"}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:16px">
        <div class="card">
          <h3 style="margin-bottom:20px">Value by stage</h3>
          ${count ? `<div class="bars">${byStage.map(b => `<div class="bar-col"><div class="v">${b.val ? moneyK(b.val) : ""}</div><div class="bar" style="height:${Math.round((b.val / maxV) * 130)}px;background:${hx(STATUS_COLOR[b.stage], 0.85)}"></div><div class="m">${b.stage.replace(" ", "<br>")}</div></div>`).join("")}</div>` : `<p class="section-sub">Add clients with deal values to see your revenue breakdown.</p>`}
        </div>
        <div class="card">
          <h3 style="margin-bottom:16px">Open deals</h3>
          ${openDeals.length ? openDeals.map(d => `<div class="deal"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">${esc(d.name)}</div>${chip(d.status)}</div><span class="mono" style="font-size:14px">${d.value ? money(d.value) : "—"}</span></div>`).join("") : `<p class="section-sub">No open deals yet.</p>`}
        </div>
      </div>
    </div>`;
  }

  /* ---------- NOTES ---------- */
  function renderNotes() {
    const notes = state.notes.slice().sort((a, b) => (b.pinned - a.pinned));
    return `
    <div class="page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
        <h3 class="grotesk" style="font-weight:600;font-size:17px;margin:0">Shared notes &amp; docs</h3>
        <button class="btn btn-primary btn-sm" data-action="new-note">+ New note</button>
      </div>
      ${notes.length ? `<div class="notes-grid">${notes.map(n => `
        <div class="note-card ${n.pinned ? "pinned" : ""}">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            ${n.tag ? `<span class="note-tag">${esc(n.tag)}</span>` : "<span></span>"}
            <span class="pin ${n.pinned ? "on" : ""}" data-action="toggle-pin" data-id="${n.id}" data-pinned="${n.pinned}" title="Pin">★</span>
          </div>
          <h4>${esc(n.title || "Untitled")}</h4>
          <p>${esc(n.body || "")}</p>
          <div class="note-foot">${avatar(n.author, 20)}<span class="note-meta">${esc(n.author || "")} · ${n.updated_at ? new Date(n.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span><span style="flex:1"></span><span class="del" data-action="del-note" data-id="${n.id}">×</span></div>
        </div>`).join("")}</div>`
        : emptyState(noteIcon(), "No notes yet", "Capture brand guidelines, checklists, pricing — anything you both need.", `<button class="btn btn-primary btn-sm" data-action="new-note">+ New note</button>`)}
    </div>`;
  }

  /* ---------- icons (simple) ---------- */
  function checkIcon() { return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6d4aff" stroke-width="2" stroke-linecap="round"><path d="M5 12l4 4 10-10"/></svg>`; }
  function usersIcon() { return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6d4aff" stroke-width="2"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke-linecap="round"/></svg>`; }
  function noteIcon() { return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6d4aff" stroke-width="2" stroke-linecap="round"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>`; }

  /* ============================================================
     MODALS
     ============================================================ */
  function renderModal() {
    const wrap = document.createElement("div");
    wrap.className = "modal-bg"; wrap.id = "modalBg";
    if (state.modal.type === "client") {
      wrap.innerHTML = `<div class="modal"><h3>New client</h3>
        <div class="row"><label class="label">Client name</label><input class="field" id="mName" placeholder="e.g. Atlas Coffee"></div>
        <div class="row"><label class="label">Project</label><input class="field" id="mProject" placeholder="e.g. Brand site + shop"></div>
        <div class="row2"><div><label class="label">Deal value ($)</label><input class="field" id="mValue" type="number" placeholder="6200"></div><div><label class="label">Owner</label><select class="field" id="mOwner"><option value="">—</option>${everyone().map(n => `<option ${n === myName() ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></div></div>
        <div class="row2"><div><label class="label">Status</label><select class="field" id="mStatus">${STATUSES.map(s => `<option>${s}</option>`).join("")}</select></div><div><label class="label">Next step</label><input class="field" id="mNext" placeholder="Intro call booked"></div></div>
        <div class="modal-actions"><button class="btn btn-sm" data-action="close-modal">Cancel</button><button class="btn btn-primary btn-sm" data-action="save-client">Add client</button></div></div>`;
    } else if (state.modal.type === "note") {
      wrap.innerHTML = `<div class="modal"><h3>New note</h3>
        <div class="row2"><div><label class="label">Title</label><input class="field" id="nTitle" placeholder="Note title"></div><div><label class="label">Tag</label><input class="field" id="nTag" placeholder="BRAND"></div></div>
        <div class="row"><label class="label">Body</label><textarea class="field" id="nBody" rows="5" placeholder="Write your note…"></textarea></div>
        <div class="modal-actions"><button class="btn btn-sm" data-action="close-modal">Cancel</button><button class="btn btn-primary btn-sm" data-action="save-note">Add note</button></div></div>`;
    }
    document.body.appendChild(wrap);
    wrap.addEventListener("click", e => { if (e.target === wrap) closeModal(); });
  }
  function closeModal() { state.modal = null; const b = document.getElementById("modalBg"); if (b) b.remove(); }

  /* ============================================================
     EVENT BINDING (delegation)
     ============================================================ */
  function bindShell() {
    root.onclick = onClick;
    root.onchange = onChange;
    const ci = document.getElementById("chatInput");
    if (ci) { ci.oninput = e => { state.chatDraft = e.target.value; }; ci.onkeydown = e => { if (e.key === "Enter") doSend(); }; }
    const tt = document.getElementById("taskTitle");
    if (tt) tt.onkeydown = e => { if (e.key === "Enter") doAddTask(); };
  }

  function onClick(e) {
    const el = e.target.closest("[data-action]"); if (!el) return;
    const a = el.dataset.action, id = el.dataset.id;
    switch (a) {
      case "nav": state.tab = el.dataset.tab; state.modal = null; render(); break;
      case "signout": signOut(); break;
      case "toggle-task": if (!e.target.closest('[data-action="del-task"]')) toggleTask(id, el.dataset.done === "true"); break;
      case "del-task": e.stopPropagation(); delTask(id); break;
      case "add-task": doAddTask(); break;
      case "tfilter": state.taskFilter = el.dataset.filter; render(); break;
      case "cfilter": state.clientFilter = el.dataset.status; render(); break;
      case "send": doSend(); break;
      case "new-client": state.modal = { type: "client" }; render(); break;
      case "save-client": doSaveClient(); break;
      case "del-client": delClient(id); break;
      case "new-note": state.modal = { type: "note" }; render(); break;
      case "save-note": doSaveNote(); break;
      case "del-note": delNote(id); break;
      case "toggle-pin": togglePin(id, el.dataset.pinned === "true"); break;
      case "add-event": doAddEvent(); break;
      case "del-event": e.stopPropagation(); delEvent(id); break;
      case "close-modal": closeModal(); break;
    }
  }
  function onChange(e) {
    const el = e.target.closest("[data-action]"); if (!el) return;
    if (el.dataset.action === "client-status") setClientStatus(el.dataset.id, el.value);
  }

  function doAddTask() {
    const t = (document.getElementById("taskTitle") || {}).value || "";
    if (!t.trim()) return;
    const who = (document.getElementById("taskWho") || {}).value || "";
    const due = (document.getElementById("taskDue") || {}).value || "";
    addTask(t.trim(), who, due);
  }
  function doSend() {
    const i = document.getElementById("chatInput"); const t = (i ? i.value : "").trim();
    if (!t) return; state.chatDraft = ""; if (i) i.value = ""; sendMsg(t);
  }
  function doSaveClient() {
    const name = (document.getElementById("mName") || {}).value || "";
    if (!name.trim()) { document.getElementById("mName").focus(); return; }
    addClient({
      name: name.trim(),
      project: (document.getElementById("mProject") || {}).value || null,
      value: Number((document.getElementById("mValue") || {}).value || 0),
      status: (document.getElementById("mStatus") || {}).value || "Lead",
      next_step: (document.getElementById("mNext") || {}).value || null,
      owner: (document.getElementById("mOwner") || {}).value || null
    });
    closeModal();
  }
  function doSaveNote() {
    const title = (document.getElementById("nTitle") || {}).value || "";
    const body = (document.getElementById("nBody") || {}).value || "";
    if (!title.trim() && !body.trim()) { closeModal(); return; }
    addNote({ title: title.trim(), body: body.trim(), tag: ((document.getElementById("nTag") || {}).value || "").toUpperCase(), author: myName(), pinned: false, updated_at: new Date().toISOString() });
    closeModal();
  }
  function doAddEvent() {
    const title = (document.getElementById("evTitle") || {}).value || "";
    if (!title.trim()) return;
    addEvent({ title: title.trim(), date: (document.getElementById("evDate") || {}).value || todayISO(), time: (document.getElementById("evTime") || {}).value || null, who: (document.getElementById("evWho") || {}).value || null });
  }

  init();
})();
