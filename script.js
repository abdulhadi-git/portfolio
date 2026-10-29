(() => {
  'use strict';

  /* ---------- 1. Helpers + feature flags ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const animate = hasGsap && !reduceMotion;

  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  const body = document.body;
  const nav = $('[data-nav]');
  const loader = $('[data-loader]');

  let lenis = null;
  let introDone = false;
  let menuOpen = false;


  /* ---------- 2. Smooth scroll (Lenis) ---------- */
  function initSmoothScroll() {
    if (!animate || typeof window.Lenis === 'undefined') return;

    lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    lenis.stop(); // locked until the loader is done
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target, toTop) {
    const offset = toTop ? 0 : target.matches('[data-case]') ? -100 : 0;

    if (lenis) {
      lenis.scrollTo(toTop ? 0 : target, { offset, duration: 1.4 });
      return;
    }
    const top = toTop ? 0 : target.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }


  /* ---------- 3. Nav: scroll state, active link, mobile menu ---------- */
  function initNav() {
    const progress = $('[data-progress]');
    const toggle = $('[data-menu-toggle]');
    const menu = $('[data-menu]');
    const links = $$('.nav__link');
    let lastY = window.scrollY;

    // scroll state + progress bar + hide on scroll down
    function onScroll() {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;

      nav.classList.toggle('is-scrolled', y > 20);
      if (progress && max > 0) progress.style.transform = `scaleX(${Math.min(1, y / max)})`;

      if (!introDone || menuOpen) return;
      const delta = y - lastY;
      if (Math.abs(delta) < 6) return;

      if (delta > 0 && y > 500) nav.classList.add('is-hidden');
      else nav.classList.remove('is-hidden');
      lastY = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // sliding indicator: sits under the hovered link, otherwise under the current section's link
    const linksWrap = $('[data-nav-links]');
    const indicator = $('[data-nav-indicator]');
    let activeLink = null;
    let hoverLink = null;

    function placeIndicator(instant) {
      const target = hoverLink || activeLink;
      links.forEach((a) => a.classList.toggle('is-lit', a === target));
      if (!indicator || !linksWrap) return;

      if (!target || !linksWrap.offsetWidth) {
        indicator.classList.remove('is-on');
        return;
      }

      const wrap = linksWrap.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const snap = instant || !indicator.classList.contains('is-on');

      if (snap) indicator.style.transition = 'none';
      indicator.style.width = `${r.width}px`;
      indicator.style.height = `${r.height}px`;
      indicator.style.transform = `translate3d(${r.left - wrap.left - linksWrap.clientLeft}px, ${r.top - wrap.top - linksWrap.clientTop}px, 0)`;
      if (snap) {
        void indicator.offsetWidth; // apply the new position without animating to it
        indicator.style.transition = '';
      }
      indicator.classList.add('is-on');
    }

    links.forEach((a) => {
      a.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'touch') return;
        hoverLink = a;
        placeIndicator();
      });
      a.addEventListener('focus', () => {
        if (!a.matches(':focus-visible')) return;
        hoverLink = a;
        placeIndicator();
      });
      a.addEventListener('blur', () => { hoverLink = null; placeIndicator(); });
    });
    if (linksWrap) linksWrap.addEventListener('pointerleave', () => { hoverLink = null; placeIndicator(); });

    window.addEventListener('resize', () => placeIndicator(true));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeIndicator(true));
    if ('ResizeObserver' in window && linksWrap) new ResizeObserver(() => placeIndicator(true)).observe(linksWrap);

    // active link follows the section that crosses the middle of the screen
    const setActive = (id) => {
      activeLink = id ? links.find((a) => a.getAttribute('href') === `#${id}`) || null : null;
      links.forEach((a) => a.classList.toggle('is-active', a === activeLink));
      placeIndicator();
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActive(entry.target.id === 'home' ? null : entry.target.id);
          });
        },
        { rootMargin: '-45% 0px -54% 0px' }
      );
      ['home', 'work', 'skills', 'cases', 'about', 'contact'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) io.observe(el);
      });
    }

    // mobile menu
    function setMenu(open) {
      menuOpen = open;
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');

      if (open) nav.classList.remove('is-hidden');
      if (lenis) open ? lenis.stop() : lenis.start();
      else document.documentElement.style.overflow = open ? 'hidden' : '';
    }
    initNav.setMenu = setMenu;

    toggle.addEventListener('click', () => setMenu(!menuOpen));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenu(false);
        toggle.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (menuOpen && window.innerWidth >= 900) setMenu(false);
    });
  }


  /* ---------- 4. Anchor links ---------- */
  function initAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;

      const hash = a.getAttribute('href');
      if (hash.length < 2) return;

      const toTop = hash === '#home';
      const target = toTop ? document.body : document.getElementById(hash.slice(1));
      if (!target) return;

      e.preventDefault();
      if (menuOpen && initNav.setMenu) initNav.setMenu(false);
      if (target.matches('[data-case]')) setCase(target, true);

      scrollToTarget(target, toTop);
      history.pushState(null, '', hash);

      if (hash === '#main') {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }


  /* ---------- 5. Case studies (expand / collapse) ---------- */
  function setCase(article, open) {
    const btn = $('[data-case-toggle]', article);
    const label = $('.case__toggle-label', article);

    article.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    label.textContent = open ? label.dataset.labelOpen : label.dataset.labelClosed;

    if (open && animate) {
      const items = $$('.case__cols > section, .case__foot', article);
      gsap.fromTo(
        items,
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08, delay: 0.2, clearProps: 'transform,opacity' }
      );
    }
  }

  function initCases() {
    $$('[data-case]').forEach((article) => {
      const btn = $('[data-case-toggle]', article);
      const panel = $('[data-case-panel]', article);

      btn.addEventListener('click', () => setCase(article, !article.classList.contains('is-open')));

      // page height changed, so tell ScrollTrigger once the animation ends
      panel.addEventListener('transitionend', (e) => {
        if (e.propertyName === 'grid-template-rows' && hasGsap) ScrollTrigger.refresh();
      });
    });

    // opened directly from a link like /#case-shopflow
    const fromHash = location.hash && document.querySelector(`[data-case]${location.hash.replace(/[^#\w-]/g, '')}`);
    if (fromHash) setCase(fromHash, true);
  }


  /* ---------- 6. Small UI: year, copy email, card spotlight ---------- */
  function initSmallUi() {
    $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

    // copy email
    $$('[data-copy]').forEach((btn) => {
      const label = $('[data-copy-label]', btn);
      const icon = $('.btn__icon i', btn);
      let timer;

      if (label) label.setAttribute('aria-live', 'polite');

      btn.addEventListener('click', async () => {
        const text = btn.dataset.copy;
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch { /* nothing else to try */ }
          ta.remove();
        }

        const original = label.dataset.original || label.textContent;
        label.dataset.original = original;
        label.textContent = 'Copied';
        if (icon) icon.className = 'ph-bold ph-check';

        clearTimeout(timer);
        timer = setTimeout(() => {
          label.textContent = original;
          if (icon) icon.className = 'ph-bold ph-copy';
        }, 2000);
      });
    });

    // light that follows the pointer on project cards (CSS reads --mx / --my)
    if (finePointer) {
      $$('[data-spotlight]').forEach((card) => {
        card.addEventListener('pointermove', (e) => {
          const r = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${e.clientX - r.left}px`);
          card.style.setProperty('--my', `${e.clientY - r.top}px`);
        }, { passive: true });
      });
    }
  }


  /* ---------- 7. Typing effect ---------- */
  function createTyped() {
    const el = $('[data-typed]');
    const caret = $('.typed__caret');
    const hero = $('#home');
    if (!el || !caret) return { start() {} };

    let words;
    try { words = JSON.parse(el.dataset.words); } catch { words = [el.textContent.trim()]; }
    if (!Array.isArray(words) || words.length < 2) return { start() {} };

    // pause while the hero is off screen
    let visible = true;
    let waiters = [];
    if ('IntersectionObserver' in window && hero) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) { waiters.forEach((r) => r()); waiters = []; }
      }).observe(hero);
    }
    const whenVisible = () => (visible ? Promise.resolve() : new Promise((r) => waiters.push(r)));

    let index = 0;
    let started = false;

    async function loop() {
      for (;;) {
        await sleep(1900); // hold the finished word
        await whenVisible();

        caret.classList.add('is-typing');

        let text = el.textContent;
        while (text.length) {
          text = text.slice(0, -1);
          el.textContent = text;
          await sleep(38);
        }
        await sleep(240);

        index = (index + 1) % words.length;
        const word = words[index];
        for (let i = 1; i <= word.length; i++) {
          el.textContent = word.slice(0, i);
          await sleep(75 + Math.random() * 55);
        }
        caret.classList.remove('is-typing');
      }
    }

    return {
      start() {
        if (started) return;
        started = true;
        loop();
      },
    };
  }


  /* ---------- 7b. Contact code editor that types itself ---------- */
  function initEditor() {
    const codeBox = $('[data-editor]');
    // no motion wanted: the full code written in the HTML simply stays
    if (!codeBox || reduceMotion) return;

    // One array per line. Each token is [css class, text]; an empty class means plain text.
    // Keep this in sync with the fallback code inside [data-editor] in index.html.
    const LINES = [
      [['t-com', '// Have a project in mind?']],
      [['t-c', 'Route'], ['t-p', '::'], ['t-f', 'post'], ['t-p', '('], ['t-s', "'/start'"], ['t-p', ', '], ['t-k', 'function'], ['t-p', ' () {']],
      [['', '    '], ['t-v', '$idea'], ['', ' = '], ['t-f', 'request'], ['t-p', '()->'], ['t-f', 'validate'], ['t-p', '([']],
      [['', '        '], ['t-s', "'name'"], ['', '  => '], ['t-s', "'required'"], ['t-p', ',']],
      [['', '        '], ['t-s', "'email'"], ['', ' => '], ['t-s', "'required|email'"], ['t-p', ',']],
      [['', '        '], ['t-s', "'idea'"], ['', '  => '], ['t-s', "'required'"], ['t-p', ',']],
      [['', '    '], ['t-p', ']);']],
      [],
      [['', '    '], ['t-c', 'Project'], ['t-p', '::'], ['t-f', 'create'], ['t-p', '('], ['t-v', '$idea'], ['t-p', ');']],
      [],
      [['', '    '], ['t-k', 'return'], ['', ' '], ['t-s', '"Let\'s build it."'], ['t-p', ';']],
      [['t-p', '});']],
    ];

    const caret = document.createElement('span');
    caret.className = 'code__caret';

    // only type while the card is on screen
    const card = codeBox.closest('.code') || codeBox;
    let visible = !('IntersectionObserver' in window);
    let waiters = [];
    if (!visible) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) { waiters.forEach((r) => r()); waiters = []; }
      }, { threshold: 0.4 }).observe(card);
    }
    const whenVisible = () => (visible ? Promise.resolve() : new Promise((r) => waiters.push(r)));

    // start from an empty editor (the card keeps its height through CSS min-height)
    codeBox.textContent = '';

    async function typeAll() {
      caret.classList.add('is-typing');

      for (const tokens of LINES) {
        await whenVisible();

        const line = document.createElement('span');
        line.className = 'code__line';
        line.appendChild(caret);
        codeBox.appendChild(line);

        for (const [cls, text] of tokens) {
          const node = cls ? document.createElement('span') : document.createTextNode('');
          if (cls) node.className = cls;
          line.insertBefore(node, caret);

          // indentation appears at once, everything else is typed letter by letter
          if (!cls && !text.trim()) { node.textContent = text; continue; }
          for (const ch of text) {
            node.textContent += ch;
            await sleep(16 + Math.random() * 30);
          }
        }
        await sleep(tokens.length ? 200 : 110);
      }

      caret.classList.remove('is-typing'); // caret blinks while the finished code is shown
    }

    async function eraseAll() {
      caret.classList.add('is-typing');
      while (codeBox.lastElementChild) {
        codeBox.lastElementChild.remove();
        const last = codeBox.lastElementChild;
        if (last) last.appendChild(caret);
        await sleep(55);
      }
    }

    (async () => {
      for (;;) {
        await whenVisible();
        await sleep(700); // let the card finish fading in
        await typeAll();
        await sleep(4500);
        await eraseAll();
        await sleep(600);
      }
    })();
  }


  /* ---------- 7c. About: "messy requirements -> software" scene ----------
     Left side of the About section. A pile of messy client requirements (with a tangled scribble)
     floats around, gets sucked into a glowing core, and the core blows open into one finished app that
     builds itself (notifications, count-up numbers, chart, tech stack), ships, and throws confetti.
     The scene is drawn on a fixed 416 x 500 stage that is scaled to the panel width, so every number
     below is in plain stage pixels. One GSAP timeline, only transform/opacity (plus the scribble's
     stroke), and it plays only while the panel is on screen. With reduced motion (or if GSAP fails
     to load) nothing animates and the page just shows the finished app that is already in the markup. */
  function initAboutScene() {
    const root = $('[data-req]');
    if (!root) return;

    const panel = $('[data-req-panel]', root);
    const stage = $('[data-req-stage]', root);
    const STAGE_W = 416;

    // scale the fixed stage to the panel width (works with or without GSAP)
    const fit = () => stage.style.setProperty('--s', (panel.clientWidth / STAGE_W).toFixed(4));
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(panel);
    else window.addEventListener('resize', fit);

    if (!animate) return;

    const sparks = [];
    try {
      const chips = $$('.req__chip', root);
      const app = $('[data-req-app]', root);
      const status = $('[data-req-status]', root);
      const ring = $('[data-req-ring]', root);
      const fill = $('[data-req-fill]', root);
      const pct = $('[data-req-pct]', root);
      const badge = $('.req__badge', root);
      const phaseEl = $('[data-req-phase]', root);
      const steps = $$('[data-req-steps] i', root);
      const side = $$('.req__logo, .req__nav', root);
      const head = $('.req__head', root);
      const stats = $$('.req__stat', root);
      const bars = $$('.req__chart i', root);
      const tiles = $$('.req__tile', root);
      const core = $('[data-req-core]', root);
      const gear = $('i', core);
      const wave = $('[data-req-wave]', root);
      const glow = $('[data-req-glow]', root);
      const scribble = $('[data-req-scribble]', root);
      const scribblePath = $('path', scribble);
      const toast = $('[data-req-toast]', root);
      const toastText = $('[data-req-toast-text]', root);
      const shine = $('[data-req-shine]', root);

      // chip positions come from the markup (--x / --y / data-r)
      const num = (el, name) => parseFloat(el.style.getPropertyValue(name)) || 0;
      const px = chips.map((c) => num(c, '--x'));
      const py = chips.map((c) => num(c, '--y'));
      const tilt = chips.map((c) => parseFloat(c.dataset.r) || 0);
      const heights = bars.map((b) => num(b, '--h') || 0.6);
      const CX = 208, CY = 247; // centre of the app (and of the core)

      // fixed "random" order in which the chips pop in and fly off (same for every loop)
      const sorted = chips.map((_, i) => i).sort((a, b) => ((a * 7919) % 101) - ((b * 7919) % 101));
      const rank = [];
      sorted.forEach((idx, pos) => { rank[idx] = pos; });
      const each = (gap) => (i) => rank[i] * gap;

      // numbers in the stat cards count up (the end value is whatever the markup says)
      const counters = $$('.req__stat b', root).map((el) => {
        const m = el.textContent.trim().match(/^([\d.]+)(.*)$/);
        return {
          el,
          end: m ? parseFloat(m[1]) : 0,
          dec: m && m[1].includes('.') ? m[1].split('.')[1].length : 0,
          suffix: m ? m[2] : '',
        };
      });
      const setCounts = (p) => counters.forEach((c) => { c.el.textContent = (c.end * p).toFixed(c.dec) + c.suffix; });
      const count = { v: 0 };

      // confetti pieces (created here so the no-JS page has none)
      const colors = ['#ff6b57', '#ffffff', '#1fb36b', '#f5c451', '#8fa4ff'];
      const N = 18;
      for (let i = 0; i < N; i++) {
        const s = document.createElement('span');
        const size = 5 + (i % 3) * 2;
        s.className = 'req__spark';
        s.style.cssText = `left:${CX}px;top:196px;width:${size}px;height:${i % 2 ? size : size * 1.6}px;background:${colors[i % colors.length]};`;
        if (i % 4 === 0) s.style.borderRadius = '50%';
        stage.appendChild(s);
        sparks.push(s);
      }
      // each piece gets its own direction (fixed, so every loop looks the same)
      const spread = (i) => ((i * 53) % 100) / 100;
      const ang = sparks.map((_, i) => ((-170 + (i / (N - 1)) * 160 + (spread(i + 5) - 0.5) * 18) * Math.PI) / 180); // a fan, upwards
      const speed = sparks.map((_, i) => 80 + spread(i + 7) * 90);
      const dx = ang.map((a, i) => Math.cos(a) * speed[i] * 1.15);
      const up = ang.map((a, i) => -Math.sin(a) * speed[i] * 0.8);
      const fall = sparks.map((_, i) => 30 + spread(i + 3) * 110);
      const spin = sparks.map((_, i) => (spread(i + 11) - 0.5) * 900);

      // phase label + step markers
      const phases = ['01 · Messy requirements', '02 · Sorting it out', '03 · Building', '04 · Shipped'];
      const setPhase = (n) => {
        phaseEl.textContent = phases[n];
        steps.forEach((s, i) => s.classList.toggle('is-on', i <= n));
        root.dataset.phase = String(n);
        gsap.fromTo(phaseEl, { y: 5, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
      };
      let lastPct = -1;
      const setPct = (v) => { if (v !== lastPct) { lastPct = v; pct.textContent = v + '%'; } };
      const reset = () => { setPct(0); setCounts(0); };

      // starting state of everything that is not the pile (the finished app is the CSS default)
      gsap.set(chips, { xPercent: -50, yPercent: -50 });
      gsap.set(sparks, { xPercent: -50, yPercent: -50, opacity: 0 });
      gsap.set(app, { opacity: 0, scale: 0.9, y: 14 });
      gsap.set(status, { opacity: 0, y: 8 });
      gsap.set(side, { opacity: 0, x: -8 });
      gsap.set(head, { opacity: 0, y: 6 });
      gsap.set(stats, { opacity: 0, y: 10 });
      gsap.set(bars, { scaleY: 0 });
      gsap.set(tiles, { opacity: 0, scale: 0 });
      gsap.set(fill, { scaleX: 0 });
      gsap.set(ring, { opacity: 0 });
      gsap.set(shine, { xPercent: -120 });
      setPhase(0);
      reset();

      // when each part of the story starts (seconds)
      const T = { merge: 3.4, wave: 5.6, app: 5.7, build: 6.3, ship: 9.5, out: 13.6 };
      const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.4 });

      // 1. the pile pops in, with a tangled scribble drawn behind it
      tl.call(setPhase, [0], 0)
        .call(reset, null, 0)
        .fromTo(scribble, { opacity: 0, scale: 1 }, { opacity: 1, duration: 0.5, ease: 'none' }, 0)
        .fromTo(scribblePath, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut' }, 0)
        .fromTo(chips,
          { x: 0, y: 0, scale: 0, opacity: 0, rotation: (i) => tilt[i] },
          { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.8)', stagger: each(0.07) }, 0.1);

      // 2. the pile is sucked into the core (x and y use different eases so the paths curve)
      tl.call(setPhase, [1], T.merge)
        .to(scribble, { scale: 0.12, opacity: 0, duration: 1.5, ease: 'power2.in', transformOrigin: '50% 49.4%' }, T.merge)
        .fromTo(core, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }, T.merge)
        .to(gear, { rotation: 540, duration: 2.2, ease: 'power1.inOut' }, T.merge)
        .to(chips, { x: (i) => CX - px[i], duration: 1.1, ease: 'power2.in', stagger: each(0.05) }, T.merge)
        .to(chips, { y: (i) => CY - py[i], duration: 1.1, ease: 'power3.inOut', stagger: each(0.05) }, T.merge)
        .to(chips, { rotation: 0, scale: 0.35, duration: 1.1, ease: 'power2.in', stagger: each(0.05) }, T.merge)
        .to(chips, { opacity: 0, duration: 0.3, ease: 'none', stagger: each(0.05) }, T.merge + 0.8)
        .to(core, { scale: 1.14, duration: 0.14, ease: 'sine.inOut', yoyo: true, repeat: 5 }, T.merge + 1.1);

      // 3. the core blows open and the app appears
      tl.to(core, { scale: 2, opacity: 0, duration: 0.45, ease: 'power2.in' }, T.wave)
        .fromTo(wave, { scale: 1, opacity: 0.9 }, { scale: 4.4, opacity: 0, duration: 0.85, ease: 'power2.out', immediateRender: false }, T.wave)
        .to(app, { opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'back.out(1.3)' }, T.app)
        .to(status, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, T.app + 0.1);

      // 4. it builds itself, with "ready" notifications and numbers counting up
      tl.call(setPhase, [2], T.build)
        .to(side, { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out', stagger: 0.07 }, T.build)
        .to(head, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, T.build + 0.2)
        .to(stats, { opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.12 }, T.build + 0.45)
        .to(count, { v: 1, duration: 1.3, ease: 'power2.out', onUpdate() { setCounts(count.v); } }, T.build + 0.45)
        .to(bars, { scaleY: (i) => heights[i], duration: 0.55, ease: 'back.out(1.4)', stagger: 0.07 }, T.build + 1)
        .to(tiles, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)', stagger: 0.09 }, T.build + 1.9)
        .to(fill, {
          scaleX: 1, duration: 3, ease: 'power1.inOut',
          onUpdate() { setPct(Math.round(this.progress() * 100)); },
        }, T.build);

      ['Login & roles ready', 'Payments connected', 'Live chat online'].forEach((text, k) => {
        const t0 = T.build + 0.5 + k * 1.05;
        tl.call(() => { toastText.textContent = text; }, null, t0)
          .fromTo(toast, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out', immediateRender: false }, t0)
          .to(toast, { y: -6, opacity: 0, duration: 0.25, ease: 'power1.in' }, t0 + 0.75);
      });

      // 5. shipped: badge pops, ring flashes, light sweeps over the app, confetti
      tl.call(setPhase, [3], T.ship)
        .fromTo(badge, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', immediateRender: false }, T.ship)
        .fromTo(ring, { opacity: 0.85, scale: 1 }, { opacity: 0, scale: 1.14, duration: 0.9, ease: 'power2.out', immediateRender: false }, T.ship)
        .fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power1.out', immediateRender: false }, T.ship)
        .fromTo(shine, { xPercent: -120, opacity: 1 }, { xPercent: 120, duration: 0.9, ease: 'power2.inOut', immediateRender: false }, T.ship)
        .to(shine, { opacity: 0, duration: 0.01 }, T.ship + 0.9)
        .fromTo(sparks, { scale: 0, opacity: 0, x: 0, y: 0, rotation: 0 }, { scale: 1, opacity: 1, duration: 0.12, ease: 'none', immediateRender: false }, T.ship)
        .to(sparks, { x: (i) => dx[i], rotation: (i) => spin[i], duration: 1.4, ease: 'power2.out' }, T.ship)
        .to(sparks, { y: (i) => -up[i], duration: 0.5, ease: 'power2.out' }, T.ship)
        .to(sparks, { y: (i) => fall[i], duration: 0.95, ease: 'power1.in' }, T.ship + 0.5)
        .to(sparks, { opacity: 0, duration: 0.5, ease: 'none' }, T.ship + 0.95);

      // 6. clear the stage, then the loop starts again with a new pile
      tl.to([app, status], { opacity: 0, duration: 0.7, ease: 'power2.in' }, T.out)
        .to(app, { scale: 0.96, y: 6, duration: 0.7, ease: 'power2.in' }, T.out)
        .to(glow, { opacity: 0, duration: 0.7, ease: 'power1.in' }, T.out);

      // desktop only: the app tilts a little towards the mouse
      if (finePointer) {
        gsap.set(app, { transformPerspective: 900 });
        const ry = gsap.quickTo(app, 'rotationY', { duration: 0.8, ease: 'power3' });
        const rx = gsap.quickTo(app, 'rotationX', { duration: 0.8, ease: 'power3' });
        panel.addEventListener('pointermove', (e) => {
          const r = panel.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 14);
          rx(-((e.clientY - r.top) / r.height - 0.5) * 12);
        });
        panel.addEventListener('pointerleave', () => { ry(0); rx(0); });
      }

      // play only while the panel is really on screen (works with the sticky layout, saves battery)
      const setActive = (on) => {
        root.classList.toggle('is-paused', !on);
        if (on) tl.play(); else tl.pause();
      };
      root.classList.add('is-paused');
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.2 }).observe(panel);
      } else {
        setActive(true);
      }
    } catch (err) {
      // never leave a half-built scene: drop everything GSAP set and show the finished app
      console.error('About scene failed, showing the finished app instead.', err);
      gsap.set($$('.req__stage *', root), { clearProps: 'transform,opacity,visibility' });
      sparks.forEach((s) => s.remove());
      $$('.req__chip, .req__scribble, .req__core, .req__wave, .req__glow, .req__toast, .req__shine', root).forEach((el) => { el.style.opacity = '0'; });
      root.dataset.phase = '3';
      const label = $('[data-req-phase]', root);
      if (label) label.textContent = '04 · Shipped';
      $$('[data-req-steps] i', root).forEach((s) => s.classList.add('is-on'));
      const p = $('[data-req-pct]', root);
      if (p) p.textContent = '100%';
    }
  }

  /* ---------- 8. Loader + hero intro ---------- */
  function prepareIntro() {
    // everything the intro animates starts hidden; the loader covers the page meanwhile
    gsap.set('.hero .line__inner', { yPercent: 115 });
    gsap.set('[data-hero-item]', { opacity: 0, y: 28 });
    gsap.set('.hero-tile', { opacity: 0 });
    gsap.set('.hero__glow', { opacity: 0 });
    gsap.set('.hero__scroll', { opacity: 0 });
    nav.classList.add('is-hidden');
  }

  function heroIntro(typed) {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

    tl.to('.hero__glow', { opacity: 1, duration: 1.8, ease: 'power2.out' }, 0)
      .add(() => nav.classList.remove('is-hidden'), 0.15)
      .to('.hero .line__inner', { yPercent: 0, duration: 1.5, stagger: 0.14 }, 0.05)
      .to('[data-hero-item]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0.45)
      .to('.hero-tile', { opacity: 1, duration: 1, stagger: 0.15, ease: 'power2.out' }, 0.9)
      .to('.hero__scroll', { opacity: 1, duration: 0.8 }, 1.2)
      .add(() => { introDone = true; typed.start(); }, 1.5);

    return tl;
  }

  function runLoader(typed) {
    const countEl = $('[data-loader-count]');
    const bar = $('[data-loader-bar]');
    const state = { v: 0 };

    const render = () => {
      countEl.textContent = Math.round(state.v);
      bar.style.transform = `scaleX(${state.v / 100})`;
    };

    // wait for fonts + window load, but never longer than 4s
    const pageReady = Promise.race([
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true })),
      ]),
      sleep(4000),
    ]);

    const exit = () => {
      const tl = gsap.timeline();
      tl.to('.loader__inner', { yPercent: -30, opacity: 0, duration: 0.6, ease: 'power3.in' })
        .to(loader, {
          yPercent: -100,
          duration: 1,
          ease: 'expo.inOut',
          onComplete: () => {
            loader.style.display = 'none';
            body.classList.remove('is-loading');
            if (lenis) lenis.start();
            ScrollTrigger.refresh();
          },
        }, '-=0.2')
        .add(heroIntro(typed), '-=0.55');
    };

    gsap.to(state, { v: 90, duration: 1.3, ease: 'power2.out', onUpdate: render });

    Promise.all([pageReady, sleep(1300)]).then(() => {
      gsap.to(state, { v: 100, duration: 0.4, ease: 'power1.out', onUpdate: render, onComplete: exit });
    });
  }

  // used when animation is off or something failed: just show the page
  function showNow() {
    if (loader) loader.style.display = 'none';
    body.classList.remove('is-loading');
    nav.classList.remove('is-hidden');
    introDone = true;
    if (hasGsap) {
      gsap.set('.line__inner, [data-hero-item], .project, .hero-tile, .hero__glow, .hero__scroll', { clearProps: 'all' });
    }
    if (lenis) lenis.start();
  }


  /* ---------- 9. Scroll animations ---------- */
  function initScrollAnimations() {
    // parallax for [data-parallax="amount"] (moves up to +/- amount px while its section passes)
    $$('[data-parallax]').forEach((el) => {
      const amp = parseFloat(el.dataset.parallax) || 0;
      ScrollTrigger.create({
        trigger: el.closest('section') || el,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          el.style.transform = `translate3d(0, ${((self.progress - 0.5) * 2 * amp).toFixed(1)}px, 0)`;
        },
      });
    });

    // project cards: one staggered entrance per row as it comes into view
    gsap.set('.project', { opacity: 0, y: 80 });
    ScrollTrigger.batch('.project', {
      start: 'top 90%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12, overwrite: true, clearProps: 'transform,opacity' }),
    });

    // floating skills pop in once
    const stage = $('[data-skills]');
    if (stage) {
      // CSS transitions on .skill__icon fight GSAP's inline transform (small -> sudden jump),
      // so they are switched off while the intro plays
      stage.classList.add('is-intro');
      gsap.from('.skill__icon', {
        scale: 0.2, opacity: 0, duration: 0.7, ease: 'back.out(1.4)',
        stagger: { each: 0.04, from: 'random' }, clearProps: 'transform,opacity',
        onComplete: () => stage.classList.remove('is-intro'),
        scrollTrigger: { trigger: stage, start: 'top 85%', once: true },
      });
      gsap.from('.skill__name', {
        opacity: 0, duration: 0.5, stagger: { each: 0.035, from: 'random' }, clearProps: 'opacity',
        scrollTrigger: { trigger: stage, start: 'top 85%', once: true },
      });
      gsap.from('.skills__core', {
        opacity: 0, duration: 0.8, clearProps: 'opacity',
        scrollTrigger: { trigger: stage, start: 'top 70%', once: true },
      });
    }

    // about visual: soft reveal
    const aboutPanel = $('.req__panel');
    if (aboutPanel) {
      gsap.from(aboutPanel, {
        clipPath: 'inset(100% 0 0 0)', duration: 1.3, ease: 'expo.out', clearProps: 'clipPath',
        scrollTrigger: { trigger: aboutPanel, start: 'top 85%', once: true },
      });
    }

    // case covers: wipe open
    $$('[data-cover]').forEach((el) => {
      const img = $('img', el);
      gsap.fromTo(el,
        { clipPath: 'inset(0 0 100% 0)' },
        {
          clipPath: 'inset(0 0 0% 0)', duration: 1.3, ease: 'expo.out', clearProps: 'clipPath',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      if (img) {
        gsap.fromTo(img,
          { scale: 1.25 },
          {
            scale: 1, duration: 1.6, ease: 'expo.out', clearProps: 'transform',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          });
      }
    });

    // counters
    $$('[data-count]').forEach((el) => {
      const end = parseFloat(el.dataset.count) || 0;
      const o = { v: 0 };
      el.textContent = '0';
      ScrollTrigger.create({
        trigger: el,
        start: 'top 92%',
        once: true,
        onEnter: () => gsap.to(o, { v: end, duration: 1.8, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v); } }),
      });
    });

    // contact: title lines, then the rest
    gsap.set('.contact__title .line__inner', { yPercent: 115 });
    gsap.set('.contact__lead, .contact__actions, .contact__channels, .contact__editor', { opacity: 0, y: 24 });
    ScrollTrigger.create({
      trigger: '.contact__panel',
      start: 'top 72%',
      once: true,
      onEnter: () => {
        gsap.to('.contact__title .line__inner', { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.12 });
        gsap.to('.contact__lead, .contact__actions, .contact__channels, .contact__editor', {
          opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.4, clearProps: 'transform,opacity',
        });
      },
    });

    // marquee gets faster while you scroll
    const track = $('[data-marquee]');
    const anim = track && track.getAnimations ? track.getAnimations()[0] : null;
    if (anim) {
      let lastY = window.scrollY;
      let boost = 0;
      window.addEventListener('scroll', () => {
        boost = Math.min(Math.abs(window.scrollY - lastY), 90);
        lastY = window.scrollY;
      }, { passive: true });
      gsap.ticker.add(() => {
        boost *= 0.92;
        if (anim.playState === 'paused') anim.play();
        anim.playbackRate = 1 + boost * 0.07;
      });
    }

    window.addEventListener('load', () => ScrollTrigger.refresh());
  }


  /* ---------- 10. Pointer effects ---------- */
  function initCursor() {
    const cursor = $('[data-cursor]');
    const label = $('[data-cursor-label]');
    if (!cursor || !finePointer) return;

    const cx = gsap.quickTo(cursor, 'x', { duration: 0.5, ease: 'power3' });
    const cy = gsap.quickTo(cursor, 'y', { duration: 0.5, ease: 'power3' });

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (!cursor.classList.contains('is-visible')) {
        gsap.set(cursor, { x: e.clientX, y: e.clientY });
        cursor.classList.add('is-visible');
      }
      cx(e.clientX);
      cy(e.clientY);
    }, { passive: true });

    // links with data-cursor-text grow the cursor and show that text
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-cursor-text]');
      if (!t) return;
      label.textContent = t.dataset.cursorText;
      cursor.classList.add('is-active');
    });
    document.addEventListener('pointerout', (e) => {
      const t = e.target.closest('[data-cursor-text]');
      if (t && !t.contains(e.relatedTarget)) cursor.classList.remove('is-active');
    });

    window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.documentElement.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
  }

  function initMagnetic() {
    if (!finePointer) return;
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });

      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.28);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  // skills drift slightly with the mouse (each at its own depth)
  function initSkillsParallax() {
    const stage = $('[data-skills]');
    if (!stage || !finePointer || window.innerWidth < 761) return;

    const items = $$('.skill', stage).map((el) => ({
      el,
      depth: el.classList.contains('skill--lg') ? 26 : el.classList.contains('skill--sm') ? 12 : 18,
      x: 0,
      y: 0,
    }));
    const core = $('.skills__core', stage);
    let tx = 0, ty = 0, cxp = 0, cyp = 0, inView = false;

    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

    ScrollTrigger.create({
      trigger: stage,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => { inView = self.isActive; },
    });

    gsap.ticker.add(() => {
      if (!inView) return;
      items.forEach((it) => {
        it.x += (tx * it.depth - it.x) * 0.07;
        it.y += (ty * it.depth - it.y) * 0.07;
        it.el.style.transform = `translate3d(${it.x.toFixed(2)}px, ${it.y.toFixed(2)}px, 0)`;
      });
      if (core) {
        cxp += (tx * -10 - cxp) * 0.05;
        cyp += (ty * -10 - cyp) * 0.05;
        core.style.transform = `translate3d(${cxp.toFixed(2)}px, ${cyp.toFixed(2)}px, 0)`;
      }
    });
  }


  /* ---------- 11. Boot ---------- */
  function boot() {
    // features that never need GSAP
    initNav();
    initAnchors();
    initCases();
    initSmallUi();
    initEditor(); // types by itself, does not need GSAP
    initAboutScene(); // about visual: scales the stage; animates only if GSAP + motion are allowed

    if (!animate) {
      showNow();
      return;
    }

    try {
      const typed = createTyped();
      initSmoothScroll();
      prepareIntro();
      initScrollAnimations();
      initCursor();
      initMagnetic();
      initSkillsParallax();
      runLoader(typed);

      // safety net: the loader must never get stuck
      setTimeout(() => {
        if (body.classList.contains('is-loading')) showNow();
      }, 9000);
    } catch (err) {
      console.error('Portfolio animations failed, showing the plain page.', err);
      showNow();
    }
  }

  boot();
})();
