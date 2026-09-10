(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;

  /* =========================================================
     UTILITAS
     ========================================================= */
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function easeOutQuint(t) {
    return 1 - Math.pow(1 - t, 5);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function formatNumber(value, decimals) {
    var fixed = value.toFixed(decimals);
    if (decimals === 0) {
      return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }
    var parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(",");
  }

  /* =========================================================
     COUNTER ANGKA (stat cards)
     ========================================================= */
  function animateCounters() {
    var counters = document.querySelectorAll(".eco-counter");
    if (!counters.length) return;

    counters.forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-target") || "0");
      var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var duration = parseInt(el.getAttribute("data-duration") || "1200", 10);

      if (reduceMotion || target === 0) {
        el.textContent = formatNumber(target, decimals);
        return;
      }

      var start = null;

      function step(ts) {
        if (start === null) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = easeOutQuint(progress);
        var value = target * eased;
        el.textContent = formatNumber(value, decimals);
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          el.textContent = formatNumber(target, decimals);
        }
      }
      requestAnimationFrame(step);
    });
  }

  /* =========================================================
     PROGRESS BAR POHON VIRTUAL
     ========================================================= */
  function animateProgressBar() {
    var fill = document.querySelector(".eco-progress-fill");
    if (!fill) return;

    var target = parseFloat(fill.getAttribute("data-target-percent") || "0");
    target = clamp(target, 0, 100);

    if (reduceMotion) {
      fill.style.width = target + "%";
      return;
    }

    // Double rAF supaya transition CSS benar-benar terpicu
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fill.style.width = target + "%";
      });
    });
  }

  /* =========================================================
     IKON MELAYANG (hero)
     ========================================================= */
  function spawnFloatingIcons() {
    var wrap = document.querySelector(".eco-float-icons");
    if (!wrap || reduceMotion) return;

    var icons = ["🍃", "♻️", "🌿", "🍂", "✨", "🌱", "🌍"];
    var count = 12;

    for (var i = 0; i < count; i++) {
      var span = document.createElement("span");
      span.className = "eco-float-icon";
      span.textContent = icons[i % icons.length];
      span.style.left = (4 + Math.random() * 92).toFixed(1) + "%";
      span.style.animationDuration = (8 + Math.random() * 8).toFixed(1) + "s";
      span.style.animationDelay = "-" + (Math.random() * 12).toFixed(1) + "s";
      span.style.fontSize = (15 + Math.random() * 16).toFixed(0) + "px";
      span.style.opacity = "0";
      wrap.appendChild(span);
    }
  }

  /* =========================================================
     CONFETTI (global)
     ========================================================= */
  window.EcoConfetti = {
    burst: function (originEl, options) {
      if (reduceMotion) return;

      options = options || {};
      var count = options.count || 14;
      var icons = options.icons || ["🍃", "✨", "🌿", "♻️", "🌱"];
      var rect = originEl.getBoundingClientRect();
      var originX = rect.left + rect.width / 2;
      var originY = rect.top + rect.height / 2;

      for (var i = 0; i < count; i++) {
        var leaf = document.createElement("span");
        leaf.className = "eco-confetti-leaf";
        leaf.textContent = icons[i % icons.length];

        var angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
        var distance = 60 + Math.random() * 90;
        var dx = Math.cos(angle) * distance;
        var dy = Math.sin(angle) * distance - 40 - Math.random() * 50;
        var rot = (Math.random() - 0.5) * 360;

        leaf.style.left = originX + "px";
        leaf.style.top = originY + "px";
        leaf.style.setProperty("--dx", dx.toFixed(1) + "px");
        leaf.style.setProperty("--dy", dy.toFixed(1) + "px");
        leaf.style.setProperty("--rot", rot.toFixed(0) + "deg");
        leaf.style.fontSize = (14 + Math.random() * 10).toFixed(0) + "px";

        document.body.appendChild(leaf);

        (function (el) {
          setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
          }, 1600);
        })(leaf);
      }
    }
  };

  /* =========================================================
     MASKOT INTERAKTIF
     ========================================================= */
  var FAKTA = [
    "Tahukah kamu? 1 kg kertas daur ulang bisa menyelamatkan 17 pohon! 🌳",
    "Botol plastik butuh sekitar 450 tahun untuk terurai di alam. 🥤",
    "Yuk ajak teman sekelasmu ikut menabung sampah hari ini! 🤝",
    "Sampah kaca bisa didaur ulang berkali-kali tanpa kehilangan kualitas. 🍾",
    "Setiap kilogram sampah yang kamu setor jadi poin buat hadiah! 🎁",
    "Memilah sampah dari sekarang, langkah kecil dampaknya besar. 🌎",
    "Kaleng aluminium bisa didaur ulang jadi kaleng baru dalam 60 hari lho! 🥫",
    "Semakin rajin menabung sampah, semakin cepat pohon virtualmu tumbuh! 🌱",
    "Satu ton kertas daur ulang menghemat 26.500 liter air. 💧",
    "Ayo jadi juara bank sampah di sekolahmu! 🏆"
  ];
  var faktaIndex = 0;
  var bubbleTimeout = null;

  function initMascot() {
    var btn = document.querySelector(".eco-mascot-btn");
    var bubble = document.querySelector(".eco-bubble");
    if (!btn || !bubble) return;

    function showFact() {
      bubble.textContent = FAKTA[faktaIndex % FAKTA.length];
      faktaIndex++;
      bubble.classList.add("show");

      clearTimeout(bubbleTimeout);
      bubbleTimeout = setTimeout(function () {
        bubble.classList.remove("show");
      }, 4500);

      if (!reduceMotion) {
        window.EcoConfetti.burst(btn, { count: 12 });
      }
    }

    btn.addEventListener("click", showFact);

    // Keyboard accessibility
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("aria-label", "Klik untuk fakta menarik tentang daur ulang");
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showFact();
      }
    });
  }

  /* =========================================================
     RIPPLE EFEK TOMBOL
     ========================================================= */
  function initRipple() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".btn");
      if (!btn || btn.disabled || btn.classList.contains("is-loading")) return;
      if (reduceMotion) return;

      var rect = btn.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height) * 2.2;
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
     TILT LEMBUT KARTU (desktop only)
     ========================================================= */
  function initCardTilt() {
    if (reduceMotion || isTouch) return;

    var cards = document.querySelectorAll(".menu-card, .stat-card");
    cards.forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        var rotateX = y * -6;
        var rotateY = x * 7;
        card.style.transform =
          "perspective(700px) rotateX(" + rotateX.toFixed(2) + "deg) rotateY(" + rotateY.toFixed(2) + "deg) translateY(-4px)";
      });

      card.addEventListener("mouseleave", function () {
        card.style.transform = "";
      });
    });
  }

  /* =========================================================
     STAGGER BARIS TABEL
     ========================================================= */
  function animateTableRows() {
    var rows = document.querySelectorAll("table.ledger tbody tr");
    if (!rows.length) return;

    rows.forEach(function (row, i) {
      row.classList.add("eco-row-in");
      if (!reduceMotion) {
        row.style.animationDelay = (i * 0.045).toFixed(3) + "s";
      }
    });
  }

  /* =========================================================
     ENTRANCE SOFT UNTUK ELEMEN UMUM
     ========================================================= */
  function softEntrance() {
    var els = document.querySelectorAll(".passbook, .receipt, .empty-state, .eco-progress-card, .card");
    els.forEach(function (el, i) {
      el.classList.add("eco-in-soft");
      if (!reduceMotion) {
        el.style.animationDelay = (0.08 + i * 0.06).toFixed(2) + "s";
      }
    });
  }

  /* =========================================================
     FLASH MESSAGE — auto hide
     ========================================================= */
  function initFlashMessages() {
    var flashes = document.querySelectorAll(".flash");
    flashes.forEach(function (flash, i) {
      // munculkan
      setTimeout(function () {
        flash.classList.add("show");
      }, 80 + i * 60);

      // auto hilang setelah 5 detik
      setTimeout(function () {
        flash.classList.add("hide");
        setTimeout(function () {
          if (flash.parentNode) flash.parentNode.removeChild(flash);
        }, 400);
      }, 5000 + i * 200);
    });
  }

  /* =========================================================
     FORM LOADING STATE
     ========================================================= */
  function initFormLoading() {
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;

      var btn = form.querySelector('button[type="submit"], .btn[type="submit"]');
      if (!btn || btn.classList.contains("is-loading")) return;

      btn.classList.add("is-loading");
      btn.disabled = true;

      var originalHTML = btn.innerHTML;
      btn.setAttribute("data-original-html", originalHTML);
      btn.innerHTML = '<span class="eco-spinner"></span> Menyimpan…';

      // fallback: jika form tidak redirect, kembalikan setelah 8 detik
      setTimeout(function () {
        if (btn.classList.contains("is-loading")) {
          btn.classList.remove("is-loading");
          btn.disabled = false;
          btn.innerHTML = originalHTML;
        }
      }, 8000);
    });
  }

  /* =========================================================
     SIDEBAR MOBILE (jika ada)
     ========================================================= */
  function initMobileSidebar() {
    var hamburger = document.querySelector(".hamburger-btn");
    var sidebar = document.querySelector(".sidebar");
    var overlay = document.querySelector(".sidebar-overlay");
    var closeBtn = document.querySelector(".sidebar-close-btn");

    if (!hamburger || !sidebar) return;

    function openSidebar() {
      sidebar.classList.add("open");
      hamburger.classList.add("is-open");
      if (overlay) overlay.classList.add("show");
      document.body.style.overflow = "hidden";
    }

    function closeSidebar() {
      sidebar.classList.remove("open");
      hamburger.classList.remove("is-open");
      if (overlay) overlay.classList.remove("show");
      document.body.style.overflow = "";
    }

    hamburger.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) closeSidebar();
      else openSidebar();
    });

    if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    // tutup saat resize ke desktop
    window.addEventListener("resize", function () {
      if (window.innerWidth > 780) closeSidebar();
    });
  }

  /* =========================================================
     INIT
     ========================================================= */
  document.addEventListener("DOMContentLoaded", function () {
    animateCounters();
    animateProgressBar();
    spawnFloatingIcons();
    initMascot();
    initRipple();
    initCardTilt();
    animateTableRows();
    softEntrance();
    initFlashMessages();
    initFormLoading();
    initMobileSidebar();
  });
})();