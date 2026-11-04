(function () {
  "use strict";
  var S = window.SITE, C = window.HLChat;
  var API = "../" + (S.apiBase || "api/") + "admin.php";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = C.esc, csrf = null;

  function api(action, data) {
    return fetch(API, {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF": csrf || "" },
      body: JSON.stringify(Object.assign({ action: action }, data || {}))
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "server" }; }).then(function (j) {
        if (r.status === 401 && action !== "login") { showAuth(false); }
        if (!r.ok || !j.ok) { var e = new Error(j.error || "server"); e.code = j.error; throw e; }
        return j;
      });
    });
  }
  var ERR = {
    bad_password: "סיסמה שגויה.", bad_setup_key: "מפתח ההגדרה שגוי (או שלא שונה בקובץ config.php).",
    weak_password: "הסיסמה צריכה להכיל לפחות 8 תווים.", rate_limited: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.",
    csrf: "פג תוקף ההתחברות. רעננו את העמוד.", server: "שגיאת שרת. בדקו שהקבצים הועלו לשרת עם PHP."
  };
  function errText(e) { return ERR[e && e.code] || "אירעה שגיאה (" + ((e && e.code) || "?") + ")"; }

  var toastT;
  function toast(t) {
    var el = $("#toast"); el.textContent = t; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 2600);
  }

  /* ================= Auth ================= */
  var setupMode = false;
  function showAuth(setup) {
    setupMode = setup;
    stopPolling();
    $("#app").hidden = true; $("#auth").hidden = false;
    $$("[data-setup]").forEach(function (e) { e.hidden = !setup; });
    $("#authTitle").textContent = setup ? "הגדרה ראשונית" : "כניסה ללוח הניהול";
    $("#authHint").textContent = setup
      ? "בחרו סיסמה למנהל. מפתח ההגדרה נמצא בקובץ api/config.php (setup_key)."
      : "הזינו את סיסמת המנהל.";
    $("#authBtn").textContent = setup ? "יצירת סיסמה וכניסה" : "כניסה";
    $("#authForm").password.autocomplete = setup ? "new-password" : "current-password";
    setTimeout(function () { (setup ? $("#authForm").setup_key : $("#authForm").password).focus(); }, 0);
  }
  $("#authForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, err = $("#authErr"); err.textContent = "";
    if (setupMode && f.password.value !== f.password2.value) { err.textContent = "הסיסמאות אינן תואמות."; return; }
    var p = setupMode
      ? api("setup", { setup_key: f.setup_key.value, password: f.password.value })
      : api("login", { password: f.password.value });
    $("#authBtn").disabled = true;
    p.then(function (j) { csrf = j.csrf; f.reset(); enterApp(); })
      .catch(function (x) { err.textContent = errText(x); })
      .finally(function () { $("#authBtn").disabled = false; });
  });
  $("#logout").addEventListener("click", function () {
    api("logout").finally(function () { csrf = null; showAuth(false); });
  });

  /* ================= Views ================= */
  var view = "dash";
  function go(v) {
    view = v;
    $$(".view").forEach(function (s) { s.hidden = s.id !== "view-" + v; });
    $$(".side__nav [data-view]").forEach(function (b) { b.classList.toggle("is-active", b.dataset.view === v); });
    if (v === "dash") loadStats();
    if (v === "inbox") loadConvs();
    if (v === "settings") loadSettings();
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-view]"); if (b) go(b.dataset.view);
  });

  function enterApp() {
    $("#auth").hidden = true; $("#app").hidden = false;
    var h = new Date().getHours();
    $("#hello").textContent = (h < 12 ? "בוקר טוב" : h < 18 ? "צהריים טובים" : "ערב טוב") + " 👋 הנה מה שקורה באתר.";
    go("dash");
    startPolling();
  }

  /* ================= Dashboard ================= */
  var DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
  function loadStats() {
    return api("stats").then(function (s) {
      $("#kpis").innerHTML = [
        ["סה״כ פניות", s.total, ""], ["פניות היום", s.today, ""],
        ["לא נקראו", s.unread, s.unread ? "kpi--hot" : ""], ["פתוחות", s.open, ""]
      ].map(function (k) {
        return '<div class="kpi ' + k[2] + '"><span>' + k[0] + "</span><b>" + k[1] + "</b></div>";
      }).join("");
      var max = Math.max.apply(null, s.days.map(function (d) { return d.n; }).concat([1]));
      $("#bars").innerHTML = s.days.map(function (d) {
        var dt = new Date(d.day + "T12:00:00");
        return '<div class="bar" title="' + d.n + ' פניות"><i>' + (d.n || "") + '</i><span style="height:' + Math.max(3, d.n / max * 100) + '%"></span><em>' + DAYS[dt.getDay()] + "</em></div>";
      }).join("");
      var cmax = Math.max.apply(null, s.by_category.map(function (c) { return c.n; }).concat([1]));
      $("#byCat").innerHTML = s.by_category.length ? s.by_category.map(function (c) {
        return '<div class="hbar"><span>' + esc(c.category) + '</span><div><i style="width:' + (c.n / cmax * 100) + '%"></i></div><b>' + c.n + "</b></div>";
      }).join("") : '<p class="muted">עדיין אין נתונים.</p>';
      setUnread(s.unread);
    }).then(function () {
      return api("conversations", {}).then(function (j) {
        $("#recent").innerHTML = j.conversations.length
          ? j.conversations.slice(0, 6).map(convRow).join("")
          : '<p class="muted">עדיין אין פניות. כשלקוח ישלח הודעה מהאתר, היא תופיע כאן.</p>';
      });
    }).catch(function () {});
  }

  function setUnread(n) {
    var b = $("#navBadge"); b.hidden = !n; b.textContent = n;
    document.title = (n ? "(" + n + ") " : "") + "לוח ניהול | הכל להכל";
  }

  /* ================= Inbox ================= */
  var filter = "", q = "", list = [], activeId = null, lastId = 0, threadBusy = false, qT;

  function convRow(c) {
    var initials = esc((c.name || "?").trim().charAt(0));
    return '<button class="crow' + (c.id === activeId ? " is-active" : "") + (c.unread_admin ? " is-unread" : "") + '" data-id="' + c.id + '">' +
      '<span class="avatar">' + initials + "</span>" +
      '<span class="crow__main"><span class="crow__top"><b>' + esc(c.name) + "</b><small>" + C.fmt(c.updated_at) + "</small></span>" +
      '<span class="crow__sub">' + (c.category ? '<em>' + esc(c.category) + "</em>" : "") + esc(c.last_msg) + "</span></span>" +
      (c.unread_admin ? '<i class="crow__dot">' + c.unread_admin + "</i>" : '<span class="pill pill--' + c.status + '">' + C.STATUS[c.status] + "</span>") +
      "</button>";
  }
  function loadConvs() {
    return api("conversations", { status: filter, q: q }).then(function (j) {
      list = j.conversations;
      $("#convs").innerHTML = list.length ? list.map(convRow).join("") : '<p class="muted pad">אין פניות להצגה.</p>';
      var total = list.reduce(function (a, c) { return a + (c.unread_admin ? 1 : 0); }, 0);
      if (!filter && !q) setUnread(total);
    }).catch(function () {});
  }
  $("#filters").addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]"); if (!b) return;
    filter = b.dataset.f;
    $$("#filters button").forEach(function (x) { x.classList.toggle("is-active", x === b); });
    loadConvs();
  });
  $("#q").addEventListener("input", function (e) {
    clearTimeout(qT); qT = setTimeout(function () { q = e.target.value.trim(); loadConvs(); }, 250);
  });
  document.addEventListener("click", function (e) {
    var r = e.target.closest(".crow[data-id]"); if (!r) return;
    if (view !== "inbox") go("inbox");
    openConv(+r.dataset.id);
  });

  var current = null;
  function openConv(id) {
    activeId = id; lastId = 0; current = null;
    $("#pick").hidden = true; $("#conv").hidden = false;
    $("#cMsgs").innerHTML = ""; $("#cErr").textContent = "";
    $("#inbox").classList.add("show-thread");
    $$(".crow").forEach(function (r) { r.classList.toggle("is-active", +r.dataset.id === id); });
    pollThread(true).then(function () { $("#cSend").message.focus(); loadConvs(); });
  }
  function fillHead(c) {
    current = c;
    $("#cName").textContent = c.name;
    $("#cMeta").textContent = "פנייה #" + c.id + " · " + C.fmt(c.created_at);
    var digits = c.phone.replace(/\D/g, ""), intl = digits.charAt(0) === "0" ? "972" + digits.slice(1) : digits;
    $("#cWa").href = "https://wa.me/" + intl + "?text=" + encodeURIComponent("שלום " + c.name + ", כאן " + S.name + " בנוגע לפנייה שלך באתר.");
    $("#cTel").href = "tel:" + c.phone;
    $("#cInfo").innerHTML =
      '<span><b>טלפון:</b> <a href="tel:' + esc(c.phone) + '" dir="ltr">' + esc(c.phone) + "</a></span>" +
      (c.business ? "<span><b>עסק:</b> " + esc(c.business) + "</span>" : "") +
      (c.category ? "<span><b>תחום:</b> " + esc(c.category) + "</span>" : "");
    $("#cStatus").textContent = c.status === "open" ? "✓ סימון כטופלה" : "פתיחה מחדש";
  }
  function pollThread(scroll) {
    if (!activeId || threadBusy) return Promise.resolve();
    threadBusy = true;
    var id = activeId;
    return api("thread", { id: id, since: lastId }).then(function (j) {
      if (id !== activeId) return;
      fillHead(j.conv);
      var box = $("#cMsgs");
      var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      var html = "";
      j.messages.forEach(function (m) { if (m.id > lastId) { lastId = m.id; html += C.msgHTML(m, "admin"); } });
      if (html) {
        box.insertAdjacentHTML("beforeend", html);
        if (scroll || atBottom) box.scrollTop = box.scrollHeight;
      }
    }).catch(function (e) {
      if (e.code === "not_found") { activeId = null; $("#conv").hidden = true; $("#pick").hidden = false; }
    }).finally(function () { threadBusy = false; });
  }
  $("#convBack").addEventListener("click", function () { $("#inbox").classList.remove("show-thread"); });

  var form = $("#cSend"), ta = form.message;
  ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = ta.value.trim(); if (!t || !activeId) return;
    ta.disabled = true; $("#cErr").textContent = "";
    api("reply", { id: activeId, message: t }).then(function () {
      ta.value = ""; return pollThread(true);
    }).then(loadConvs).catch(function (x) { $("#cErr").textContent = errText(x); })
      .finally(function () { ta.disabled = false; ta.focus(); });
  });

  var QUICK = [
    "שלום, תודה על הפנייה! נשמח לעזור 🙂",
    "המוצר זמין במלאי. מתי נוח לכם להגיע?",
    "אשלח לכם הצעת מחיר בהקדם.",
    "אפשר לקבל כמה פרטים נוספים (כמות / מידות)?",
    "נשמח לראות אתכם בחנות בברטעה!"
  ];
  $("#quick").innerHTML = QUICK.map(function (t, i) { return '<button type="button" data-q="' + i + '">' + esc(t) + "</button>"; }).join("");
  $("#quick").addEventListener("click", function (e) {
    var b = e.target.closest("[data-q]"); if (!b) return;
    ta.value = (ta.value ? ta.value + " " : "") + QUICK[+b.dataset.q]; ta.focus();
  });

  $("#cStatus").addEventListener("click", function () {
    if (!current) return;
    var s = current.status === "open" ? "closed" : "open";
    api("status", { id: current.id, status: s }).then(function () {
      current.status = s; fillHead(current); loadConvs(); toast(s === "closed" ? "הפנייה סומנה כטופלה" : "הפנייה נפתחה מחדש");
    }).catch(function (x) { toast(errText(x)); });
  });
  $("#cDel").addEventListener("click", function () {
    if (!current || !confirm("למחוק את הפנייה של " + current.name + "? לא ניתן לשחזר.")) return;
    api("delete", { id: current.id }).then(function () {
      activeId = null; current = null; $("#conv").hidden = true; $("#pick").hidden = false;
      $("#inbox").classList.remove("show-thread"); loadConvs(); toast("הפנייה נמחקה");
    }).catch(function (x) { toast(errText(x)); });
  });

  /* ================= Settings ================= */
  var arForm = $("#arForm");
  function previewAR() {
    var t = arForm.auto_reply.value
      .replace(/\{name\}/g, "ישראל").replace(/\{site\}/g, S.name)
      .replace(/\{whatsapp\}/g, "https://wa.me/" + (arForm.dataset.wa || S.whatsapp));
    $("#arPreview").innerHTML = C.msgHTML({ id: 0, sender: "auto", body: t, created_at: Date.now() / 1000 }, "visitor");
  }
  function loadSettings() {
    api("settings").then(function (j) {
      arForm.auto_reply.value = j.auto_reply; arForm.dataset.wa = j.whatsapp; previewAR();
    }).catch(function () {});
  }
  arForm.auto_reply.addEventListener("input", previewAR);
  arForm.addEventListener("submit", function (e) {
    e.preventDefault();
    api("save_settings", { auto_reply: arForm.auto_reply.value }).then(function () { toast("ההודעה האוטומטית נשמרה ✓"); })
      .catch(function (x) { toast(errText(x)); });
  });
  $("#pwForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target;
    if (f.new.value.length < 8) { toast(ERR.weak_password); return; }
    api("password", { current: f.current.value, new: f.new.value }).then(function () { f.reset(); toast("הסיסמה עודכנה ✓"); })
      .catch(function (x) { toast(errText(x)); });
  });

  /* ================= Polling ================= */
  var pollT = null;
  function tick() {
    if (document.hidden) return;
    if (view === "inbox") { loadConvs(); pollThread(false); }
    else if (view === "dash") loadStats();
    else api("stats").then(function (s) { setUnread(s.unread); }).catch(function () {});
  }
  function startPolling() { stopPolling(); pollT = setInterval(tick, 7000); }
  function stopPolling() { if (pollT) clearInterval(pollT); pollT = null; }

  /* ================= Boot ================= */
  api("state").then(function (s) {
    if (s.logged_in) { csrf = s.csrf; enterApp(); }
    else showAuth(s.needs_setup);
  }).catch(function () {
    showAuth(false);
    $("#authErr").textContent = ERR.server;
  });
})();
