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

  /* Some mobile browsers will resume real playback on their own during
     rapid programmatic seeking (buffer catch-up, tap-to-play gestures
     slipping through, autoplay heuristics). The video must only ever
     move via scroll, so any spontaneous 'play' is reverted instantly. */
  heroVideo.addEventListener('play', () => {
    if (!scrubbing) heroVideo.pause();
  });

  /* iOS in particular needs the decoder "unlocked" with one real
     play/pause cycle before currentTime scrubbing renders smoothly;
     skipping this is a common cause of stutter on first scroll. Muted
     playback is allowed without a user gesture, so this can run as
     soon as metadata is ready. */
  let scrubbing = false;
  const unlockDecoder = () => {
    scrubbing = true;
    const p = heroVideo.play();
    if (p && p.catch) p.catch(() => {});
    heroVideo.pause();
    scrubbing = false;
  };

  let duration = 0;
  let rafQueued = false;
  let pendingSeek = false;

  /* Mobile browsers resize the visual viewport as the address bar
     hides/shows while scrolling, firing spurious resize/scroll events.
     Reacting to every one of those made the scrub range jump mid-scroll.
     Viewport height is cached and only refreshed on real resizes
     (orientation change, devtools, etc.), debounced so address-bar
     animation frames don't trigger a refresh. */
  let viewportHeight = window.innerHeight;
  let resizeDebounce = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      viewportHeight = window.innerHeight;
      requestScrub();
    }, 150);
  });

  const getRange = () => {
    const rect = heroSpacer.getBoundingClientRect();
    const spacerTop = rect.top + window.scrollY;
    const range = heroSpacer.offsetHeight - viewportHeight;
    return { spacerTop, range: Math.max(range, 1) };
  };

  let lastTarget = 0;

  const seekTo = target => {
    lastTarget = target;
    /* A seek already in flight is left to finish rather than piling a
       second one on top of it -- on weaker mobile decoders that queueing
       is what turns a smooth scrub into visible stutter. The 'seeked'
       handler below re-checks lastTarget once it's free. */
    if (heroVideo.seeking) { pendingSeek = true; return; }
    scrubbing = true;
    if (typeof heroVideo.fastSeek === 'function') {
      heroVideo.fastSeek(target);
    } else {
      heroVideo.currentTime = target;
    }
    scrubbing = false;
  };

  heroVideo.addEventListener('seeked', () => {
    if (pendingSeek) {
      pendingSeek = false;
      if (Math.abs(heroVideo.currentTime - lastTarget) > 0.01) seekTo(lastTarget);
    }
  });

  const applyScrub = () => {
    rafQueued = false;
    if (!duration) return;
    const { spacerTop, range } = getRange();
    const progress = Math.min(Math.max((window.scrollY - spacerTop) / range, 0), 1);
    const target = progress * duration;
    if (Math.abs(heroVideo.currentTime - target) > 0.01) {
      seekTo(target);
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
    unlockDecoder();
    applyScrub();
  };

  if (heroVideo.readyState >= 1) {
    initScrub();
  } else {
    heroVideo.addEventListener('loadedmetadata', initScrub, { once: true });
  }

  window.addEventListener('scroll', requestScrub, { passive: true });

  /* fade out the scroll cue once the hero starts advancing */
  const scrollCue = document.getElementById('scrollCue');
  window.addEventListener('scroll', () => {
    scrollCue.style.opacity = window.scrollY > 20 ? '0' : '1';
  }, { passive: true });

})();
