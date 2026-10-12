// landing-fx.js — interactive layer for 0 Лендинг.html
// Product intent: every effect shows the product working (live activity, seats filling,
// numbers counting), background motion stays behind content and pauses off-screen.
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- styles ----------
  const st = document.createElement('style');
  st.textContent = `
  .fx-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block}
  .fx-progress{position:fixed;top:0;left:0;right:0;height:3px;background:var(--vt-orange);z-index:60;transform-origin:0 50%;transform:scaleX(0)}
  .nav{transition:box-shadow .3s}.nav.scrolled{box-shadow:0 10px 30px -18px rgba(21,22,26,.35)}
  .nav-links a{position:relative}.nav-links a.on{color:var(--vt-ink)}
  .nav-links a.on:after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;border-radius:2px;background:var(--vt-orange)}
  .rv{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .8s cubic-bezier(.2,.7,.2,1)}
  .rv.in{opacity:1;transform:none}
  .hero-vis .phone{z-index:2;will-change:transform}
  .float{transition:opacity .35s ease,transform .35s ease}.float .txt{transition:opacity .3s}
  .float.swap .txt{opacity:0}
  .bt{transition:transform .35s cubic-bezier(.2,.7,.2,1),box-shadow .35s}
  .bt>*{position:relative;z-index:1}
  .bt:after{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .35s;
    background:radial-gradient(380px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.75),transparent 62%)}
  .bt--blue:after,.bt--ink:after{background:radial-gradient(380px circle at var(--mx,50%) var(--my,50%),rgba(255,255,255,.16),transparent 62%)}
  .bt--raised:after{background:radial-gradient(380px circle at var(--mx,50%) var(--my,50%),rgba(21,22,26,.05),transparent 62%)}
  @media (pointer:fine){.bt:hover{transform:translateY(-5px)}.bt:hover:after{opacity:1}}
  .seg i{transition:background .3s ease}
  .btn--orange{will-change:transform}
  .step .N{display:inline-block;transition:transform .5s cubic-bezier(.2,.7,.2,1)}
  @media (pointer:fine){.step:hover .N{transform:translateX(8px)}}
  .pc{transition:transform .35s cubic-bezier(.2,.7,.2,1)}
  @media (pointer:fine){.pc:hover{transform:translateY(-6px)}}
  `;
  document.head.appendChild(st);

  // ---------- particle field ----------
  // Dots drift like players on a court; lines connect neighbours; the cursor pulls
  // nearby dots into a "huddle" and links them to the pointer.
  function Field(host, { density = 9000, colors, link = 110, max = 110 } = {}) {
    const cv = document.createElement('canvas');
    cv.className = 'fx-canvas';
    const anchor = $$(':scope > .orb, :scope > .orb2', host).pop();
    anchor ? anchor.after(cv) : host.prepend(cv);
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, P = [], run = !RM, visible = true;
    const m = { x: -9999, y: -9999, on: false };

    const seed = () => {
      const n = Math.max(24, Math.min(max, Math.round(W * H / density)));
      P = Array.from({ length: n }, (_, i) => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35,
        r: Math.random() * 1.6 + .8,
        c: colors[i % 7 === 0 ? 1 : 0],
      }));
    };
    const size = () => {
      const r = host.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      seed(); if (!run) draw();
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        for (let j = i + 1; j < P.length; j++) {
          const b = P[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < link * link) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - Math.sqrt(d) / link) * .18})`;
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (m.on) {
          const dx = a.x - m.x, dy = a.y - m.y, d = Math.sqrt(dx * dx + dy * dy);
          if (d < 160) {
            ctx.strokeStyle = `rgba(255,107,31,${(1 - d / 160) * .55})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(m.x, m.y); ctx.stroke();
          }
        }
        ctx.fillStyle = a.c; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
      }
    };
    const step = () => {
      for (const a of P) {
        if (m.on) {
          const dx = m.x - a.x, dy = m.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (d < 160 && d > 40) { a.vx += dx / d * .03; a.vy += dy / d * .03; }
          else if (d <= 40) { a.vx -= dx / d * .09; a.vy -= dy / d * .09; }
        }
        a.vx *= .985; a.vy *= .985;
        const sp = Math.hypot(a.vx, a.vy);
        if (sp < .12) { a.vx += (Math.random() - .5) * .04; a.vy += (Math.random() - .5) * .04; }
        a.x += a.vx; a.y += a.vy;
        if (a.x < -10) a.x = W + 10; if (a.x > W + 10) a.x = -10;
        if (a.y < -10) a.y = H + 10; if (a.y > H + 10) a.y = -10;
      }
    };
    const loop = () => { if (run && visible) { step(); draw(); } requestAnimationFrame(loop); };

    new ResizeObserver(size).observe(host);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
    host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(); m.x = e.clientX - r.left; m.y = e.clientY - r.top; m.on = true; });
    host.addEventListener('pointerleave', () => { m.on = false; });
    size(); if (run) requestAnimationFrame(loop);
  }

  const heroVis = $('.hero-vis'), finalBox = $('.final');
  if (heroVis) Field(heroVis, { colors: ['rgba(255,255,255,.7)', '#FF6B1F'], density: 8200 });
  if (finalBox) Field(finalBox, { colors: ['rgba(255,255,255,.6)', '#FFB38A'], density: 11000, link: 120, max: 80 });

  // ---------- scroll progress + nav state ----------
  const bar = document.createElement('div'); bar.className = 'fx-progress'; document.body.appendChild(bar);
  const nav = $('.nav');
  const links = $$('.nav-links a');
  const ids = links.map(a => a.getAttribute('href').slice(1));
  const secIO = new IntersectionObserver((es) => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ids.forEach(id => { const s = document.getElementById(id); if (s) secIO.observe(s); });

  // ---------- reveal on scroll (staggered per group) ----------
  const groups = ['.hero-copy > *', '.sec-h', '.ba > *', '.bento > .bt', '.steps > .step', '.aud > *', '.price > .pc', '.price-note', '.faq > div:first-child', '.faq details', '.final'];
  groups.forEach(g => $$(g).forEach((el, i) => {
    el.classList.add('rv'); el.style.transitionDelay = `${Math.min(i, 6) * 80}ms`;
  }));
  if (RM) $$('.rv').forEach(el => el.classList.add('in'));
  else {
    const rvIO = new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); rvIO.unobserve(e.target); onReveal(e.target); }
    }), { threshold: .15 });
    $$('.rv').forEach(el => rvIO.observe(el));
  }

  // ---------- count-ups & seat fills — product moments ----------
  const countUp = (el, to, dur = 1100) => {
    const suffix = el.innerHTML.replace(/^\s*\d+/, '');
    const t0 = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.innerHTML = Math.round(to * e) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const fillSeg = (seg) => {
    const cells = $$('i', seg);
    const colors = cells.map(c => c.style.background);
    cells.forEach(c => { c.dataset.full = c.style.background; c.style.background = ''; });
    cells.forEach((c, i) => setTimeout(() => { if (c.dataset.full) c.style.background = c.dataset.full; }, 60 * i + 150));
    return colors;
  };
  function onReveal(el) {
    $$('.seg', el).forEach(fillSeg);
    $$('.pc .N.big, .bt--blue .vis .N:first-child, .card-ev .N', el).forEach(n => {
      const v = parseInt(n.textContent, 10); if (!isNaN(v)) countUp(n, v);
    });
  }
  if (!RM) $$('.hero-vis .seg').forEach(s => setTimeout(() => fillSeg(s), 500));

  // ---------- live activity in the hero ----------
  const feeds = {
    f1: [['Никита записался', 'осталось 2 места'], ['Маша записала +1', 'занято 13 из 14'], ['Лера оплатила', '+15,00 Br в кассу']],
    f2: [['Освободилось место', 'Денис получил приглашение'], ['Напоминание отправлено', '12 игрокам · за 2 часа'], ['Сбор на мячи', 'собрано 175 из 250 Br']],
  };
  Object.entries(feeds).forEach(([k, list], fi) => {
    const f = $(`.float.${k}`); if (!f) return;
    const txt = f.lastElementChild; txt.classList.add('txt');
    let i = 0;
    setInterval(() => {
      if (RM || document.hidden) return;
      f.classList.add('swap');
      setTimeout(() => { i = (i + 1) % list.length; txt.innerHTML = `${list[i][0]}<small>${list[i][1]}</small>`; f.classList.remove('swap'); }, 320);
    }, 3600 + fi * 900);
  });

  // ---------- cursor parallax + scroll drift (single rAF) ----------
  const layers = heroVis ? [
    [$('.ph1', heroVis), -14, -10, .06],
    [$('.ph2', heroVis), 18, 12, -.08],
    [$('.float.f1', heroVis), 26, 16, .12],
    [$('.float.f2', heroVis), -22, 14, -.1],
    [$('.orb', heroVis), 30, 24, .18],
  ].filter(l => l[0]) : [];
  layers.forEach(([el]) => { el.dataset.base = getComputedStyle(el).transform === 'none' ? '' : getComputedStyle(el).transform; });
  const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  if (heroVis && FINE && !RM) {
    heroVis.addEventListener('pointermove', (e) => {
      const r = heroVis.getBoundingClientRect();
      tgt.x = (e.clientX - r.left) / r.width * 2 - 1; tgt.y = (e.clientY - r.top) / r.height * 2 - 1;
    });
    heroVis.addEventListener('pointerleave', () => { tgt.x = 0; tgt.y = 0; });
  }

  // marquee reacts to scroll velocity and direction
  const mq = $('.marq-in'); let mqX = 0, lastY = scrollY, vel = 0, dir = 1;
  if (mq && !RM) mq.style.animation = 'none';

  const frame = () => {
    const y = scrollY, dy = y - lastY; lastY = y;
    vel += (Math.abs(dy) - vel) * .12; if (dy) dir = dy > 0 ? 1 : -1;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav && nav.classList.toggle('scrolled', y > 8);

    if (!RM) {
      cur.x += (tgt.x - cur.x) * .08; cur.y += (tgt.y - cur.y) * .08;
      const sy = Math.min(y, 900);
      layers.forEach(([el, ax, ay, sc]) => {
        el.style.transform = `${el.dataset.base} translate(${cur.x * ax}px, ${cur.y * ay - sy * sc}px)`;
      });
      if (mq) {
        const half = mq.scrollWidth / 2;
        mqX -= (.6 + Math.min(vel, 40) * .35) * dir;
        if (mqX < -half) mqX += half; if (mqX > 0) mqX -= half;
        mq.style.transform = `translateX(${mqX}px)`;
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // ---------- spotlight on bento tiles ----------
  if (FINE) $$('.bt').forEach(t => t.addEventListener('pointermove', (e) => {
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));

  // ---------- magnetic primary CTAs ----------
  if (FINE && !RM) $$('.btn--orange').forEach(b => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      b.style.transform = `translate(${dx * .18}px, ${dy * .3}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transition = 'transform .4s cubic-bezier(.2,.7,.2,1)'; b.style.transform = ''; setTimeout(() => b.style.transition = '', 400); });
  });
})();
