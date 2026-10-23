/* A conceptual spatial model. The proposal images remain flat exhibits, not 360° photographs. */
const MARKET_STATIONS = [
  {id:"entrance",x:0,z:7,label:"Entrance"},
  {id:"produce",x:5.4,z:0.2,label:"Produce"},
  {id:"plaza",x:0,z:-0.8,label:"Plaza"},
  {id:"textiles",x:-5.4,z:0.2,label:"Textiles"},
  {id:"roof",x:0,z:-7,y:1.25,label:"Roof"}
];

function vrEntity(tag,parent,attributes={}) {
  const element=document.createElement(tag);
  Object.entries(attributes).forEach(([name,value])=>element.setAttribute(name,value));
  parent.append(element);
  return element;
}
function vrText(parent,value,position,width=3.2,color="#F2EFE6",align="center") {
  return vrEntity("a-text",parent,{value,position,width,color,align});
}
function vrButton(parent,label,position,width,color,onClick) {
  const button=vrEntity("a-plane",parent,{class:"vr-control",width,height:0.38,position,color,material:"shader: flat; side: double"});
  vrText(button,label,"0 0 0.012",width*2.7,"#FFFFFF");
  button.addEventListener("click",onClick);
  button.addEventListener("mouseenter",()=>button.setAttribute("scale","1.08 1.08 1"));
  button.addEventListener("mouseleave",()=>button.setAttribute("scale","1 1 1"));
  return button;
}
function vrBox(parent,x,y,z,w,h,d,color,extra={}) {
  return vrEntity("a-box",parent,{position:`${x} ${y} ${z}`,width:w,height:h,depth:d,color,...extra});
}

if(window.AFRAME && !AFRAME.components["market-locomotion"]) {
  AFRAME.registerComponent("market-locomotion",{
    init() {
      this.axes={x:0,y:0};
      this.lastTurn=0;
      const left=document.getElementById("vr-left-hand");
      const right=document.getElementById("vr-right-hand");
      left.addEventListener("thumbstickmoved",event=>{
        this.axes.x=event.detail.x||0;
        this.axes.y=event.detail.y||0;
      });
      right.addEventListener("thumbstickmoved",event=>{
        const now=performance.now();
        if(Math.abs(event.detail.x)>0.75 && now-this.lastTurn>360){
          const rotation=this.el.getAttribute("rotation");
          this.el.setAttribute("rotation",{x:0,y:rotation.y+(event.detail.x>0?-30:30),z:0});
          this.lastTurn=now;
        }
      });
    },
    tick(_time,delta) {
      if(!delta || (Math.abs(this.axes.x)<0.14 && Math.abs(this.axes.y)<0.14))return;
      const camera=document.getElementById("vr-camera");
      const rig=this.el;
      const yaw=(rig.object3D.rotation.y+camera.object3D.rotation.y);
      const forward=-this.axes.y;
      const side=this.axes.x;
      const step=Math.min(delta,50)*0.0025;
      const position=rig.object3D.position;
      position.x=Math.max(-9,Math.min(9,position.x+(Math.cos(yaw)*side-Math.sin(yaw)*forward)*step));
      position.z=Math.max(-11,Math.min(13,position.z+(-Math.sin(yaw)*side-Math.cos(yaw)*forward)*step));
    }
  });
}

window.initMarketVr=function({PLACES,setState,getCurrent}) {
  if(!window.AFRAME) {
    document.getElementById("vr-launch").disabled=true;
    document.getElementById("vr-status").textContent="The 3D engine could not load. The aerial map and walkthrough remain available.";
    return;
  }
  const shell=document.getElementById("vr-shell");
  const scene=document.getElementById("vr-scene");
  const model=document.getElementById("market-model");
  const rig=document.getElementById("vr-rig");
  const infoBoard=vrEntity("a-entity",rig,{position:"-1.38 1.55 -2.25",rotation:"0 18 0",visible:false});
  vrEntity("a-plane",infoBoard,{width:2.25,height:1.35,color:"#202722",material:"side: double; opacity: 0.96"});
  vrText(infoBoard,"Design intention","0 0.42 0.02",2.7,"#E6AA30");
  const infoText=vrText(infoBoard,"","0 -0.07 0.02",2.15,"#F2EFE6","left");
  infoText.setAttribute("wrap-count","28");
  const toast=document.getElementById("vr-toast");
  const hudPlaces=document.getElementById("vr-places");
  const shadeButton=document.getElementById("vr-shade");
  const routeButton=document.getElementById("vr-route");
  const shadeGroup=vrEntity("a-entity",model,{id:"shade-layer"});
  const routeGroup=vrEntity("a-entity",model,{id:"route-layer",visible:false});
  const stationNodes=new Map();
  const consoleNodes=new Map();
  let active=PLACES[0];
  let returnFocus;
  let toastTimer;

  function announce(message) {
    toast.textContent=message;
    toast.classList.add("shown");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove("shown"),5500);
    document.getElementById("vr-wrist-hint").setAttribute("value",message.slice(0,42));
  }
  function focus(place,{sync=true}={}) {
    active=place;
    const spot=MARKET_STATIONS.find(item=>item.id===place.id);
    rig.setAttribute("position",`${spot.x} ${spot.y||0} ${spot.z+2.4}`);
    document.getElementById("vr-wrist-title").setAttribute("value",place.name);
    document.getElementById("vr-wrist-hint").setAttribute("value","Point and trigger to inspect");
    infoBoard.setAttribute("visible",false);
    document.querySelectorAll(".vr-place-button").forEach(button=>{
      button.setAttribute("aria-current",button.dataset.zone===place.id?"true":"false");
    });
    stationNodes.forEach((node,id)=>node.setAttribute("color",id===place.id?"#E6AA30":"#A64B35"));
    consoleNodes.forEach((node,id)=>node.setAttribute("visible",id===place.id && scene.is("vr-mode")));
    if(sync)setState(place,"walkthrough",{scroll:false});
    announce(`${place.name} · Select Inspect for its design idea`);
  }
  function toggleShade() {
    const visible=!shadeGroup.getAttribute("visible");
    shadeGroup.setAttribute("visible",visible);
    shadeButton.setAttribute("aria-pressed",String(visible));
    shadeButton.textContent=visible?"Shade on":"Shade off";
    announce(visible?"Shade layer shown: canopies and trees soften the market routes.":"Shade layer hidden: compare the open market plan.");
  }
  function toggleRoute() {
    const visible=!routeGroup.getAttribute("visible");
    routeGroup.setAttribute("visible",visible);
    routeButton.setAttribute("aria-pressed",String(visible));
    routeButton.textContent=visible?"Hide walking route":"Show walking route";
    announce(visible?"Walking route shown: entrance, plaza and market streets connect.":"Walking route hidden.");
  }
  function inspect() {
    announce(active.feature);
    infoText.setAttribute("value",active.feature);
    if(scene.is("vr-mode"))infoBoard.setAttribute("visible",!infoBoard.getAttribute("visible"));
  }

  // Urban massing is intentionally diagrammatic; the attached renders carry the proposal's visual detail.
  vrBox(model,0,0.045,0,15.6,0.09,19,"#B5B99E");
  vrBox(model,0,0.06,7.5,4.2,0.08,5.8,"#E6D8BC");
  vrBox(model,0,0.06,0,3.2,0.08,16,"#E6D8BC");
  vrBox(model,-4.8,0.06,0,3.4,0.08,9.5,"#E6D8BC");
  vrBox(model,4.8,0.06,0,3.4,0.08,9.5,"#E6D8BC");
  vrBox(model,0,0.62,-7,6,1.24,4.8,"#B58C69");
  vrBox(model,0,1.28,-7,5.95,0.08,4.75,"#D6C5A5");
  for(let step=0;step<4;step++)vrBox(model,0,0.18+step*0.29,-3.8-step*0.42,2.2,0.36+step*0.58,0.42,"#C5A780");
  for(const x of [-8.2,8.2]) {
    for(const z of [-8,-4,0,4,8]) {
      vrBox(model,x,1.2,z,2.2,2.4,2.9,z%8===0?"#B96D4B":"#C7A27D");
      vrBox(model,x,2.47,z,2.35,0.16,3.05,"#855E43");
    }
  }
  for(const x of [-3.2,3.2])for(const z of [-5,-1,3]) {
    vrBox(model,x,0.7,z,1.2,1.4,1.5,"#D3AE78");
    vrBox(shadeGroup,x,1.66,z,1.75,0.08,1.9,"#E6AA30",{material:"opacity: 0.86; side: double"});
    vrBox(model,x,0.85,z+0.8,1.25,0.12,0.24,"#456C4D");
  }
  for(const x of [-6.8,-2.2,2.2,6.8])for(const z of [-8,-3,2,7]) {
    vrEntity("a-cylinder",shadeGroup,{position:`${x} 0.83 ${z}`,radius:0.1,height:1.65,color:"#765E40"});
    vrEntity("a-sphere",shadeGroup,{position:`${x} 1.9 ${z}`,radius:0.78,color:"#456C4D",material:"roughness: 1"});
  }
  vrBox(model,0,0.12,-0.8,2.9,0.2,2.9,"#A64B35");
  vrEntity("a-cylinder",model,{position:"-1.35 0.28 -0.8",radius:0.72,height:0.32,color:"#DDD1B6"});
  vrBox(model,0,1.7,10.2,3.5,0.32,0.5,"#A64B35");
  vrBox(model,-1.6,0.9,10.2,0.3,1.8,0.5,"#A64B35");
  vrBox(model,1.6,0.9,10.2,0.3,1.8,0.5,"#A64B35");
  vrText(model,"POORNA MARKET","0 1.73 10.49",3.9,"#F2EFE6");
  for(const [x,z,w,d] of [[0,5,0.24,5],[0,-3.6,0.24,5.3],[-2.8,0,5.8,0.24],[2.8,0,5.8,0.24]]) {
    vrBox(routeGroup,x,0.13,z,w,0.05,d,"#E6AA30",{material:"opacity: 0.9"});
  }

  PLACES.forEach((place,index)=>{
    const spot=MARKET_STATIONS[index];
    const group=vrEntity("a-entity",model,{position:`${spot.x} ${spot.y||0} ${spot.z}`});
    const marker=vrEntity("a-cylinder",group,{class:"vr-control",position:"0 0.12 0.6",radius:0.67,height:0.18,color:"#A64B35"});
    vrText(group,String(index+1),"0 0.24 0.6",3,"#FFFFFF");
    stationNodes.set(place.id,marker);
    marker.addEventListener("click",()=>focus(place));
    marker.addEventListener("mouseenter",()=>marker.setAttribute("scale","1.14 1 1.14"));
    marker.addEventListener("mouseleave",()=>marker.setAttribute("scale","1 1 1"));
    vrBox(group,0,1.08,-0.52,4.1,2.16,0.16,"#202722");
    vrEntity("a-plane",group,{position:"0 1.3 -0.41",width:3.96,height:1.32,src:`#vr-scene-${place.id}`,material:"shader: flat; side: double"});
    vrText(group,place.name,`0 0.49 -0.4`,3.8,"#F2EFE6");
    vrText(group,"Design visualization","0 0.27 -0.4",3,"#E6AA30");
    const consolePanel=vrEntity("a-entity",group,{position:"2.65 1.23 -0.6",rotation:"0 -25 0",visible:false});
    consoleNodes.set(place.id,consolePanel);
    vrEntity("a-plane",consolePanel,{width:1.9,height:1.76,color:"#202722",material:"side: double; opacity: 0.94"});
    vrText(consolePanel,"Explore this place","0 0.64 0.02",2.9,"#F2EFE6");
    vrButton(consolePanel,"Inspect","0 0.24 0.03",1.55,"#456C4D",inspect);
    vrButton(consolePanel,"Toggle shade","0 -0.22 0.03",1.55,"#A64B35",toggleShade);
    vrButton(consolePanel,"Walking route","0 -0.68 0.03",1.55,"#A64B35",toggleRoute);
    const htmlButton=document.createElement("button");
    htmlButton.type="button";
    htmlButton.className="vr-place-button";
    htmlButton.dataset.zone=place.id;
    htmlButton.textContent=place.short;
    htmlButton.addEventListener("click",()=>focus(place));
    hudPlaces.append(htmlButton);
  });
  rig.setAttribute("market-locomotion","");
  document.getElementById("vr-shade").addEventListener("click",toggleShade);
  document.getElementById("vr-route").addEventListener("click",toggleRoute);
  document.getElementById("vr-inspect").addEventListener("click",inspect);
  function open(event) {
    returnFocus=event.currentTarget;
    shell.classList.add("active");
    shell.setAttribute("aria-hidden","false");
    document.body.classList.add("vr-open");
    document.querySelector("main").inert=true;
    document.querySelector(".site-header").inert=true;
    document.querySelector("footer").inert=true;
    focus(getCurrent(),{sync:false});
    scene.resize?.();
    document.getElementById("vr-close").focus();
  }
  function close() {
    if(scene.is("vr-mode"))scene.exitVR();
    shell.classList.remove("active");
    shell.setAttribute("aria-hidden","true");
    document.body.classList.remove("vr-open");
    document.querySelector("main").inert=false;
    document.querySelector(".site-header").inert=false;
    document.querySelector("footer").inert=false;
    returnFocus?.focus();
  }
  document.getElementById("vr-launch").addEventListener("click",open);
  document.getElementById("vr-button").addEventListener("click",open);
  document.getElementById("vr-close").addEventListener("click",close);
  document.addEventListener("keydown",event=>{if(event.key==="Escape" && shell.classList.contains("active"))close();});
  document.getElementById("vr-headset").addEventListener("click",async()=>{
    if(!navigator.xr || !await navigator.xr.isSessionSupported("immersive-vr")){
      announce("A compatible WebXR headset is needed. You can explore this 3D model in your browser.");
      return;
    }
    try{await scene.enterVR();}
    catch{announce("The headset session could not start. Continue exploring in the browser.");}
  });
  document.getElementById("vr-right-hand").addEventListener("thumbstickdown",()=>{
    const index=PLACES.indexOf(active);
    focus(PLACES[(index+1)%PLACES.length]);
  });
  scene.addEventListener("enter-vr",()=>{
    document.getElementById("vr-wrist").setAttribute("visible",true);
    consoleNodes.get(active.id)?.setAttribute("visible",true);
  });
  scene.addEventListener("exit-vr",()=>{
    document.getElementById("vr-wrist").setAttribute("visible",false);
    infoBoard.setAttribute("visible",false);
    consoleNodes.forEach(node=>node.setAttribute("visible",false));
  });
  scene.addEventListener("exit-vr",()=>announce("Headset view closed. The 3D model remains open."));
};
