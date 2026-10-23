const PLACES = [
  {id:"entrance",name:"Market Entrance",short:"Entrance",image:"assets/entrance.webp",x:50,y:68,description:"A generous threshold connects the surrounding street to the market’s internal pedestrian routes.",feature:"A shaded arrival edge, planted forecourt and clear crossings frame the public entrance.",alt:"Visualized market entrance with a brick and bamboo gateway, shaded pedestrian forecourt, street traffic and visitors.",icon:"gate"},
  {id:"produce",name:"Fresh Produce Street",short:"Produce",image:"assets/produce.webp",x:78,y:48,description:"Small produce and flower stalls animate a walkable market street with a strong sense of everyday exchange.",feature:"Trees, overhead shade and a continuous walking route support browsing and movement.",alt:"Visualized produce street with vegetables, flowers, vendors, shoppers and shade sails.",icon:"produce"},
  {id:"plaza",name:"Central Plaza",short:"Plaza",image:"assets/plaza.webp",x:49,y:38,description:"A shared court offers a place to pause between the market streets and surrounding retail edges.",feature:"Planted seating and open circulation make the plaza a social centre of the proposal.",alt:"Visualized central plaza with planted seating, shaded market edges and people gathering.",icon:"plaza"},
  {id:"textiles",name:"Textile & Retail Street",short:"Textiles",image:"assets/textiles.webp",x:27,y:39,description:"A retail lane brings fabric and small shops into a shaded, pedestrian-focused streetscape.",feature:"A continuous route links shopfront activity with places to sit and meet.",alt:"Visualized textile street with fabric stalls, shoppers, trees and a shaded pedestrian route.",icon:"textile"},
  {id:"roof",name:"Roof Promenade",short:"Roof",image:"assets/roof.webp",x:51,y:17,description:"An elevated walk overlooks the markets, planted courtyards and the urban neighbourhood around them.",feature:"Planting, seating and pergolas extend public life onto the roof.",alt:"Visualized planted roof promenade looking over the market courtyards and surrounding streets.",icon:"roof"}
];
const ICONS = {
  gate:'<svg viewBox="0 0 48 48"><path d="M5 39h38M9 39V19C9 11 15 6 24 6s15 5 15 13v20M17 39V23a7 7 0 0 1 14 0v16"/></svg>',
  produce:'<svg viewBox="0 0 48 48"><path d="M8 19h32l-4 22H12L8 19ZM6 19h36M24 19c-3-8 0-13 6-14M24 19c-3-7-9-9-14-8M25 13c4-5 8-5 12-4"/></svg>',
  plaza:'<svg viewBox="0 0 48 48"><path d="M6 39h36M11 30h26v9H11zM24 30V9M13 15c2-6 6-9 11-9s9 3 11 9M10 19c3 3 7 4 14 4s11-1 14-4"/></svg>',
  textile:'<svg viewBox="0 0 48 48"><path d="M8 7h32v7H8zM12 14v27h24V14M18 14v27M30 14v27M12 22h24M12 31h24"/></svg>',
  roof:'<svg viewBox="0 0 48 48"><path d="M5 37h38M9 37V19l15-12 15 12v18M14 26h20M19 37V26M29 37V26M24 16c4-4 8-3 9 0-3 3-6 4-9 4-3 0-6-1-9-4 1-3 5-4 9 0Z"/></svg>'
};
const byId = id => document.getElementById(id);
const overview = byId("overview");
const walkthrough = byId("walkthrough");
const mapHotspots = byId("map-hotspots");
const placePanel = byId("place-panel");
const locationList = byId("location-list");
const walkImage = byId("walk-image");
const imageError = byId("image-error");
let current = PLACES[0];
let mode = "overview";
let imageRequest = 0;

function stateFromUrl() {
  const params = new URLSearchParams(location.search);
  return {place:PLACES.find(place=>place.id===params.get("zone")) || PLACES[0],view:params.get("view")==="walkthrough" ? "walkthrough":"overview"};
}
function writeUrl(place,view,replace=false) {
  const url = new URL(location.href);
  url.searchParams.set("zone",place.id);
  url.searchParams.set("view",view);
  history[replace?"replaceState":"pushState"]({zone:place.id,view},"",url);
}
function renderSelection() {
  const index = PLACES.indexOf(current)+1;
  byId("panel-index").textContent = `Location ${String(index).padStart(2,"0")} / 05`;
  byId("panel-icon").innerHTML = ICONS[current.icon];
  byId("panel-title").textContent = current.name;
  byId("panel-description").textContent = current.description;
  byId("panel-feature").textContent = current.feature;
  byId("walk-index").textContent = `Location ${String(index).padStart(2,"0")} / 05`;
  byId("walk-title").textContent = current.name;
  byId("walk-description").textContent = current.description;
  byId("walk-feature").textContent = current.feature;
  document.querySelectorAll(".hotspot").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.zone===current.id)));
  document.querySelectorAll(".location-card").forEach(button=>{
    if(button.dataset.zone===current.id)button.setAttribute("aria-current","true");
    else button.removeAttribute("aria-current");
  });
  byId("prev-place").setAttribute("aria-label",`Previous location: ${PLACES[(index+3)%5].name}`);
  byId("next-place").setAttribute("aria-label",`Next location: ${PLACES[index%5].name}`);
}
function showPanel(place) {
  current = place;
  renderSelection();
  placePanel.hidden = false;
}
function hidePanel() {
  placePanel.hidden = true;
  document.querySelectorAll(".hotspot").forEach(button=>button.setAttribute("aria-pressed","false"));
}
function loadScene(place) {
  const request = ++imageRequest;
  const wrapper = walkImage.parentElement;
  wrapper.setAttribute("aria-busy","true");
  imageError.hidden = true;
  const preloader = new Image();
  preloader.onload = () => {
    if(request!==imageRequest)return;
    walkImage.src = place.image;
    walkImage.alt = place.alt;
    wrapper.setAttribute("aria-busy","false");
  };
  preloader.onerror = () => {
    if(request!==imageRequest)return;
    wrapper.setAttribute("aria-busy","false");
    imageError.hidden = false;
  };
  preloader.src = place.image;
}
function setState(place,view,{push=true,scroll=true,showInfo=true}={}) {
  current = place;
  mode = view;
  renderSelection();
  const isWalk = view==="walkthrough";
  document.body.classList.toggle("overview-mode",!isWalk);
  walkthrough.hidden = !isWalk;
  overview.hidden = isWalk;
  document.querySelector(".intro").hidden = isWalk;
  if(!isWalk && showInfo)showPanel(place);
  else hidePanel();
  if(isWalk)loadScene(place);
  if(push)writeUrl(place,view);
  if(scroll)(isWalk?walkthrough:overview).scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});
}
function neighbour(direction) {
  const index = PLACES.indexOf(current);
  setState(PLACES[(index+direction+PLACES.length)%PLACES.length],"walkthrough");
}
function buildNavigation() {
  PLACES.forEach((place,index)=>{
    const hotspot = document.createElement("button");
    hotspot.type="button";
    hotspot.className="hotspot";
    hotspot.dataset.zone=place.id;
    hotspot.style.left=`${place.x}%`;
    hotspot.style.top=`${place.y}%`;
    hotspot.setAttribute("aria-label",`Select ${place.name} on aerial view`);
    hotspot.textContent=String(index+1);
    hotspot.addEventListener("mouseenter",()=>showPanel(place));
    hotspot.addEventListener("focus",()=>showPanel(place));
    hotspot.addEventListener("click",()=>setState(place,"overview",{scroll:false}));
    mapHotspots.append(hotspot);
    const card = document.createElement("button");
    card.type="button";
    card.className="location-card";
    card.dataset.zone=place.id;
    card.setAttribute("aria-label",`Go to ${place.name}`);
    card.innerHTML=`<img src="${place.image}" width="360" height="160" loading="lazy" alt=""><span><small>Location ${String(index+1).padStart(2,"0")}</small>${place.name}</span>`;
    card.addEventListener("click",()=>setState(place,"walkthrough"));
    locationList.append(card);
  });
}
buildNavigation();
const initial=stateFromUrl();
setState(initial.place,initial.view,{push:false,scroll:false,showInfo:new URLSearchParams(location.search).has("zone")});
byId("panel-close").addEventListener("click",hidePanel);
document.addEventListener("keydown",event=>{if(event.key==="Escape" && mode==="overview")hidePanel();});
byId("map-frame")?.addEventListener("click",event=>{if(event.target===event.currentTarget)hidePanel();});
byId("panel-go").addEventListener("click",()=>setState(current,"walkthrough"));
byId("back-map").addEventListener("click",()=>setState(current,"overview"));
byId("prev-place").addEventListener("click",()=>neighbour(-1));
byId("next-place").addEventListener("click",()=>neighbour(1));
const about=byId("about-dialog");
byId("about-open").addEventListener("click",()=>about.showModal());
byId("about-close").addEventListener("click",()=>about.close());
about.addEventListener("click",event=>{if(event.target===about)about.close();});
window.addEventListener("popstate",()=>{const state=stateFromUrl();setState(state.place,state.view,{push:false});});
document.addEventListener("DOMContentLoaded",()=>window.initMarketVr?.({PLACES,setState,getCurrent:()=>current}),{once:true});
