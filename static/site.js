/* =========================================================
   site.js — animasi interaktif global (semua halaman)
   Dimuat di base.html, sebelum {% block scripts %}
   ========================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  /* =========================================================
     UTILITAS
     ========================================================= */
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /* =========================================================
     CONFETTI GLOBAL (dipakai dashboard & halaman lain)
     ========================================================= */
  function burstConfetti(originEl, opts) {
    if (reduceMotion || !originEl) return;

    opts = opts || {};
    var rect = originEl.getBoundingClientRect();
    var originX = rect.left + rect.width / 2;
    var originY = rect.top + rect.height / 2;
    var emojis = opts.emojis || opts.icons || ["🍃", "♻️", "🌿", "⭐", "✨", "🌱"];
    var n = opts.count || 12;

    for (var i = 0; i < n; i++) {
      var leaf = document.createElement("span");
      leaf.className = "eco-confetti-leaf";
      leaf.textContent = emojis[Math.floor(Math.random() * emojis.length)];

      var angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.7;
      var distance = 50 + Math.random() * 90;
      var dx = Math.cos(angle) * distance;
      var dy = Math.sin(angle) * distance - 40 - Math.random() * 40;
      var rot = ((Math.random() - 0.5) * 360).toFixed(0) + "deg";

      leaf.style.left = originX + "px";
      leaf.style.top = originY + "px";
      leaf.style.setProperty("--dx", dx.toFixed(1) + "px");
      leaf.style.setProperty("--dy", dy.toFixed(1) + "px");
      leaf.style.setProperty("--rot", rot);
      leaf.style.fontSize = (13 + Math.random() * 10).toFixed(0) + "px";

      document.body.appendChild(leaf);

      (function (el) {
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 1600);
      })(leaf);
    }
  }

  // Expose global (dashboard.js bisa pakai yang sama)
  window.EcoConfetti = { burst: burstConfetti };

  /* =========================================================
     RIPPLE — event delegation (efisien untuk tombol dinamis)
     ========================================================= */
  function initRipple() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".btn");
      if (!btn || btn.disabled || btn.classList.contains("is-loading")) return;
      if (reduceMotion) return;

      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 2.1;
      var x = e.clientX - rect.left - size / 2;
      var y = e.clientY - rect.top - size / 2;

      var ripple = document.createElement("span");
      ripple.className = "eco-ripple";
      ripple.style.width = size + "px";
      ripple.style.height = size + "px";
      ripple.style.left = x + "px";
      ripple.style.top = y + "px";

      btn.appendChild(ripple);
      setTimeout(function () {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      }, 650);
    });
  }

  /* =========================================================
     FLASH MESSAGE — slide-in + auto hilang
     ========================================================= */
  function initFlash() {
    var flashes = document.querySelectorAll(".flash, [data-flash]");
    if (!flashes.length) return;

    flashes.forEach(function (el, i) {
      // Munculkan
      setTimeout(function () {
        el.classList.add("show");
      }, 70 + i * 80);

      // Auto hilang
      var hideDelay = 4800 + i * 250;
      setTimeout(function () {
        el.classList.add("hide");
        setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 380);
      }, hideDelay);
    });
  }

  /* =========================================================
     TABEL LEDGER — baris muncul bertahap
     ========================================================= */
  function initTableStagger() {
    if (reduceMotion) return;

    document.querySelectorAll("table.ledger tbody").forEach(function (tbody) {
      var rows = tbody.querySelectorAll("tr");
      rows.forEach(function (row, i) {
        row.classList.add("eco-row-in");
        row.style.animationDelay = Math.min(i * 42, 520) + "ms";
      });
    });
  }

  /* =========================================================
     KARTU UMUM — entrance soft
     ========================================================= */
  function initCardEntrance() {
    if (reduceMotion) return;

    var selectors = ".passbook, .receipt, .empty-state, .card:not(.eco-progress-card)";
    document.querySelectorAll(selectors).forEach(function (el, i) {
      if (el.classList.contains("eco-in-soft")) return; // sudah di-handle halaman lain
      el.classList.add("eco-in-soft");
      el.style.animationDelay = (60 + i * 70) + "ms";
    });
  }

  /* =========================================================
     FORM — loading state saat submit
     ========================================================= */
  function initFormLoading() {
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;

      var btn = form.querySelector('button[type="submit"], .btn[type="submit"], button.btn');
      if (!btn || btn.disabled || btn.classList.contains("is-loading")) return;

      var originalHTML = btn.innerHTML;
      btn.dataset.originalHtml = originalHTML;
      btn.innerHTML = '<span class="eco-spinner" aria-hidden="true"></span> Memproses…';
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.setAttribute("aria-busy", "true");

      // Fallback: restore jika form tidak redirect (misal validasi gagal di client)
      setTimeout(function () {
        if (btn.classList.contains("is-loading") && document.body.contains(btn)) {
          btn.classList.remove("is-loading");
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
          btn.innerHTML = originalHTML;
        }
      }, 9000);
    });
  }

  /* =========================================================
     RECEIPT — confetti otomatis saat struk tampil
     ========================================================= */
  function initReceiptConfetti() {
    var mark = document.querySelector(".receipt .r-mark");
    if (!mark) return;

    setTimeout(function () {
      burstConfetti(mark, {
        count: 16,
        emojis: ["🍃", "✨", "🌿", "⭐", "♻️", "🎉"]
      });
    }, 280);
  }

  /* =========================================================
     TILT LEMBUT (desktop only)
     ========================================================= */
  function initTilt() {
    if (reduceMotion || isCoarsePointer) return;

    document.querySelectorAll(".menu-card, .stat-card").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        var rotX = clamp(-py * 5.5, -6, 6);
        var rotY = clamp(px * 6, -7, 7);

        card.style.transform =
          "perspective(680px) rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg) translateY(-3px)";
      });

      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  /* =========================================================
     SIDEBAR MOBILE
     ========================================================= */
  function initMobileSidebar() {
    var sidebar = document.getElementById("sidebar") || document.querySelector(".sidebar");
    var hamburger = document.getElementById("hamburgerBtn") || document.querySelector(".hamburger-btn");
    var overlay = document.getElementById("sidebarOverlay") || document.querySelector(".sidebar-overlay");
    var closeBtn = document.getElementById("sidebarCloseBtn") || document.querySelector(".sidebar-close-btn");

    if (!sidebar || !hamburger) return;

    function openMenu() {
      sidebar.classList.add("open");
      if (overlay) overlay.classList.add("show");
      hamburger.classList.add("is-open");
      hamburger.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }

    function closeMenu() {
      sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("show");
      hamburger.classList.remove("is-open");
      hamburger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }

    hamburger.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) closeMenu();
      else openMenu();
    });

    if (overlay) overlay.addEventListener("click", closeMenu);
    if (closeBtn) closeBtn.addEventListener("click", closeMenu);

    // Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sidebar.classList.contains("open")) {
        closeMenu();
      }
    });

    // Tutup saat link navigasi diklik (mobile)
    sidebar.querySelectorAll("a.nav-link").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    // Tutup otomatis jika window membesar ke desktop
    window.addEventListener("resize", function () {
      if (window.innerWidth > 780 && sidebar.classList.contains("open")) {
        closeMenu();
      }
    });
  }

  /* =========================================================
     INIT
     ========================================================= */
  document.addEventListener("DOMContentLoaded", function () {
    initRipple();
    initFlash();
    initTableStagger();
    initCardEntrance();
    initFormLoading();
    initReceiptConfetti();
    initTilt();
    initMobileSidebar();
  });
})();