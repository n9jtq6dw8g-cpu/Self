document.addEventListener("DOMContentLoaded",()=>{
  alert("script.js loaded");

const archivedToggle=document.getElementById("archivedToggle");
const archivedList=document.getElementById("archivedActivityList");

if(archivedToggle){
  archivedToggle.onclick=()=>{
    archivedList.classList.toggle("collapsed");
  };
}

const ACT="activities", LOG="logs";
const load=k=>JSON.parse(localStorage.getItem(k))||{};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

/* NAV */
document.querySelectorAll(".nav-btn").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll(".nav-btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    document.getElementById("screen-"+b.dataset.target).classList.add("active");
    if(b.dataset.target==="summary") renderSummary();
  };
});

/* THEME */
document.getElementById("toggleTheme").onclick=()=>{
  document.body.classList.toggle("dark");
};

/* ACTIVITIES */
const actName = document.getElementById("actName");
const actUnit=document.getElementById("actUnit");
const actStart=document.getElementById("actStart");
const actEnd=document.getElementById("actEnd");
const actFreq=document.getElementById("actFreq");
const weekdays=document.getElementById("weekdays");
const list=document.getElementById("activityList");
let edit=null;

actFreq.onchange=()=>weekdays.classList.toggle("hidden",actFreq.value!=="custom");

document.getElementById("saveActivity").onclick=()=>{
  if(!actName.value) return;
  const a=load(ACT);
  const id=edit||actName.value.toLowerCase().replace(/\s+/g,"_");
  a[id]={id,name:actName.value,unit:actUnit.value,startTime:actStart.value,endTime:actEnd.value,frequency:actFreq.value,days:[...weekdays.querySelectorAll("input:checked")].map(i=>i.value),active:true};
  save(ACT,a);
  resetActivityForm();
  renderActivities();
};

function renderActivities(){
  const acts = load(ACT);
  list.innerHTML = "";
  archivedList.innerHTML = "";

  Object.values(acts).forEach(a=>{

    /* ARCHIVED */
    if(a.archived){
      const arc=document.createElement("div");
      arc.className="card paused";
      arc.innerHTML=`
        <strong>${a.name}</strong> (${a.unit})
        <div class="row" style="margin-top:6px;">
          <button class="secondary unarchive-btn">Unarchive</button>
        </div>
      `;
      arc.querySelector(".unarchive-btn").onclick=()=>{
        a.archived=false;
        a.active=true;
        save(ACT,acts);
        renderActivities();
        populate();
      };
      archivedList.appendChild(arc);
      return;
    }

    /* ACTIVE / PAUSED */
    const card=document.createElement("div");
    card.className="card"+(a.active?"":" paused");

    card.innerHTML=`
      <strong>${a.name}</strong> (${a.unit})
      <div class="row" style="margin-top:8px;">
        <button class="secondary edit-btn">Edit</button>
        <button class="secondary toggle-btn">${a.active?"Pause":"Resume"}</button>
        <button class="secondary archive-btn">Archive</button>
        <button class="secondary cal-btn">Calendar</button>
      </div>
    `;

    card.querySelector(".edit-btn").onclick=()=>{
      edit=a.id;
      actName.value=a.name;
      actUnit.value=a.unit;
      actStart.value=a.startTime||"";
      actEnd.value=a.endTime||"";
      actFreq.value=a.frequency||"daily";
      weekdays.classList.toggle("hidden",a.frequency!=="custom");
      weekdays.querySelectorAll("input").forEach(i=>{
        i.checked=a.days?.includes(i.value);
      });
      document.getElementById("cancelEdit").classList.remove("hidden");
    };

    card.querySelector(".toggle-btn").onclick=()=>{
      a.active=!a.active;
      save(ACT,acts);
      renderActivities();
      populate();
    };

    card.querySelector(".archive-btn").onclick=()=>{
      a.archived=true;
      a.active=false;
      save(ACT,acts);
      renderActivities();
      populate();
    };

    card.querySelector(".cal-btn").onclick=()=>{
      exportCalendar(a);
    };

    list.appendChild(card);
  });

  populate();
}
  
/* LOGGING */
const date=document.getElementById("logDate");
date.value=new Date().toISOString().split("T")[0];
const sel=document.getElementById("logActivity");
const entry=document.getElementById("logEntry");
const hist=document.getElementById("logHistory");

function populate(){
  const sel=document.getElementById("logActivity");
  const summarySel=document.getElementById("summaryActivity");
  if(!sel || !summarySel) return;

  const a=load(ACT);
  sel.innerHTML=Object.values(a)
    .filter(x=>x.active && !x.archived)
    .map(x=>`<option value="${x.id}">${x.name}</option>`)
    .join("");

  summarySel.innerHTML=Object.values(a)
    .filter(x=>!x.archived)
    .map(x=>`<option value="${x.id}">${x.name}</option>`)
    .join("");

  renderEntry();
}

sel.onchange=renderEntry;

function renderEntry(){
  const a=load(ACT)[sel.value];
  if(!a) return;
  entry.innerHTML=`<div class="log-input"><input id="val" type="number" placeholder="${a.unit}"><button>Add</button></div>`;
  entry.querySelector("button").onclick=()=>{
    const l=load(LOG);
    const d=date.value;
    l[d]=l[d]||{};
    l[d][a.id]=l[d][a.id]||[];
    l[d][a.id].push(+document.getElementById("val").value);
    save(LOG,l);
    renderHistory();
    renderSummary();
  };
}

function renderHistory(){
  const l = load(LOG);
  const a = load(ACT);
  hist.innerHTML = "";

  Object.keys(l).sort().reverse().forEach(d=>{
    const day = document.createElement("div");
    day.className = "history-day";
    day.innerHTML = `<strong>${formatHistoryDate(d)}</strong>`;

    Object.keys(l[d]).forEach(id=>{
      l[d][id].forEach((v, idx)=>{
        const s = document.createElement("div");
        s.className = "history-set";
        s.innerHTML = `
          <span>${v} ${a[id]?.unit || ""}</span>
          <button class="icon-btn edit">
            <svg><use xlink:href="#icon-edit"/></svg>
          </button>
          <button class="icon-btn delete">
            <svg><use xlink:href="#icon-delete"/></svg>
          </button>
        `;

        /* EDIT */
        s.querySelector(".edit").onclick = ()=>{
          const nv = prompt("Edit value", v);
          if(nv === null || nv === "") return;
          l[d][id][idx] = +nv;
          save(LOG, l);
          renderHistory();
          renderSummary();
        };

        /* DELETE */
        s.querySelector(".delete").onclick = ()=>{
          if(!confirm("Delete this entry?")) return;
          l[d][id].splice(idx,1);
          if(l[d][id].length === 0) delete l[d][id];
          if(Object.keys(l[d]).length === 0) delete l[d];
          save(LOG, l);
          renderHistory();
          renderSummary();
        };

        day.appendChild(s);
      });
    });

    hist.appendChild(day);
  });
}

/* SUMMARY */
const ctx=document.getElementById("summaryGraph").getContext("2d");
document.getElementById("summaryActivity").onchange=renderSummary;
document.getElementById("summaryRange").onchange=renderSummary;

function renderSummary(){
  const id=document.getElementById("summaryActivity").value;
  if(!id){
  ctx.clearRect(0,0,320,180);
  return;
}
  const range=document.getElementById("summaryRange").value;
  const l=load(LOG);
  const now=new Date(); now.setHours(0,0,0,0);
  let start=new Date(now);
  if(range==="weekly") start.setDate(now.getDate()-now.getDay());
  if(range==="monthly") start=new Date(now.getFullYear(),now.getMonth(),1);
  if(range==="yearly") start=new Date(now.getFullYear(),0,1);
  if(range==="all") start=new Date("1970-01-01");

let data = [];
let sets = [];

Object.keys(l)
  .sort()
  .forEach(d=>{
    const dt = new Date(d);
    if(dt >= start && l[d][id]){
      const sum = l[d][id].reduce((a,b)=>a+b,0);
      data.push({ date:d, value:sum });
      l[d][id].forEach(v=>sets.push(v));
    }
  });

const values = data.map(x=>x.value);

document.getElementById("sTotal").textContent =
  values.reduce((a,b)=>a+b,0);

document.getElementById("sAvg").textContent =
  values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length) : 0;

document.getElementById("sBest").textContent =
  Math.max(0, ...values);

document.getElementById("sBestSet").textContent =
  Math.max(0, ...sets);

document.getElementById("sActive").textContent =
  values.length;

document.getElementById("sStreak").textContent =
  calculateStreak(l, id);

/* DRAW GRAPH */
ctx.clearRect(0,0,320,180);
if(values.length === 0) return;

const max = Math.max(...values, 1);
const step = values.length > 1 ? 320 / (values.length - 1) : 160;

ctx.beginPath();
values.forEach((v,i)=>{
  const x = i * step;
  const y = 170 - (v / max) * 140;
  i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
});
ctx.strokeStyle = "#F57F5B";
ctx.lineWidth = 2;
ctx.stroke();

/* DOTS */
values.forEach((v,i)=>{
  const x = i * step;
  const y = 170 - (v / max) * 140;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#F57F5B";
  ctx.fill();
});

}

function exportCalendar(a){
  if(!a.startTime || !a.endTime){
    alert("Please set start and end time for this activity.");
    return;
  }

  const start=new Date();
  const until=new Date();
  until.setDate(until.getDate()+90);

  const [sh,sm]=a.startTime.split(":");
  const [eh,em]=a.endTime.split(":");

  start.setHours(sh,sm,0,0);
  const end=new Date(start);
  end.setHours(eh,em,0,0);

  let r="FREQ=DAILY";
  if(a.frequency==="alternate") r="FREQ=DAILY;INTERVAL=2";
  if(a.frequency==="custom"){
    const map={Mon:"MO",Tue:"TU",Wed:"WE",Thu:"TH",Fri:"FR",Sat:"SA",Sun:"SU"};
    r="FREQ=WEEKLY;BYDAY="+(a.days||[]).map(d=>map[d]).join(",");
  }

  r+=";UNTIL="+until.toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";

  const ics=`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:${a.name}
DTSTART:${start.toISOString().replace(/[-:]/g,"").split(".")[0]}Z
DTEND:${end.toISOString().replace(/[-:]/g,"").split(".")[0]}Z
RRULE:${r}
END:VEVENT
END:VCALENDAR`;

  const blob=new Blob([ics],{type:"text/calendar"});
  const link=document.createElement("a");
  link.href=URL.createObjectURL(blob);
  link.download=a.name+".ics";
  link.click();
}

function resetActivityForm(){
  edit = null;
  actName.value = "";
  actUnit.value = "count";
  actStart.value = "";
  actEnd.value = "";
  actFreq.value = "daily";
  weekdays.classList.add("hidden");
  weekdays.querySelectorAll("input").forEach(i=>i.checked=false);
  document.getElementById("cancelEdit").classList.add("hidden");
}

function formatHistoryDate(d){
  const date=new Date(d);
  const today=new Date();
  today.setHours(0,0,0,0);

  const diff=(today - date)/(1000*60*60*24);

  if(diff===0) return "Today";
  if(diff===1) return "Yesterday";

  return date.toLocaleDateString(undefined,{
    day:"numeric",
    month:"short",
    year:"numeric"
  });
}

function calculateStreak(logs, activityId){
  let streak = 0;
  const d = new Date();
  d.setHours(0,0,0,0);

  while(true){
    const key = d.toISOString().split("T")[0];
    if(logs[key] && logs[key][activityId]?.length){
      streak++;
      d.setDate(d.getDate() - 1);
    }else{
      break;
    }
  }
  return streak;
}

/* INIT */
renderActivities();
populate();
renderHistory();
renderSummary();

});