 // CONTENT
const FILES = [
  {
    name: "Esports Comparison",
    icon: "📁",
    title: "Esports Comparison",
    meta: "Personal project · 2025",
    desc: "Compares head-to-head win rates between all teams, based on the draft. Pulls live data through an API.",
    tags: ["Python", "API", "Vue"],
    link: "https://example.com"       // TODO: replace with the real project link
  },
  {
    name: "League Tracker",
    icon: "📁",
    title: "League Tracker",
    meta: "Personal project · 2025",
    desc: "A Liquipedia-style tracker for League of Legends esports.",
    tags: ["React", "localStorage"],
    link: "https://github.com"        // TODO: replace with the real project link
  },
  {
    name: "Draft Explorer",
    icon: "🎮",
    title: "Draft Explorer - lol-predict (demo)",
    type: "iframe",                    // opens a page inside the window
    url: "demos/lol-predict/index.html",
    size: { width: "min(980px, 94%)", height: "min(620px, calc(100% - 40px))" }   // bigger than the default
  },
  {
    name: "About me.txt",
    icon: "📄",
    title: "About me.txt - Notepad",
    text: "Hi, I'm Matej.\n\nI build small, useful things for myself and my passions.\nDouble-click the folders on the desktop\nto see my projects.\n\nBased in: Bratislava\nSkills: HTML, CSS, JavaScript, Python..."
  },
  {
    name: "Experience.txt",
    icon: "📄",
    title: "Experience.txt - Notepad",
    text: "I've been interning at VUB Bank since November 2024.\n\nI work as a full-stack web developer. My work also includes\nbuilding pipelines, APIs and database management.\n\nBased in: Bratislava\nSkills: HTML, CSS, JavaScript, Python..."
  },
  {
    name: "Contact.txt",
    icon: "✉️",
    title: "Contact.txt - Notepad",
    text: "Email:    matejbamburak11@gmail.com\nGitHub:   github.com/nef3o\nLinkedIn: linkedin.com/in/matej-bamburak-74a281317"
  },
  {
    name: "University.txt",
    icon: "📄",
    title: "University.txt - Notepad",
    text: "University:     Comenius University Bratislava\nFaculty:        Faculty of Management\nSpecialization: Data Science\n\nI'm finishing my Bachelor's degree in summer 2027\nand plan to continue towards a Master's degree."
  },
  {
    name: "Personalize",
    icon: "🎨",
    title: "Personalization",
    type: "wallpapers"                 // special type: opens the wallpaper picker
  },
  {
    // Easter egg: hidden from the desktop and Start menu, opened by typing a secret word
    name: "Great Success",
    icon: "⚠️",
    title: "System Message",
    type: "easter-egg",
    hidden: true,
    size: { width: "min(380px, 92%)", height: "230px" }
  }
];

// WALLPAPER SETTINGS
const WALLPAPER_FOLDER = "wallpapers/";
const WALLPAPERS = [
  "sunset.svg",
  "forest.svg",
  "midnight.svg",
  "krava.jpg",
  "xp.jpg"
];
const WALLPAPER_STORAGE_KEY = "portfolio-wallpaper";   // remembers the choice between visits
const SECRET_WORDS = ["borat", "booyakasha", "niceee"]; // type these to open easter egg windows; case-insensitive, accents ignored
const FILE_TO_OPEN_ON_LOAD = "Contact.txt";     // name of the file to open at start; use null for a clean desktop

// STATE + SHORTCUTS 
const $ = (selector) => document.querySelector(selector);

const iconGrid  = $("#icon-grid");
const startMenu = $("#start-menu");
const startBtn  = $("#start-button");
const taskList  = $("#task-list");
const desktop   = $("#desktop");

const openWindows = {};             // index in FILES -> { win, task }
let topZ = 10;                      // grows each time a window is focused, so it sits on top
let activeIndex = null;             // which window currently has focus
const isTouch = matchMedia("(pointer: coarse)").matches;

// SMALL HELPERS

// Stops text from being read as HTML (safe habit when inserting content into the page)
function escapeHTML(text) {
  return text.replace(/[&<>"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[char]));
}

// Returns the HTML for the inside of a window, depending on the file type
function buildContent(file) {
  if (file.type === "wallpapers") return buildWallpaperPicker();

  // Fake Windows error dialog (the easter egg)
  if (file.type === "easter-egg") {
    return `
      <div class="egg">
        <span class="egg-icon" aria-hidden="true">⚠️</span>
        <div>
          <p class="egg-title">Great success!</p>
          <p>You found the hidden file. Your visit has been verified and your browser is now officially approved by this portfolio.</p>
          <p>Very nice.</p>
        </div>
      </div>
      <div class="egg-buttons"><button class="egg-ok">High five</button></div>`;
  }
  // A page shown inside the window, like a mini browser
  if (file.type === "iframe") {
    return `<iframe class="demo-frame" src="${file.url}" title="${escapeHTML(file.title)}"
                    loading="lazy" sandbox="allow-scripts allow-same-origin"></iframe>`;
  }

  if (file.text) {
    return `<pre class="notepad">${escapeHTML(file.text)}</pre>`;
  }

  const tags = file.tags
    .map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`)
    .join("");

  return `
    <div class="address-bar">📁 Projects ▸ ${escapeHTML(file.name)}</div>
    <h2>${escapeHTML(file.title)}</h2>
    <p class="meta">${escapeHTML(file.meta)}</p>
    <p>${escapeHTML(file.desc)}</p>
    <div>${tags}</div>
    <a class="open-link" href="${file.link}" target="_blank" rel="noopener">Open project</a>
  `;
}

// DESKTOP ICONS + START MENU
function buildDesktopIcons() {
  if (file.hidden) return;         // hidden files (the easter egg) get no icon
  FILES.forEach((file, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");

    button.className = "icon";
    button.innerHTML = `<span class="icon-image">${file.icon}</span>${escapeHTML(file.name)}`;

    // Single click selects. On touch screens, or when activated with the
    // keyboard (event.detail === 0), it opens straight away.
    button.addEventListener("click", (event) => {
      document.querySelectorAll(".icon").forEach((icon) => icon.classList.remove("selected"));
      button.classList.add("selected");
      if (isTouch || event.detail === 0) openFile(index);
    });

    // Double click opens, like the real thing
    button.addEventListener("dblclick", () => openFile(index));

    item.appendChild(button);
    iconGrid.appendChild(item);
  });
}

function buildStartMenu() {
  FILES.forEach((file, index) => {
    if (file.hidden) return;         // hidden files (the easter egg) get no entry in the Start menu
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = `${file.icon} ${file.name}`;
    button.addEventListener("click", () => {
      openFile(index);
      toggleStartMenu(false);
    });
    item.appendChild(button);
    startMenu.appendChild(item);
  });
}

// Pass true/false to force it open/closed; with no argument it flips
function toggleStartMenu(forceOpen) {
  const shouldOpen = forceOpen ?? startMenu.hidden;
  startMenu.hidden = !shouldOpen;
  startBtn.setAttribute("aria-expanded", String(shouldOpen));
}

// WINDOW MANAGEMENT
function openFile(index) {
  // Already open? Just bring it back to the front.
  if (openWindows[index]) {
    showWindow(index);
    return;
  }
  createWindow(index);
}

function createWindow(index) {
  const file = FILES[index];
  const win = document.createElement("section");
  const offset = Object.keys(openWindows).length * 28;   // each new window is nudged so they cascade

  win.className = "window";
  win.setAttribute("role", "dialog");
  win.setAttribute("aria-label", file.title);
  const width = file.size?.width ?? "min(480px, 92%)";      // files can ask for a bigger window
  const height = file.size?.height ?? "340px";
  win.style.cssText = `left: ${110 + offset}px; top: ${30 + offset}px; width: ${width}; height: ${height};`;

  win.innerHTML = `
    <div class="titlebar">
      <span>${file.icon}</span>
      <span class="titlebar-text">${escapeHTML(file.title)}</span>
      <div class="window-buttons">
        <button class="minimize" aria-label="Minimize">–</button>
        <button class="maximize" aria-label="Maximize">□</button>
        <button class="close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="window-content">${buildContent(file)}</div>
  `;
  desktop.appendChild(win);
  if (file.type === "wallpapers") initWallpaperPicker(win);
  if (file.type === "easter-egg") {
    win.querySelector(".egg-ok").addEventListener("click", () => closeWindow(index));
  }
  if (file.type === "iframe") {
    // Clicks inside an iframe never reach our pointerdown handler, so when the
    // page loses focus to the frame we bring this window to the front instead.
    window.addEventListener("blur", () => {
      if (openWindows[index]?.win === win && document.activeElement === win.querySelector(".demo-frame")) {
        focusWindow(index);
      }
    });
  }

  // Matching button in the taskbar
  const task = document.createElement("button");
  task.className = "task";
  task.textContent = `${file.icon} ${file.title}`;
  taskList.appendChild(task);

  openWindows[index] = { win, task };

  // Wire up the buttons and interactions
  win.addEventListener("pointerdown", () => focusWindow(index));
  win.querySelector(".minimize").addEventListener("click", () => minimizeWindow(index));
  win.querySelector(".maximize").addEventListener("click", () => win.classList.toggle("maximized"));
  win.querySelector(".close").addEventListener("click", () => closeWindow(index));
  task.addEventListener("click", () => toggleFromTaskbar(index));

  const titlebar = win.querySelector(".titlebar");
  titlebar.addEventListener("dblclick", (event) => {
    if (!event.target.closest(".window-buttons")) win.classList.toggle("maximized");
  });
  makeDraggable(win, titlebar);

  focusWindow(index);
}

function focusWindow(index) {
  activeIndex = index;
  openWindows[index].win.style.zIndex = ++topZ;

  // Only the focused window's taskbar button looks "pressed"
  for (const key in openWindows) {
    openWindows[key].task.classList.toggle("active", Number(key) === index);
  }
}

function showWindow(index) {
  openWindows[index].win.classList.remove("minimized");
  focusWindow(index);
}

function minimizeWindow(index) {
  openWindows[index].win.classList.add("minimized");
  openWindows[index].task.classList.remove("active");
}

function closeWindow(index) {
  openWindows[index].win.remove();
  openWindows[index].task.remove();
  delete openWindows[index];
  if (activeIndex === index) activeIndex = null;
}

// Clicking a taskbar button: minimize it if it's already in front, otherwise show it
function toggleFromTaskbar(index) {
  const { task } = openWindows[index];
  if (task.classList.contains("active")) {
    minimizeWindow(index);
  } else {
    showWindow(index);
  }
}

// Lets a window be dragged by its title bar (works with mouse and touch)
function makeDraggable(win, handle) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".window-buttons")) return;
    if (win.classList.contains("maximized")) return;

    // Remember where inside the window the pointer grabbed it
    const grabX = event.clientX - win.offsetLeft;
    const grabY = event.clientY - win.offsetTop;
    handle.setPointerCapture(event.pointerId);

    handle.onpointermove = (moveEvent) => {
      win.style.left = Math.max(-200, moveEvent.clientX - grabX) + "px";
      win.style.top  = Math.max(0, moveEvent.clientY - grabY) + "px";   // never lose the title bar off-screen
    };
    handle.onpointerup = () => { handle.onpointermove = null; };
  });
}

// WALLPAPER SWITCHER
let currentWallpaper = "";            // "" means the default blue gradient

// "my-photo_01.jpg" -> "my photo 01" (used as the caption under each thumbnail)
function wallpaperLabel(filename) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
}

// HTML for the picker window: the default option plus one thumbnail per file in WALLPAPERS
function buildWallpaperPicker() {
  const options = WALLPAPERS.map((name) => `
    <button class="wallpaper-option" data-wallpaper="${escapeHTML(name)}">
      <img src="${WALLPAPER_FOLDER}${encodeURI(name)}" alt="" loading="lazy">
      <span>${escapeHTML(wallpaperLabel(name))}</span>
    </button>`).join("");

  return `
    <div class="address-bar">🎨 Control Panel ▸ Personalization</div>
    <h2>Change your desktop background</h2>
    <p class="meta">Click a picture to apply it.</p>
    <div class="wallpaper-grid">
      <button class="wallpaper-option" data-wallpaper="">
        <span class="default-swatch"></span>
        <span>Windows blue</span>
      </button>
      ${options}
    </div>`;
}

function applyWallpaper(name) {
  currentWallpaper = name;
  // An empty string removes the inline style, so the CSS gradient comes back
  desktop.style.background = name
    ? `url("${WALLPAPER_FOLDER}${encodeURI(name)}") center / cover no-repeat`
    : "";

  try {
    if (name) localStorage.setItem(WALLPAPER_STORAGE_KEY, name);
    else localStorage.removeItem(WALLPAPER_STORAGE_KEY);
  } catch (error) { /* storage can be blocked (private mode); the wallpaper still changes */ }

  markSelectedWallpaper();
}

// Highlights the thumbnail that matches the current wallpaper
function markSelectedWallpaper() {
  document.querySelectorAll(".wallpaper-option").forEach((button) => {
    button.classList.toggle("selected", button.dataset.wallpaper === currentWallpaper);
  });
}

function initWallpaperPicker(win) {
  win.querySelector(".wallpaper-grid").addEventListener("click", (event) => {
    const button = event.target.closest(".wallpaper-option");
    if (button) applyWallpaper(button.dataset.wallpaper);
  });
  markSelectedWallpaper();
}

// Re-applies the wallpaper chosen on a previous visit
function loadSavedWallpaper() {
  try {
    const saved = localStorage.getItem(WALLPAPER_STORAGE_KEY);
    if (saved && WALLPAPERS.includes(saved)) applyWallpaper(saved);
  } catch (error) { /* ignore */ }
}

// Right-click on the empty desktop shows a small "Personalize" menu
function setupDesktopContextMenu() {
  const menu = $("#context-menu");
  const personalizeIndex = FILES.findIndex((file) => file.type === "wallpapers");

  desktop.addEventListener("contextmenu", (event) => {
    if (event.target.id !== "desktop") return;   // only on empty space, not on icons or windows
    event.preventDefault();
    menu.style.left = event.clientX + "px";
    menu.style.top = event.clientY + "px";
    menu.hidden = false;
  });

  menu.querySelector("button").addEventListener("click", () => openFile(personalizeIndex));
  document.addEventListener("click", () => { menu.hidden = true; });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") menu.hidden = true; });
}

// CLOCK
function updateClock() {
  const now = new Date();
  $("#clock").innerHTML =
    now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
    "<br>" + now.toLocaleDateString();
}

// GLOBAL EVENTS
startBtn.addEventListener("click", (event) => {
  event.stopPropagation();           // otherwise the document click below closes it again
  toggleStartMenu();
});

// Clicking anywhere else closes the start menu
document.addEventListener("click", (event) => {
  if (!startMenu.contains(event.target)) toggleStartMenu(false);
});

// Clicking empty desktop deselects icons
desktop.addEventListener("click", (event) => {
  if (event.target.id === "desktop") {
    document.querySelectorAll(".icon").forEach((icon) => icon.classList.remove("selected"));
  }
});

// Escape closes the start menu first, then the focused window
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!startMenu.hidden) toggleStartMenu(false);
  else if (activeIndex !== null) closeWindow(activeIndex);
});
// Easter egg: remember the last few keys typed and look for a secret word
let typedKeys = "";
document.addEventListener("keydown", (event) => {
  if (event.key.length !== 1) return;                     // ignore Shift, Escape, arrows...
  typedKeys = (typedKeys + event.key.toLowerCase()).slice(-20);   // keep only the latest 20 characters

  if (SECRET_WORDS.some((word) => typedKeys.endsWith(word))) {
    typedKeys = "";
    openFile(FILES.findIndex((file) => file.type === "easter-egg"));
  }
});
// START UP
buildDesktopIcons();
buildStartMenu();
setupDesktopContextMenu();
loadSavedWallpaper();
updateClock();
setInterval(updateClock, 30000);     // refresh twice a minute is plenty
if (FILE_TO_OPEN_ON_LOAD !== null) {
  const startIndex = FILES.findIndex((file) => file.name === FILE_TO_OPEN_ON_LOAD);   // by name, so adding files never breaks it
  if (startIndex !== -1) openFile(startIndex);
}
