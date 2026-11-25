const BLOCKS = Array.from({ length: 13 }, (_, i) => 26 + i);
const FLOORS = Array.from({ length: 9 }, (_, i) => i);
const TIME_SLOTS = [
  "09:20","09:50","10:20","10:50","11:20","11:50","12:20","12:50",
  "13:20","13:50","14:20","14:50","15:20","15:50","16:20","16:50"
];
const STORAGE_KEY = "vacansee-favorites-v2";

function floorName(floor) {
  if (floor === 0) return "Ground Floor";
  const suffix = floor === 1 ? "st" : floor === 2 ? "nd" : floor === 3 ? "rd" : "th";
  return `${floor}${suffix} Floor`;
}
function displayTime(value) {
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2,"0")} ${suffix}`;
}
function getRooms() {
  const rooms = [];
  BLOCKS.forEach(block => {
    // Two clearly labelled prototype rooms on every floor of every listed block.
    FLOORS.forEach(floor => {
      [1, 2].forEach(index => {
        const roomCode = `${floor}${String(index + 1).padStart(2,"0")}`;
        const roomNumber = `${block}-${roomCode}`;
        const capacity = index === 0 ? 30 : 24;
        const type = index === 0 ? "QUIET STUDY" : "GROUP ROOM";
        const purpose = index === 0 ? "Individual study" : "Group discussion";
        rooms.push({
          id: roomNumber,
          name: `Room ${roomNumber}`,
          building: block,
          floor,
          type,
          capacity,
          purpose
        });
      });
    });
  });
  return rooms;
}
const ROOMS = getRooms();

function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.filter(id => ROOMS.some(room => room.id === id)) : [];
  } catch (_) {
    return [];
  }
}
function saveFavorites(favorites) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites)); }
  catch (_) { showToast("Your browser could not save favourites."); }
}
let favorites = readFavorites();

function currentSlot() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let closest = TIME_SLOTS[0];
  let smallestGap = Infinity;
  TIME_SLOTS.forEach(slot => {
    const [h,m] = slot.split(":").map(Number);
    const gap = Math.abs((h * 60 + m) - currentMinutes);
    if (gap < smallestGap) { smallestGap = gap; closest = slot; }
  });
  return closest;
}
function roomStatus(room, slot) {
  // Prototype timetable: deterministic sample data, not live LPU room occupancy.
  const index = TIME_SLOTS.indexOf(slot);
  const seed = room.building * 7 + room.floor * 11 + Number(room.id.split("-")[1]);
  if ((seed + index * 3) % 13 === 0) return "uncertain";
  return (seed + index * 5) % 4 === 0 ? "occupied" : "available";
}
function availabilityText(status, slot) {
  if (status === "uncertain") return "Schedule not confirmed";
  if (status === "occupied") return "Occupied at " + displayTime(slot);
  const index = TIME_SLOTS.indexOf(slot);
  const next = TIME_SLOTS[index + 1];
  return next ? `Available at ${displayTime(slot)}` : `Available at ${displayTime(slot)}`;
}
function roomCard(room, slot) {
  const status = roomStatus(room, slot);
  const saved = favorites.includes(room.id);
  const statusText = status === "available" ? "Available" : status === "occupied" ? "Occupied" : "Uncertain";
  return `<article class="room-card">
    <div class="room-top"><span class="room-type">${room.type}</span><span class="status ${status}">${statusText}</span></div>
    <h3>${room.name}</h3>
    <p class="room-location">Block ${room.building} · ${floorName(room.floor)}</p>
    <div class="room-meta"><span>♙ ${room.capacity} seats</span><span>✦ ${room.purpose}</span></div>
    <div class="room-bottom"><span class="room-time"><b>${availabilityText(status, slot)}</b></span>
    <button class="save ${saved ? "saved" : ""}" data-save="${room.id}" aria-label="${saved ? "Remove" : "Save"} ${room.name}" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button></div>
  </article>`;
}

function updateSavedCount() {
  document.querySelectorAll("#savedCount").forEach(el => el.textContent = favorites.length);
}
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 1900);
}
function setActiveSlot() {
  const timeSelect = document.getElementById("time");
  if (timeSelect && timeSelect.value === "now") return currentSlot();
  return timeSelect ? timeSelect.value : currentSlot();
}
function renderRooms(list, slot, headingPrefix = "") {
  const grid = document.getElementById("roomGrid");
  const empty = document.getElementById("empty");
  const resultText = document.getElementById("resultText");
  if (!grid) return;
  grid.innerHTML = list.map(room => roomCard(room, slot)).join("");
  grid.hidden = list.length === 0;
  if (empty) empty.hidden = list.length !== 0;
  if (resultText) {
    resultText.textContent = `${headingPrefix}${list.length} classroom${list.length === 1 ? "" : "s"} · ${displayTime(slot)}`;
  }
  updateSavedCount();
}
function applySearch() {
  const building = document.getElementById("building")?.value || "all";
  const floor = document.getElementById("floor")?.value || "all";
  const slot = setActiveSlot();
  const matches = ROOMS.filter(room =>
    (building === "all" || String(room.building) === building) &&
    (floor === "all" || String(room.floor) === floor)
  );
  renderRooms(matches, slot);
  const finder = document.querySelector(".finder");
  if (finder) {
    finder.classList.remove("searching");
    void finder.offsetWidth;
    finder.classList.add("searching");
  }
}
function renderSavedPage() {
  const grid = document.getElementById("roomGrid");
  if (!grid) return;
  const savedRooms = ROOMS.filter(room => favorites.includes(room.id));
  const slot = currentSlot();
  renderRooms(savedRooms, slot, "Saved · ");
  const empty = document.getElementById("empty");
  if (empty) {
    empty.innerHTML = `<h3>No saved classrooms yet</h3><p>Save a classroom using the heart icon and it will appear here.</p><a class="button primary" href="index.html#finder">Find a classroom <b>→</b></a>`;
  }
  const title = document.getElementById("savedHeading");
  if (title) title.textContent = `Your saved classrooms (${savedRooms.length})`;
}

document.addEventListener("DOMContentLoaded", () => {
  updateSavedCount();
  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", event => {
      event.preventDefault();
      applySearch();
      document.getElementById("classrooms")?.scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("clear")?.addEventListener("click", () => {
      const buildingSelect = document.getElementById("building");
      const floorSelect = document.getElementById("floor");
      const timeSelect = document.getElementById("time");
      if (buildingSelect) buildingSelect.value = "";
      if (floorSelect) floorSelect.value = "all";
      if (timeSelect) timeSelect.value = "now";
      const section = document.getElementById("classrooms");
      section?.classList.remove("results-visible");
      section?.classList.add("results-hidden");
      const prompt = document.getElementById("resultsPrompt");
      if (prompt) prompt.hidden = false;
      const grid = document.getElementById("roomGrid");
      if (grid) { grid.innerHTML = ""; grid.hidden = true; }
      const empty = document.getElementById("empty");
      if (empty) empty.hidden = true;
      const resultText = document.getElementById("resultText");
      if (resultText) resultText.textContent = "Choose a building and press Search spaces to see classroom availability.";
    });
    document.getElementById("roomGrid")?.addEventListener("click", event => {
      const button = event.target.closest("[data-save]");
      if (!button) return;
      const id = button.dataset.save;
      favorites = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id];
      saveFavorites(favorites);
      updateSavedCount();
      applySearch();
      showToast(favorites.includes(id) ? "Classroom saved." : "Classroom removed from saved.");
    });
    // Homepage results intentionally stay hidden until the student searches.
  }
  if (document.body.dataset.page === "saved") {
    document.getElementById("roomGrid")?.addEventListener("click", event => {
      const button = event.target.closest("[data-save]");
      if (!button) return;
      const id = button.dataset.save;
      favorites = favorites.filter(item => item !== id);
      saveFavorites(favorites);
      renderSavedPage();
      showToast("Classroom removed from saved.");
    });
    document.getElementById("clearSaved")?.addEventListener("click", () => {
      favorites = [];
      saveFavorites(favorites);
      renderSavedPage();
      showToast("All saved classrooms cleared.");
    });
    renderSavedPage();
  }
  document.getElementById("menu")?.addEventListener("click", () => {
    document.getElementById("nav")?.classList.toggle("open");
  });
  document.querySelectorAll("#nav a").forEach(link => {
    link.addEventListener("click", () => document.getElementById("nav")?.classList.remove("open"));
  });
});
