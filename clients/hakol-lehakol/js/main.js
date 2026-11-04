(function () {
  "use strict";
  var S = window.SITE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Category icons (stroke SVG) ---------- */
  var ICONS = {
    chair: '<path d="M7 3h10v8H7zM5 11h14v3H5zM8 14v7M16 14v7M12 14v4"/>',
    shelves: '<path d="M4 2v20M20 2v20M4 7h16M4 12h16M4 17h16"/><path d="M7 4.5h3M13 9.5h4M7 14.5h5"/>',
    machine: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M4 9h16M8 5.5h1M8 13v5"/>',
    chef: '<path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 9.18 0A4 4 0 0 1 18 13.87V21H6Z"/><path d="M6 17h12"/>',
    store: '<path d="M3 9l1.5-5h15L21 9M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/><path d="M5 13v8h14v-8M10 21v-5h4v5"/>',
    cup: '<path d="M6 8h12l-1.5 13h-9ZM5 8h14M12 8l2-6h3"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6"/>',
    knife: '<path d="M14 3 3 14l3 3 4-1 1-4 7-7a2.8 2.8 0 0 0-4-2ZM15 14l6 6M18 17l-2 2"/>',
    bottle: '<path d="M10 2h4v3l2 3v13a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8l2-3Z"/><path d="M8 12h8M8 17h8"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="M3 8l9 5 9-5M12 13v8"/>'
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.box) + "</svg>";
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function waLink(text) {
    return "https://wa.me/" + S.whatsapp + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  /* ---------- Global contact bindings ---------- */
  $$("[data-wa]").forEach(function (a) { a.href = waLink("שלום, הגעתי מהאתר של " + S.name + " ואשמח לקבל פרטים."); });
  $$("[data-tel]").forEach(function (a) { a.href = "tel:" + S.phoneTel; a.textContent = S.phoneDisplay; a.dir = "ltr"; });
  $$("[data-mail]").forEach(function (a) { a.href = "mailto:" + S.email; a.textContent = S.email; });
  $$("[data-address]").forEach(function (e) { e.textContent = S.address; });
  $$("[data-tagline]").forEach(function (e) { e.textContent = S.tagline; });
  $("#year").textContent = new Date().getFullYear();

  $("#hours").innerHTML = S.hours.map(function (h) {
    return "<li><span>" + esc(h[0]) + "</span><b>" + esc(h[1]) + "</b></li>";
  }).join("");

  /* ---------- Categories ---------- */
  $("#cats").innerHTML = S.categories.map(function (c, i) {
    return '<button class="cat" data-cat="' + i + '" style="--d:' + (i * 40) + 'ms">' +
      '<span class="cat__icon">' + icon(c.icon) + "</span>" +
      '<span class="cat__title">' + esc(c.title) + "</span>" +
      '<span class="cat__desc">' + esc(c.desc) + "</span>" +
      '<span class="cat__more">' + c.sub.length + " תתי קטגוריות ←</span>" +
      "</button>";
  }).join("");

  $("#heroTiles").innerHTML = S.categories.slice(0, 9).map(function (c, i) {
    return '<div class="tile" style="--d:' + (i * 90) + 'ms">' + icon(c.icon) + "<span>" + esc(c.title) + "</span></div>";
  }).join("");

  $("#footerCats").innerHTML = S.categories.map(function (c, i) {
    return '<a href="#categories" data-cat="' + i + '">' + esc(c.title) + "</a>";
  }).join("");

  var sel = $("#catSelect");
  S.categories.forEach(function (c) {
    var o = document.createElement("option");
    o.value = o.textContent = c.title;
    sel.appendChild(o);
  });

  /* ---------- Modal ---------- */
  var modal = $("#modal"), lastFocus = null, current = null;
  function openCat(i) {
    var c = S.categories[i]; if (!c) return;
    current = c; lastFocus = document.activeElement;
    $("#modalIcon").innerHTML = icon(c.icon);
    $("#modalTitle").textContent = c.title;
    $("#modalDesc").textContent = c.desc;
    $("#modalSubs").innerHTML = c.sub.map(function (s) {
      return '<li><a target="_blank" rel="noopener" href="' + waLink("שלום, אשמח לקבל פרטים והצעת מחיר על: " + c.title + " – " + s) + '">' + esc(s) + "</a></li>";
    }).join("");
    $("#modalWa").href = waLink("שלום, אשמח לקבל פרטים על " + c.title + ".");
    modal.hidden = false;
    document.body.classList.add("no-scroll");
    $(".modal__x").focus();
  }
  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-cat]");
    if (t && t.tagName === "BUTTON") { openCat(+t.dataset.cat); return; }
    if (t) { e.preventDefault(); openCat(+t.dataset.cat); return; }
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  $("#modalForm").addEventListener("click", function () {
    if (current) sel.value = current.title;
    closeModal();
  });

  /* ---------- Mobile nav ---------- */
  var burger = $("#burger"), nav = $("#nav");
  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
  });
  $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", false); }); });

  /* ---------- Header shadow ---------- */
  var header = $(".header");
  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 10); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Contact form ---------- */
  var form = $("#contactForm"), status = $("#formStatus");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.className = "form__status";
    if (!form.checkValidity()) {
      status.textContent = "נא למלא שם, טלפון תקין והודעה.";
      status.classList.add("is-err");
      var bad = form.querySelector(":invalid"); if (bad) bad.focus();
      return;
    }
    if (form._gotcha.value) return; // spam bot
    var d = {
      name: form.name.value.trim(), phone: form.phone.value.trim(),
      business: form.business.value.trim(), category: form.category.value, message: form.message.value.trim()
    };
    var text = "פנייה חדשה מהאתר – " + S.name +
      "\nשם: " + d.name + "\nטלפון: " + d.phone +
      (d.business ? "\nעסק: " + d.business : "") +
      (d.category ? "\nתחום: " + d.category : "") +
      "\nהודעה: " + d.message;

    if (!S.formEndpoint) {
      window.open(waLink(text), "_blank", "noopener");
      status.textContent = "נפתח וואטסאפ עם פרטי הפנייה – רק ללחוץ שליחה.";
      status.classList.add("is-ok");
      return;
    }
    var btn = form.querySelector("[type=submit]");
    btn.disabled = true; status.textContent = "שולח…";
    fetch(S.formEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(Object.assign({ _subject: "פנייה חדשה מהאתר – " + S.name }, d))
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      form.reset();
      status.textContent = "תודה! הפנייה התקבלה ונחזור אליכם בהקדם.";
      status.classList.add("is-ok");
    }).catch(function () {
      status.innerHTML = 'אירעה שגיאה בשליחה. אפשר לשלוח לנו <a target="_blank" rel="noopener" href="' + waLink(text) + '">בוואטסאפ</a>.';
      status.classList.add("is-err");
    }).finally(function () { btn.disabled = false; });
  });
})();
