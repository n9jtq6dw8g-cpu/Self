document.addEventListener("DOMContentLoaded", () => {

/* ================= STORAGE ================= */
const ACT_KEY = "activities";
const LOG_KEY = "logs";
const load = k => JSON.parse(localStorage.getItem(k)) || {};
const save = (k,v) => localStorage.setItem(k, JSON.stringify(v));
const todayISO = () => new Date().toISOString().split("T")[0];

/* ================= NAV ================= */
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

/* ================= SVG ICONS ================= */
const ICONS = {
  skip:`<svg viewBox="0 0 24 24"><path d="M4 14c4-8 12-8 16 0"/><circle cx="4" cy="14" r="2"/><circle cx="20" cy="14" r="2"/></svg>`,
  water:`<svg viewBox="0 0 24 24"><path d="M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>`,
  run:`<svg viewBox="0 0 24 24"><path d="M6 21l2-6 3-2 2 2 3-1 2 5"/></svg>`,
  push:`<svg viewBox="0 0 24 24"><path d="M4 14h16M6 18h12"/></svg>`,
  default:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>`
};

function getIcon(name){
  const n=name.toLowerCase();
  if(n.includes("skip")||n.includes("rope")) return ICONS.skip;
  if(n.includes("water")) return ICONS.water;
  if(n.includes("run")||n.includes("walk")) return ICONS.run;
  if(n.includes("push")||n.includes("pull")) return ICONS.push;
  return ICONS.default;
}

/* ================= ACTIVITY ================= */
let editId=null;
const actName=actUnit=actStart=actEnd=actFreq=null;

const activityList=document.getElementById("activityList");

function renderActivities(){
  const acts=load(ACT_KEY);
  activityList.innerHTML="";
  Object.values(acts).filter(a=>!a.archived).forEach(a=>{
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <div class="row">
        <div class="icon">${getIcon(a.name)}</div>
        <strong>${a.name}</strong>
      </div>
      <div class="row">
        <button class="secondary edit">Edit</button>
        <button class="secondary toggle">${a.active?"Pause":"Resume"}</button>
        <button class="secondary archive">Archive</button>
      </div>
      <div class="row">
        <button class="secondary calendar">Add to Calendar</button>
      </div>
    `;
    const [editBtn,toggleBtn,archiveBtn,calBtn]=card.querySelectorAll("button");

    editBtn.onclick=()=>startEdit(a);
    toggleBtn.onclick=()=>{a.active=!a.active;save(ACT_KEY,acts);renderAll();};
    archiveBtn.onclick=()=>{a.archived=true;a.active=false;save(ACT_KEY,acts);renderAll();};
    calBtn.onclick=()=>exportCalendar(a);

    activityList.appendChild(card);
  });
  populateSummaryActivities();
}

/* ================= CALENDAR EXPORT ================= */
function exportCalendar(activity){
  const startDate=new Date();
  const endDate=new Date();
  endDate.setDate(endDate.getDate()+90);

  const events=[];
  const weekdaysMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};

  for(let d=new Date(startDate); d<=endDate; d.setDate(d.getDate()+1)){
    const day=d.getDay();
    if(activity.frequency==="alternate" && (Math.floor((d-startDate)/(86400000))%2!==0)) continue;
    if(activity.frequency==="custom" && !activity.days.includes(Object.keys(weekdaysMap).find(k=>weekdaysMap[k]===day))) continue;

    const [sh,sm]=activity.startTime.split(":");
    const [eh,em]=activity.endTime.split(":");

    const start=new Date(d); start.setHours(sh,sm,0);
    const end=new Date(d); end.setHours(eh,em,0);

    events.push(`
BEGIN:VEVENT
SUMMARY:${activity.name}
DTSTART:${formatICS(start)}
DTEND:${formatICS(end)}
END:VEVENT`);
  }

  const ics=`BEGIN:VCALENDAR
VERSION:2.0
${events.join("\n")}
END:VCALENDAR`;

  const blob=new Blob([ics],{type:"text/calendar"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${activity.name}-schedule.ics`;
  a.click();
}

function formatICS(d){
  return d.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
}

/* ================= SUMMARY ================= */
const summaryActivity=document.getElementById("summaryActivity");
const summaryRange=document.getElementById("summaryRange");
const ctx=document.getElementById("summaryGraph").getContext("2d");

summaryActivity.onchange=renderSummary;
summaryRange.onchange=renderSummary;

function populateSummaryActivities(){
  const acts=load(ACT_KEY);
  summaryActivity.innerHTML=Object.values(acts).filter(a=>!a.archived)
    .map(a=>`<option value="${a.id}">${a.name}</option>`).join("");
}

function renderSummary(){
  const id=summaryActivity.value;
  if(!id) return;
  const logs=load(LOG_KEY);
  const daysMap={daily:7,weekly:30,monthly:180,yearly:365,all:3650};
  const days=daysMap[summaryRange.value];

  let data=[],allSets=[],activeDays=0;
  for(let i=days-1;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const k=d.toISOString().split("T")[0];
    const sets=logs[k]?.[id]||[];
    const sum=sets.reduce((a,b)=>a+b,0);
    data.push(sum);
    if(sets.length){activeDays++;allSets.push(...sets);}
  }

  drawGraph(data);

  document.getElementById("sTotal").textContent=data.reduce((a,b)=>a+b,0);
  document.getElementById("sAvg").textContent=activeDays?Math.round(data.reduce((a,b)=>a+b,0)/activeDays):0;
  document.getElementById("sBest").textContent=Math.max(...data,0);
  document.getElementById("sBestSet").textContent=allSets.length?Math.max(...allSets):0;
  document.getElementById("sActive").textContent=activeDays;

  let streak=0;
  for(let i=data.length-1;i>=0;i--){ if(data[i]>0) streak++; else break; }
  document.getElementById("sStreak").textContent=streak;
}

function drawGraph(values){
  ctx.clearRect(0,0,320,180);
  const max=Math.max(...values,1);
  ctx.beginPath();
  ctx.strokeStyle="#2aa198";
  ctx.lineWidth=2;
  values.forEach((v,i)=>{
    const x=i*(320/(values.length-1));
    const y=180-(v/max)*160;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  });
  ctx.stroke();
}

/* ================= INIT ================= */
function renderAll(){
  renderActivities();
  populateSummaryActivities();
  renderSummary();
}
renderAll();

});