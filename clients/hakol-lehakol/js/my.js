(function () {
  "use strict";
  var S = window.SITE, C = window.HLChat;
  var $ = function (s) { return document.querySelector(s); };

  document.querySelectorAll("[data-wa]").forEach(function (a) {
    a.href = "https://wa.me/" + S.whatsapp + "?text=" + encodeURIComponent("שלום, אשמח לקבל פרטים.");
  });

  var listEl = $("#myList"), grid = $("#myGrid"), convs = [], active = null, thread = null;

  function renderStats() {
    var open = convs.filter(function (c) { return c.status === "open"; }).length;
    var unread = convs.reduce(function (a, c) { return a + c.unread; }, 0);
    $("#myStats").innerHTML =
      '<div class="stat"><b>' + convs.length + "</b><span>סה״כ פניות</span></div>" +
      '<div class="stat"><b>' + open + "</b><span>פתוחות</span></div>" +
      '<div class="stat stat--hl"><b>' + unread + "</b><span>הודעות חדשות</span></div>";
  }

  function renderList() {
    listEl.innerHTML = convs.map(function (c) {
      return '<button class="item' + (active === c.token ? " is-active" : "") + '" data-token="' + c.token + '">' +
        '<span class="item__top"><b>פנייה #' + c.id + "</b>" +
        '<span class="pill pill--' + c.status + '">' + C.STATUS[c.status] + "</span></span>" +
        (c.category ? '<span class="item__cat">' + C.esc(c.category) + "</span>" : "") +
        '<span class="item__last">' + C.esc(c.last_msg) + "</span>" +
        '<span class="item__time">' + C.fmt(c.updated_at) + (c.unread ? ' <i class="dot">' + c.unread + " חדשות</i>" : "") + "</span>" +
        "</button>";
    }).join("");
  }

  function refresh() {
    var tokens = C.list().map(function (c) { return c.token; });
    if (!tokens.length) { show(false); return Promise.resolve(); }
    return C.api("list", { tokens: tokens }).then(function (j) {
      // drop tokens the server no longer knows about
      var known = j.conversations.map(function (c) { return c.token; });
      tokens.forEach(function (t) { if (known.indexOf(t) < 0) C.forget(t); });
      convs = j.conversations;
      if (active) convs.forEach(function (c) { if (c.token === active) c.unread = 0; });
      show(convs.length > 0);
      renderStats(); renderList();
    }).catch(function () {
      $("#myStats").innerHTML = '<p class="chat__err">לא ניתן לטעון את הפניות כרגע. נסו לרענן את העמוד.</p>';
    });
  }

  function show(has) {
    grid.hidden = !has; $("#myStats").hidden = !has; $("#myNone").hidden = has;
  }

  function open(token) {
    var c = convs.find(function (x) { return x.token === token; }); if (!c) return;
    active = token;
    if (thread) thread.stop();
    $("#myPick").hidden = true; $("#myConv").hidden = false;
    grid.classList.add("show-thread");
    $("#convTitle").textContent = "פנייה #" + c.id + (c.category ? " · " + c.category : "");
    $("#convMeta").textContent = "נפתחה " + C.fmt(c.created_at);
    setStatus(c.status);
    thread = C.Thread($("#myMsgs"), token, {
      forceScroll: true,
      onConv: function (conv) { setStatus(conv.status); },
      onGone: refresh
    });
    thread.start(6000);
    c.unread = 0; renderList(); renderStats();
    try { history.replaceState(null, "", "#c" + c.id); } catch (e) {}
  }
  function setStatus(s) {
    var el = $("#convStatus"); el.textContent = C.STATUS[s]; el.className = "pill pill--" + s;
  }

  listEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-token]"); if (b) open(b.dataset.token);
  });
  $("#backList").addEventListener("click", function () { grid.classList.remove("show-thread"); });

  var form = $("#mySend"), ta = form.message;
  ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var t = ta.value.trim(); if (!t || !thread) return;
    $("#myErr").textContent = ""; ta.disabled = true;
    thread.send(t).then(function () { ta.value = ""; refresh(); })
      .catch(function (x) { $("#myErr").textContent = C.errorText(x); })
      .finally(function () { ta.disabled = false; ta.focus(); });
  });

  refresh().then(function () {
    var m = /^#c(\d+)$/.exec(location.hash);
    var pick = m ? convs.find(function (c) { return String(c.id) === m[1]; }) : null;
    if (pick) open(pick.token);
    else if (convs.length && window.innerWidth > 760) open(convs[0].token);
  });
  setInterval(refresh, 20000);
})();
