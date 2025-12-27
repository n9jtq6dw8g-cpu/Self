document.addEventListener("DOMContentLoaded", () => {

/* ========= ICON SYSTEM (SVG) ========= */
const ICONS = {
  rope: `<svg viewBox="0 0 24 24"><path d="M6 2c-2 2-2 6 0 8m12-8c2 2 2 6 0 8M4 14c4 4 12 4 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  water: `<svg viewBox="0 0 24 24"><path d="M12 2v20m-6-6c0 4 12 4 12 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  push: `<svg viewBox="0 0 24 24"><path d="M4 14h16M6 18h12" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  default: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>`
};

function getIcon(name) {
  const n = name.toLowerCase();
  if (n.includes("skip") || n.includes("rope")) return ICONS.rope;
  if (n.includes("water")) return ICONS.water;
  if (n.includes("push") || n.includes("pull")) return ICONS.push;
  return ICONS.default;
}

/* ========= STORAGE ========= */
const ACT_KEY = "activities";
const LOG_KEY = "logs";
const load = k => JSON.parse(localStorage.getItem(k)) || {};
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
const today = () => new Date().toISOString().split("T")[0];

/* ========= NAV ========= */
const screens = {
  log: document.getElementById("screen-log"),
  summary: document.getElementById("screen-summary"),
  profile: document.getElementById("screen-profile")
};

document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    Object.values(screens).forEach(s=>s.classList.remove("active"));
    screens[btn.dataset.target].classList.add("active");
    if(btn.dataset.target==="summary") renderSummary();
  };
});

/* ========= ACTIVITY RENDER ========= */
const activityList=document.getElementById("activityList");

function renderActivities(){
  const acts=load(ACT_KEY);
  activityList.innerHTML="";
  Object.values(acts).filter(a=>!a.archived).forEach(a=>{
    const div=document.createElement("div");
    div.className="card";
    div.innerHTML=`
      <div class="row">
        <div class="icon">${getIcon(a.name)}</div>
        <strong>${a.name}</strong>
      </div>
      <div class="row">
        <button>Edit</button>
        <button>${a.active?"Pause":"Resume"}</button>
        <button class="secondary">Archive</button>
      </div>
    `;
    const [edit,toggle,arch]=div.querySelectorAll("button");
    edit.onclick=()=>startEdit(a);
    toggle.onclick=()=>{a.active=!a.active;save(ACT_KEY,acts);renderAll();};
    arch.onclick=()=>{a.archived=true;a.active=false;save(ACT_KEY,acts);renderAll();};
    activityList.appendChild(div);
  });
  populateSummaryActivities();
}

/* ========= SUMMARY GRAPH ========= */
const canvas=document.getElementById("summaryGraph");
const ctx=canvas.getContext("2d");

function drawGraph(values){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const max=Math.max(...values,1);
  const pad=30;
  const w=canvas.width-pad*2;
  const h=canvas.height-pad*2;

  // Grid
  ctx.strokeStyle="rgba(0,0,0,0.1)";
  ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad+(h/4)*i;
    ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(canvas.width-pad,y);ctx.stroke();
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle="#2aa198";
  ctx.lineWidth=2;
  ctx.lineJoin="round";
  ctx.lineCap="round";

  values.forEach((v,i)=>{
    const x=pad+(w/(values.length-1))*i;
    const y=pad+h-(v/max)*h;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();
}

/* ========= SUMMARY ========= */
const summaryActivity=document.getElementById("summaryActivity");
const summaryRange=document.getElementById("summaryRange");
summaryActivity.onchange=renderSummary;
summaryRange.onchange=renderSummary;

function populateSummaryActivities(){
  const acts=load(ACT_KEY);
  summaryActivity.innerHTML=Object.values(acts)
    .filter(a=>!a.archived)
    .map(a=>`<option value="${a.id}">${a.name}</option>`).join("");
}

function renderSummary(){
  const id=summaryActivity.value;
  if(!id)return;
  const logs=load(LOG_KEY);
  const daysMap={daily:7,weekly:30,monthly:180,yearly:365,all:3650};
  const days=daysMap[summaryRange.value];
  let data=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const k=d.toISOString().split("T")[0];
    data.push((logs[k]?.[id]||[]).reduce((a,b)=>a+b,0));
  }
  drawGraph(data);
}

/* ========= THEME ========= */
document.getElementById("toggleTheme").onclick=()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("theme",document.body.classList.contains("dark")?"dark":"light");
};
if(localStorage.getItem("theme")==="dark") document.body.classList.add("dark");

/* ========= INIT ========= */
function renderAll(){
  renderActivities();
  renderSummary();
}
renderAll();

});