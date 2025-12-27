document.addEventListener("DOMContentLoaded",()=>{

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
const actName=actNameEl=document.getElementById("actName");
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

const archivedList = document.getElementById("archivedActivityList");
archivedList.innerHTML = "";

function renderActivities(){
  const acts = load(ACT);
  list.innerHTML = "";

  Object.values(acts).forEach(a=>{
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
}

    const card = document.createElement("div");
    card.className = "card" + (a.active ? "" : " paused");

    card.innerHTML = `
      <strong>${a.name}</strong> (${a.unit})
      <div class="row" style="margin-top:8px;">
        <button class="secondary edit-btn">Edit</button>
        <button class="secondary toggle-btn">${a.active ? "Pause" : "Resume"}</button>
        <button class="secondary archive-btn">Archive</button>
        <button class="secondary cal-btn">Calendar</button>
      </div>
    `;

    const editBtn   = card.querySelector(".edit-btn");
    const toggleBtn = card.querySelector(".toggle-btn");
    const archiveBtn= card.querySelector(".archive-btn");
    const calBtn    = card.querySelector(".cal-btn");

    /* EDIT */
    editBtn.onclick = ()=>{
      edit = a.id;
      actName.value = a.name;
      actUnit.value = a.unit;
      actStart.value = a.startTime || "";
      actEnd.value = a.endTime || "";
      actFreq.value = a.frequency || "daily";
      weekdays.classList.toggle("hidden", a.frequency !== "custom");
      weekdays.querySelectorAll("input").forEach(i=>{
        i.checked = a.days?.includes(i.value);
      });
      document.getElementById("cancelEdit").classList.remove("hidden");
    };

    /* PAUSE / RESUME */
    toggleBtn.onclick = ()=>{
      a.active = !a.active;
      save(ACT, acts);
      renderActivities();
      populate();
    };

    /* ARCHIVE */
    archiveBtn.onclick = ()=>{
      a.archived = true;
      a.active = false;
      save(ACT, acts);
      renderActivities();
      populate();
    };

    /* CALENDAR EXPORT */
    calBtn.onclick = ()=>{
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
  const a=load(ACT);
  sel.innerHTML=Object.values(a).map(x=>`<option value="${x.id}">${x.name}</option>`).join("");
  document.getElementById("summaryActivity").innerHTML=sel.innerHTML;
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
  const l=load(LOG), a=load(ACT);
  hist.innerHTML="";
  Object.keys(l).sort().reverse().forEach(d=>{
    const day=document.createElement("div");
    day.className="history-day";
    day.innerHTML=`<strong>${d}</strong>`;
    Object.keys(l[d]).forEach(id=>{
      l[d][id].forEach(v=>{
        const s=document.createElement("div");
        s.className="history-set";
        s.innerHTML=`<span>${v} ${a[id]?.unit||""}</span>
          <button class="icon-btn"><svg><use xlink:href="#icon-edit"/></svg></button>
          <button class="icon-btn delete"><svg><use xlink:href="#icon-delete"/></svg></button>`;
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
  const range=document.getElementById("summaryRange").value;
  const l=load(LOG);
  const now=new Date(); now.setHours(0,0,0,0);
  let start=new Date(now);
  if(range==="weekly") start.setDate(now.getDate()-now.getDay());
  if(range==="monthly") start=new Date(now.getFullYear(),now.getMonth(),1);
  if(range==="yearly") start=new Date(now.getFullYear(),0,1);
  if(range==="all") start=new Date("1970-01-01");

  let days=[],sets=[];
  Object.keys(l).forEach(d=>{
    const dt=new Date(d);
    if(dt>=start && l[d][id]){
      const sum=l[d][id].reduce((a,b)=>a+b,0);
      days.push(sum);
      l[d][id].forEach(v=>sets.push(v));
    }
  });

  document.getElementById("sTotal").textContent=days.reduce((a,b)=>a+b,0);
  document.getElementById("sAvg").textContent=days.length?Math.round(days.reduce((a,b)=>a+b,0)/days.length):0;
  document.getElementById("sBest").textContent=Math.max(0,...days);
  document.getElementById("sBestSet").textContent=Math.max(0,...sets);
  document.getElementById("sActive").textContent=days.length;
  document.getElementById("sStreak").textContent=days.length;

  ctx.clearRect(0,0,320,180);
  if(!days.length) return;
  const max=Math.max(...days,1);
  ctx.strokeStyle="#F57F5B";
  ctx.beginPath();
  days.forEach((v,i)=>{
    const x=i*(320/(days.length-1||1));
    const y=180-(v/max)*160;
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.stroke();
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

/* INIT */
renderActivities();
populate();
renderHistory();
renderSummary();

});