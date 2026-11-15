(() => {
  const mv = document.getElementById('mv');
  const body = document.body;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Camera views (orbit = theta phi radius, target = x y z in model metres).
  const VIEWS = {
    hero:     matchMedia('(max-width: 900px)').matches ? {orbit: '-30deg 60deg 400m', target: '10m -95m 30m'} : {orbit: '-30deg 58deg 230m', target: '10m 4m 0m'},
    concept:  {orbit: '-35deg 52deg 270m', target: '10m 6m 0m'},
    entrance: {orbit: '60deg 84deg 15m',   target: '35m 5m 6m'},
    street:   {orbit: '0deg 86deg 40m',    target: '45m 3m 2m'},
    zones:    {orbit: '-15deg 30deg 270m', target: '0m 8m 0m'},
    drawings: {orbit: '0deg 82deg 270m',   target: '18m 8m 0m'},
    about:    {orbit: '150deg 55deg 290m', target: '10m 4m 0m'}
  };
  let currentView = 'hero';
  let lastUserMove = 0;

  function go(name) {
    const v = VIEWS[name];
    if (!v || !mv) return;
    currentView = name;
    // auto-rotate turns the model itself; undo that so the named views line up.
    if (name !== 'hero' && typeof mv.resetTurntableRotation === 'function') mv.resetTurntableRotation(0);
    mv.cameraTarget = v.target;
    mv.cameraOrbit = v.orbit;
    if (reduceMotion) mv.jumpCameraToGoal();
    document.querySelectorAll('.view-chips button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.go === name)));
  }

  if (mv) {
    if (reduceMotion) mv.removeAttribute('auto-rotate');
    mv.cameraOrbit = VIEWS.hero.orbit; mv.cameraTarget = VIEWS.hero.target;
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loader-text');
    mv.addEventListener('progress', e => {
      const p = Math.round((e.detail.totalProgress || 0) * 100);
      loaderText.textContent = `Loading the 3D market… ${p}%`;
    });
    mv.addEventListener('load', () => { loader.classList.add('done'); });
    mv.addEventListener('error', () => {
      loaderText.textContent = 'The 3D model could not load. Try refreshing, or take the 360° tour instead.';
      loader.querySelector('.loader-ring').hidden = true;
    });
    mv.addEventListener('camera-change', e => { if (e.detail.source === 'user-interaction') lastUserMove = Date.now(); });
  }

  // Buttons and hotspots that fly the camera.
  document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => {
    const name = btn.dataset.go;
    go(name);
    if (btn.classList.contains('hotspot')) {
      const target = document.getElementById(name);
      if (target) target.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth'});
    }
  }));

  // Landing page vs docked story.
  function updateDock() {
    const atHero = window.scrollY < window.innerHeight * 0.45;
    if (atHero === body.classList.contains('at-hero')) return;
    body.classList.toggle('at-hero', atHero);
    if (!mv) return;
    if (atHero) {
      if (!reduceMotion) mv.setAttribute('auto-rotate', '');
      go('hero');
    } else {
      mv.removeAttribute('auto-rotate');
      if (currentView === 'hero') go('concept');
    }
  }
  addEventListener('scroll', updateDock, {passive: true});
  addEventListener('resize', updateDock);
  updateDock();

  // Fly to each chapter's view as it reaches the middle of the screen.
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || body.classList.contains('at-hero')) return;
      const name = entry.target.dataset.view;
      // Don't yank the camera away while someone is actively orbiting.
      if (Date.now() - lastUserMove < 2500) return;
      if (name !== currentView) go(name);
    });
  }, {rootMargin: matchMedia('(max-width: 900px)').matches ? '-62% 0px -30% 0px' : '-45% 0px -45% 0px'});
  document.querySelectorAll('.chapter[data-view]').forEach(c => io.observe(c));

  // Market zones (same five places as the walkthrough and 360° tour).
  const ZONES = [
    {id: 'entrance', name: 'Market Entrance', img: 'assets/renders/entrance.webp', c: '#ff6a1a', alt: 'Render of the main frontage from the street, with terraces, planters and the hawker street beyond'},
    {id: 'produce', name: 'Fresh Produce Street', img: 'assets/renders/produce.webp', c: '#ffd23f', alt: 'Render of the hawker street with produce stalls, push-carts, umbrellas and bunting'},
    {id: 'plaza', name: 'Central Atrium', img: 'assets/renders/plaza.webp', c: '#4fd69c', alt: 'Render inside the market looking into the octagonal atrium'},
    {id: 'textiles', name: 'Textile & Retail Street', img: 'assets/renders/textiles.webp', c: '#d9c8ff', alt: 'Render of the shophouses with open shopfronts, awnings and balconies'},
    {id: 'roof', name: 'Roof & Skyline', img: 'assets/renders/roof.webp', c: '#4a8dff', alt: 'Aerial render of the market roof and the hawker street alongside'}
  ];
  const grid = document.getElementById('zone-grid');
  if (grid) {
    ZONES.forEach((z, i) => {
      const a = document.createElement('a');
      a.className = 'zone';
      a.href = `tour.html?zone=${z.id}&view=walkthrough`;
      a.style.setProperty('--c', z.c);
      a.innerHTML = `<img src="${z.img}" width="1280" height="720" loading="lazy" alt="${z.alt}"><span><small>Zone ${String(i + 1).padStart(2, '0')}</small><br>${z.name}</span>`;
      grid.appendChild(a);
    });
  }

  // Drawing lightbox.
  const dialog = document.getElementById('drawing-dialog');
  const img = document.getElementById('drawing-img');
  document.querySelectorAll('.drawing-open').forEach(btn => btn.addEventListener('click', () => {
    img.classList.remove('zoomed');
    img.src = btn.dataset.src;
    img.alt = `${btn.dataset.title} at full size`;
    document.getElementById('drawing-title').textContent = btn.dataset.title;
    dialog.showModal();
  }));
  img.addEventListener('click', () => img.classList.toggle('zoomed'));
  document.getElementById('drawing-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
})();
