/* Poorna Market: first-person / WebXR walk through the 3D model. */
(() => {
  // Floor height (m), position, and which way to face (yaw in degrees; 0 = north / -z).
  const SPOTS = [
    {id: 'street', name: 'Hawker street', pos: [41.5, 0.15, 45], yaw: 0},
    {id: 'entrance', name: 'Side entrance', pos: [48.5, 0.15, 6], yaw: 90},
    {id: 'shops', name: 'Shopfronts', pos: [48, 0.15, -18], yaw: -90},
    {id: 'front', name: 'Main frontage', pos: [22, 0.15, 56], yaw: 0},
    {id: 'atrium', name: 'Atrium', pos: [-14, 3.4, -6], yaw: -90},
    {id: 'roof', name: 'Roof', pos: [2, 17.1, 26], yaw: 0}
  ];
  const INFOS = [
    {pos: [36.4, 10.2, 6], kicker: 'Side entrance', title: 'A gateway onto the street', body: 'Brick piers, a woven shade canopy and a marigold toran open the market onto the hawker street. The forecourt is a place to arrive, meet and spill out.'},
    {pos: [45, 4.2, -26], kicker: 'Hawker street', title: 'The street as a bazaar', body: 'Produce stalls line the market edge, push-carts sit in the middle and festival bunting ties the street together. Illustrative context, not a survey.'},
    {pos: [55, 5.6, 4], kicker: 'Shopfronts', title: 'Open fronts, layered facades', body: 'The shophouses keep open ground floors, signboards, awnings and balconies, so the street stays lively on both sides.'},
    {pos: [-2, 19.5, -6], kicker: 'Atrium', title: 'A breathing core', body: 'The octagonal atrium cuts through every floor, letting light and air move down into the market.'},
    {pos: [14, 7, 44], kicker: 'Main frontage', title: 'The city-facing edge', body: 'Stepped terraces with planters and a patterned brick screen face the main road.'}
  ];
  const $ = id => document.getElementById(id);
  const scene = $('scene'), rig = $('rig'), cam = $('cam'), market = $('market');
  const isTouch = matchMedia('(pointer: coarse)').matches;
  document.body.classList.add(isTouch ? 'is-touch' : 'is-desk');

  // ---- graph-paper ground ----
  function gridTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#c9d3e3'; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    return c;
  }

  // ---- walking (keyboard is handled by wasd-controls; this adds thumbsticks + on-screen arrows) ----
  AFRAME.registerComponent('walker', {
    init() {
      this.axis = {x: 0, y: 0};
      this.dom = {x: 0, y: 0};
      this.turnReady = true;
      this.v = new THREE.Vector3();
      const left = $('left-hand'), right = $('right-hand');
      left.addEventListener('thumbstickmoved', e => { this.axis.x = e.detail.x; this.axis.y = e.detail.y; });
      right.addEventListener('thumbstickmoved', e => {
        if (Math.abs(e.detail.x) > 0.7 && this.turnReady) { this.el.object3D.rotation.y -= Math.sign(e.detail.x) * Math.PI / 6; this.turnReady = false; }
        if (Math.abs(e.detail.x) < 0.3) this.turnReady = true;
      });
    },
    tick(t, dt) {
      const x = this.axis.x + this.dom.x, y = this.axis.y + this.dom.y;
      if (Math.abs(x) < 0.15 && Math.abs(y) < 0.15) return;
      const speed = 3.2 * dt / 1000;
      cam.object3D.getWorldDirection(this.v); // camera looks down -z, so this points backwards
      this.v.y = 0; this.v.normalize();
      const fx = -this.v.x, fz = -this.v.z;         // forward
      const rx = -fz, rz = fx;                       // right
      const p = this.el.object3D.position;
      p.x += (fx * -y + rx * x) * speed;
      p.z += (fz * -y + rz * x) * speed;
    }
  });

  function teleport(spot) {
    const [x, y, z] = spot.pos;
    rig.object3D.position.set(x, y, z);
    rig.object3D.rotation.y = THREE.MathUtils.degToRad(spot.yaw);
    const lc = cam.components['look-controls'];
    if (lc && lc.yawObject) { lc.yawObject.rotation.y = 0; lc.pitchObject.rotation.x = 0; }
    if (!scene.is('vr-mode')) cam.object3D.position.set(0, 1.6, 0); else cam.object3D.position.x = cam.object3D.position.z = 0;
    document.querySelectorAll('.spots button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.spot === spot.id)));
    history.replaceState(null, '', `?spot=${spot.id}`);
  }

  function showInfo(info) {
    $('info-kicker').textContent = info.kicker;
    $('info-title').textContent = info.title;
    $('info-body').textContent = info.body;
    $('info').hidden = false;
    // In a headset there is no DOM, so float a card in front of the viewer.
    if (scene.is('vr-mode')) {
      const card = $('card');
      card.innerHTML = '';
      const camPos = new THREE.Vector3(), dir = new THREE.Vector3();
      cam.object3D.getWorldPosition(camPos); cam.object3D.getWorldDirection(dir); dir.y = 0; dir.normalize();
      card.object3D.position.set(camPos.x - dir.x * 2.2, camPos.y - 0.1, camPos.z - dir.z * 2.2);
      card.object3D.lookAt(camPos.x, camPos.y - 0.1, camPos.z);
      card.innerHTML = `
        <a-plane class="clickable" width="1.86" height="1.06" position="0 0 -0.005" material="shader: flat; color: #111"></a-plane>
        <a-plane class="clickable" width="1.8" height="1" material="shader: flat; color: #fbfaf6"></a-plane>
        <a-plane width="1.8" height="0.16" position="0 0.42 0.002" material="shader: flat; color: #e8684a"></a-plane>
        <a-text value="${info.kicker.toUpperCase()}" color="#111" width="1.6" position="-0.82 0.42 0.004"></a-text>
        <a-text value="${info.title}" color="#111" width="2.6" position="-0.82 0.22 0.004" wrap-count="34"></a-text>
        <a-text value="${info.body}" color="#333" width="1.7" position="-0.82 -0.12 0.004" wrap-count="52"></a-text>
        <a-text value="(click card to close)" color="#888" width="1.2" position="-0.82 -0.44 0.004"></a-text>`;
      card.setAttribute('visible', true);
      card.querySelectorAll('.clickable').forEach(p => p.addEventListener('click', () => { card.setAttribute('visible', false); card.innerHTML = ''; }));
    }
  }
  $('info-close').addEventListener('click', () => { $('info').hidden = true; });

  function build() {
    const ground = $('grid-ground');
    const tex = new THREE.CanvasTexture(gridTexture());
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(56, 56); tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = ground.getObject3D('mesh');
    if (mesh) { mesh.material.map = tex; mesh.material.needsUpdate = true; }

    // Teleport pads: coral rings on the floor with a label.
    const pads = $('pads');
    SPOTS.forEach(s => {
      const e = document.createElement('a-entity');
      e.setAttribute('position', `${s.pos[0]} ${s.pos[1] + 0.06} ${s.pos[2]}`);
      e.innerHTML = `
        <a-ring class="clickable" radius-inner="0.55" radius-outer="0.95" rotation="-90 0 0" material="shader: flat; color: #e8684a; side: double"></a-ring>
        <a-circle class="clickable" radius="0.55" rotation="-90 0 0" position="0 0.005 0" material="shader: flat; color: #111; opacity: 0.85; transparent: true"></a-circle>
        <a-entity position="0 2.4 0" look-at-camera>
          <a-plane width="${0.32 + s.name.length * 0.19}" height="0.5" material="shader: flat; color: #111"></a-plane>
          <a-text value="${s.name}" align="center" color="#fbfaf6" width="5" position="0 0 0.01"></a-text>
        </a-entity>`;
      e.querySelectorAll('.clickable').forEach(c => c.addEventListener('click', () => teleport(s)));
      pads.appendChild(e);
    });

    // Info points: coral "i" markers.
    const infos = $('infos');
    INFOS.forEach(info => {
      const e = document.createElement('a-entity');
      e.setAttribute('position', info.pos.join(' '));
      e.setAttribute('look-at-camera', '');
      e.innerHTML = `
        <a-circle class="clickable" radius="0.62" material="shader: flat; color: #111"></a-circle>
        <a-circle class="clickable" radius="0.5" position="0 0 0.01" material="shader: flat; color: #e8684a"
          animation="property: scale; from: 1 1 1; to: 1.15 1.15 1.15; dir: alternate; loop: true; dur: 1100; easing: easeInOutSine"></a-circle>
        <a-text value="i" align="center" color="#fff" width="8" position="0 0.04 0.02"></a-text>`;
      e.querySelectorAll('.clickable').forEach(c => c.addEventListener('click', () => showInfo(info)));
      infos.appendChild(e);
    });

    // DOM spot buttons.
    const nav = $('spots');
    SPOTS.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = `key key-${['orange', 'lav', 'purple', 'green', 'blue', 'yellow'][i % 6]}`;
      b.dataset.spot = s.id; b.textContent = s.name;
      b.addEventListener('click', () => teleport(s));
      nav.appendChild(b);
    });
    const start = SPOTS.find(s => s.id === new URLSearchParams(location.search).get('spot')) || SPOTS[0];
    teleport(start);
  }

  // Billboard labels toward the viewer (yaw only).
  AFRAME.registerComponent('look-at-camera', {
    tick() {
      const p = new THREE.Vector3(); cam.object3D.getWorldPosition(p);
      const o = this.el.object3D; const w = new THREE.Vector3(); o.getWorldPosition(w);
      o.rotation.y = Math.atan2(p.x - w.x, p.z - w.z);
    }
  });

  // On-screen arrows: hold to walk.
  document.querySelectorAll('#dpad [data-move]').forEach(btn => {
    const [x, y] = btn.dataset.move.split(',').map(Number);
    const start = e => { e.preventDefault(); const w = rig.components.walker; w.dom.x = x; w.dom.y = y; btn.classList.add('down'); };
    const stop = () => { const w = rig.components.walker; w.dom.x = 0; w.dom.y = 0; btn.classList.remove('down'); };
    btn.addEventListener('pointerdown', start); btn.addEventListener('pointerup', stop); btn.addEventListener('pointerleave', stop); btn.addEventListener('pointercancel', stop);
  });

  // Enter VR (WebXR). Hide the button when no headset/browser support.
  const vrBtn = $('enter-vr');
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then(ok => { if (!ok) { vrBtn.textContent = 'VR: headset only'; vrBtn.disabled = true; } }).catch(() => {});
  } else { vrBtn.textContent = 'VR: headset only'; vrBtn.disabled = true; }
  setTimeout(() => $('help').classList.add('faded'), 9000);
  vrBtn.addEventListener('click', () => scene.enterVR());
  scene.addEventListener('enter-vr', () => document.body.classList.add('in-vr'));
  scene.addEventListener('exit-vr', () => document.body.classList.remove('in-vr'));

  market.addEventListener('model-loaded', () => { $('loading').classList.add('done'); });
  market.addEventListener('model-error', () => { $('loading-text').textContent = 'The model could not load. Please refresh.'; });
  if (scene.hasLoaded) build(); else scene.addEventListener('loaded', build);
})();
