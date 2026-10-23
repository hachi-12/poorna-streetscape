/* Poorna Market: conceptual 360-degree standing-point tour. */
window.initMarketVr = function ({PLACES, setState, getCurrent}) {
  const $ = id => document.getElementById(id);
  const shell = $("vr-shell"), scene = $("vr-scene"), gallery = $("vr-gallery");
  const nav = $("vr-places"), plan = $("tour-plan-points"), info = $("tour-info");
  const camera = $("vr-camera"), toast = $("vr-toast");
  const points = [
    {id:"entrance-a",zone:"entrance",name:"City threshold",image:"assets/panoramas/entrance-a.webp",heading:0,x:45,y:73,links:[["entrance-b",0]],note:"The gateway brings the surrounding street into a shaded pedestrian arrival.",annotation:"Brick screen and shaded entry",annotationYaw:12},
    {id:"entrance-b",zone:"entrance",name:"Inside the gateway",image:"assets/panoramas/entrance-b.webp",heading:0,x:56,y:62,links:[["entrance-a",180],["plaza-a",0]],note:"From the entry, the market route opens toward the shared central court.",annotation:"Arrival and planting",annotationYaw:75},
    {id:"plaza-a",zone:"plaza",name:"Market court",image:"assets/panoramas/plaza-a.webp",heading:0,x:43,y:44,links:[["entrance-b",180],["plaza-b",0],["produce-a",90],["textiles-a",270]],note:"A planted court offers a pause between the active market streets.",annotation:"Planted public seating",annotationYaw:12},
    {id:"plaza-b",zone:"plaza",name:"Shaded gathering",image:"assets/panoramas/plaza-b.webp",heading:0,x:56,y:34,links:[["plaza-a",180],["roof-a",65]],note:"Shade, seating and a roof connection extend the public route.",annotation:"Layered shade",annotationYaw:10},
    {id:"produce-a",zone:"produce",name:"Produce arcade",image:"assets/panoramas/produce-a.webp",heading:0,x:72,y:53,links:[["plaza-a",180],["produce-b",0]],note:"A broad pedestrian path is animated by produce, flowers and shopfronts.",annotation:"Market activity and shade",annotationYaw:70},
    {id:"produce-b",zone:"produce",name:"Flower and fruit stalls",image:"assets/panoramas/produce-b.webp",heading:0,x:85,y:43,links:[["produce-a",180]],note:"Small stalls and a planted edge make browsing part of the street.",annotation:"Flexible stall edge",annotationYaw:80},
    {id:"textiles-a",zone:"textiles",name:"Retail threshold",image:"assets/panoramas/textiles-a.webp",heading:0,x:35,y:46,links:[["plaza-a",180],["textiles-b",0]],note:"Textile displays face the shaded route between the shops.",annotation:"Retail frontage",annotationYaw:80},
    {id:"textiles-b",zone:"textiles",name:"Textile lane",image:"assets/panoramas/textiles-b.webp",heading:0,x:22,y:34,links:[["textiles-a",180]],note:"Fabric displays, places to pause and shade create an active lane.",annotation:"Textile displays",annotationYaw:90},
    {id:"roof-a",zone:"roof",name:"Roof arrival",image:"assets/panoramas/roof-a.webp",heading:0,x:44,y:22,links:[["plaza-b",180],["roof-b",270]],note:"A planted terrace looks across the market and its urban setting.",annotation:"Pergola and roof planting",annotationYaw:270},
    {id:"roof-b",zone:"roof",name:"Roof overlook",image:"assets/panoramas/roof-b.webp",heading:0,x:58,y:12,links:[["roof-a",180]],note:"Seating and planted parapets turn the roof into a place to gather.",annotation:"Terrace seating",annotationYaw:270}
  ];
  const byId = Object.fromEntries(points.map(point => [point.id,point]));
  const first = zone => points.find(point => point.zone === zone);
  const label = id => { const p=byId[id]; return PLACES.find(z => z.id === p.zone).short + " · " + p.name; };
  let active=first(getCurrent().id), currentSky=null, token=0, returnFocus=null, toastTimer;
  let yaw=0, pitch=0, zoom=75, vrYaw=0, snapReady={left:true,right:true};
  const progress=$("tour-load"), error=$("tour-error"), study=$("tour-study");
  const headsetButton=$("vr-headset");
  headsetButton.disabled=true;
  headsetButton.title="Loading the first 360° view";

  function announce(message) {
    toast.textContent=message; toast.classList.add("shown");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove("shown"),4000);
  }
  function entity(tag,parent,attrs={}) {
    const node=document.createElement(tag);
    for(const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    parent.append(node); return node;
  }
  function asset(src) {
    return new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=async()=>{try{if(image.decode)await image.decode();resolve(image)}catch(e){reject(e)}};
      image.onerror=()=>reject(new Error("Image unavailable"));
      image.src=src;
    });
  }
  function heading(value) {
    yaw=((value%360)+360)%360;
    if(scene.is("vr-mode")) {
      vrYaw=yaw;
      $("vr-rig").setAttribute("rotation","0 "+vrYaw+" 0");
      return;
    }
    const look=camera.components["look-controls"];
    if(look?.yawObject) look.yawObject.rotation.y=-yaw*Math.PI/180;
    else camera.setAttribute("rotation","0 "+(-yaw)+" 0");
  }
  function turn(delta) {
    if(scene.is("vr-mode")) {
      vrYaw=(vrYaw+delta+360)%360;
      $("vr-rig").setAttribute("rotation","0 "+vrYaw+" 0");
      return;
    }
    const live=camera.components["look-controls"]?.yawObject?.rotation?.y;
    if(Number.isFinite(live))yaw=-live*180/Math.PI;
    heading(yaw+delta);
  }
  function tilt(value) {
    pitch=Math.max(-70,Math.min(70,value));
    const look=camera.components["look-controls"];
    if(look?.pitchObject) look.pitchObject.rotation.x=pitch*Math.PI/180;
  }
  function lookUp(delta) {
    const live=camera.components["look-controls"]?.pitchObject?.rotation?.x;
    if(Number.isFinite(live))pitch=live*180/Math.PI;
    tilt(pitch+delta);
  }
  function setZoom(value) {
    zoom=Math.max(45,Math.min(90,value));
    camera.setAttribute("camera","fov:"+zoom);
    $("tour-zoom-value").textContent=String(zoom)+"°";
  }
  function resetView() {heading(active.heading);tilt(0);setZoom(75);announce("View reset");}
  function positionAt(angle,radius=3.7,height=1.25) {
    const a=angle*Math.PI/180;
    return (Math.sin(a)*radius).toFixed(3)+" "+height+" "+(-Math.cos(a)*radius).toFixed(3);
  }
  function vrButton(label,angle,height,click) {
    const group=entity("a-entity",gallery,{position:positionAt(angle,3.7,height),rotation:"0 "+(-angle)+" 0",class:"vr-ui"});
    const plate=entity("a-plane",group,{class:"vr-control",width:1.08,height:.32,material:"shader: flat; color: #F2EFE6; side: double"});
    entity("a-text",group,{value:label,align:"center",color:"#202722",width:2.4,position:"0 0 .012","wrap-count":18});
    plate.addEventListener("click",click);
    plate.addEventListener("mouseenter",()=>plate.setAttribute("material","shader: flat; color: #E6AA30; side: double"));
    plate.addEventListener("mouseleave",()=>plate.setAttribute("material","shader: flat; color: #F2EFE6; side: double"));
  }
  function vrMoveMarker(id,angle) {
    const destination=byId[id];
    const group=entity("a-entity",gallery,{position:positionAt(angle,3.7,.72),rotation:"0 "+(-angle)+" 0",class:"vr-ui"});
    const disc=entity("a-circle",group,{class:"vr-control",radius:.25,material:"shader: flat; color: #E6AA30; side: double"});
    entity("a-text",group,{value:">",align:"center",color:"#202722",width:1.5,position:"0 0 .012"});
    entity("a-plane",group,{width:1.38,height:.29,position:".94 0 0",material:"shader: flat; color: #F2EFE6; side: double"});
    entity("a-text",group,{value:destination.name,align:"center",color:"#202722",width:2.7,position:".94 0 .012","wrap-count":24});
    disc.addEventListener("click",()=>show(destination));
    disc.addEventListener("mouseenter",()=>disc.setAttribute("material","shader: flat; color: #A64B35; side: double"));
    disc.addEventListener("mouseleave",()=>disc.setAttribute("material","shader: flat; color: #E6AA30; side: double"));
  }
  function buildVrMarkers() {
    gallery.replaceChildren();
    active.links.forEach(([id,angle])=>vrMoveMarker(id,angle));
    vrButton("Inspect",active.annotationYaw,2.02,()=>showNotes());
    vrButton("Overview",180,2.45,()=>close());
  }
  function setDetails(open) {
    $("tour-info-body").hidden=!open;
    info.classList.toggle("expanded",open);
    $("tour-info-toggle").setAttribute("aria-expanded",String(open));
    $("tour-info-toggle").innerHTML=open
      ? 'Close details <span aria-hidden="true">−</span>'
      : 'Inspect design <span aria-hidden="true">+</span>';
  }
  function showNotes() {
    setDetails(true);
    if(scene.is("vr-mode")) {
      gallery.querySelector(".vr-note")?.remove();
      const angle=active.annotationYaw;
      const card=entity("a-entity",gallery,{class:"vr-note",position:positionAt(angle,2.5,1.65),rotation:"0 "+(-angle)+" 0"});
      entity("a-plane",card,{width:1.88,height:1.38,material:"shader: flat; color: #F2EFE6; side: double"});
      entity("a-plane",card,{width:1.88,height:.04,position:"0 .67 .012",material:"shader: flat; color: #A64B35; side: double"});
      entity("a-image",card,{src:PLACES.find(p=>p.id===active.zone).detail,width:1.7,height:.61,position:"0 .31 .014"});
      entity("a-text",card,{value:active.annotation,color:"#A64B35",width:1.88,align:"left",position:"-.84 -.10 .016","wrap-count":27});
      entity("a-text",card,{value:active.note,color:"#202722",width:1.75,align:"left",position:"-.84 -.37 .016","wrap-count":35});
      const close=entity("a-circle",card,{class:"vr-control",radius:.13,position:".73 .52 .020",material:"shader: flat; color: #456C4D; side: double"});
      entity("a-text",card,{value:"x",color:"#F2EFE6",align:"center",width:.58,position:".73 .52 .030"});
      close.addEventListener("click",()=>card.remove());
    }
    announce(active.note);
  }
  function render() {
    const place=PLACES.find(p=>p.id===active.zone);
    $("tour-index").textContent=String(PLACES.indexOf(place)+1).padStart(2,"0")+" / 05 · Point "+(active.id.endsWith("a")?"01":"02")+" / 02";
    $("tour-title").textContent=place.name;
    $("tour-description").textContent=place.description;
    $("tour-feature").textContent=active.note;
    $("tour-point-name").textContent=active.name;
    $("tour-detail-caption").textContent=place.detailCaption;
    $("tour-study-image").src=place.detail;
    $("tour-study-image").alt="Detail study: "+place.detailCaption;
    study.hidden=true;
    setDetails(false);
    $("tour-main-view").setAttribute("aria-pressed","true");
    $("tour-detail-view").setAttribute("aria-pressed","false");
    nav.querySelectorAll("button").forEach(button=>{
      if(button.dataset.zone===active.zone)button.setAttribute("aria-current","true");
      else button.removeAttribute("aria-current");
    });
    plan.querySelectorAll("button").forEach(button=>{
      button.setAttribute("aria-current",String(button.dataset.point===active.id));
    });
    const links=$("tour-links"); links.replaceChildren();
    active.links.forEach(([id])=>{
      const destination=byId[id];
      const button=document.createElement("button");
      button.type="button";
      button.className="tour-link";
      button.setAttribute("aria-label","Move to "+label(id));
      const name=document.createElement("span");
      name.textContent=destination.name;
      const zone=document.createElement("small");
      zone.textContent=PLACES.find(p=>p.id===destination.zone).short;
      const arrow=document.createElement("span");
      arrow.className="tour-link-arrow";
      arrow.setAttribute("aria-hidden","true");
      arrow.textContent="↗";
      button.append(zone,name,arrow);
      button.addEventListener("click",()=>show(byId[id]));
      links.append(button);
    });
    buildVrMarkers();
  }
  function syncUrl() {
    const url=new URL(location.href);
    url.searchParams.set("view","tour");
    url.searchParams.set("zone",active.zone);
    url.searchParams.set("point",active.id);
    if(url.href!==location.href)history.pushState({view:"tour",zone:active.zone,point:active.id},"",url);
  }
  function skyReady(sky,src) {
    return new Promise((resolve,reject)=>{
      let done=false;
      const timeout=setTimeout(()=>finish(false),10000);
      function finish(ok) {
        if(done)return; done=true; clearTimeout(timeout);
        sky.removeEventListener("materialtextureloaded",loaded);
        ok?resolve():reject(new Error("Panorama texture unavailable"));
      }
      function loaded(){finish(true)}
      sky.addEventListener("materialtextureloaded",loaded);
      sky.setAttribute("src",src);
      requestAnimationFrame(()=>{
        const map=sky.getObject3D("mesh")?.material?.map;
        if(map?.image?.complete || map?.image?.naturalWidth)finish(true);
      });
    });
  }
  function sceneReady() {
    if(!window.AFRAME)return Promise.reject(new Error("3D viewer unavailable"));
    if(scene.hasLoaded)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error("3D viewer timed out")),12000);
      scene.addEventListener("loaded",()=>{clearTimeout(timeout);resolve()},{once:true});
    });
  }
  async function show(point,{sync=true}={}) {
    if(!point)return;
    const ticket=++token;
    progress.hidden=false; error.hidden=true;
    headsetButton.disabled=true;
    progress.textContent="Loading "+point.name+" · image 1/2…";
    scene.setAttribute("aria-busy","true");
    try {
      const image=await asset(point.image);
      if(ticket!==token)return;
      if(image.naturalWidth!==image.naturalHeight*2)throw new Error("Panorama must be 2:1");
      progress.textContent="Preparing "+point.name+" · 3D view 2/2…";
      await sceneReady();
      if(ticket!==token)return;
      const next=entity("a-sky",scene,{visible:"false",rotation:"0 0 0"});
      try{await skyReady(next,point.image)}catch(e){next.remove();throw e}
      if(ticket!==token){next.remove();return}
      next.setAttribute("visible","true");
      $("vr-base-sky").setAttribute("visible","false");
      if(currentSky)currentSky.remove();
      currentSky=next;
      active=point;
      progress.hidden=true; scene.setAttribute("aria-busy","false");
      headsetButton.disabled=false;
      headsetButton.title="Enter the 360° view in a compatible headset";
      render(); heading(active.heading);tilt(0);setZoom(75);
      announce(active.name+" · 360° design visualization");
      if(sync)syncUrl();
    } catch(e) {
      if(ticket!==token)return;
      progress.hidden=true; error.hidden=false; scene.setAttribute("aria-busy","false");
      headsetButton.disabled=!currentSky;
      $("tour-retry").onclick=()=>show(point,{sync});
      $("tour-error-next").onclick=()=>close();
      announce("Panorama could not load. Retry or return to the overview.");
    }
  }
  function open(event,{sync=true,point=null}={}) {
    if(!shell.classList.contains("active")) {
      returnFocus=event?.currentTarget||document.activeElement;
      shell.classList.add("active");
      shell.setAttribute("aria-hidden","false");
      document.body.classList.add("vr-open");
      document.querySelector("main").inert=true;
      document.querySelector(".site-header").inert=true;
      document.querySelector("footer").inert=true;
      $("vr-close").focus();
      scene.resize?.();
    }
    show(point||first(getCurrent().id),{sync});
  }
  function close({sync=true}={}) {
    if(!shell.classList.contains("active"))return;
    ++token;
    if(scene.is("vr-mode"))scene.exitVR();
    shell.classList.remove("active","headset-active");
    shell.setAttribute("aria-hidden","true");
    document.body.classList.remove("vr-open");
    document.querySelector("main").inert=false;
    document.querySelector(".site-header").inert=false;
    document.querySelector("footer").inert=false;
    if(sync)setState(PLACES.find(p=>p.id===active.zone),"overview",{scroll:false,showInfo:false});
    returnFocus?.focus?.();
  }
  PLACES.forEach((place,index)=>{
    const button=document.createElement("button");
    button.type="button";button.dataset.zone=place.id;
    button.className="tour-place-button";
    const number=document.createElement("small");
    number.textContent=String(index+1).padStart(2,"0");
    const name=document.createElement("span");
    name.textContent=place.short;
    const preview=document.createElement("span");
    preview.className="tour-place-preview";
    preview.setAttribute("aria-hidden","true");
    const image=document.createElement("img");
    image.src=place.image;
    image.alt="";
    image.loading="lazy";
    image.width=160;
    image.height=90;
    const caption=document.createElement("span");
    caption.textContent=place.name;
    const pointNames=document.createElement("small");
    pointNames.textContent=points.filter(point=>point.zone===place.id).map(point=>point.name).join(" / ");
    preview.append(image,caption,pointNames);
    button.append(number,name,preview);
    button.setAttribute("aria-label","Go to "+place.name);
    button.addEventListener("click",()=>show(first(place.id)));
    nav.append(button);
  });
  points.forEach(point=>{
    const button=document.createElement("button");
    button.type="button";button.dataset.point=point.id;
    button.style.left=point.x+"%";button.style.top=point.y+"%";
    button.textContent=point.id.endsWith("a")?"1":"2";
    button.title=label(point.id);
    button.setAttribute("aria-label","Move to "+label(point.id)+" on market plan");
    button.addEventListener("click",()=>show(point));
    plan.append(button);
  });
  $("vr-launch").addEventListener("click",open);
  $("vr-button").addEventListener("click",open);
  $("vr-close").addEventListener("click",()=>close());
  $("tour-info-toggle").addEventListener("click",()=>setDetails($("tour-info-body").hidden));
  $("tour-main-view").addEventListener("click",()=>{
    study.hidden=true;
    $("tour-main-view").setAttribute("aria-pressed","true");
    $("tour-detail-view").setAttribute("aria-pressed","false");
  });
  $("tour-detail-view").addEventListener("click",()=>{
    study.hidden=false;showNotes();
    $("tour-main-view").setAttribute("aria-pressed","false");
    $("tour-detail-view").setAttribute("aria-pressed","true");
  });
  $("tour-reset").addEventListener("click",resetView);
  $("tour-zoom-in").addEventListener("click",()=>setZoom(zoom-8));
  $("tour-zoom-out").addEventListener("click",()=>setZoom(zoom+8));
  scene.addEventListener("wheel",event=>{
    if(!shell.classList.contains("active"))return;
    event.preventDefault();setZoom(zoom+(event.deltaY>0?5:-5));
  },{passive:false});
  document.addEventListener("keydown",event=>{
    if(!shell.classList.contains("active"))return;
    if(event.key==="Escape"){event.preventDefault();close();return}
    if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
    if(event.key==="ArrowLeft"){turn(-15);event.preventDefault()}
    if(event.key==="ArrowRight"){turn(15);event.preventDefault()}
    if(event.key==="ArrowUp"){lookUp(-10);event.preventDefault()}
    if(event.key==="ArrowDown"){lookUp(10);event.preventDefault()}
    if(event.key==="+"||event.key==="="){setZoom(zoom-8);event.preventDefault()}
    if(event.key==="-"){setZoom(zoom+8);event.preventDefault()}
    if(event.key.toLowerCase()==="r"){resetView();event.preventDefault()}
  });
  window.addEventListener("tourstatechange",event=>{
    const {place,view,point}=event.detail;
    if(view==="tour")open(null,{sync:false,point:byId[point]&&byId[point].zone===place.id?byId[point]:first(place.id)});
    else close({sync:false});
  });
  headsetButton.addEventListener("click",()=>{
    try{
      if(!navigator.xr||!currentSky)throw new Error("unsupported");
      const request=scene.enterVR();
      if(request?.catch)request.catch(()=>announce("Headset entry failed. Continue in the browser or retry."));
    }catch{announce("A compatible WebXR headset is unavailable. Continue in this browser.")}
  });
  scene.addEventListener("enter-vr",()=>shell.classList.add("headset-active"));
  scene.addEventListener("exit-vr",()=>{
    shell.classList.remove("headset-active");
    vrYaw=0;$("vr-rig").setAttribute("rotation","0 0 0");
    heading(active.heading);
  });
  ["left","right"].forEach(hand=>{
    const node=$("vr-"+hand+"-hand");
    node.addEventListener("thumbstickmoved",event=>{
      const x=event.detail.x;
      if(Math.abs(x)<.35){snapReady[hand]=true;return}
      if(Math.abs(x)>.75&&snapReady[hand]){turn(x>0?30:-30);snapReady[hand]=false}
    });
  });
  if(!window.AFRAME)headsetButton.title="WebXR viewer unavailable";
  const query=new URLSearchParams(location.search);
  if(query.get("view")==="tour"){
    const point=byId[query.get("point")];
    open(null,{sync:false,point:point&&point.zone===getCurrent().id?point:first(getCurrent().id)});
  }
};
