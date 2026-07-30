(() => {
  "use strict";

  /* ---------- loading overlay ---------- */
  const loadingOverlay = document.getElementById('loading-overlay');
  window.addEventListener('load', () => {
    setTimeout(() => loadingOverlay.classList.add('is-loaded'), 400);
  });

  /* ---------- nav scroll state ---------- */
  const nav = document.getElementById('mainNav');
  const onNavScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onNavScroll, { passive: true });
  onNavScroll();

  /* ---------- mobile menu ---------- */
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const closeMobileMenu = () => mobileMenu.classList.remove('is-open');
  menuToggle.addEventListener('click', () => mobileMenu.classList.toggle('is-open'));
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileMenu));

  /* ---------- cursor follower (fine-pointer only) ---------- */
  if (window.matchMedia('(pointer: fine)').matches) {
    const dot = document.getElementById('cursorDot');
    const ring = document.getElementById('cursorRing');
    const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { x: mouse.x, y: mouse.y };
    window.addEventListener('mousemove', e => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      dot.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0) translate(-50%,-50%)`;
    });
    const tick = () => {
      ringPos.x += (mouse.x - ringPos.x) * 0.15;
      ringPos.y += (mouse.y - ringPos.y) * 0.15;
      ring.style.transform = `translate3d(${ringPos.x}px,${ringPos.y}px,0) translate(-50%,-50%)`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

  /* ---------- gallery parallax ---------- */
  const parallaxItems = Array.from(document.querySelectorAll('.parallax')).map(el => ({
    el, factor: parseFloat(el.dataset.factor) || 0.1
  }));
  const onParallaxScroll = () => {
    parallaxItems.forEach(item => {
      const rect = item.el.getBoundingClientRect();
      const offset = (rect.top - innerHeight / 2) * item.factor;
      item.el.style.transform = `translate3d(0,${offset.toFixed(1)}px,0)`;
    });
  };
  window.addEventListener('scroll', onParallaxScroll, { passive: true });
  onParallaxScroll();

  /* ---------- destaque card tilt ---------- */
  document.querySelectorAll('.tilt-card').forEach(card => {
    const img = card.querySelector('.ph-img');
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 8).toFixed(2)}deg) translateY(-6px) scale(1.02)`;
      if (img) img.style.transform = `scale(1.08) translate(${(px * 8).toFixed(1)}px,${(py * 8).toFixed(1)}px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateY(0) scale(1)';
      if (img) img.style.transform = 'scale(1) translate(0,0)';
    });
  });

  /* ---------- scroll-scrubbed hero video ----------
     The hero is wrapped in a tall spacer (.hero-spacer) with a sticky
     inner section (.hero-sticky). While the spacer scrolls under the
     viewport, the hero visually stays pinned full-screen; scroll
     position within that range is mapped 1:1 to video.currentTime, so
     scrolling down advances the video and scrolling up reverses it.
     Once the spacer's range is exhausted the sticky section releases
     and the page scrolls on normally into the next section. */
  const heroSpacer = document.getElementById('heroSpacer');
  const heroVideo = document.getElementById('heroVideo');

  heroVideo.muted = true;
  heroVideo.controls = false;
  heroVideo.removeAttribute('controls');

  let duration = 0;
  let rafQueued = false;

  const getRange = () => {
    const rect = heroSpacer.getBoundingClientRect();
    const spacerTop = rect.top + window.scrollY;
    const range = heroSpacer.offsetHeight - window.innerHeight;
    return { spacerTop, range: Math.max(range, 1) };
  };

  const applyScrub = () => {
    rafQueued = false;
    if (!duration) return;
    const { spacerTop, range } = getRange();
    const progress = Math.min(Math.max((window.scrollY - spacerTop) / range, 0), 1);
    const target = progress * duration;
    if (Math.abs(heroVideo.currentTime - target) > 0.01) {
      heroVideo.currentTime = target;
    }
  };

  const requestScrub = () => {
    if (!rafQueued) {
      rafQueued = true;
      requestAnimationFrame(applyScrub);
    }
  };

  const initScrub = () => {
    duration = heroVideo.duration || 0;
    applyScrub();
  };

  if (heroVideo.readyState >= 1) {
    initScrub();
  } else {
    heroVideo.addEventListener('loadedmetadata', initScrub, { once: true });
  }

  window.addEventListener('scroll', requestScrub, { passive: true });
  window.addEventListener('resize', requestScrub);

  /* fade out the scroll cue once the hero starts advancing */
  const scrollCue = document.getElementById('scrollCue');
  window.addEventListener('scroll', () => {
    scrollCue.style.opacity = window.scrollY > 20 ? '0' : '1';
  }, { passive: true });

})();
