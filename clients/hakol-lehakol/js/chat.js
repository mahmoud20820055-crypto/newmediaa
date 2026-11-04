/* =========================================================
   הכל להכל – Visitor messaging (shared by the site widget and my.html)
   ========================================================= */
(function () {
  "use strict";
  var S = window.SITE;
  var API = (S.apiBase || "api/") + "visitor.php";
  var KEY = "hl_convs";

  function api(action, data) {
    return fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ action: action }, data || {}))
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "server" }; }).then(function (j) {
        if (!r.ok || !j.ok) { var e = new Error(j.error || "server"); e.code = j.error; throw e; }
        return j;
      });
    });
  }

  /* ---- local list of this visitor's conversations ---- */
  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30))); } catch (e) {} }
  function remember(conv) {
    var list = load().filter(function (c) { return c.token !== conv.token; });
    list.unshift({ token: conv.token, id: conv.id });
    save(list);
  }
  function forget(token) { save(load().filter(function (c) { return c.token !== token; })); }

  /* ---- rendering helpers ---- */
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function linkify(text) {
    return esc(text).replace(/https?:\/\/[^\s<]+/g, function (u) {
      var label = /wa\.me/.test(u) ? "💬 לחצו כאן לוואטסאפ" : u;
      return '<a href="' + u + '" target="_blank" rel="noopener nofollow">' + label + "</a>";
    }).replace(/\n/g, "<br>");
  }
  var dtf = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  var tf = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" });
  function fmt(ts) {
    var d = new Date(ts * 1000);
    return d.toDateString() === new Date().toDateString() ? tf.format(d) : dtf.format(d);
  }
  var LABEL = { visitor: "אני", admin: S.name, auto: S.name + " · הודעה אוטומטית" };
  function msgHTML(m, viewer) {
    var mine = viewer === "admin" ? m.sender !== "visitor" : m.sender === "visitor";
    var label = viewer === "admin"
      ? ({ visitor: "לקוח", admin: "אני", auto: "הודעה אוטומטית" })[m.sender]
      : LABEL[m.sender];
    return '<div class="msg ' + (mine ? "msg--mine" : "msg--them") + (m.sender === "auto" ? " msg--auto" : "") + '" data-id="' + m.id + '">' +
      '<div class="msg__meta">' + esc(label || "") + " · " + fmt(m.created_at) + "</div>" +
      '<div class="msg__body">' + linkify(m.body) + "</div></div>";
  }
  var STATUS = { open: "פתוחה", closed: "טופלה" };

  /* ---- live thread view ---- */
  function Thread(box, token, opts) {
    opts = opts || {};
    var lastId = 0, timer = null, busy = false, stopped = false;
    function append(msgs) {
      if (!msgs.length) return;
      var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      var html = "";
      msgs.forEach(function (m) {
        if (m.id <= lastId) return;
        lastId = m.id; html += msgHTML(m, "visitor");
      });
      if (!html) return;
      box.insertAdjacentHTML("beforeend", html);
      if (atBottom || opts.forceScroll) box.scrollTop = box.scrollHeight;
      if (opts.onNew) opts.onNew(msgs);
    }
    function poll() {
      if (busy || stopped) return;
      busy = true;
      return api("thread", { token: token, since: lastId }).then(function (j) {
        append(j.messages);
        if (opts.onConv) opts.onConv(j.conv);
      }).catch(function (e) {
        if (e.code === "not_found") { forget(token); if (opts.onGone) opts.onGone(); stop(); }
      }).finally(function () { busy = false; });
    }
    function start(ms) { stop(); stopped = false; timer = setInterval(poll, ms || 6000); return poll(); }
    function stop() { stopped = true; if (timer) clearInterval(timer); timer = null; }
    function send(text) {
      return api("send", { token: token, message: text }).then(function (j) { append([j.message]); box.scrollTop = box.scrollHeight; });
    }
    box.innerHTML = "";
    return { start: start, stop: stop, send: send, poll: poll, append: append };
  }

  function errorText(e) {
    return ({
      rate_limited: "יותר מדי הודעות בזמן קצר. נסו שוב בעוד דקה.",
      bad_phone: "מספר הטלפון לא תקין.",
      missing_name: "נא למלא שם.", missing_phone: "נא למלא טלפון.", missing_message: "נא לכתוב הודעה."
    })[e && e.code] || "אירעה שגיאה בשליחה. נסו שוב או פנו אלינו בוואטסאפ.";
  }

  window.HLChat = {
    api: api, list: load, remember: remember, forget: forget,
    Thread: Thread, msgHTML: msgHTML, fmt: fmt, esc: esc, STATUS: STATUS, errorText: errorText,
    start: function (data) { return api("start", data).then(function (j) { if (j.conv) remember(j.conv); return j; }); }
  };
})();
