/* ══════════════════════════════════════════
   VremeaAzi — script.js
   Geocoding: Open-Meteo (multi-result, free, no key)
   POIs:      Overpass / OpenStreetMap (free, no key)
              + Wikipedia summaries (free, no key)
   Globe:     Three.js (Blue Marble texture, no key)
   AI:        Google Gemini (key injected via window.__VREMEA__)
══════════════════════════════════════════ */

const WX_KEY  = '914254454ca488d913232fffe6d35533';
const WX_BASE = 'https://api.openweathermap.org';

const GEO_BASE      = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_BASE  = 'https://nominatim.openstreetmap.org/reverse';
const OVERPASS_BASE = 'https://overpass-api.de/api/interpreter';
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast';

const GEMINI_KEY = (AIzaSyBFv-BuClqYb-NT6VJZTln2co5MoYbtCyw) || '';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

// ─── DOM ─────────────────────────────────
const cityInput  = document.getElementById('city-input');
const searchBtn  = document.getElementById('search-btn');
const locateBtn  = document.getElementById('locate-btn');
const suggestDiv = document.getElementById('suggestions');

// ─── STATE ───────────────────────────────
let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
let debounceTimer  = null;
let currentCity    = '';
let currentCountry = '';

let currentLat = 0;
let currentLon = 0;

// ══════════════════════════════════════════
// THEME
// ══════════════════════════════════════════
const themeBtn = document.getElementById('theme-toggle');
function applyTheme(isLight) {
  document.body.classList.toggle('light', isLight);
  localStorage.setItem('lightMode', isLight);
}
applyTheme(localStorage.getItem('lightMode') === 'true');
themeBtn.addEventListener('click', () => applyTheme(!document.body.classList.contains('light')));

// ══════════════════════════════════════════
// SIDEBAR — Stable scroll spy
// Fixes:
//   - No more "skipping" through items when you click a nav link
//     (the spy is suppressed during the smooth-scroll animation)
//   - No more flicker when scrolling between sections
//     (always picks one active id, never blank, throttled with rAF)
//   - Last section now lights up correctly when scrolled to bottom
// ══════════════════════════════════════════
const sidebar         = document.getElementById('sidebar');
const sidebarToggle   = document.getElementById('sidebar-toggle');     // header hamburger (mobile)
const sidebarCollapse = document.getElementById('sidebar-collapse-btn'); // bottom-of-sidebar (desktop)
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const navItems        = Array.from(document.querySelectorAll('.nav-item[data-section]'));
const scrollArea      = document.getElementById('scroll-area');

const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

// ── Desktop: persisted collapse state (icon-only vs full) ──
const SIDEBAR_KEY = 'sidebarCollapsed';
if (localStorage.getItem(SIDEBAR_KEY) === 'true') {
  sidebar.classList.add('collapsed');
}
function setCollapsed(on) {
  sidebar.classList.toggle('collapsed', on);
  localStorage.setItem(SIDEBAR_KEY, String(on));
}
if (sidebarCollapse) {
  sidebarCollapse.addEventListener('click', () => {
    setCollapsed(!sidebar.classList.contains('collapsed'));
  });
}

// ── Mobile: open/close drawer with backdrop ──
function openDrawer() {
  sidebar.classList.add('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
}
function closeDrawer() {
  sidebar.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
}
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeDrawer();
    else openDrawer();
  });
}
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeDrawer);
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

let activeId       = navItems[0]?.dataset.section || '';
let suppressSpy    = false;
let suppressTimer  = null;
let pendingFrame   = null;

// Cached section metrics in SCROLL-AREA coordinates.
// We can't use el.offsetTop because the two-column grid creates separate
// offset parents for the left and right columns, so sections in the right
// column report an offsetTop relative to their column instead of to the
// scroll area. getBoundingClientRect gives us the real on-screen geometry.
let sectionsCache = null;
function getSections() {
  if (!sectionsCache && scrollArea) {
    const baseTop = scrollArea.getBoundingClientRect().top;
    const scrollOffset = scrollArea.scrollTop;
    sectionsCache = navItems.map(item => {
      const el = document.getElementById(item.dataset.section);
      if (!el || el.offsetParent === null) return null;
      const rect   = el.getBoundingClientRect();
      const top    = rect.top - baseTop + scrollOffset;
      const height = rect.height;
      return {
        id: item.dataset.section,
        el,
        top,
        height,
        center: top + height / 2,
        bottom: top + height,
      };
    }).filter(Boolean);
  }
  return sectionsCache || [];
}
function invalidateSectionsCache() {
  sectionsCache = null;
}

function setActive(id) {
  if (!id || id === activeId) return;
  activeId = id;
  for (const n of navItems) {
    n.classList.toggle('active', n.dataset.section === id);
  }
}

// Click → smooth scroll so the target section's CENTER lands on the
// viewport's vertical middle (so the spy will then keep it active).
// First/last items snap to top/bottom edges instead so they line up cleanly.
navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const id = item.dataset.section;
    if (!scrollArea) return;

    const sections = getSections();
    if (!sections.length) return;
    const target = sections.find(s => s.id === id);
    if (!target) return;

    setActive(id);

    // Disable scroll spy while the smooth-scroll animation runs,
    // otherwise the sidebar lights up every section we pass through.
    suppressSpy = true;
    clearTimeout(suppressTimer);

    const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
    let targetY;
    if (target === sections[0]) {
      targetY = 0;
    } else if (target === sections[sections.length - 1]) {
      targetY = maxScroll;
    } else {
      // Place the section's vertical middle at the viewport's vertical middle.
      targetY = target.center - scrollArea.clientHeight / 2;
    }
    targetY = Math.max(0, Math.min(targetY, maxScroll));

    scrollArea.scrollTo({ top: targetY, behavior: 'smooth' });

    // Re-enable spy after the smooth scroll likely finished.
    suppressTimer = setTimeout(() => { suppressSpy = false; }, 700);

    if (isMobile()) closeDrawer();
  });
});

// Scroll spy — picks the LAST section whose top has scrolled past an
// anchor line at 30% down the viewport. Now that all sections stack in
// a single column in nav order, this is unambiguous and never skips.
function computeActive() {
  pendingFrame = null;
  if (suppressSpy || !scrollArea) return;

  const sections = getSections();
  if (!sections.length) return;

  const scrollTop = scrollArea.scrollTop;
  const viewport  = scrollArea.clientHeight;
  const scrollMax = scrollArea.scrollHeight;

  // Force the last item when scrolled to the very bottom (its top may
  // never reach the anchor line if the section is short).
  if (scrollTop + viewport >= scrollMax - 4) {
    setActive(sections[sections.length - 1].id);
    return;
  }

  const anchor = scrollTop + viewport * 0.30;
  let current = sections[0].id;
  for (const s of sections) {
    if (s.top <= anchor) current = s.id;
    else break;
  }
  setActive(current);
}

function scheduleSpy() {
  if (pendingFrame !== null) return;
  pendingFrame = requestAnimationFrame(computeActive);
}

if (scrollArea) {
  scrollArea.addEventListener('scroll', scheduleSpy, { passive: true });
}
window.addEventListener('resize', () => {
  invalidateSectionsCache();
  scheduleSpy();
});

// ══════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════
function normalizeStr(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[şŞșȘ]/g,'s').replace(/[ţŢțȚ]/g,'t')
    .replace(/[ăĂâÂ]/g,'a').replace(/[îÎ]/g,'i').toLowerCase();
}
function windDir(d) { return ['N','NE','E','SE','S','SV','V','NV'][Math.round(d/45)%8]; }
function dewPoint(t,h) { return Math.round(t-((100-h)/5)); }
function fmtTime(ts) {
  return new Date(ts*1000).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
}
function updateDateTime() {
  const el = document.getElementById('date-time');
  if (el) el.textContent = new Date().toLocaleDateString('ro-RO',{
    weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'
  });
}
function setLoading(on) {
  const areas = document.querySelectorAll('.hero-section,.page-section');
  areas.forEach(a => a.classList.toggle('loading-state', on));
}

// ══════════════════════════════════════════
// RECENT SEARCHES
// ══════════════════════════════════════════
function addRecent(city) {
  recentSearches = [city,...recentSearches.filter(c=>c.toLowerCase()!==city.toLowerCase())].slice(0,5);
  localStorage.setItem('recentSearches',JSON.stringify(recentSearches));
}
function removeRecent(city) {
  recentSearches = recentSearches.filter(c=>c!==city);
  localStorage.setItem('recentSearches',JSON.stringify(recentSearches));
  showSuggestions('');
}
window.removeRecent = removeRecent;

// ══════════════════════════════════════════
// SUGGESTIONS — Local RO DB + API
// ══════════════════════════════════════════
const RO_NAMES = {
  'Bucharest':'București','Iasi':'Iași','Brasov':'Brașov','Timisoara':'Timișoara',
  'Constanta':'Constanța','Craiova':'Craiova','Galati':'Galați','Ploiesti':'Ploiești',
  'Braila':'Brăila','Bacau':'Bacău','Pitesti':'Pitești','Targu Mures':'Târgu Mureș',
  'Baia Mare':'Baia Mare','Buzau':'Buzău','Satu Mare':'Satu Mare','Botosani':'Botoșani',
  'Ramnicu Valcea':'Râmnicu Vâlcea','Suceava':'Suceava','Targoviste':'Târgoviște',
  'Focsani':'Focșani','Tulcea':'Tulcea','Alba Iulia':'Alba Iulia','Bistrita':'Bistrița',
  'Resita':'Reșița','Sfantu Gheorghe':'Sfântu Gheorghe','Piatra Neamt':'Piatra Neamț'
};

const RO_DB = [
  ['București','Bucharest,RO',1],['Cluj-Napoca','Cluj-Napoca,RO',1],
  ['Timișoara','Timisoara,RO',1],['Iași','Iasi,RO',1],
  ['Constanța','Constanta,RO',1],['Craiova','Craiova,RO',1],
  ['Brașov','Brasov,RO',1],['Galați','Galati,RO',1],
  ['Ploiești','Ploiesti,RO',1],['Oradea','Oradea,RO',1],
  ['Brăila','Braila,RO',2],['Bacău','Bacau,RO',2],
  ['Arad','Arad,RO',2],['Pitești','Pitesti,RO',2],
  ['Sibiu','Sibiu,RO',2],['Târgu Mureș','Targu Mures,RO',2],
  ['Baia Mare','Baia Mare,RO',2],['Buzău','Buzau,RO',2],
  ['Satu Mare','Satu Mare,RO',2],['Botoșani','Botosani,RO',2],
  ['Râmnicu Vâlcea','Ramnicu Valcea,RO',2],['Suceava','Suceava,RO',2],
  ['Târgoviște','Targoviste,RO',2],['Focșani','Focsani,RO',2],
  ['Tulcea','Tulcea,RO',2],['Deva','Deva,RO',2],
  ['Alba Iulia','Alba Iulia,RO',2],['Bistrița','Bistrita,RO',2],
  ['Reșița','Resita,RO',2],['Sfântu Gheorghe','Sfantu Gheorghe,RO',2],
  ['Piatra Neamț','Piatra Neamt,RO',2],['Sinaia','Sinaia,RO',2],
  ['Mangalia','Mangalia,RO',2],['Predeal','Predeal,RO',2],
  ['Giurgiu','Giurgiu,RO',2],['Vaslui','Vaslui,RO',2],
];

const WORLD_MAJOR = new Set([
  'london','paris','berlin','rome','madrid','vienna','amsterdam','brussels',
  'prague','warsaw','budapest','athens','lisbon','stockholm','oslo','copenhagen',
  'zurich','milan','barcelona','munich','new york','los angeles','toronto',
  'sydney','tokyo','beijing','dubai','istanbul','moscow','kyiv',
  'singapore','bangkok','seoul','cairo','cape town','rio de janeiro'
]);

function scoreCity(city, nq) {
  const n = normalizeStr(city.name);
  let s = 1000;
  if (n===nq) s-=500;
  else if (n.startsWith(nq)) s-=300;
  else if (n.includes(nq)) s-=100;
  if (city.country==='RO') s-=200;
  else if (city.country==='MD') s-=80;
  else if (WORLD_MAJOR.has(n)) s-=60;
  return s;
}

function searchRO(q) {
  const nq = normalizeStr(q);
  return RO_DB
    .filter(([n]) => normalizeStr(n).includes(nq))
    .sort(([nA,,tA],[nB,,tB]) => {
      const a=normalizeStr(nA),b=normalizeStr(nB);
      if(a===nq&&b!==nq)return -1; if(b===nq&&a!==nq)return 1;
      if(a.startsWith(nq)&&!b.startsWith(nq))return -1;
      if(!a.startsWith(nq)&&b.startsWith(nq))return 1;
      return tA-tB;
    })
    .slice(0,4)
    .map(([name,apiQuery]) => ({name,country:'RO',apiQuery,_local:true}));
}

function renderSugg(cities) {
  if (!cities.length) { suggestDiv.classList.remove('active'); return; }
  suggestDiv.innerHTML = cities.map(c => {
    const q = c.apiQuery || (c.state?`${c.name},${c.state},${c.country}`:`${c.name},${c.country}`);
    const flag = c.country==='RO'?'🇷🇴 ':'';
    const label = c._local ? `${flag}${c.name}` : (c.state?`${c.name}, ${c.state}, ${c.country}`:`${c.name}, ${c.country}`);
    // If we already know precise coords (from OWM /geo) include them so the
    // click handler can skip the disambiguation modal entirely.
    const coords = (Number.isFinite(c.lat) && Number.isFinite(c.lon))
      ? ` data-lat="${c.lat}" data-lon="${c.lon}" data-country="${c.country||''}" data-state="${c.state||''}"`
      : '';
    return `<div class="suggestion-item" data-query="${q}" data-display="${c.name}"${coords}>${label}</div>`;
  }).join('');
  suggestDiv.classList.add('active');
  safeIcons();
}

async function fetchAndShow(q) {
  if (!q || q.length<2) return;
  const nq = normalizeStr(q);
  const local = searchRO(q);
  renderSugg(local);
  try {
    const res  = await fetch(`${WX_BASE}/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=20&appid=${WX_KEY}`);
    const data = await res.json();
    if (!Array.isArray(data)) return;
    const seen = new Set(local.map(c=>normalizeStr(c.name)+'-RO'));
    const api  = data
      .filter(c => {const k=`${normalizeStr(c.name)}-${c.country}`;if(seen.has(k))return false;seen.add(k);return true;})
      .map(c=>(c.country==='RO'&&RO_NAMES[c.name])?{...c,name:RO_NAMES[c.name]}:c)
      .filter(c=>c.country!=='RO')
      .sort((a,b)=>scoreCity(a,nq)-scoreCity(b,nq))
      .slice(0,3);
    if (cityInput.value.trim()===q.trim()) renderSugg([...local,...api].slice(0,7));
  } catch(e){ console.error(e); }
}

function showSuggestions(v) {
  if (!v) {
    if (recentSearches.length) {
      suggestDiv.innerHTML = recentSearches.map(c=>`
        <div class="suggestion-item recent" data-city="${c}">
          <span class="suggestion-text">🕐 ${c}</span>
          <button class="remove-recent" onclick="event.stopPropagation();removeRecent('${c}')">✕</button>
        </div>`).join('');
      suggestDiv.classList.add('active');
    } else suggestDiv.classList.remove('active');
    return;
  }
  clearTimeout(debounceTimer);
  const local = searchRO(v);
  if (local.length) renderSugg(local);
  debounceTimer = setTimeout(()=>fetchAndShow(v), 300);
}

// ══════════════════════════════════════════
// GEOCODING (Open-Meteo, multi-result, with disambiguation modal)
// ══════════════════════════════════════════
async function geocodeMulti(query) {
  const r = await fetch(
    `${GEO_BASE}?name=${encodeURIComponent(query)}&count=10&language=ro&format=json`
  );
  const j = await r.json();
  return (j.results || []).map(r => ({
    name:        r.name,
    country:     r.country_code,
    countryName: r.country,
    admin1:      r.admin1,
    admin2:      r.admin2,
    admin3:      r.admin3,
    admin4:      r.admin4,
    lat:         r.latitude,
    lon:         r.longitude,
    elevation:   r.elevation,
    population:  r.population || 0,
    timezone:    r.timezone,
    feature:     r.feature_code,
  }));
}

function geoDisplayLine(g) {
  return [g.admin3, g.admin2, g.admin1, g.countryName].filter(Boolean).join(', ');
}
function geoFlagEmoji(cc) {
  if (!cc || cc.length !== 2) return '🌍';
  const A = 0x1F1E6, c = cc.toUpperCase();
  return String.fromCodePoint(A + (c.charCodeAt(0) - 65), A + (c.charCodeAt(1) - 65));
}

const geoModal      = document.getElementById('geo-modal');
const geoModalList  = document.getElementById('geo-modal-list');
const geoModalClose = document.getElementById('geo-modal-close');
geoModalClose?.addEventListener('click', closeGeoModal);
geoModal?.querySelector('.geo-modal-backdrop')?.addEventListener('click', closeGeoModal);
function closeGeoModal() {
  geoModal?.classList.remove('show');
  geoModal?.setAttribute('aria-hidden', 'true');
}
function openGeoModal(results, onPick) {
  if (!geoModal || !geoModalList) return;
  geoModalList.innerHTML = results.map((r, i) => `
    <button type="button" class="geo-modal-item" data-idx="${i}">
      <span class="geo-flag">${geoFlagEmoji(r.country)}</span>
      <span class="geo-info">
        <span class="geo-name">${r.name}</span>
        <span class="geo-loc">${geoDisplayLine(r)}${r.population ? ` · ${r.population.toLocaleString('ro-RO')} loc.` : ''}</span>
        <span class="geo-coords">${r.lat.toFixed(4)}°, ${r.lon.toFixed(4)}°</span>
      </span>
    </button>`).join('');
  geoModal.classList.add('show');
  geoModal.setAttribute('aria-hidden', 'false');
  geoModalList.querySelectorAll('.geo-modal-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx, 10);
      closeGeoModal();
      onPick(results[idx]);
    }, { once: true });
  });
  safeIcons();
}

// Smart pick: if user wrote "Name, County/Country", filter; if still many, ask.
// `interactive` defaults to true — only the very first auto-load passes false.
async function smartSearch(rawQuery, interactive = true) {
  const parts = rawQuery.split(',').map(s => s.trim()).filter(Boolean);
  const namePart = parts[0];
  const hint = parts.slice(1).join(' ').toLowerCase();
  if (!namePart) return;

  setLoading(true);
  let results;
  try {
    results = await geocodeMulti(namePart);
  } catch {
    setLoading(false);
    if (interactive) alert('Nu am putut contacta serviciul de localizare. Încearcă din nou.');
    return;
  }
  setLoading(false);

  if (!results.length) {
    if (interactive) alert(`Nu am găsit „${namePart}". Verifică ortografia.`);
    return;
  }

  // If a hint is present (e.g. "Valea Lupului, Iași" or ",RO"), filter.
  if (hint) {
    const matches = results.filter(r => {
      const hay = [r.admin1, r.admin2, r.admin3, r.country, r.countryName]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(hint);
    });
    if (matches.length) results = matches;
  }

  // Auto-load (page first paint) → just take the best (first / most populous) result.
  if (!interactive) {
    results.sort((a,b) => (b.population||0) - (a.population||0));
    return loadByGeo(results[0]);
  }

  if (results.length === 1) return loadByGeo(results[0]);

  // Multiple ambiguous matches → show modal.
  openGeoModal(results, picked => loadByGeo(picked));
}

async function loadByGeo(geo) {
  setLoading(true);
  try {
    const res  = await fetch(
      `${WX_BASE}/data/2.5/weather?lat=${geo.lat}&lon=${geo.lon}&units=metric&lang=ro&appid=${WX_KEY}`
    );
    if (!res.ok) throw new Error('Eroare la obținerea vremii.');
    const data = await res.json();
    // Always trust the Open-Meteo geocode for the displayed name.
    data.name = geo.name;
    data.sys = data.sys || {};
    data.sys.country = geo.country;
    data.coord = { lat: geo.lat, lon: geo.lon };

    updateUI(data, geo);
    addRecent(geoFullLabel(geo));
    currentCity    = geo.name;
    currentCountry = geo.country;

    Promise.all([
      fetch5Day(geo.lat, geo.lon),
      fetchHourly(geo.lat, geo.lon),
      fetchAirQuality(geo.lat, geo.lon),
      setExtra(data, geo),
    ]).then(() => { invalidateSectionsCache(); scheduleSpy(); });

    fetchTravelGuide(geo);
  } catch (err) {
    alert(err.message || 'Eroare la obținerea datelor.');
  } finally {
    setLoading(false);
  }
}

function geoFullLabel(geo) {
  const tail = [geo.admin1, geo.country].filter(Boolean).join(', ');
  return tail ? `${geo.name}, ${tail}` : geo.name;
}

// Public entry-points (used by the rest of the app)
async function checkWeather(query, interactive = true) {
  // `query` may be raw text, or a previous "Valea Lupului, Iași, RO" label.
  return smartSearch(query, interactive);
}
async function checkByCoords(lat, lon) {
  // Reverse-geocode the click/locate point first so the title is meaningful.
  let geo;
  try {
    const r = await fetch(
      `${REVERSE_BASE}?format=json&lat=${lat}&lon=${lon}&zoom=12&accept-language=ro`,
      { headers: { 'Accept': 'application/json' } }
    );
    const j = await r.json();
    const a = j.address || {};
    geo = {
      name: a.city || a.town || a.village || a.hamlet || a.suburb || a.county || j.display_name?.split(',')[0] || 'Locația ta',
      country: (a.country_code || '').toUpperCase(),
      countryName: a.country,
      admin1: a.state || a.region,
      admin2: a.county,
      admin3: a.suburb,
      lat, lon,
      elevation: 0, population: 0, timezone: '',
    };
  } catch {
    geo = { name: 'Locația ta', country: '', lat, lon, admin1:'', admin2:'', countryName:'' };
  }
  return loadByGeo(geo);
}

// ══════════════════════════════════════════
// UPDATE UI
// ══════════════════════════════════════════
function updateUI(d, geo) {
  updateDateTime();
  currentLat = d.coord.lat;
  currentLon = d.coord.lon;

  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  // City title — prefer the geocode (gives admin1/county) over OWM's bare name.
  if (geo) {
    set('city-name', geo.name);
    const sub = [geo.admin2, geo.admin1, geo.countryName || geo.country].filter(Boolean).join(', ');
    const dt = document.getElementById('date-time');
    if (dt && sub) dt.title = sub; // keep date/time visible, but allow hover with location
  } else {
    set('city-name', d.name);
  }
  set('temp',        `${Math.round(d.main.temp)}°`);
  set('feels-like',  `Simțit: ${Math.round(d.main.feels_like)}°C`);
  set('desc',        d.weather[0].description);
  const icon = document.getElementById('weather-icon');
  if (icon) icon.src = `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png`;

  const ws = `${Math.round(d.wind.speed*3.6)} km/h`;
  const vis = `${(d.visibility/1000).toFixed(1)} km`;
  set('humidity',      `${d.main.humidity}%`);
  set('wind',          ws);
  set('pressure',      `${d.main.pressure} hPa`);
  set('visibility',    vis);
  set('wind-direction',`${windDir(d.wind.deg)} (${d.wind.deg}°)`);
  set('clouds',        `${d.clouds.all}%`);
  set('dew-point',     `${dewPoint(d.main.temp,d.main.humidity)}°C`);
  set('uv-index',      'N/A');

  set('h-humidity',   `${d.main.humidity}%`);
  set('h-wind',       ws);
  set('h-visibility', vis);
  set('h-pressure',   `${d.main.pressure} hPa`);

  set('sunrise', fmtTime(d.sys.sunrise));
  set('sunset',  fmtTime(d.sys.sunset));
  const dl = (d.sys.sunset-d.sys.sunrise)*1000;
  set('daylight-duration', `${Math.floor(dl/3600000)}h ${Math.floor((dl%3600000)/60000)}m`);

  const map = document.getElementById('google-map');
  if (map) map.src = `https://www.google.com/maps?q=${d.coord.lat},${d.coord.lon}&output=embed`;

  // (3D globe is initialized lazily via the map/globe tabs)

  safeIcons();
  invalidateSectionsCache();
}

function setExtra(d, geo) {
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('coordinates', `${d.coord.lat.toFixed(4)}°, ${d.coord.lon.toFixed(4)}°`);
  const tz=(d.timezone||0)/3600;
  set('timezone', `UTC${tz>=0?'+':''}${tz}`);
  set('rain-probability','N/A');
  set('elevation', (geo && Number.isFinite(geo.elevation)) ? `${Math.round(geo.elevation)} m` : '—');
}

// ══════════════════════════════════════════
// FORECASTS
// ══════════════════════════════════════════
async function fetch5Day(lat, lon) {
  try {
    const res  = await fetch(`${WX_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ro&appid=${WX_KEY}`);
    const data = await res.json();
    const days = data.list.filter(i=>i.dt_txt.includes('12:00:00')).slice(0,5);
    const el   = document.getElementById('forecast');
    if (!el) return;
    el.innerHTML = days.map(d => {
      const date = new Date(d.dt*1000);
      return `<div class="forecast-row">
        <span class="forecast-day-name">${date.toLocaleDateString('ro-RO',{weekday:'short'})}</span>
        <span class="forecast-date-sub">${date.toLocaleDateString('ro-RO',{day:'numeric',month:'short'})}</span>
        <img class="forecast-icon-sm" src="https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png" alt="">
        <span class="forecast-desc-sm">${d.weather[0].description}</span>
        <span class="forecast-temp-sm">${Math.round(d.main.temp_min)}° / ${Math.round(d.main.temp_max)}°</span>
      </div>`;
    }).join('');
  } catch(e){console.error('5day:',e);}
}

async function fetchHourly(lat, lon) {
  try {
    const res  = await fetch(`${WX_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ro&appid=${WX_KEY}`);
    const data = await res.json();
    const el   = document.getElementById('hourly-forecast');
    if (!el) return;
    el.innerHTML = data.list.slice(0,12).map(h => {
      const time = new Date(h.dt*1000).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
      return `<div class="hourly-item">
        <div class="hourly-time">${time}</div>
        <img class="hourly-icon" src="https://openweathermap.org/img/wn/${h.weather[0].icon}.png" alt="">
        <div class="hourly-temp">${Math.round(h.main.temp)}°C</div>
        <div class="hourly-detail">💧 ${h.main.humidity}%</div>
        <div class="hourly-detail">💨 ${Math.round(h.wind.speed*3.6)} km/h</div>
      </div>`;
    }).join('');
  } catch(e){console.error('hourly:',e);}
}

async function fetchAirQuality(lat, lon) {
  try {
    const res  = await fetch(`${WX_BASE}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${WX_KEY}`);
    const data = await res.json();
    const item = data.list[0];
    const aqi  = item.main.aqi;
    const labels  = ['Excelent','Bun','Moderat','Slab','Foarte slab'];
    const classes = ['aqi-good','aqi-fair','aqi-moderate','aqi-poor','aqi-very-poor'];
    const vEl = document.getElementById('aqi-value');
    const lEl = document.getElementById('aqi-label');
    if (vEl) { vEl.textContent=aqi; vEl.className='aqi-num '+classes[aqi-1]; }
    if (lEl) { lEl.textContent=labels[aqi-1]; lEl.className='aqi-lbl '+classes[aqi-1]; }
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set('pm25',`${item.components.pm2_5.toFixed(1)} μg/m³`);
    set('pm10',`${item.components.pm10.toFixed(1)} μg/m³`);
    set('o3',  `${item.components.o3.toFixed(1)} μg/m³`);
    set('no2', `${item.components.no2.toFixed(1)} μg/m³`);
  } catch {
    const el=document.getElementById('aqi-label');
    if(el) el.textContent='Indisponibil';
  }
}

// ══════════════════════════════════════════
// CITY TIER CLASSIFICATION
// ══════════════════════════════════════════
const LARGE_CITIES = new Set([
  'paris','london','rome','barcelona','amsterdam','berlin','vienna','prague','budapest',
  'lisbon','madrid','athens','istanbul','dubai','tokyo','bangkok','singapore','sydney',
  'new york','los angeles','toronto','chicago','miami','montreal',
  'beijing','shanghai','seoul','hong kong','mumbai','delhi','cairo',
  'rio de janeiro','buenos aires','cape town','johannesburg',
  'mexico city','lima','bogota',
  'bucharest','bucurești','cluj-napoca','timisoara','timișoara','brasov','brașov',
  'constanta','constanța','iasi','iași','craiova','oradea','galati','galați',
  'münchen','munich','hamburg','milan','milano','florence','firenze','venice','venezia',
  'krakow','warsaw','wroclaw','gdansk','porto','seville','sevilla','valencia',
  'brussels','bruges','ghent','zurich','geneva','bern','stockholm','oslo',
  'copenhagen','helsinki','riga','tallinn','vilnius','sofia','zagreb','belgrade',
  'sarajevo','dubrovnik','split','athens','thessaloniki','kyiv','lviv','minsk',
]);

const MEDIUM_CITIES = new Set([
  'sibiu','sinaia','brasov','brașov','alba iulia','targu mures','târgu mureș',
  'bacau','bacău','suceava','tulcea','piatra neamt','piatra neamț','deva',
  'pitesti','pitești','buzau','buzău','satu mare','baia mare','arad',
  'resita','reșița','sfantu gheorghe','sfântu gheorghe','giurgiu',
  'mangalia','neptun','venus','mamaia','eforie',
]);

// Normalize the tier sets once so diacritic stripping always matches.
const _LARGE_NORM  = new Set([...LARGE_CITIES].map(normalizeStr));
const _MEDIUM_NORM = new Set([...MEDIUM_CITIES].map(normalizeStr));
function cityTier(city) {
  const n = normalizeStr(city);
  if (_LARGE_NORM.has(n))  return 'large';
  if (_MEDIUM_NORM.has(n)) return 'medium';
  return 'small';
}

// ══════════════════════════════════════════
// AFFILIATE LINKS
// ══════════════════════════════════════════
const AFF = {
  booking:     c=>`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(c)}&aid=YOUR_AID`,
  gyg:         c=>`https://www.getyourguide.com/s/?q=${encodeURIComponent(c)}&partner_id=YOUR_ID`,
  viator:      c=>`https://www.viator.com/search/${encodeURIComponent(c)}?pid=YOUR_PID`,
  airbnb:      c=>`https://www.airbnb.com/s/${encodeURIComponent(c)}/homes`,
  tripadvisor: c=>`https://www.tripadvisor.com/Search?q=${encodeURIComponent(c)}`,
  facebook:    (c,q)=>`https://www.facebook.com/search/groups/?q=${encodeURIComponent(q||c)}`,
};

function buildAffStrip(city, country) {
  const tier = cityTier(city);
  let buttons = [];

  if (tier === 'large') {
    buttons = [
      {cls:'aff-booking', href:AFF.booking(city),     icon:'🏨', name:'Booking.com',   sub:'Rezervă hotel'},
      {cls:'aff-gyg',     href:AFF.gyg(city),         icon:'🎟', name:'GetYourGuide',  sub:'Tururi & Activități'},
      {cls:'aff-viator',  href:AFF.viator(city),      icon:'🌍', name:'Viator',         sub:'Experiențe locale'},
      {cls:'aff-airbnb',  href:AFF.airbnb(city),      icon:'🏡', name:'Airbnb',         sub:'Cazări unice'},
    ];
  } else if (tier === 'medium') {
    buttons = [
      {cls:'aff-booking', href:AFF.booking(city),     icon:'🏨', name:'Booking.com',   sub:'Rezervă hotel'},
      {cls:'aff-airbnb',  href:AFF.airbnb(city),      icon:'🏡', name:'Airbnb',         sub:'Cazări unice'},
      {cls:'aff-tripadvisor',href:AFF.tripadvisor(city),icon:'⭐',name:'TripAdvisor',   sub:'Recenzii & locuri'},
      {cls:'aff-facebook',href:AFF.facebook(city,fbQuery(city,country)),icon:'👥',name:'Grupuri Facebook',sub:'Grupuri locale'},
    ];
  } else {
    buttons = [
      {cls:'aff-booking', href:AFF.booking(city),     icon:'🏨', name:'Booking.com',   sub:'Cazare'},
      {cls:'aff-facebook',href:AFF.facebook(city,fbQuery(city,country)),icon:'👥',name:'Grupuri Facebook',sub:'Grupuri locale'},
      {cls:'aff-tripadvisor',href:AFF.tripadvisor(city),icon:'⭐',name:'TripAdvisor',  sub:'Recenzii locale'},
    ];
  }

  return buttons.map(b=>`
    <a class="aff-btn ${b.cls}" href="${b.href}" target="_blank" rel="noopener">
      <div class="aff-icon">${b.icon}</div>
      <div class="aff-text">
        <span class="aff-name">${b.name}</span>
        <span class="aff-sub">${b.sub}</span>
      </div>
    </a>`).join('');
}

// ══════════════════════════════════════════
// TRAVEL GUIDE
// ══════════════════════════════════════════
const CAT_MAP = {
  'cultural':'Cultură','historic':'Istorie','natural':'Natură',
  'architecture':'Arhitectură','museums':'Muzeu','religion':'Religie',
  'foods':'Gastronomie','amusements':'Distracție','sport':'Sport',
  'interesting_places':'Atracție'
};
function catLabel(kinds) {
  if (!kinds) return 'Atracție';
  const k = kinds.split(',')[0];
  for (const key of Object.keys(CAT_MAP)) { if (k.includes(key)) return CAT_MAP[key]; }
  return 'Atracție';
}
function kindEmoji(kinds) {
  if (!kinds) return '📍';
  if (kinds.includes('museum'))    return '🏛️';
  if (kinds.includes('religion') || kinds.includes('church')) return '⛪';
  if (kinds.includes('natural') || kinds.includes('park'))    return '🌳';
  if (kinds.includes('castle'))    return '🏰';
  if (kinds.includes('food'))      return '🍽️';
  if (kinds.includes('art'))       return '🎨';
  if (kinds.includes('historic'))  return '🏺';
  if (kinds.includes('beach'))     return '🏖️';
  if (kinds.includes('monument'))  return '🗿';
  return '📍';
}

function isBadPlaceName(name) {
  if (!name) return true;
  const n = name.toLowerCase();
  return (
    n.startsWith('list of') ||
    n === 'tourist attraction' ||
    n === 'tourist attractions' ||
    n.startsWith('lists of') ||
    n.includes('aaaaa') ||
    n.length < 3
  );
}

function buildCardLinks(place, city, tier, country) {
  const name = place.name || '';
  const searchQ = encodeURIComponent(name + ' ' + city);
  const wikiSlug = place.wikipedia || name;

  const links = [];

  if (place.point) {
    const {lat, lon} = place.point;
    links.push(`<a class="tc-link secondary" href="https://www.google.com/maps/search/${searchQ}/@${lat},${lon},15z" target="_blank" rel="noopener">🗺 Hartă</a>`);
  } else {
    links.push(`<a class="tc-link secondary" href="https://www.google.com/maps/search/${searchQ}" target="_blank" rel="noopener">🗺 Hartă</a>`);
  }

  if (wikiSlug && !isBadPlaceName(wikiSlug)) {
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiSlug)}`;
    links.push(`<a class="tc-link secondary" href="${wikiUrl}" target="_blank" rel="noopener">📖 Wikipedia</a>`);
  }

  if (tier === 'large') {
    links.push(`<a class="tc-link secondary" href="${AFF.gyg(name+' '+city)}" target="_blank" rel="noopener">🎟 Tur ghidat</a>`);
  }

  if (tier !== 'small') {
    links.push(`<a class="tc-link secondary" href="https://www.tripadvisor.com/Search?q=${searchQ}" target="_blank" rel="noopener">⭐ Recenzii</a>`);
  }

  return links.join('');
}

function renderCards(places, city, tier, country) {
  const el = document.getElementById('travel-cards');
  if (!el) return;
  const MIN_DESC = 80;
  const valid = places
    .filter(p => {
      if (isBadPlaceName(p.name)) return false;
      const desc = p.wikipedia_extracts?.text || p.info?.descr || p.description || '';
      return desc.length >= MIN_DESC;
    })
    .slice(0, 4);
  if (!valid.length) {
    el.innerHTML = `<div class="travel-loading" style="grid-column:1/-1"><p style="color:var(--text2)">Nu am găsit atracții cu informații suficiente. Încearcă linkurile de mai sus.</p></div>`;
    return;
  }
  el.innerHTML = valid.map(p => {
    const desc = p.wikipedia_extracts?.text || p.info?.descr || p.description || 'Atracție locală recomandată.';
    const descClean = desc.length > 220 ? desc.slice(0,220)+'…' : desc;
    const source = p.wikipedia_extracts?.text ? '<span class="tc-source">📡 Wikipedia</span>' : '';
    return `
      <div class="travel-card">
        <div class="tc-emoji">${kindEmoji(p.kinds)}</div>
        <div class="tc-body">
          <div class="tc-head">
            <span class="tc-name">${p.name}</span>
            <span class="tc-cat">${catLabel(p.kinds)}</span>
          </div>
          <p class="tc-desc">${descClean}</p>
          ${source}
          <div class="tc-links">${buildCardLinks(p, city, tier, country)}</div>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════
// TRAVEL GUIDE — Overpass (POIs by lat/lon) + Wikipedia summaries
// Guarantees: results are physically near the picked location, never
// confused by a same-name place elsewhere on the planet.
// ══════════════════════════════════════════

// Overpass tag → friendly Romanian label & emoji
const POI_TAGS = [
  { q:'tourism=attraction',           cat:'Atracție',     icon:'📍' },
  { q:'tourism=museum',               cat:'Muzeu',        icon:'🏛️' },
  { q:'tourism=viewpoint',            cat:'Belvedere',    icon:'🌄' },
  { q:'tourism=gallery',              cat:'Galerie',      icon:'🎨' },
  { q:'tourism=zoo',                  cat:'Grădină zoo',  icon:'🦁' },
  { q:'tourism=theme_park',           cat:'Parc tematic', icon:'🎢' },
  { q:'historic=castle',              cat:'Castel',       icon:'🏰' },
  { q:'historic=monastery',           cat:'Mănăstire',    icon:'⛪' },
  { q:'historic=monument',            cat:'Monument',     icon:'🗿' },
  { q:'historic=memorial',            cat:'Memorial',     icon:'🕯️' },
  { q:'historic=ruins',               cat:'Ruine',        icon:'🏛️' },
  { q:'historic=archaeological_site', cat:'Sit arheologic', icon:'⚒️' },
  { q:'leisure=park',                 cat:'Parc',         icon:'🌳' },
  { q:'leisure=garden',               cat:'Grădină',      icon:'🌸' },
  { q:'natural=peak',                 cat:'Vârf montan',  icon:'⛰️' },
  { q:'natural=waterfall',            cat:'Cascadă',      icon:'💦' },
  { q:'natural=cave_entrance',        cat:'Peșteră',      icon:'🕳️' },
  { q:'natural=beach',                cat:'Plajă',        icon:'🏖️' },
  { q:'amenity=place_of_worship',     cat:'Lăcaș de cult', icon:'⛪' },
];

function tagInfo(tags) {
  if (!tags) return { cat:'Atracție', icon:'📍' };
  for (const t of POI_TAGS) {
    const [k,v] = t.q.split('=');
    if (tags[k] === v) return t;
  }
  return { cat:'Loc interesant', icon:'📍' };
}

function distMeters(lat1, lon1, lat2, lon2) {
  const R=6371000, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

async function overpassNearby(lat, lon, radiusKm = 8) {
  const r = radiusKm * 1000;
  const filter = POI_TAGS.map(t => {
    const [k,v] = t.q.split('=');
    return `nwr["${k}"="${v}"](around:${r},${lat},${lon});`;
  }).join('');
  const query = `[out:json][timeout:25];(${filter});out center tags 80;`;

  const res = await fetch(OVERPASS_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const j = await res.json();

  const out = [];
  const seen = new Set();
  for (const el of (j.elements || [])) {
    const name = el.tags?.name || el.tags?.['name:ro'] || el.tags?.['name:en'];
    if (!name || isBadPlaceName(name) || seen.has(name)) continue;
    seen.add(name);
    const plat = el.lat ?? el.center?.lat;
    const plon = el.lon ?? el.center?.lon;
    if (plat == null || plon == null) continue;
    const info = tagInfo(el.tags);
    out.push({
      name,
      cat:  info.cat,
      icon: info.icon,
      lat:  plat,
      lon:  plon,
      distM: distMeters(lat, lon, plat, plon),
      wiki: el.tags?.wikipedia || null, // e.g. "ro:Mănăstirea Putna"
      website: el.tags?.website || el.tags?.['contact:website'] || null,
    });
  }
  // Sort closest first.
  out.sort((a,b) => a.distM - b.distM);
  return out;
}

async function enrichWithWikipedia(places, max = 6) {
  const top = places.slice(0, max);
  await Promise.all(top.map(async p => {
    let lang = 'ro', title = p.name;
    if (p.wiki && p.wiki.includes(':')) {
      const [l, t] = p.wiki.split(/:(.+)/);
      lang = l || 'ro';
      title = t || p.name;
    }
    try {
      const r = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      );
      if (r.ok) {
        const j = await r.json();
        if (j && j.type !== 'disambiguation' && j.extract && j.extract.length > 40) {
          p.desc = j.extract.length > 240 ? j.extract.slice(0,240)+'…' : j.extract;
          p.wikiUrl = j.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
        }
      }
    } catch {/* ignore */}
  }));
  return top;
}

function renderTravelCards(places, geo) {
  const el = document.getElementById('travel-cards');
  if (!el) return;
  if (!places.length) {
    el.innerHTML = `
      <div class="travel-loading" style="grid-column:1/-1">
        <p style="color:var(--text2);text-align:center;padding:24px">
          Ne pare rău, nu avem rezultate la moment pentru această locație.
        </p>
      </div>`;
    return;
  }
  el.innerHTML = places.map(p => {
    const distKm = (p.distM / 1000);
    const distLabel = distKm < 1
      ? `${Math.round(p.distM)} m`
      : `${distKm.toFixed(1)} km`;
    const desc = p.desc || `${p.cat} la ${distLabel} de centrul localității ${geo.name}.`;
    const links = [];
    links.push(`<a class="tc-link secondary" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" rel="noopener">🗺 Hartă</a>`);
    if (p.wikiUrl) links.push(`<a class="tc-link secondary" href="${p.wikiUrl}" target="_blank" rel="noopener">📖 Wikipedia</a>`);
    if (p.website) links.push(`<a class="tc-link secondary" href="${p.website}" target="_blank" rel="noopener">🌐 Site oficial</a>`);
    links.push(`<a class="tc-link secondary" href="https://www.tripadvisor.com/Search?q=${encodeURIComponent(p.name + ' ' + geo.name)}" target="_blank" rel="noopener">⭐ Recenzii</a>`);
    return `
      <div class="travel-card">
        <div class="tc-emoji">${p.icon}</div>
        <div class="tc-body">
          <div class="tc-head">
            <span class="tc-name">${p.name}</span>
            <span class="tc-cat">${p.cat} · ${distLabel}</span>
          </div>
          <p class="tc-desc">${desc}</p>
          <div class="tc-links">${links.join('')}</div>
        </div>
      </div>`;
  }).join('');
}

async function fetchTravelGuide(geo) {
  const section = document.getElementById('s-travel');
  if (!section) return;
  section.style.display = '';

  const city = geo.name;
  const country = geo.country || '';
  const titleEl = document.getElementById('travel-title');
  const tagEl   = document.getElementById('travel-tagline');
  const affEl   = document.getElementById('affiliate-strip');
  const cardsEl = document.getElementById('travel-cards');
  const ideaEl  = document.getElementById('today-idea');

  if (titleEl) titleEl.textContent = `Ce poți face în ${city}`;
  if (tagEl)   tagEl.textContent   = 'Se caută atracții în jurul tău…';
  if (affEl)   affEl.innerHTML     = buildAffStrip(city, country);
  if (ideaEl)  ideaEl.style.display = 'none';
  if (cardsEl) cardsEl.innerHTML   = `
    <div class="travel-loading">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <p style="margin-top:14px;font-size:13px;color:var(--text2)">Se caută obiective lângă ${city}…</p>
    </div>`;

  let places = [];
  try {
    places = await overpassNearby(geo.lat, geo.lon, 8);
    if (places.length < 3) {
      const wider = await overpassNearby(geo.lat, geo.lon, 25);
      // merge unique by name
      const seen = new Set(places.map(p=>p.name));
      for (const p of wider) if (!seen.has(p.name)) { places.push(p); seen.add(p.name); }
      places.sort((a,b) => a.distM - b.distM);
    }
  } catch (e) {
    console.warn('[Overpass failed]', e.message);
  }

  if (places.length) {
    places = await enrichWithWikipedia(places, 6);
  }

  if (tagEl) {
    tagEl.textContent = places.length
      ? `${places.length} obiective găsite în jurul ${city}`
      : '';
  }
  renderTravelCards(places.slice(0, 6), geo);
  safeIcons();
  invalidateSectionsCache();
  scheduleSpy();
}

// ══════════════════════════════════════════
// MAP / GLOBE TABS  +  Three.js interactive globe
// ══════════════════════════════════════════
const mapTabs   = document.querySelectorAll('.map-mode-tab');
const mapWrap   = document.querySelector('.map-wrap');
const globeWrap = document.getElementById('globe-wrap');
let globeReady  = false;
let globeAPI    = null;

mapTabs.forEach(tab => {
  tab.addEventListener('click', async () => {
    mapTabs.forEach(t => t.classList.toggle('active', t === tab));
    const mode = tab.dataset.mode;
    if (mode === 'globe') {
      if (mapWrap)   mapWrap.style.display   = 'none';
      if (globeWrap) globeWrap.style.display = '';
      if (!globeReady) await initGlobe();
      if (globeAPI && Number.isFinite(currentLat) && Number.isFinite(currentLon)) {
        globeAPI.focus(currentLat, currentLon);
      }
    } else {
      if (globeWrap) globeWrap.style.display = 'none';
      if (mapWrap)   mapWrap.style.display   = '';
    }
  });
});

async function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container) return;
  const loadingEl = container.querySelector('.globe-loading');
  const tooltip   = document.getElementById('globe-tooltip');

  try {
    const THREE = await import('three');

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 3, 5);
    scene.add(dir);

    // Earth — Blue Marble texture from NASA (CORS ok via wikimedia mirror)
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    const earthTex = await new Promise((res, rej) => {
      loader.load(
        'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/WorldMap-A_non-Frame.png/1280px-WorldMap-A_non-Frame.png',
        res, undefined, rej
      );
    }).catch(() => null);

    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTex || null,
      color: earthTex ? 0xffffff : 0x2266cc,
      shininess: 8,
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMat);
    scene.add(earth);

    // Subtle atmosphere
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.04, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x4fa3e8, transparent: true, opacity: 0.10, side: THREE.BackSide,
      })
    );
    scene.add(atmo);

    // Pin marker
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff5577 })
    );
    pin.visible = false;
    scene.add(pin);

    // Star background (cheap)
    const starGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 30, t = Math.random()*Math.PI*2, p = Math.acos(2*Math.random()-1);
      starPos[i*3]   = r*Math.sin(p)*Math.cos(t);
      starPos[i*3+1] = r*Math.sin(p)*Math.sin(t);
      starPos[i*3+2] = r*Math.cos(p);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color:0xffffff, size:0.04, sizeAttenuation:true })));

    // Convert lat/lon → 3D point on sphere
    function latLonToVec3(lat, lon, radius = 1.005) {
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lon + 180) * Math.PI / 180;
      // Texture is equirectangular, x increases east → our convention:
      return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
         radius * Math.cos(phi),
         radius * Math.sin(phi) * Math.sin(theta)
      );
    }
    function vec3ToLatLon(v) {
      const r = v.length();
      const lat = 90 - Math.acos(v.y / r) * 180 / Math.PI;
      let lon = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
      if (lon < -180) lon += 360;
      if (lon > 180)  lon -= 360;
      return { lat, lon };
    }

    // Drag-to-rotate
    let isDragging = false, lastX = 0, lastY = 0;
    let rotY = 0, rotX = 0;
    let autoSpin = true;
    let dragStartTime = 0, dragMoved = false;

    renderer.domElement.addEventListener('pointerdown', e => {
      isDragging = true;
      autoSpin = false;
      lastX = e.clientX; lastY = e.clientY;
      dragStartTime = Date.now();
      dragMoved = false;
      renderer.domElement.setPointerCapture(e.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMoved = true;
      rotY += dx * 0.005;
      rotX += dy * 0.005;
      rotX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, rotX));
      lastX = e.clientX; lastY = e.clientY;
    });
    renderer.domElement.addEventListener('pointerup', e => {
      isDragging = false;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
      // Treat as click if barely moved & quick
      if (!dragMoved && (Date.now() - dragStartTime) < 350) {
        handleClick(e);
      }
    });
    renderer.domElement.addEventListener('wheel', e => {
      e.preventDefault();
      camera.position.z = Math.max(1.4, Math.min(6, camera.position.z + e.deltaY * 0.0015));
    }, { passive: false });

    // Tap → load weather for the point
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function handleClick(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      ndc.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(earth)[0];
      if (!hit) return;
      // Bring point into local sphere coords (un-rotate)
      const localPt = earth.worldToLocal(hit.point.clone());
      const { lat, lon } = vec3ToLatLon(localPt);
      // Drop pin
      pin.position.copy(latLonToVec3(lat, lon, 1.012));
      pin.visible = true;
      pin.parent = earth;
      // Show tooltip briefly
      if (tooltip) {
        tooltip.style.left = (e.clientX - rect.left) + 'px';
        tooltip.style.top  = (e.clientY - rect.top) + 'px';
        tooltip.textContent = `Se încarcă vremea pentru ${lat.toFixed(2)}°, ${lon.toFixed(2)}°…`;
        tooltip.style.display = 'block';
        setTimeout(() => { tooltip.style.display = 'none'; }, 2200);
      }
      checkByCoords(lat, lon);
    }

    if (loadingEl) loadingEl.style.display = 'none';

    // Animate
    function animate() {
      requestAnimationFrame(animate);
      if (!isDragging && autoSpin) rotY += 0.0015;
      earth.rotation.y = rotY;
      earth.rotation.x = rotX;
      atmo.rotation.copy(earth.rotation);
      renderer.render(scene, camera);
    }
    animate();

    // Resize
    const ro = new ResizeObserver(() => {
      const w2 = container.clientWidth, h2 = container.clientHeight;
      if (w2 && h2) {
        renderer.setSize(w2, h2);
        camera.aspect = w2 / h2;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(container);

    globeAPI = {
      focus(lat, lon) {
        // rotate earth so the point faces camera
        const phi = (90 - lat) * Math.PI / 180;
        const theta = (lon + 180) * Math.PI / 180;
        rotY = -theta + Math.PI;
        rotX = phi - Math.PI/2;
        rotX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, rotX));
        pin.position.copy(latLonToVec3(lat, lon, 1.012));
        pin.parent = earth;
        pin.visible = true;
      }
    };
    globeReady = true;
  } catch (err) {
    console.error('[Globe init failed]', err);
    if (loadingEl) {
      loadingEl.innerHTML = `<p>Nu am putut încărca globul 3D.<br/><small>${err.message || ''}</small></p>`;
    }
  }
}

// ══════════════════════════════════════════
// AI ASSISTANT (Gemini, function-calling for weather lookups)
// ══════════════════════════════════════════
const aiLauncher = document.getElementById('ai-launcher');
const aiPanel    = document.getElementById('ai-panel');
const aiClose    = document.getElementById('ai-close');
const aiMsgs     = document.getElementById('ai-messages');
const aiForm     = document.getElementById('ai-form');
const aiInput    = document.getElementById('ai-input');
const aiSend     = document.getElementById('ai-send');
const aiSugg     = document.getElementById('ai-suggestions');

const aiHistory = []; // [{role:'user'|'model', parts:[...]}, ...]

aiLauncher?.addEventListener('click', () => {
  aiPanel?.classList.add('open');
  if (!aiMsgs.dataset.greeted) {
    aiMsgs.dataset.greeted = '1';
    addAIBubble('bot',
      'Bună! Sunt asistentul tău de vreme și călătorii. Întreabă-mă, de exemplu:<br/>' +
      '<em>„Care e cel mai cald oraș din Europa azi?”</em> sau ' +
      '<em>„Vreau o vacanță la mare săptămâna asta”</em>.');
    renderSuggestions([
      'Cel mai cald oraș din România azi',
      'Plouă mâine în Cluj?',
      'Recomandă-mi o vacanță la munte',
      'Vreme la mare în weekend',
    ]);
  }
  aiInput?.focus();
});
aiClose?.addEventListener('click', () => aiPanel?.classList.remove('open'));

function renderSuggestions(items) {
  if (!aiSugg) return;
  aiSugg.innerHTML = items.map(s => `<button type="button" class="ai-chip">${s}</button>`).join('');
  aiSugg.querySelectorAll('.ai-chip').forEach(c => {
    c.addEventListener('click', () => { aiInput.value = c.textContent; aiForm.requestSubmit(); });
  });
}

function addAIBubble(role, html) {
  const wrap = document.createElement('div');
  wrap.className = `ai-msg ai-msg-${role === 'user' ? 'user' : 'bot'}`;
  wrap.innerHTML = `<div class="ai-bubble">${html}</div>`;
  aiMsgs.appendChild(wrap);
  aiMsgs.scrollTop = aiMsgs.scrollHeight;
  return wrap;
}
function addTypingBubble() {
  const wrap = document.createElement('div');
  wrap.className = 'ai-msg ai-msg-bot';
  wrap.innerHTML = `<div class="ai-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
  aiMsgs.appendChild(wrap);
  aiMsgs.scrollTop = aiMsgs.scrollHeight;
  return wrap;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function mdToHtml(md) {
  let s = escapeHtml(md);
  // bold
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\((https?:[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // bullets at line start
  s = s.replace(/(^|\n)[\-•] (.+)/g, '$1<li>$2</li>');
  s = s.replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>').replace(/<\/ul>\s*<ul>/g, '');
  // line breaks
  s = s.replace(/\n/g, '<br/>');
  return s;
}

// Affiliate link builders for AI cards
function bookingLink(q)     { return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(q)}`; }
function airbnbLink(q)      { return `https://www.airbnb.com/s/${encodeURIComponent(q)}/homes`; }
function tripadvisorLink(q) { return `https://www.tripadvisor.com/Search?q=${encodeURIComponent(q)}`; }
function skyscannerLink(q)  { return `https://www.skyscanner.net/transport/flights-to/?search=${encodeURIComponent(q)}`; }

function travelLinksHtml(place) {
  const q = place;
  return `<div class="ai-links">
    <a href="${bookingLink(q)}" target="_blank" rel="noopener">🏨 Booking</a>
    <a href="${airbnbLink(q)}" target="_blank" rel="noopener">🏡 Airbnb</a>
    <a href="${tripadvisorLink(q)}" target="_blank" rel="noopener">⭐ TripAdvisor</a>
    <a href="${skyscannerLink(q)}" target="_blank" rel="noopener">✈️ Skyscanner</a>
  </div>`;
}

// ── Tool implementations ─────────────────────────────────────
async function tool_get_weather({ location }) {
  const matches = await geocodeMulti(location);
  if (!matches.length) return { error: `Nu am găsit „${location}".` };
  const g = matches[0];
  const r = await fetch(`${WX_BASE}/data/2.5/weather?lat=${g.lat}&lon=${g.lon}&units=metric&lang=ro&appid=${WX_KEY}`);
  if (!r.ok) return { error: 'Nu am putut obține vremea.' };
  const d = await r.json();
  return {
    name: g.name, country: g.country, region: g.admin1,
    lat: g.lat, lon: g.lon,
    temp_c: Math.round(d.main.temp),
    feels_like_c: Math.round(d.main.feels_like),
    description: d.weather?.[0]?.description,
    humidity: d.main.humidity,
    wind_kph: Math.round((d.wind?.speed || 0) * 3.6),
  };
}

async function tool_get_forecast({ location, days = 3 }) {
  const matches = await geocodeMulti(location);
  if (!matches.length) return { error: `Nu am găsit „${location}".` };
  const g = matches[0];
  const r = await fetch(
    `${FORECAST_BASE}?latitude=${g.lat}&longitude=${g.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=${Math.min(7, days)}`
  );
  const j = await r.json();
  const out = [];
  if (j.daily) {
    for (let i = 0; i < (j.daily.time || []).length; i++) {
      out.push({
        date: j.daily.time[i],
        max_c: Math.round(j.daily.temperature_2m_max[i]),
        min_c: Math.round(j.daily.temperature_2m_min[i]),
        rain_pct: j.daily.precipitation_probability_max?.[i] ?? null,
      });
    }
  }
  return { name: g.name, country: g.country, days: out };
}

async function tool_compare_cities({ cities }) {
  const list = (cities || []).slice(0, 8);
  const results = await Promise.all(list.map(async name => {
    try {
      const w = await tool_get_weather({ location: name });
      return w.error ? null : w;
    } catch { return null; }
  }));
  return { results: results.filter(Boolean) };
}

const TOOLS = {
  get_weather:    tool_get_weather,
  get_forecast:   tool_get_forecast,
  compare_cities: tool_compare_cities,
};

const TOOL_DECLARATIONS = [
  {
    name: 'get_weather',
    description: 'Vremea curentă pentru un oraș/locație. Returnează temperatura, descrierea, vântul, umiditatea.',
    parameters: {
      type: 'object',
      properties: { location: { type: 'string', description: 'Numele orașului sau localității, ex: "Cluj-Napoca, RO".' } },
      required: ['location'],
    },
  },
  {
    name: 'get_forecast',
    description: 'Prognoză pe câteva zile pentru o locație.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        days:     { type: 'integer', description: 'Numărul de zile (1–7).' },
      },
      required: ['location'],
    },
  },
  {
    name: 'compare_cities',
    description: 'Compară vremea actuală în mai multe orașe simultan. Folosește când utilizatorul vrea „cel mai cald/rece/ploios" oraș dintr-o listă.',
    parameters: {
      type: 'object',
      properties: { cities: { type: 'array', items: { type: 'string' } } },
      required: ['cities'],
    },
  },
];

const AI_SYSTEM_PROMPT = `Ești asistentul de vreme și călătorii pentru VremeaAzi.
Răspunde mereu în română, scurt, prietenos, util.
Folosește instrumentele disponibile pentru a obține vremea reală — nu inventa date.
Pentru întrebări de tip „cel mai cald/rece oraș", apelează compare_cities cu o listă rezonabilă de 5–8 orașe relevante.
Pentru recomandări de vacanță, propune 1–3 destinații concrete potrivite vremii cerute, cu o descriere de o frază. Apoi încheie răspunsul cu eticheta exactă pe linie nouă pentru fiecare:
RECOMMENDATION: <Nume Oraș>
Front-end-ul va atașa link-uri Booking / Airbnb / TripAdvisor / Skyscanner pentru fiecare RECOMMENDATION.
Nu include link-uri în text — doar etichetele RECOMMENDATION.`;

async function geminiCall(history) {
  const body = {
    systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
    contents: history,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
  };
  const res = await fetch(GEMINI_URL(GEMINI_MODEL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
  }
  return await res.json();
}

async function runAI(userText) {
  if (!GEMINI_KEY) {
    addAIBubble('bot', 'Asistentul AI nu este configurat (lipsește cheia API).');
    return;
  }
  aiHistory.push({ role: 'user', parts: [{ text: userText }] });

  const typing = addTypingBubble();
  try {
    let safety = 0;
    while (safety++ < 5) {
      const j = await geminiCall(aiHistory);
      const cand = j.candidates?.[0];
      const parts = cand?.content?.parts || [];

      const fnCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);
      if (fnCalls.length) {
        // Record the model turn (so the API sees its function call)
        aiHistory.push({ role: 'model', parts });
        // Run tools
        const responses = await Promise.all(fnCalls.map(async fc => {
          const fn = TOOLS[fc.name];
          let result;
          try {
            result = fn ? await fn(fc.args || {}) : { error: 'Unknown tool' };
          } catch (e) {
            result = { error: e.message };
          }
          return {
            functionResponse: { name: fc.name, response: { result } },
          };
        }));
        aiHistory.push({ role: 'function', parts: responses });
        continue; // loop, let model see tool results
      }

      // Final text answer
      const text = parts.map(p => p.text || '').join('').trim();
      aiHistory.push({ role: 'model', parts: [{ text }] });

      // Pull RECOMMENDATION: <Place> markers and convert to link cards
      const recs = [];
      const cleaned = text.replace(/^RECOMMENDATION:\s*(.+)$/gim, (_, p) => {
        recs.push(p.trim()); return '';
      }).trim();

      let html = mdToHtml(cleaned || 'Iată ce am găsit:');
      for (const place of recs) {
        html += `<div class="ai-result-card"><div class="arc-name">${escapeHtml(place)}</div>${travelLinksHtml(place)}</div>`;
      }

      typing.querySelector('.ai-bubble').innerHTML = html;
      aiMsgs.scrollTop = aiMsgs.scrollHeight;
      return;
    }
    typing.querySelector('.ai-bubble').textContent = 'Răspunsul a depășit limita de pași. Încearcă să reformulezi.';
  } catch (err) {
    console.error(err);
    typing.querySelector('.ai-bubble').textContent = `Eroare: ${err.message}`;
  }
}

aiForm?.addEventListener('submit', e => {
  e.preventDefault();
  const v = aiInput.value.trim();
  if (!v) return;
  addAIBubble('user', escapeHtml(v));
  aiInput.value = '';
  runAI(v);
});
aiInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    aiForm.requestSubmit();
  }
});

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function safeIcons() {
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  } else {
    window._lucideCbs = window._lucideCbs || [];
    window._lucideCbs.push(() => { if(window.lucide) lucide.createIcons(); });
  }
}

const FB_TERMS = {
  'RO':'ghid', 'FR':'guide touristique', 'DE':'Reiseführer', 'IT':'guida turistica',
  'ES':'guía turística', 'PT':'guia turístico', 'PL':'przewodnik', 'CZ':'průvodce',
  'HU':'útikalauz', 'SK':'sprievodca', 'HR':'vodič', 'SI':'vodnik',
  'GR':'οδηγός', 'TR':'gezi rehberi', 'RU':'путеводитель', 'UA':'гід',
  'JP':'観光', 'CN':'旅游', 'KR':'여행', 'AR':'دليل السياحة',
  'NL':'reisgids', 'BE':'reisgids', 'SE':'resguide', 'NO':'reiseguide',
  'DK':'rejseguide', 'FI':'matkaopas',
  'US':'travel guide', 'GB':'travel guide', 'CA':'travel guide',
  'AU':'travel guide', 'NZ':'travel guide', 'ZA':'travel guide',
  'IN':'travel guide', 'MX':'guía turística', 'BR':'guia turístico',
  'AR_c':'guía', 'CL':'guía', 'CO':'guía',
};
function fbQuery(city, country) {
  const term = FB_TERMS[country] || 'travel';
  return `${city} ${term}`;
}

// ══════════════════════════════════════════
// EVENTS
// ══════════════════════════════════════════
cityInput.addEventListener('focus', ()=>{ if(!cityInput.value) showSuggestions(''); });
cityInput.addEventListener('input', e=>showSuggestions(e.target.value));
cityInput.addEventListener('blur',  ()=>setTimeout(()=>suggestDiv.classList.remove('active'),200));
cityInput.addEventListener('keydown', e=>{
  if (e.key==='Enter' && cityInput.value.trim()) {
    checkWeather(cityInput.value.trim());
    suggestDiv.classList.remove('active');
  }
});

searchBtn.addEventListener('click', ()=>{ if(cityInput.value.trim()) checkWeather(cityInput.value.trim()); });

suggestDiv.addEventListener('click', e=>{
  const item = e.target.closest('.suggestion-item');
  if (!item || e.target.classList.contains('remove-recent')) return;
  const query   = item.dataset.query || item.dataset.city;
  const display = item.dataset.display
    || item.querySelector('.suggestion-text')?.textContent.replace('🕐 ','')
    || query.split(',')[0];
  cityInput.value = display.trim();
  suggestDiv.classList.remove('active');
  // If the suggestion already has precise coordinates (from OWM /geo),
  // load directly — no need to re-geocode or show the disambiguation modal.
  const lat = parseFloat(item.dataset.lat);
  const lon = parseFloat(item.dataset.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    loadByGeo({
      name: display.trim(),
      country: item.dataset.country || '',
      countryName: item.dataset.country || '',
      admin1: item.dataset.state || '',
      admin2: '', admin3: '',
      lat, lon,
      elevation: undefined, population: 0, timezone: '',
    });
  } else {
    checkWeather(query);
  }
});

document.addEventListener('click', e=>{
  if (!e.target.closest('.search-container')) suggestDiv.classList.remove('active');
});

locateBtn.addEventListener('click', ()=>{
  if (!navigator.geolocation) { alert('Geolocația nu este suportată.'); return; }
  locateBtn.innerHTML = '<i data-lucide="loader"></i>';
  safeIcons();
  navigator.geolocation.getCurrentPosition(
    pos => checkByCoords(pos.coords.latitude, pos.coords.longitude).then(()=>{
      locateBtn.innerHTML = '<i data-lucide="locate"></i><span>Locația mea</span>';
      safeIcons();
    }),
    ()  => {
      alert('Nu s-a putut obține locația.');
      locateBtn.innerHTML = '<i data-lucide="locate"></i><span>Locația mea</span>';
      safeIcons();
    }
  );
});

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
window.addEventListener('load', () => {
  safeIcons();
  // Mobile drawer starts closed (CSS handles transform).
  // Desktop collapse state is restored from localStorage above.
  checkWeather(recentSearches[0] || 'București', false);
});
