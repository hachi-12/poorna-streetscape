/* Wide proposal renders are bounded views, never presented as 360° photographs. */
window.initMarketVr = function ({PLACES, setState, getCurrent}) {
  const $ = id => document.getElementById(id);
  const shell = $("vr-shell"), stage = $("tour-stage"), frame = $("tour-image-frame");
  const image = $("tour-image"), markerLayer = $("tour-markers"), scene = $("vr-scene");
  const gallery = $("vr-gallery"), nav = $("vr-places"), planPoints = $("tour-plan-points");
  const toast = $("vr-toast"), info = $("tour-info");
  let active = getCurrent(), detail = false, loadingToken = 0, returnFocus = null;
  let currentVrImage = null, vrImageToken = 0, pan = 0.5, dragging = false, dragStart = 0, panStart = 0.5, toastTimer;

  function say(message) {
    toast.textContent = message;
    toast.classList.add("shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("shown"), 4200);
  }
  function imageFor(place, useDetail) { return useDetail ? place.detail : place.image; }
  function loadAsset(src) {
    return new Promise((resolve, reject) => {
      const next = new Image();
      next.onload = async () => {
        try { if (next.decode) await next.decode(); resolve(next); }
        catch (error) { reject(error); }
      };
      next.onerror = () => reject(new Error(`Could not load ${src}`));
      next.src = src;
    });
  }
  function setPan(value) {
    pan = Math.max(0, Math.min(1, value));
    image.style.objectPosition = `${Math.round(pan * 100)}% center`;
    placeMarkers();
  }
  function placeMarkers() {
    if (!shell.classList.contains("active")) return;
    const width = frame.clientWidth, height = frame.clientHeight;
    const scale = Math.max(width / (image.naturalWidth || 2172), height / (image.naturalHeight || 724));
    const drawnWidth = (image.naturalWidth || 2172) * scale;
    const drawnHeight = (image.naturalHeight || 724) * scale;
    const left = (width - drawnWidth) * pan, top = (height - drawnHeight) / 2;
    markerLayer.querySelectorAll(".tour-marker").forEach(node => {
      const x = left + Number(node.dataset.x) * drawnWidth;
      const y = top + Number(node.dataset.y) * drawnHeight;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.hidden = x < 28 || x > width - 28 || y < 90 || y > height - 90;
    });
  }
  function showNotes() {
    info.classList.remove("collapsed");
    $("tour-info-toggle").setAttribute("aria-expanded","true");
    $("tour-info-toggle").textContent = "Hide Notes";
    say(active.feature);
  }
  function buildMarkers() {
    markerLayer.replaceChildren();
    const points = detail ? [
      {label:"Return to Main View",x:0.5,y:0.48,action:()=>showImage(active,false)},
      {label:active.pinLabel,x:0.68,y:0.57,action:showNotes}
    ] : [
      {label:active.pinLabel,x:0.34,y:0.52,action:showNotes},
      {label:"Open Detail Study",x:0.68,y:0.53,action:()=>showImage(active,true)}
    ];
    points.forEach((point,index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tour-marker";
      button.dataset.x = point.x;
      button.dataset.y = point.y;
      button.setAttribute("aria-label",point.label);
      button.title = point.label;
      button.innerHTML = `<span aria-hidden="true">${index+1}</span><span class="tour-marker-label">${point.label}</span>`;
      button.addEventListener("click",point.action);
      markerLayer.append(button);
    });
    placeMarkers();
  }
  function updateText() {
    const index = PLACES.indexOf(active);
    $("tour-index").textContent = `Location ${String(index+1).padStart(2,"0")} / 05`;
    $("tour-title").textContent = active.name;
    $("tour-description").textContent = active.description;
    $("tour-feature").textContent = active.feature;
    $("tour-detail-caption").textContent = detail ? active.detailCaption : "Select a numbered point on the view to inspect the proposal.";
    $("tour-main-view").setAttribute("aria-pressed",String(!detail));
    $("tour-detail-view").setAttribute("aria-pressed",String(detail));
    nav.querySelectorAll("button").forEach(button => {
      if (button.dataset.zone === active.id) button.setAttribute("aria-current","true");
      else button.removeAttribute("aria-current");
    });
    planPoints.querySelectorAll("button").forEach(button => button.setAttribute("aria-current",String(button.dataset.zone === active.id)));
  }
  function entity(tag,parent,attributes={}) {
    const node = document.createElement(tag);
    for(const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
    parent.append(node);
    return node;
  }
  function vrText(parent,value,position,width=2.2,color="#202722") {
    return entity("a-text",parent,{value,position,width,color,align:"center","wrap-count":34});
  }
  function vrControl(parent,label,position,width,handler) {
    const control = entity("a-entity",parent,{position});
    const plane = entity("a-plane",control,{class:"vr-control",width,height:0.38,material:"shader: flat; color: #F2EFE6; side: double"});
    vrText(control,label,"0 0 0.015",width*2.5);
    plane.addEventListener("click",handler);
    plane.addEventListener("mouseenter",()=>plane.setAttribute("material","shader: flat; color: #E6AA30; side: double"));
    plane.addEventListener("mouseleave",()=>plane.setAttribute("material","shader: flat; color: #F2EFE6; side: double"));
  }
  function updateVrView(src) {
    if (!window.AFRAME || !scene.hasLoaded) return;
    const ticket = ++vrImageToken;
    const aspect = (image.naturalWidth || 2172) / (image.naturalHeight || 724);
    const arc = 5 * (110 * Math.PI / 180);
    const next = entity("a-curvedimage",gallery,{
      radius:5,"theta-start":125,"theta-length":110,height:(arc/aspect).toFixed(3),
      position:"0 1.72 0",visible:false,src
    });
    let promoted = false;
    function promote() {
      if (promoted || !next.isConnected) return;
      if (ticket !== vrImageToken) { next.remove(); return; }
      promoted = true;
      next.setAttribute("visible",true);
      if (currentVrImage && currentVrImage !== next) currentVrImage.remove();
      currentVrImage = next;
    }
    next.addEventListener("materialtextureloaded",promote,{once:true});
    const started = performance.now();
    const checkTexture = () => {
      if (promoted || !next.isConnected) return;
      if (ticket !== vrImageToken) { next.remove(); return; }
      const mesh = next.getObject3D("mesh");
      const map = mesh?.material?.map;
      if (map?.image?.complete || map?.image?.naturalWidth) promote();
      else if (performance.now()-started < 7000) requestAnimationFrame(checkTexture);
      else { next.remove(); say("The headset image could not load. Continue in the browser or choose another place."); }
    };
    requestAnimationFrame(checkTexture);
  }
  function updateVrControls() {
    if (!window.AFRAME || !scene.hasLoaded) return;
    gallery.querySelectorAll(".vr-tour-ui").forEach(node=>node.remove());
    const ui = entity("a-entity",gallery,{class:"vr-tour-ui",position:"0 0.62 -2.35"});
    entity("a-plane",ui,{width:3.65,height:1.25,material:"shader: flat; color: #202722; opacity: 0.94; side: double"});
    vrText(ui,`${String(PLACES.indexOf(active)+1).padStart(2,"0")} / 05   ${active.name}`,"0 0.39 0.014",4.5,"#F2EFE6");
    vrControl(ui,"Previous","-1.27 0.02 0.02",1.0,()=>move(-1));
    vrControl(ui,detail?"Main View":"Detail","0 0.02 0.02",1.0,()=>showImage(active,!detail));
    vrControl(ui,"Next","1.27 0.02 0.02",1.0,()=>move(1));
    vrControl(ui,"Overview","0 -0.40 0.02",1.4,()=>close());
    const note = entity("a-entity",gallery,{class:"vr-tour-ui",position:"0 2.9 -3.2"});
    entity("a-plane",note,{width:3.7,height:0.48,material:"shader: flat; color: #202722; opacity: 0.9; side: double"});
    vrText(note,detail?active.detailCaption:active.feature,"0 0 0.018",3.9,"#F2EFE6");
  }
  async function showImage(place,useDetail,{sync=true}={}) {
    const token = ++loadingToken, src = imageFor(place,useDetail);
    $("tour-load").hidden = false;
    $("tour-error").hidden = true;
    frame.setAttribute("aria-busy","true");
    try {
      const loaded = await loadAsset(src);
      if (token !== loadingToken) return;
      active = place; detail = useDetail;
      image.src = src;
      image.alt = useDetail ? `Design visualization detail: ${place.detailCaption}` : place.alt;
      image.width = loaded.naturalWidth;
      image.height = loaded.naturalHeight;
      frame.setAttribute("aria-busy","false");
      $("tour-load").hidden = true;
      setPan(0.5);
      buildMarkers();
      updateText();
      updateVrView(src);
      updateVrControls();
      if (sync) {
        const params = new URLSearchParams(location.search);
        if (params.get("zone") !== place.id || params.get("view") !== "tour") setState(place,"tour",{scroll:false});
      }
    } catch {
      if (token !== loadingToken) return;
      frame.setAttribute("aria-busy","false");
      $("tour-load").hidden = true;
      $("tour-error").hidden = false;
      $("tour-retry").onclick = () => showImage(place,useDetail,{sync});
      say("The image could not load. Retry or choose another place.");
    }
  }
  function move(direction) {
    const index = PLACES.indexOf(active);
    showImage(PLACES[(index+direction+PLACES.length)%PLACES.length],false);
  }
  function open(event,{sync=true}={}) {
    if (shell.classList.contains("active")) return;
    returnFocus = event?.currentTarget || document.activeElement;
    shell.classList.add("active");
    shell.setAttribute("aria-hidden","false");
    document.body.classList.add("vr-open");
    document.querySelector("main").inert = true;
    document.querySelector(".site-header").inert = true;
    document.querySelector("footer").inert = true;
    showImage(getCurrent(),false,{sync});
    $("vr-close").focus();
    requestAnimationFrame(placeMarkers);
  }
  function close({sync=true}={}) {
    if (!shell.classList.contains("active")) return;
    ++loadingToken;
    $("tour-load").hidden = true;
    $("tour-error").hidden = true;
    frame.setAttribute("aria-busy","false");
    if (scene?.is("vr-mode")) scene.exitVR();
    shell.classList.remove("active","headset-active","preparing-headset");
    shell.setAttribute("aria-hidden","true");
    document.body.classList.remove("vr-open");
    document.querySelector("main").inert = false;
    document.querySelector(".site-header").inert = false;
    document.querySelector("footer").inert = false;
    if (sync) setState(active,"overview",{scroll:false,showInfo:false});
    if (sync) $("vr-launch").focus();
    else returnFocus?.focus?.();
  }
  PLACES.forEach((place,index) => {
    const navButton = document.createElement("button");
    navButton.type = "button";
    navButton.dataset.zone = place.id;
    navButton.innerHTML = `<small>${String(index+1).padStart(2,"0")}</small><span>${place.short}</span>`;
    navButton.setAttribute("aria-label",`Go to ${place.name}`);
    navButton.addEventListener("click",()=>showImage(place,false));
    nav.append(navButton);
    const dot = document.createElement("button");
    dot.type = "button";
    dot.dataset.zone = place.id;
    dot.style.left = `${place.x}%`;
    dot.style.top = `${place.y}%`;
    dot.setAttribute("aria-label",`Go to ${place.name} on market plan`);
    dot.title = place.name;
    dot.textContent = String(index+1);
    dot.addEventListener("click",()=>showImage(place,false));
    planPoints.append(dot);
  });
  $("vr-launch").addEventListener("click",open);
  $("vr-button").addEventListener("click",open);
  $("vr-close").addEventListener("click",()=>close());
  $("tour-prev").addEventListener("click",()=>move(-1));
  $("tour-next").addEventListener("click",()=>move(1));
  $("tour-error-next").addEventListener("click",()=>move(1));
  $("tour-main-view").addEventListener("click",()=>showImage(active,false));
  $("tour-detail-view").addEventListener("click",()=>showImage(active,true));
  $("tour-info-toggle").addEventListener("click",() => {
    const collapsed = info.classList.toggle("collapsed");
    $("tour-info-toggle").setAttribute("aria-expanded",String(!collapsed));
    $("tour-info-toggle").textContent = collapsed ? "Show Notes" : "Hide Notes";
  });
  document.addEventListener("keydown",event => {
    if (!shell.classList.contains("active")) return;
    if (event.key === "Escape") {event.preventDefault();close();}
    if (event.key === "ArrowRight") {event.preventDefault();move(1);}
    if (event.key === "ArrowLeft") {event.preventDefault();move(-1);}
  });
  stage.addEventListener("pointerdown",event => {
    if (event.target.closest("button")) return;
    dragging = true; dragStart = event.clientX; panStart = pan;
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove",event => {
    if (dragging) setPan(panStart + (dragStart-event.clientX)/Math.max(1,frame.clientWidth));
  });
  stage.addEventListener("pointerup",()=>dragging=false);
  stage.addEventListener("pointercancel",()=>dragging=false);
  window.addEventListener("resize",placeMarkers);
  window.addEventListener("tourstatechange",event => {
    const {place,view} = event.detail;
    if (view === "tour") {
      if (!shell.classList.contains("active")) open(null,{sync:false});
      showImage(place,false,{sync:false});
    } else close({sync:false});
  });
  if (window.AFRAME) {
    const setupScene = () => {
      updateVrView(imageFor(active,detail));
      updateVrControls();
    };
    if (scene.hasLoaded) setupScene();
    else scene.addEventListener("loaded",setupScene,{once:true});
    $("vr-headset").addEventListener("click",async () => {
      try {
        if (!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")) throw new Error("unsupported");
        shell.classList.add("preparing-headset");
        scene.resize?.();
        await scene.enterVR();
      } catch {
        shell.classList.remove("preparing-headset");
        say("A compatible WebXR headset is unavailable. Continue the tour in this browser.");
      }
    });
    scene.addEventListener("enter-vr",()=>shell.classList.add("headset-active"));
    scene.addEventListener("exit-vr",()=>{
      shell.classList.remove("headset-active","preparing-headset");
      say("Headset view closed. Continue the tour in this browser.");
    });
    $("vr-right-hand").addEventListener("thumbstickdown",()=>move(1));
    $("vr-left-hand").addEventListener("thumbstickdown",()=>move(-1));
  } else {
    $("vr-headset").disabled = true;
    $("vr-headset").title = "WebXR could not load on this device";
  }
  if (new URLSearchParams(location.search).get("view") === "tour") open(null,{sync:false});
};
