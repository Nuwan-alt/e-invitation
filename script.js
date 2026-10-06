/* ==========================================================================
   Dilshi & Nuwan — Wedding Invitation
   Vanilla JS. Every feature below degrades gracefully if its CDN library
   (GSAP/ScrollTrigger, Swiper) fails to load.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
   * RSVP config — paste the Google Apps Script web app URL here once
   * it's deployed (see README.md for the step-by-step setup).
   * ------------------------------------------------------------------ */
  var RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbx67YqxfWGxu1gLwifAo6fSjbVK9gnnX1JDSCvhHv8SF4EyGSXlX4mXrbbLOPIPWHGF/exec";
  var RSVP_DEADLINE = "1st November 2026"; // e.g. "10th November 2026" — leave empty to hide the line
  var RSVP_STORAGE_KEY = "dn-wedding-rsvp-2026";

  /* ------------------------------------------------------------------
   * Pre-shoot photo config — swap file names / captions / crops here.
   * `file` maps to images/optimized/<file>.jpg and <file>.webp
   * `position` is a CSS object-position value so faces aren't cropped.
   * ------------------------------------------------------------------ */
  var PHOTOS = [
    { file: "ps6", alt: "Nuwan kissing Dilshi's forehead, in black and white", position: "50% 35%" },
    { file: "ps4", alt: "Dilshi and Nuwan spinning hand in hand in a meadow", position: "45% 80%" },
    { file: "ps2", alt: "Nuwan dipping Dilshi in the surf by the rocks", position: "65% 58%" },
    { file: "ps5", alt: "Nuwan holding Dilshi from behind on the beach", position: "50% 55%" }
  ];

  /* ==================================================================
   * Guest-name personalisation (?to=Name)
   * ================================================================== */
  function getGuestName() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = params.get("to");
      if (!raw) return "";
      raw = raw.trim().slice(0, 60);
      return raw;
    } catch (e) {
      return "";
    }
  }

  function applyGuestName() {
    var guest = getGuestName();
    var dearLine = document.getElementById("dearLine");
    var guestTextEl = document.querySelector(".invitation__guest-text");

    if (guest) {
      dearLine.textContent = "Dear " + guest + ",";
      dearLine.hidden = false;
      if (guestTextEl) guestTextEl.textContent = guest;
    }
    // no guest param: cover stays generic, invitation keeps its
    // "You & Your Family" placeholder / dotted line already in the HTML.
  }

  /* ==================================================================
   * Gallery slides (built from PHOTOS so they're easy to swap)
   * ================================================================== */
  function buildGallerySlides() {
    var wrapper = document.getElementById("gallerySwiperWrapper");
    if (!wrapper) return;

    // Swiper's loop mode needs more slides than we have photos to swipe
    // smoothly, so with Swiper present each photo is added twice. Every copy
    // opens the lightbox at its photo via data-photo (see initLightbox).
    var copies = typeof Swiper === "undefined" ? 1 : 2;
    var slides = [];
    for (var c = 0; c < copies; c++) {
      PHOTOS.forEach(function (p, i) { slides.push({ p: p, i: i, copy: c > 0 }); });
    }

    var html = slides.map(function (s) {
      var p = s.p;
      return (
        '<div class="swiper-slide gallery__slide">' +
          '<a href="images/optimized/' + p.file + '.jpg" data-photo="' + s.i + '"' +
             (s.copy ? ' aria-hidden="true" tabindex="-1"' : '') + '>' +
            '<picture>' +
              '<source srcset="images/optimized/' + p.file + '.webp" type="image/webp">' +
              '<img src="images/optimized/' + p.file + '.jpg" alt="' + p.alt.replace(/"/g, "&quot;") + '" ' +
                   'loading="lazy" style="object-position:' + p.position + '">' +
            '</picture>' +
          "</a>" +
        "</div>"
      );
    }).join("");

    wrapper.innerHTML = html;
  }

  function initGallery() {
    if (typeof Swiper === "undefined") return; // CSS fallback keeps slides reachable via horizontal scroll
    var n = PHOTOS.length;
    var paginationEl = document.querySelector(".gallery__swiper .swiper-pagination");

    var swiper = new Swiper(".gallery__swiper", {
      effect: "coverflow",
      grabCursor: true,
      centeredSlides: true,
      loop: true, // slides are doubled in buildGallerySlides so this stays smooth
      slidesPerView: "auto",
      spaceBetween: 18,
      coverflowEffect: {
        rotate: 10,
        stretch: 0,
        depth: 140,
        modifier: 1.4,
        slideShadows: false
      },
      autoplay: {
        delay: 3800,
        disableOnInteraction: true,
        pauseOnMouseEnter: true
      },
      // one dot per photo, not per slide (each photo appears twice)
      pagination: {
        el: paginationEl,
        type: "custom",
        renderCustom: function (sw) {
          var active = sw.realIndex % n;
          var dots = "";
          for (var i = 0; i < n; i++) {
            dots += '<span class="swiper-pagination-bullet' + (i === active ? " swiper-pagination-bullet-active" : "") +
                    '" role="button" tabindex="0" data-dot="' + i + '" aria-label="Go to photo ' + (i + 1) + '"></span>';
          }
          return dots;
        }
      }
    });

    // go to the nearer of the photo's two copies, so the swipe is short
    function goToPhoto(i) {
      var r = swiper.realIndex, total = n * 2;
      var dist = function (t) { var d = Math.abs(t - r); return Math.min(d, total - d); };
      swiper.slideToLoop(dist(i) <= dist(i + n) ? i : i + n);
    }
    if (paginationEl) {
      paginationEl.addEventListener("click", function (e) {
        var dot = e.target.closest("[data-dot]");
        if (dot) goToPhoto(+dot.getAttribute("data-dot"));
      });
      paginationEl.addEventListener("keydown", function (e) {
        var dot = e.target.closest("[data-dot]");
        if (dot && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); goToPhoto(+dot.getAttribute("data-dot")); }
      });
    }
  }

  /* ==================================================================
   * Full-screen photo viewer, built on Swiper so the photo follows the
   * finger while swiping (with the next one sliding in beside it),
   * loops past either end and supports pinch / double-tap zoom.
   * ================================================================== */
  function initLightbox() {
    if (typeof Swiper === "undefined") return; // plain links still open the photos
    var wrapper = document.getElementById("gallerySwiperWrapper");
    if (!wrapper) return;

    var n = PHOTOS.length;
    var icon = function (d) {
      return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" ' +
             'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
    };

    var viewer = document.createElement("div");
    viewer.className = "lightbox";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "Photo viewer");
    viewer.setAttribute("aria-hidden", "true");
    viewer.innerHTML =
      '<div class="swiper lightbox__swiper"><div class="swiper-wrapper">' +
        PHOTOS.map(function (p) {
          return '<div class="swiper-slide"><div class="swiper-zoom-container">' +
                   '<img src="images/optimized/' + p.file + '.webp" alt="' + p.alt.replace(/"/g, "&quot;") + '" decoding="async">' +
                 "</div></div>";
        }).join("") +
      "</div></div>" +
      '<p class="lightbox__count caps" aria-live="polite"></p>' +
      '<button type="button" class="lightbox__btn lightbox__close" aria-label="Close photo viewer">' + icon("M6 6l12 12M18 6L6 18") + "</button>" +
      '<button type="button" class="lightbox__btn lightbox__nav lightbox__nav--prev" aria-label="Previous photo">' + icon("M15 5l-7 7 7 7") + "</button>" +
      '<button type="button" class="lightbox__btn lightbox__nav lightbox__nav--next" aria-label="Next photo">' + icon("M9 5l7 7-7 7") + "</button>";
    document.body.appendChild(viewer);

    var counter = viewer.querySelector(".lightbox__count");
    var closeBtn = viewer.querySelector(".lightbox__close");
    var lastFocus = null;

    // set up while invisible (visibility, not display:none) so Swiper can
    // measure the screen, and the photos are already decoded on first open
    var viewerSwiper = new Swiper(viewer.querySelector(".lightbox__swiper"), {
      loop: n > 1,
      speed: 320,
      spaceBetween: 20,
      longSwipesRatio: 0.3, // a slow drag past ~a third of the screen changes photo
      zoom: { maxRatio: 3 },
      keyboard: { enabled: false },
      navigation: {
        prevEl: viewer.querySelector(".lightbox__nav--prev"),
        nextEl: viewer.querySelector(".lightbox__nav--next")
      },
      on: {
        slideChange: function (sw) { counter.textContent = (sw.realIndex + 1) + " / " + n; }
      }
    });

    function open(i) {
      lastFocus = document.activeElement;
      viewerSwiper.update();
      viewerSwiper.slideToLoop(i, 0);
      counter.textContent = (i + 1) + " / " + n;
      viewerSwiper.keyboard.enable();
      root.classList.add("lightbox-open");
      viewer.classList.add("is-open");
      viewer.setAttribute("aria-hidden", "false");
      closeBtn.focus({ preventScroll: true });
    }

    function close() {
      if (!viewer.classList.contains("is-open")) return;
      viewerSwiper.zoom.out();
      viewerSwiper.keyboard.disable();
      root.classList.remove("lightbox-open");
      viewer.classList.remove("is-open");
      viewer.setAttribute("aria-hidden", "true");
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    closeBtn.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    wrapper.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-photo]");
      if (!a) return;
      e.preventDefault();
      open(+a.getAttribute("data-photo"));
    });
  }

  /* ==================================================================
   * Countdown to 25 Nov 2026, 10:00 Asia/Colombo (UTC+5:30)
   * ================================================================== */
  function initCountdown() {
    var target = new Date("2026-11-25T10:00:00+05:30").getTime();
    var els = {
      days: document.getElementById("cdDays"),
      hours: document.getElementById("cdHours"),
      minutes: document.getElementById("cdMinutes"),
      seconds: document.getElementById("cdSeconds")
    };
    var grid = document.getElementById("countdownGrid");
    var doneMsg = document.getElementById("countdownDone");
    var prev = {};
    var timerId;

    function setUnit(el, value, key) {
      var padded = String(value).padStart(2, "0");
      if (prev[key] === padded) return;
      prev[key] = padded;
      el.textContent = padded;
      el.classList.remove("tick");
      // eslint-disable-next-line no-unused-expressions
      void el.offsetWidth; // restart CSS animation
      el.classList.add("tick");
    }

    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) {
        clearInterval(timerId);
        grid.hidden = true;
        doneMsg.hidden = false;
        return;
      }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      setUnit(els.days, d, "d");
      setUnit(els.hours, h, "h");
      setUnit(els.minutes, m, "m");
      setUnit(els.seconds, s, "s");
    }

    tick();
    timerId = setInterval(tick, 1000);
  }

  /* ==================================================================
   * Google Calendar link — used by the RSVP success screen's
   * "Add to Calendar" button once a guest confirms they're attending.
   * ================================================================== */
  function buildGoogleCalendarUrl() {
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent("Dilshi & Nuwan's Wedding") +
      "&dates=20261125T043000Z/20261125T103000Z" +
      "&details=" + encodeURIComponent("Join us to celebrate the marriage of Dilshi & Nuwan.") +
      "&location=" + encodeURIComponent("The Kingsbury, Colombo") +
      "&ctz=Asia%2FColombo";
  }

  /* ==================================================================
   * RSVP form: client-side validation + POST to a Google Apps Script
   * web app (form-urlencoded, so it's a "simple request" — no CORS
   * preflight). Every failure mode (unconfigured endpoint, timeout,
   * network error) degrades to a visible, retryable message; nothing
   * fails silently except the honeypot.
   * ================================================================== */
  function initRsvpForm() {
    var form = document.getElementById("rsvpForm");
    if (!form) return;

    var nameInput = document.getElementById("rsvpName");
    var nameError = document.getElementById("rsvpNameError");
    var attendYes = document.getElementById("rsvpAttendYes");
    var attendNo = document.getElementById("rsvpAttendNo");
    var attendCards = form.querySelectorAll(".rsvp-attend__card");
    var attendingError = document.getElementById("rsvpAttendingError");
    var phoneInput = document.getElementById("rsvpPhone");
    var messageInput = document.getElementById("rsvpMessage");
    var messageCount = document.getElementById("rsvpMessageCount");
    var honeypot = document.getElementById("rsvpWebsite");
    var formError = document.getElementById("rsvpFormError");
    var formErrorText = document.getElementById("rsvpFormErrorText");
    var retryBtn = document.getElementById("rsvpRetryBtn");
    var submitBtn = document.getElementById("rsvpSubmit");
    var submitLabel = document.getElementById("rsvpSubmitLabel");
    var spinner = document.getElementById("rsvpSpinner");
    var deadlineEl = document.getElementById("rsvpDeadline");
    var successEl = document.getElementById("rsvpSuccess");
    var successMessage = document.getElementById("rsvpSuccessMessage");
    var successCal = document.getElementById("rsvpSuccessCal");
    var alreadyEl = document.getElementById("rsvpAlready");
    var updateBtn = document.getElementById("rsvpUpdateBtn");

    /* ---- deadline line ---- */
    if (deadlineEl) {
      if (RSVP_DEADLINE) {
        deadlineEl.textContent = "Kindly respond by " + RSVP_DEADLINE;
        deadlineEl.hidden = false;
      } else {
        deadlineEl.hidden = true;
      }
    }

    /* ---- prefill name from ?to= ---- */
    var guestParam = getGuestName();
    if (guestParam && nameInput) nameInput.value = guestParam;

    /* ---- attending choice cards ---- */
    function updateAttendingUI() {
      attendCards.forEach(function (card) {
        var input = card.querySelector("input");
        card.classList.toggle("is-selected", !!(input && input.checked));
      });
    }
    [attendYes, attendNo].forEach(function (radio) {
      if (!radio) return;
      radio.addEventListener("change", function () {
        hideError(attendingError);
        updateAttendingUI();
      });
    });

    /* ---- phone number: group digits as typed (76 123 4567) ---- */
    // Sri Lankan numbers are grouped the usual way: 76 123 4567,
    // 076 123 4567 or +94 76 123 4567. Other country codes are left as typed.
    function groupDigits(d, sizes) {
      var parts = [], at = 0;
      for (var i = 0; i < sizes.length && at < d.length; i++) {
        parts.push(d.slice(at, at + sizes[i]));
        at += sizes[i];
      }
      return parts.join(" ");
    }
    function formatPhone(value) {
      var d = value.replace(/\D/g, "");
      if (value.trim().charAt(0) === "+") {
        if (d.length >= 2 && d.slice(0, 2) !== "94") return "+" + value.replace(/[^\d ]/g, "").trim();
        if (d.length <= 2) return "+" + d;
        var local = d.slice(2).replace(/^0/, "");
        return "+94 " + groupDigits(local.slice(0, 9), [2, 3, 4]);
      }
      if (d.charAt(0) === "0") return groupDigits(d.slice(0, 10), [3, 3, 4]);
      return groupDigits(d.slice(0, 9), [2, 3, 4]);
    }
    if (phoneInput) {
      phoneInput.addEventListener("input", function () {
        var value = phoneInput.value;
        var formatted = formatPhone(value);
        if (formatted === value) return;
        // keep the caret after the same number of digits it was after
        var digitsBefore = value.slice(0, phoneInput.selectionStart).replace(/\D/g, "").length;
        phoneInput.value = formatted;
        var pos = formatted.charAt(0) === "+" ? 1 : 0;
        for (var seen = 0; pos < formatted.length && seen < digitsBefore; pos++) {
          if (/\d/.test(formatted.charAt(pos))) seen++;
        }
        if (document.activeElement === phoneInput) phoneInput.setSelectionRange(pos, pos);
      });
    }

    /* ---- message character counter ---- */
    if (messageInput && messageCount) {
      messageInput.addEventListener("input", function () {
        messageCount.textContent = String(messageInput.value.length);
      });
    }

    function showError(el, msg) {
      if (!el) return;
      el.textContent = msg;
      el.hidden = false;
    }
    function hideError(el) {
      if (!el) return;
      el.hidden = true;
    }

    function validate() {
      var ok = true;
      hideError(nameError);
      hideError(attendingError);

      if (!nameInput.value.trim()) {
        showError(nameError, "Please enter your name.");
        ok = false;
      }
      if (!form.querySelector('input[name="attending"]:checked')) {
        showError(attendingError, "Please let us know if you'll attend.");
        ok = false;
      }
      return ok;
    }

    /* ---- localStorage, wrapped so a blocked/private-mode store never
       breaks the form itself, only the "remember me" convenience ---- */
    function readStoredResponse() {
      try {
        var raw = window.localStorage.getItem(RSVP_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }
    function storeResponse(name, attending) {
      try {
        window.localStorage.setItem(RSVP_STORAGE_KEY, JSON.stringify({
          submitted: true, name: name, attending: attending, ts: Date.now()
        }));
      } catch (e) { /* ignore — non-essential */ }
    }
    function clearStoredResponse() {
      try { window.localStorage.removeItem(RSVP_STORAGE_KEY); } catch (e) { /* ignore */ }
    }

    function showForm() {
      form.hidden = false;
      successEl.hidden = true;
      alreadyEl.hidden = true;
    }
    function showAlready() {
      form.hidden = true;
      successEl.hidden = true;
      alreadyEl.hidden = false;
    }
    function showSuccess(name, attending) {
      form.hidden = true;
      alreadyEl.hidden = true;
      successEl.hidden = false;
      if (attending === "yes") {
        successMessage.textContent = "Thank you, " + name + "! We can't wait to celebrate with you 🤍";
        if (successCal) {
          successCal.href = buildGoogleCalendarUrl();
          successCal.hidden = false;
        }
      } else {
        successMessage.textContent = "Thank you, " + name + ". You'll be missed 🤍";
        if (successCal) successCal.hidden = true;
      }
    }

    if (updateBtn) {
      updateBtn.addEventListener("click", function () {
        clearStoredResponse();
        showForm();
      });
    }

    var stored = readStoredResponse();
    if (stored && stored.submitted) showAlready();

    function setLoading(isLoading) {
      submitBtn.disabled = isLoading;
      if (spinner) spinner.hidden = !isLoading;
      if (submitLabel) submitLabel.textContent = isLoading ? "Sending…" : "Send RSVP";
    }

    function submitRsvp() {
      formError.hidden = true;

      if (honeypot && honeypot.value) return; // silently drop bot submissions
      if (!validate()) return;

      if (!RSVP_ENDPOINT || RSVP_ENDPOINT.indexOf("PASTE_") === 0) {
        console.warn("RSVP_ENDPOINT is not configured — paste your Google Apps Script web app URL into script.js.");
        formErrorText.textContent = "RSVP is not configured yet. Please try again later.";
        formError.hidden = false;
        return;
      }

      var name = nameInput.value.trim();
      var attendingInput = form.querySelector('input[name="attending"]:checked');
      var attending = attendingInput ? attendingInput.value : "";
      var phone = phoneInput.value.trim();
      var message = messageInput.value.trim();

      setLoading(true);

      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;

      var body = new URLSearchParams();
      body.set("timestamp", new Date().toISOString());
      body.set("name", name);
      body.set("attending", attending === "yes" ? "Yes" : "No");
      body.set("phone", phone);
      body.set("message", message);
      body.set("guestParam", guestParam || "");

      fetch(RSVP_ENDPOINT, {
        method: "POST",
        body: body,
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          if (timeoutId) clearTimeout(timeoutId);
          return res.json().catch(function () { return { result: "success" }; });
        })
        .then(function (data) {
          setLoading(false);
          if (data && data.result === "error") {
            formErrorText.textContent = "Something went wrong on our end. Please try again.";
            formError.hidden = false;
            return;
          }
          storeResponse(name, attending);
          showSuccess(name, attending);
        })
        .catch(function () {
          if (timeoutId) clearTimeout(timeoutId);
          setLoading(false);
          formErrorText.textContent = "We couldn't send your RSVP. Please check your connection and try again.";
          formError.hidden = false;
        });
    }

    form.addEventListener("submit", function (evt) {
      evt.preventDefault();
      submitRsvp();
    });
    if (retryBtn) {
      retryBtn.addEventListener("click", submitRsvp);
    }
  }

  /* ==================================================================
   * Cover screen: scroll-lock + "Open Invitation" reveal
   * ================================================================== */
  function initCover() {
    var openBtn = document.getElementById("openInvitation");
    var cover = document.getElementById("cover");
    var canAnimate = window.gsap && !reduceMotion;

    root.classList.add("lock-scroll");

    // take the cover out of the page entirely, so it doesn't leave a
    // screen-tall blank gap above the invitation
    function finish() {
      if (cover) cover.hidden = true;
      root.classList.remove("lock-scroll");
      window.scrollTo(0, 0);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
      document.dispatchEvent(new Event("invitation:opened"));
    }

    function openInvitation() {
      if (openBtn.disabled) return;
      openBtn.disabled = true;

      if (canAnimate) {
        // lift the cover into a fixed overlay: the invitation moves up
        // underneath it and is revealed as the cover fades away
        gsap.killTweensOf(".cover__button");
        cover.classList.add("cover--leaving");
        window.scrollTo(0, 0);
        if (window.ScrollTrigger) ScrollTrigger.refresh();

        var tl = gsap.timeline({ onComplete: finish });
        tl.to(".cover__photo .floral--tr", { x: "6%", y: "-8%", opacity: 0, duration: 1.1, ease: "power3.inOut" }, 0)
          .to(".cover__foliage-bottom", { y: "12%", opacity: 0, duration: 1.1, ease: "power3.inOut" }, 0)
          .to(".cover__content", { y: -50, opacity: 0, duration: 0.9, ease: "power3.inOut" }, 0.05)
          .to("#cover", { autoAlpha: 0, duration: 0.5, ease: "power2.out" }, "-=0.35");
      } else {
        finish();
      }
    }

    if (openBtn) {
      openBtn.addEventListener("click", openInvitation);
    } else {
      root.classList.remove("lock-scroll");
    }
  }

  /* ==================================================================
   * GSAP entrance + scroll animations (progressive enhancement only —
   * every element this touches is already visible via static CSS, so a
   * failed CDN load simply means "no animation", never "hidden content").
   * ================================================================== */
  function initGsapAnimations() {
    if (!window.gsap || reduceMotion) return;

    if (window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      root.classList.add("js-anim");
    }

    /* ---- cover load-in sequence ---- */
    var dearLine = document.getElementById("dearLine");
    var coverIntroTargets = [".cover__tagline"];
    if (dearLine && !dearLine.hidden) coverIntroTargets.unshift("#dearLine");

    gsap.set(".cover__photo .floral--tr", { x: 34, y: -26, opacity: 0 });
    gsap.set(".cover__foliage-bottom", { y: 30, opacity: 0 });
    gsap.set(".cover__logo", { scale: 0.9, opacity: 0 });
    gsap.set(coverIntroTargets, { opacity: 0, y: 16 });
    gsap.set(".cover__button", { opacity: 0, y: 10 });

    var coverTl = gsap.timeline({ delay: 0.15 });
    coverTl
      .to(".cover__photo .floral--tr", { x: 0, y: 0, opacity: 1, duration: 1.6, ease: "power2.out" }, 0)
      .to(".cover__foliage-bottom", { y: 0, opacity: 1, duration: 1.6, ease: "power2.out" }, 0)
      .to(".cover__logo", { scale: 1, opacity: 1, duration: 1, ease: "back.out(1.5)" }, 0.35)
      .fromTo(".cover__logo",
        { filter: "drop-shadow(0 0 0px rgba(176,154,108,0))" },
        { filter: "drop-shadow(0 0 16px rgba(176,154,108,0.5))", duration: 0.9, yoyo: true, repeat: 1, ease: "sine.inOut" },
        0.45)
      .to(coverIntroTargets, { opacity: 1, y: 0, duration: 0.7, stagger: 0.18, ease: "power2.out" }, 0.95)
      .to(".cover__button", { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 1.55)
      .to(".cover__button", { scale: 1.035, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: -1 }, 2.1);

    /* ---- ambient foliage sway (whole site) ---- */
    gsap.utils.toArray(".cover__foliage, .section__foliage").forEach(function (el, i) {
      gsap.to(el, {
        rotate: i % 2 === 0 ? 1.4 : -1.4,
        duration: 7 + i,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1
      });
    });

    if (!window.ScrollTrigger) return;

    /* ---- light foliage parallax on scroll ---- */
    gsap.utils.toArray(".section__foliage").forEach(function (el) {
      var section = el.closest(".section");
      gsap.to(el, {
        y: 36,
        ease: "none",
        scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true }
      });
    });

    /* ---- gold divider lines draw across on scroll ---- */
    document.querySelectorAll(".divider").forEach(function (d) {
      ScrollTrigger.create({
        trigger: d,
        start: "top 88%",
        once: true,
        onEnter: function () { d.classList.add("in-view"); }
      });
    });

    /* ---- invitation card: staggered reveal ---- */
    var invLines = gsap.utils.toArray("#invitation .reveal-line");
    var invNames = gsap.utils.toArray(".names-reveal");
    gsap.set(invLines, { opacity: 0, y: 20 });
    gsap.set(invNames, { opacity: 0, filter: "blur(8px)" });

    ScrollTrigger.create({
      trigger: "#invitation",
      start: "top 72%",
      once: true,
      onEnter: function () {
        var tl = gsap.timeline();
        tl.to(invLines, { opacity: 1, y: 0, duration: 0.7, stagger: 0.09, ease: "power2.out" })
          .to(invNames, { opacity: 1, filter: "blur(0px)", duration: 0.65, stagger: 0.3, ease: "power2.out" }, "-=0.35");
      }
    });

    /* ---- individual "card" style reveals ----
       fromTo (not from) everywhere below: a from() tween reads the element's
       current transform as its end state, and elements with a CSS transform
       transition (e.g. .btn) can be caught mid-transition — the map button
       used to end up stuck 24px low, sitting on top of the map */
    gsap.utils.toArray(".reveal-up").forEach(function (el) {
      gsap.fromTo(el, { opacity: 0, y: 24 }, {
        opacity: 1, y: 0, duration: 0.8, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 88%" }
      });
    });

    /* ---- generic fade+rise for the remaining sections ---- */
    document.querySelectorAll(".section:not(#invitation) .content-col").forEach(function (col) {
      var kids = Array.prototype.filter.call(col.children, function (k) {
        return !k.classList.contains("divider");
      });
      if (!kids.length) return;
      gsap.fromTo(kids, { opacity: 0, y: 24 }, {
        opacity: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "power2.out",
        scrollTrigger: { trigger: col, start: "top 82%" }
      });
    });
  }

  /* ==================================================================
   * Calendar: hand-drawn ring circles the wedding day.
   * Independent of GSAP and kept even with reduced motion (a single short
   * line draw). Armed only once the cover has gone, so guests actually see
   * it draw, and watches the wedding day itself, not the whole calendar —
   * on phones the 25th sits in the last row and would otherwise draw
   * below the fold.
   * ================================================================== */
  function initCalendarRing() {
    if (!("IntersectionObserver" in window)) return; // ring just shows, static

    var days = document.querySelectorAll(".cal__day--wedding");
    days.forEach(function (d) { d.closest(".cal").classList.add("cal--draw"); });

    function arm() {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.closest(".cal").classList.add("in-view");
          io.unobserve(e.target);
        });
      }, { threshold: 1, rootMargin: "0px 0px -15% 0px" });
      days.forEach(function (d) { io.observe(d); });
    }

    var cover = document.getElementById("cover");
    if (cover && !cover.hidden) {
      document.addEventListener("invitation:opened", arm, { once: true });
    } else {
      arm();
    }
  }

  /* ==================================================================
   * Boot
   * ================================================================== */
  applyGuestName();
  buildGallerySlides();
  initGallery();
  initLightbox();
  initCountdown();
  initRsvpForm();
  initCover();
  initCalendarRing();
  initGsapAnimations();
})();
