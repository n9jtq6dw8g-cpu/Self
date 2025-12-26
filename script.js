const form = document.getElementById("habitForm");
const output = document.getElementById("output");

const todayKey = new Date().toISOString().split("T")[0];

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = {
    date: todayKey,
    skipping: document.getElementById("skipping").value || 0,
    water: document.getElementById("water").value || 0,
    stretching: document.getElementById("stretching").value || 0
  };

  localStorage.setItem(todayKey, JSON.stringify(data));
  displayData(data);
});

function displayData(data) {
  output.textContent = JSON.stringify(data, null, 2);
}

// Load today’s data if already saved
const saved = localStorage.getItem(todayKey);
if (saved) {
  displayData(JSON.parse(saved));
}
