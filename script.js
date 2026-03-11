/* ══════════════════════════════════════════
   VremeaAzi — script.js
   Travel: OpenTripMap (worldwide, free) + Wikipedia fallback
══════════════════════════════════════════ */

const WX_KEY  = '914254454ca488d913232fffe6d35533';
const WX_BASE = 'https://api.openweathermap.org';

// ── OpenTripMap free API key ──────────────────────────────────────
// Register FREE at https://opentripmap.com/product (5000 req/day)
// Then replace this key with your own:
const OTM_KEY  = '5ae2e3f221c38a28845f05b6bb5c2d7a0aa7a8f36ea0e52fb851d60b';
const OTM_BASE = 'https://api.opentripmap.com/0.1/en';

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
// SIDEBAR
// ══════════════════════════════════════════
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
if (sidebarToggle) {
  sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
}

// Active nav item on scroll
const navItems = document.querySelectorAll('.nav-item[data-section]');
const scrollArea = document.getElementById('scroll-area');

navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const id = item.dataset.section;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

if (scrollArea) {
  scrollArea.addEventListener('scroll', () => {
    let current = '';
    navItems.forEach(item => {
      const id = item.dataset.section;
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        const top = el.getBoundingClientRect().top;
        if (top < 200) current = id;
      }
    });
    if (current) {
      navItems.forEach(n => n.classList.toggle('active', n.dataset.section === current));
    }
  });
}

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
    return `<div class="suggestion-item" data-query="${q}" data-display="${c.name}">${label}</div>`;
  }).join('');
  suggestDiv.classList.add('active');
  lucide.createIcons();
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
// WEATHER FETCH
// ══════════════════════════════════════════
async function checkWeather(query) {
  setLoading(true);
  try {
    const res = await fetch(`${WX_BASE}/data/2.5/weather?q=${encodeURIComponent(query)}&units=metric&lang=ro&appid=${WX_KEY}`);
    if (!res.ok) throw new Error('Orașul nu a fost găsit. Verifică ortografia.');
    const data = await res.json();
    updateUI(data);
    addRecent(data.name);
    currentCity    = data.name;
    currentCountry = data.sys.country;
    const {lat,lon} = data.coord;
    Promise.all([fetch5Day(lat,lon), fetchHourly(lat,lon), fetchAirQuality(lat,lon), setExtra(data)]);
    fetchTravelGuide(data.name, data.sys.country, lat, lon);
  } catch(err) { alert(err.message); }
  finally { setLoading(false); }
}

async function checkByCoords(lat, lon) {
  setLoading(true);
  try {
    const res  = await fetch(`${WX_BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=ro&appid=${WX_KEY}`);
    const data = await res.json();
    updateUI(data);
    addRecent(data.name);
    currentCity = data.name; currentCountry = data.sys.country;
    const c = data.coord;
    Promise.all([fetch5Day(c.lat,c.lon), fetchHourly(c.lat,c.lon), fetchAirQuality(c.lat,c.lon), setExtra(data)]);
    fetchTravelGuide(data.name, data.sys.country, c.lat, c.lon);
  } catch { alert('Eroare la obținerea datelor.'); }
  finally { setLoading(false); }
}

// ══════════════════════════════════════════
// UPDATE UI
// ══════════════════════════════════════════
function updateUI(d) {
  updateDateTime();
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('city-name', d.name);
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

  // Hero stats
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

  lucide.createIcons();
}

function setExtra(d) {
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('coordinates', `${d.coord.lat.toFixed(4)}°, ${d.coord.lon.toFixed(4)}°`);
  const tz=d.timezone/3600;
  set('timezone', `UTC${tz>=0?'+':''}${tz}`);
  set('rain-probability','N/A'); set('elevation','—');
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
// large  = major tourist city (GYG/Viator work well)
// medium = regional city (Booking/Airbnb + Facebook)
// small  = small town/village (Wikipedia + Facebook only)
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

function cityTier(city) {
  const n = normalizeStr(city);
  if (LARGE_CITIES.has(n)) return 'large';
  if (MEDIUM_CITIES.has(n)) return 'medium';
  // Heuristic: if OTM returned results it's at least medium
  return 'small';
}

// ══════════════════════════════════════════
// AFFILIATE LINKS
// Replace IDs with your real affiliate IDs
// ══════════════════════════════════════════
const AFF = {
  booking:     c=>`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(c)}&aid=YOUR_AID`,
  gyg:         c=>`https://www.getyourguide.com/s/?q=${encodeURIComponent(c)}&partner_id=YOUR_ID`,
  viator:      c=>`https://www.viator.com/search/${encodeURIComponent(c)}?pid=YOUR_PID`,
  airbnb:      c=>`https://www.airbnb.com/s/${encodeURIComponent(c)}/homes`,
  tripadvisor: c=>`https://www.tripadvisor.com/Search?q=${encodeURIComponent(c)}`,
  facebook:    c=>`https://www.facebook.com/search/groups/?q=${encodeURIComponent(c+' tourism travel')}`,
};

// Affiliate strip buttons vary by tier
function buildAffStrip(city) {
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
      {cls:'aff-facebook',href:AFF.facebook(city),    icon:'👥', name:'Grupuri locale', sub:'Comunități Facebook'},
    ];
  } else {
    // small
    buttons = [
      {cls:'aff-booking', href:AFF.booking(city),     icon:'🏨', name:'Booking.com',   sub:'Cazare'},
      {cls:'aff-facebook',href:AFF.facebook(city),    icon:'👥', name:'Grupuri locale', sub:'Comunități Facebook'},
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
// OpenTripMap (worldwide) → Wikipedia Categories → Wikipedia Search
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

// Bad place names to filter out
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

// Build per-card action links based on tier
function buildCardLinks(place, city, tier) {
  const name = place.name || '';
  const searchQ = encodeURIComponent(name + ' ' + city);
  const wikiSlug = place.wikipedia || name;

  const links = [];

  // Google Maps link (always useful)
  if (place.point) {
    const {lat, lon} = place.point;
    links.push(`<a class="tc-link secondary" href="https://www.google.com/maps/search/${searchQ}/@${lat},${lon},15z" target="_blank" rel="noopener">🗺 Hartă</a>`);
  } else {
    links.push(`<a class="tc-link secondary" href="https://www.google.com/maps/search/${searchQ}" target="_blank" rel="noopener">🗺 Hartă</a>`);
  }

  // Wikipedia (always if available)
  if (wikiSlug && !isBadPlaceName(wikiSlug)) {
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiSlug)}`;
    links.push(`<a class="tc-link secondary" href="${wikiUrl}" target="_blank" rel="noopener">📖 Wikipedia</a>`);
  }

  // Booking for this place (large + medium)
  if (tier === 'large') {
    links.push(`<a class="tc-link secondary" href="${AFF.gyg(name+' '+city)}" target="_blank" rel="noopener">🎟 Tur ghidat</a>`);
  }

  // TripAdvisor link (medium+)
  if (tier !== 'small') {
    links.push(`<a class="tc-link secondary" href="https://www.tripadvisor.com/Search?q=${searchQ}" target="_blank" rel="noopener">⭐ Recenzii</a>`);
  }

  return links.join('');
}

// Render attraction cards
function renderCards(places, city, tier) {
  const el = document.getElementById('travel-cards');
  if (!el) return;
  const valid = places.filter(p => !isBadPlaceName(p.name));
  if (!valid.length) {
    el.innerHTML = `<div class="travel-loading" style="grid-column:1/-1"><p style="color:var(--text2)">Nu am găsit atracții specifice. Încearcă linkurile de mai sus.</p></div>`;
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
          <div class="tc-links">${buildCardLinks(p, city, tier)}</div>
        </div>
      </div>`;
  }).join('');
}

// ── OpenTripMap ──────────────────────────────────────────────────
async function fetchOTM(city, lat, lon) {
  const url = `${OTM_BASE}/places/radius?radius=8000&lon=${lon}&lat=${lat}&kinds=interesting_places,cultural,historic,architecture,museums,natural,religion&rate=3&format=json&limit=15&apikey=${OTM_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OTM ${res.status}`);
  const places = await res.json();
  if (!Array.isArray(places)) throw new Error('Bad OTM response');

  const top = places
    .filter(p => p.properties?.name && !isBadPlaceName(p.properties.name))
    .sort((a,b) => (b.properties.rate||0)-(a.properties.rate||0))
    .slice(0,6);

  if (top.length < 2) throw new Error('Too few named places');

  // Fetch details for top 4
  const details = await Promise.all(
    top.slice(0,4).map(async p => {
      try {
        const dr = await fetch(`${OTM_BASE}/places/xid/${p.properties.xid}?apikey=${OTM_KEY}`);
        const d  = await dr.json();
        return { ...d, kinds: d.kinds || p.properties.kinds };
      } catch { return { ...p.properties, kinds: p.properties.kinds }; }
    })
  );
  return details.filter(d => d?.name && !isBadPlaceName(d.name));
}

// ── Wikipedia Categories API (precise) ──────────────────────────
// Fetches pages IN the category "Tourist attractions in {City}"
// This gives actual specific places, not generic articles
async function fetchWikiByCategory(city, country) {
  const lang = (country === 'RO') ? 'ro' : 'en';
  const catName = lang === 'ro'
    ? `Obiective turistice din ${city}`
    : `Tourist attractions in ${city}`;

  const catUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(catName)}&format=json&cmlimit=12&cmtype=page&origin=*`;
  const catRes = await fetch(catUrl).then(r=>r.json());
  const members = catRes?.query?.categorymembers || [];

  if (members.length < 2) throw new Error(`Category too small: ${members.length}`);

  // Fetch summaries for each member
  const summaries = await Promise.all(
    members.slice(0,6).map(m =>
      fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(m.title)}`)
        .then(r=>r.json()).catch(()=>null)
    )
  );

  return summaries
    .filter(s => s && s.type !== 'disambiguation' && s.extract && s.title && !isBadPlaceName(s.title))
    .map(s => ({
      name: s.title,
      kinds: guessKind(s.title, s.description || ''),
      wikipedia: s.title,
      wikipedia_extracts: { text: s.extract }
    }));
}

// ── Wikipedia Search fallback (direct place search) ─────────────
// Search for the CITY's own Wikipedia page and extract sights from it
async function fetchWikiCityPage(city, country) {
  const lang = (country === 'RO') ? 'ro' : 'en';

  // Try "Tourism in {city}" page first
  const tourismPage = lang === 'ro' ? `Turism în ${city}` : `Tourism in ${city}`;
  let summaries = [];

  // Strategy: search Wikipedia for "{city} {landmarks|sights|monuments}"
  const queries = lang === 'ro'
    ? [`${city} monumente`, `${city} obiective`, `${city} muzeu`, `${city} parc`]
    : [`${city} museum`, `${city} cathedral church`, `${city} park garden`, `${city} palace castle`];

  const results = await Promise.all(
    queries.slice(0,3).map(q =>
      fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&srlimit=3&origin=*`)
        .then(r=>r.json())
        .catch(()=>({query:{search:[]}}))
    )
  );

  // Collect unique relevant titles
  const seen = new Set();
  const titles = [];
  for (const r of results) {
    for (const item of (r?.query?.search || [])) {
      const t = item.title;
      // Only include if the city name appears in the article title (more precise)
      if (!seen.has(t) && !isBadPlaceName(t) && normalizeStr(t).includes(normalizeStr(city).split(' ')[0])) {
        seen.add(t);
        titles.push(t);
      }
    }
  }

  if (titles.length < 2) throw new Error('Not enough precise results');

  const fetched = await Promise.all(
    titles.slice(0,5).map(t =>
      fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`)
        .then(r=>r.json()).catch(()=>null)
    )
  );

  return fetched
    .filter(s => s && s.type !== 'disambiguation' && s.extract && !isBadPlaceName(s.title))
    .map(s => ({
      name: s.title,
      kinds: guessKind(s.title, s.description || ''),
      wikipedia: s.title,
      wikipedia_extracts: { text: s.extract }
    }));
}

function guessKind(title, desc) {
  const t = (title + ' ' + desc).toLowerCase();
  if (t.includes('museum') || t.includes('muzeu')) return 'museums';
  if (t.includes('church') || t.includes('cathedral') || t.includes('biseric') || t.includes('monastir') || t.includes('manastir')) return 'religion';
  if (t.includes('park') || t.includes('garden') || t.includes('parc') || t.includes('gradina')) return 'natural';
  if (t.includes('castle') || t.includes('palace') || t.includes('palat') || t.includes('castel')) return 'historic';
  if (t.includes('monument') || t.includes('memorial') || t.includes('statue')) return 'historic';
  if (t.includes('beach') || t.includes('plaja')) return 'beach';
  if (t.includes('restaurant') || t.includes('food') || t.includes('market')) return 'foods';
  if (t.includes('art') || t.includes('gallery')) return 'art';
  if (t.includes('tower') || t.includes('bridge') || t.includes('fountain')) return 'architecture';
  return 'interesting_places';
}

// ── MAIN orchestrator ────────────────────────────────────────────
async function fetchTravelGuide(city, country, lat, lon) {
  const section = document.getElementById('s-travel');
  if (!section) return;
  section.style.display = '';

  const tier    = cityTier(city);
  const titleEl = document.getElementById('travel-title');
  const tagEl   = document.getElementById('travel-tagline');
  const affEl   = document.getElementById('affiliate-strip');
  const cardsEl = document.getElementById('travel-cards');
  const ideaEl  = document.getElementById('today-idea');

  if (titleEl) titleEl.textContent = `Ce poți face în ${city}`;
  if (tagEl)   tagEl.textContent   = '';
  if (affEl)   affEl.innerHTML     = buildAffStrip(city);
  if (ideaEl)  ideaEl.style.display = 'none';
  if (cardsEl) cardsEl.innerHTML   = `
    <div class="travel-loading">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <p style="margin-top:14px;font-size:13px;color:var(--text2)">Se caută atracții din ${city}…</p>
    </div>`;

  let places = [];
  let source  = '';

  // 1️⃣ OpenTripMap (best, has GPS coordinates + Wikipedia links)
  try {
    places = await fetchOTM(city, lat, lon);
    source = `${places.length} atracții găsite via OpenTripMap`;
  } catch(e) {
    console.warn('[OTM failed]', e.message);

    // 2️⃣ Wikipedia Category (precise — actual places in category)
    try {
      places = await fetchWikiByCategory(city, country);
      source = `Atracții via Wikipedia categorie`;
    } catch(e2) {
      console.warn('[Wiki Category failed]', e2.message);

      // 3️⃣ Wikipedia targeted search (city-specific articles)
      try {
        places = await fetchWikiCityPage(city, country);
        source = `Rezultate Wikipedia pentru ${city}`;
      } catch(e3) {
        console.warn('[Wiki Search failed]', e3.message);
        source = '';
      }
    }
  }

  if (tagEl) tagEl.textContent = source;
  renderCards(places, city, tier);
  lucide.createIcons();
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
  checkWeather(query);
});

document.addEventListener('click', e=>{
  if (!e.target.closest('.search-container')) suggestDiv.classList.remove('active');
});

locateBtn.addEventListener('click', ()=>{
  if (!navigator.geolocation) { alert('Geolocația nu este suportată.'); return; }
  locateBtn.innerHTML = '<i data-lucide="loader"></i>';
  lucide.createIcons();
  navigator.geolocation.getCurrentPosition(
    pos => checkByCoords(pos.coords.latitude, pos.coords.longitude).then(()=>{
      locateBtn.innerHTML = '<i data-lucide="locate"></i><span>Locația mea</span>';
      lucide.createIcons();
    }),
    ()  => {
      alert('Nu s-a putut obține locația.');
      locateBtn.innerHTML = '<i data-lucide="locate"></i><span>Locația mea</span>';
      lucide.createIcons();
    }
  );
});

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
window.addEventListener('load', ()=>{
  lucide.createIcons();
  checkWeather(recentSearches[0] || 'București');
});
