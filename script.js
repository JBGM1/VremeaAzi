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
// AFFILIATE LINKS
// ══════════════════════════════════════════
// Replace IDs with your real affiliate IDs after registration
const AFF = {
  booking: c=>`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(c)}&aid=YOUR_AID`,
  gyg:     c=>`https://www.getyourguide.com/s/?q=${encodeURIComponent(c)}&partner_id=YOUR_ID`,
  viator:  c=>`https://www.viator.com/search/${encodeURIComponent(c)}?pid=YOUR_PID`,
  airbnb:  c=>`https://www.airbnb.com/s/${encodeURIComponent(c)}/homes`,
};

function buildAffStrip(city) {
  return [
    {cls:'aff-booking',href:AFF.booking(city),icon:'🏨',name:'Booking.com',sub:'Rezervă hotel'},
    {cls:'aff-gyg',    href:AFF.gyg(city),    icon:'🎟',name:'GetYourGuide',sub:'Tururi & Activități'},
    {cls:'aff-viator', href:AFF.viator(city), icon:'🌍',name:'Viator',      sub:'Experiențe locale'},
    {cls:'aff-airbnb', href:AFF.airbnb(city), icon:'🏡',name:'Airbnb',      sub:'Cazări unice'},
  ].map(b=>`
    <a class="aff-btn ${b.cls}" href="${b.href}" target="_blank" rel="noopener">
      <div class="aff-icon">${b.icon}</div>
      <div class="aff-text">
        <span class="aff-name">${b.name}</span>
        <span class="aff-sub">${b.sub}</span>
      </div>
    </a>`).join('');
}

// ══════════════════════════════════════════
// TRAVEL GUIDE — OpenTripMap (worldwide)
// Fallback: Wikipedia REST API
// ══════════════════════════════════════════

const CAT_MAP = {
  'cultural':'Cultură','historic':'Istorie','natural':'Natură',
  'architecture':'Arhitectură','museums':'Muzeu','religion':'Religie',
  'foods':'Gastronomie','amusements':'Distracție','sport':'Sport',
  'interesting_places':'Atracție'
};

function otmKind(kinds) {
  if (!kinds) return 'interesting_places';
  const k = kinds.split(',')[0];
  for (const key of Object.keys(CAT_MAP)) {
    if (k.includes(key)) return key;
  }
  return 'interesting_places';
}

function catLabel(kinds) { return CAT_MAP[otmKind(kinds)] || 'Atracție'; }

function kindEmoji(kinds) {
  if (!kinds) return '📍';
  if (kinds.includes('museum'))    return '🏛️';
  if (kinds.includes('religion'))  return '⛪';
  if (kinds.includes('natural'))   return '🌳';
  if (kinds.includes('castle'))    return '🏰';
  if (kinds.includes('food'))      return '🍽️';
  if (kinds.includes('park'))      return '🌿';
  if (kinds.includes('art'))       return '🎨';
  if (kinds.includes('historic'))  return '🏺';
  if (kinds.includes('beach'))     return '🏖️';
  if (kinds.includes('monument'))  return '🗿';
  return '📍';
}

// Render cards from OTM/Wikipedia data
function renderCards(places, city) {
  const el = document.getElementById('travel-cards');
  if (!el) return;
  if (!places.length) {
    el.innerHTML = `<div class="travel-loading"><p>Nu am găsit atracții pentru această locație.</p></div>`;
    return;
  }
  el.innerHTML = places.map(p => {
    const desc    = p.wikipedia_extracts?.text || p.info?.descr || p.description || 'Atracție locală recomandată pentru vizitatori.';
    const descClean = desc.length > 200 ? desc.slice(0,200)+'…' : desc;
    const source  = p.wikipedia_extracts?.text ? 'Sursă: Wikipedia' : '';
    const wikiLink = p.wikipedia ? `<a class="tc-link secondary" href="https://en.wikipedia.org/wiki/${encodeURIComponent(p.wikipedia)}" target="_blank" rel="noopener">📖 Wikipedia</a>` : '';
    return `
      <div class="travel-card">
        <div class="tc-emoji">${kindEmoji(p.kinds)}</div>
        <div class="tc-body">
          <div class="tc-head">
            <span class="tc-name">${p.name || 'Atracție locală'}</span>
            <span class="tc-cat">${catLabel(p.kinds)}</span>
          </div>
          <p class="tc-desc">${descClean}</p>
          ${source?`<div class="tc-source">${source}</div>`:''}
          <div class="tc-links">
            <a class="tc-link" href="${AFF.gyg((p.name||'')+ ' ' +city)}" target="_blank" rel="noopener">🎟 Rezervă tur</a>
            <a class="tc-link secondary" href="https://www.google.com/search?q=${encodeURIComponent((p.name||'')+' '+city)}" target="_blank" rel="noopener">🔍 Mai mult</a>
            ${wikiLink}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── STEP 1: Try OpenTripMap ──────────────────────────────────────
async function fetchOTM(city, lat, lon) {
  // Get POIs near city
  const radius = 8000;
  const kinds  = 'interesting_places,cultural,historic,architecture,museums,natural,religion';
  const url    = `${OTM_BASE}/places/radius?radius=${radius}&lon=${lon}&lat=${lat}&kinds=${kinds}&rate=3&format=json&limit=12&apikey=${OTM_KEY}`;

  const res    = await fetch(url);
  if (!res.ok) throw new Error(`OTM ${res.status}`);
  const places = await res.json();
  if (!Array.isArray(places) || places.length < 2) throw new Error('Too few results');

  // Sort by rate + popularity
  const top = places
    .filter(p => p.properties.name && p.properties.name.trim())
    .sort((a,b) => (b.properties.rate||0)-(a.properties.rate||0))
    .slice(0,6);

  // Fetch details (with Wikipedia extracts) for top 4
  const details = await Promise.all(
    top.slice(0,4).map(async p => {
      try {
        const dr = await fetch(`${OTM_BASE}/places/xid/${p.properties.xid}?apikey=${OTM_KEY}`);
        return await dr.json();
      } catch { return p.properties; }
    })
  );

  return details.filter(d => d && (d.name||d.properties?.name));
}

// ── STEP 2: Wikipedia fallback ───────────────────────────────────
async function fetchWikipediaFallback(city, country) {
  // Search for attractions in Wikipedia
  const lang = country === 'RO' ? 'ro' : 'en';
  const query = lang==='ro' ? `${city} atractii turistice` : `${city} tourist attractions`;

  const search = await fetch(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=8&origin=*`
  ).then(r=>r.json());

  const results = search?.query?.search || [];

  // Get summaries for top 4 distinct results
  const summaries = await Promise.all(
    results.slice(0,4).map(r =>
      fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(r.title)}`)
        .then(res=>res.json())
        .catch(()=>null)
    )
  );

  return summaries
    .filter(s => s && s.title && s.extract && !s.title.toLowerCase().includes('disambiguation'))
    .map(s => ({
      name: s.title,
      kinds: guessKindFromTitle(s.title),
      description: s.extract,
      wikipedia: s.title,
      wikipedia_extracts: { text: s.extract }
    }));
}

function guessKindFromTitle(title) {
  const t = title.toLowerCase();
  if (t.includes('museum') || t.includes('muzeu')) return 'museums';
  if (t.includes('church') || t.includes('cathedral') || t.includes('biseric') || t.includes('manastir')) return 'religion';
  if (t.includes('park') || t.includes('parc') || t.includes('garden') || t.includes('gradina')) return 'natural';
  if (t.includes('castle') || t.includes('palace') || t.includes('palat') || t.includes('castel')) return 'historic';
  if (t.includes('monument') || t.includes('memorial')) return 'historic';
  if (t.includes('restaurant') || t.includes('market') || t.includes('piata')) return 'foods';
  return 'interesting_places';
}

// ── MAIN travel guide orchestrator ──────────────────────────────
async function fetchTravelGuide(city, country, lat, lon) {
  const section = document.getElementById('s-travel');
  if (!section) return;
  section.style.display = '';

  // Update title + affiliate strip
  const titleEl = document.getElementById('travel-title');
  if (titleEl) titleEl.textContent = `Ce poți face în ${city}`;
  const tagEl = document.getElementById('travel-tagline');
  if (tagEl) tagEl.textContent = '';
  const affEl = document.getElementById('affiliate-strip');
  if (affEl) affEl.innerHTML = buildAffStrip(city);
  const ideaEl = document.getElementById('today-idea');
  if (ideaEl) ideaEl.style.display = 'none';

  // Show loading
  const cardsEl = document.getElementById('travel-cards');
  if (cardsEl) cardsEl.innerHTML = `
    <div class="travel-loading">
      <div class="loading-dots"><span></span><span></span><span></span></div>
      <p style="margin-top:14px;font-size:13px;color:var(--text2)">
        Se caută atracții din ${city}…
      </p>
    </div>`;

  let places = [];

  // Try OpenTripMap first
  try {
    places = await fetchOTM(city, lat, lon);
    if (tagEl) tagEl.textContent = `${places.length} atracții găsite prin OpenTripMap pentru ${city}.`;
  } catch(e) {
    console.warn('OTM failed, trying Wikipedia:', e.message);
    // Fallback: Wikipedia
    try {
      places = await fetchWikipediaFallback(city, country);
      if (tagEl) tagEl.textContent = `Atracții recomandate pentru ${city} — date via Wikipedia.`;
    } catch(e2) {
      console.error('Wikipedia fallback failed:', e2);
    }
  }

  renderCards(places, city);
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
