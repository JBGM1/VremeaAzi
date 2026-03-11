const API_KEY = '914254454ca488d913232fffe6d35533';
const API_BASE = 'https://api.openweathermap.org';

// DOM refs
const cityInput   = document.getElementById('city-input');
const searchBtn   = document.getElementById('search-btn');
const locateBtn   = document.getElementById('locate-btn');
const suggestDiv  = document.getElementById('suggestions');
const themeToggle = document.getElementById('theme-toggle');

// State
let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
let debounceTimer  = null;

// ===========================
// THEME
// ===========================
function applyTheme(isLight) {
  document.body.classList.toggle('light', isLight);
  localStorage.setItem('lightMode', isLight);
}

// Load saved theme (default = dark)
applyTheme(localStorage.getItem('lightMode') === 'true');

themeToggle.addEventListener('click', () => {
  const isNowLight = !document.body.classList.contains('light');
  applyTheme(isNowLight);
});

// ===========================
// UTILITIES
// ===========================
function normalizeStr(str) {
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[șȘ]/g, 's').replace(/[țȚ]/g, 't')
    .replace(/[ăĂ]/g, 'a').replace(/[âÂ]/g, 'a').replace(/[îÎ]/g, 'i')
    .toLowerCase();
}

function windDegToDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','V','NV'];
  return dirs[Math.round(deg / 45) % 8];
}

function calcDewPoint(temp, humidity) {
  return Math.round(temp - ((100 - humidity) / 5));
}

function formatTime(unixTs) {
  return new Date(unixTs * 1000).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function updateDateTime() {
  document.getElementById('date-time').textContent = new Date().toLocaleDateString('ro-RO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ===========================
// RECENT SEARCHES
// ===========================
function addRecent(city) {
  recentSearches = [city, ...recentSearches.filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 5);
  localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
}

function removeRecent(city) {
  recentSearches = recentSearches.filter(c => c !== city);
  localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  showSuggestions('');
}
// Expose globally for inline onclick
window.removeRecent = removeRecent;

// ===========================
// SUGGESTIONS — Smart Priority
// ===========================

// Romanian name mappings (API returns EN names)
const RO_NAMES = {
  'Bucharest': 'București', 'Iasi': 'Iași', 'Brasov': 'Brașov',
  'Timisoara': 'Timișoara', 'Cluj-Napoca': 'Cluj-Napoca',
  'Constanta': 'Constanța', 'Craiova': 'Craiova', 'Galati': 'Galați',
  'Ploiesti': 'Ploiești', 'Braila': 'Brăila', 'Oradea': 'Oradea',
  'Bacau': 'Bacău', 'Arad': 'Arad', 'Pitesti': 'Pitești',
  'Sibiu': 'Sibiu', 'Targu Mures': 'Târgu Mureș', 'Baia Mare': 'Baia Mare',
  'Buzau': 'Buzău', 'Satu Mare': 'Satu Mare', 'Botosani': 'Botoșani',
  'Ramnicu Valcea': 'Râmnicu Vâlcea', 'Suceava': 'Suceava',
  'Drobeta-Turnu Severin': 'Drobeta-Turnu Severin', 'Targoviste': 'Târgoviște',
  'Focsani': 'Focșani', 'Tulcea': 'Tulcea', 'Deva': 'Deva',
  'Resita': 'Reșița', 'Alba Iulia': 'Alba Iulia', 'Bistrita': 'Bistrița',
  'Drobeta Turnu Severin': 'Drobeta-Turnu Severin', 'Sfantu Gheorghe': 'Sfântu Gheorghe'
};

// Major Romanian cities — tier 1 (cele mai importante)
const RO_MAJOR = new Set([
  'bucurești', 'iași', 'cluj-napoca', 'timișoara', 'constanța',
  'craiova', 'brașov', 'galați', 'ploiești', 'oradea', 'braila',
  'bacău', 'arad', 'pitești', 'sibiu', 'târgu mureș', 'baia mare',
  'buzău', 'satu mare', 'botoșani', 'râmnicu vâlcea', 'suceava',
  'focșani', 'tulcea', 'deva', 'alba iulia', 'bistrita', 'drobeta-turnu severin',
  // variante fara diacritice (pt matching)
  'bucuresti', 'iasi', 'cluj', 'timisoara', 'constanta', 'brasov',
  'galati', 'ploiesti', 'bacau', 'pitesti', 'targu mures', 'sfantu gheorghe'
]);

// Major world cities — tier 3
const WORLD_MAJOR = new Set([
  'london','paris','berlin','rome','madrid','vienna','amsterdam','brussels',
  'prague','warsaw','budapest','athens','lisbon','stockholm','oslo','copenhagen',
  'zurich','geneva','milan','barcelona','munich','hamburg','frankfurt','lyon',
  'new york','los angeles','chicago','toronto','sydney','tokyo','beijing',
  'shanghai','dubai','istanbul','moscow','kyiv','sofia','zagreb','belgrade',
  'new york city','los angeles','san francisco'
]);

// Score a city result for sorting
function scoreCityResult(city, normalizedQuery) {
  const name    = normalizeStr(city.name);
  const country = city.country;
  let score     = 1000; // lower = better

  // --- Match quality ---
  if (name === normalizedQuery)             score -= 500; // exact match
  else if (name.startsWith(normalizedQuery)) score -= 300; // starts with
  else if (name.includes(normalizedQuery))   score -= 100; // contains

  // --- Geographic priority ---
  if (country === 'RO') {
    if (RO_MAJOR.has(name)) score -= 200;  // tier 1: orase mari RO
    else score -= 150;                      // tier 2: orase mici RO
  } else if (country === 'MD') {
    score -= 80;                            // Moldova
  } else if (WORLD_MAJOR.has(name)) {
    score -= 60;                            // tier 3: orase mari internationale
  }
  // everything else stays near 1000

  return score;
}

async function fetchSuggestions(query) {
  if (!query || query.length < 2) return [];
  try {
    const res  = await fetch(`${API_BASE}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=20&appid=${API_KEY}`);
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const nq = normalizeStr(query);

    // Deduplicate by name+country
    const seen = new Set();
    const unique = data.filter(c => {
      const k = `${normalizeStr(c.name)}-${c.country}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Apply Romanian display names
    const mapped = unique.map(c =>
      (c.country === 'RO' && RO_NAMES[c.name]) ? { ...c, name: RO_NAMES[c.name] } : c
    );

    // Sort by score
    mapped.sort((a, b) => scoreCityResult(a, nq) - scoreCityResult(b, nq));

    return mapped.slice(0, 7);
  } catch (e) {
    console.error('Suggestions error:', e);
    return [];
  }
}

async function showSuggestions(value) {
  if (!value) {
    if (recentSearches.length) {
      suggestDiv.innerHTML = recentSearches.map(c => `
        <div class="suggestion-item recent" data-city="${c}">
          <span class="suggestion-text">🕐 ${c}</span>
          <button class="remove-recent" onclick="event.stopPropagation(); removeRecent('${c}')">✕</button>
        </div>`).join('');
      suggestDiv.classList.add('active');
    } else {
      suggestDiv.classList.remove('active');
    }
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const cities = await fetchSuggestions(value);
    if (cities.length) {
      suggestDiv.innerHTML = cities.map(c => {
        const label = c.state ? `${c.name}, ${c.state}, ${c.country}` : `${c.name}, ${c.country}`;
        return `<div class="suggestion-item" data-query="${c.name},${c.country}">${label}</div>`;
      }).join('');
      suggestDiv.classList.add('active');
    } else {
      suggestDiv.classList.remove('active');
    }
  }, 280);
}

// ===========================
// WEATHER FETCH
// ===========================
async function checkWeather(query) {
  const info = document.querySelector('.info');
  info.classList.add('loading');
  try {
    const res = await fetch(`${API_BASE}/data/2.5/weather?q=${encodeURIComponent(query)}&units=metric&lang=ro&appid=${API_KEY}`);
    if (!res.ok) throw new Error('Orașul nu a fost găsit. Verifică ortografia.');
    const data = await res.json();

    updateUI(data);
    addRecent(data.name);

    const { lat, lon } = data.coord;
    // Parallel fetches
    Promise.all([
      fetch5Day(lat, lon),
      fetchHourly(lat, lon),
      fetchAirQuality(lat, lon),
      fetchExtra(data)
    ]);
  } catch (err) {
    alert(err.message);
  } finally {
    info.classList.remove('loading');
  }
}

async function checkWeatherByCoords(lat, lon) {
  const info = document.querySelector('.info');
  info.classList.add('loading');
  try {
    const res = await fetch(`${API_BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=ro&appid=${API_KEY}`);
    const data = await res.json();
    updateUI(data);
    addRecent(data.name);
    const c = data.coord;
    Promise.all([fetch5Day(c.lat, c.lon), fetchHourly(c.lat, c.lon), fetchAirQuality(c.lat, c.lon), fetchExtra(data)]);
  } catch {
    alert('Eroare la obținerea datelor meteo.');
  } finally {
    info.classList.remove('loading');
  }
}

// ===========================
// UPDATE UI
// ===========================
function updateUI(data) {
  updateDateTime();

  document.getElementById('city-name').textContent = data.name;
  document.getElementById('temp').textContent       = `${Math.round(data.main.temp)}°`;
  document.getElementById('feels-like').textContent = `Simțit: ${Math.round(data.main.feels_like)}°C`;
  document.getElementById('desc').textContent       = data.weather[0].description;
  document.getElementById('weather-icon').src       = `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`;

  document.getElementById('humidity').textContent      = `${data.main.humidity}%`;
  document.getElementById('wind').textContent          = `${Math.round(data.wind.speed * 3.6)} km/h`;
  document.getElementById('pressure').textContent      = `${data.main.pressure} hPa`;
  document.getElementById('visibility').textContent    = `${(data.visibility / 1000).toFixed(1)} km`;
  document.getElementById('wind-direction').textContent= `${windDegToDir(data.wind.deg)} (${data.wind.deg}°)`;
  document.getElementById('clouds').textContent        = `${data.clouds.all}%`;
  document.getElementById('dew-point').textContent     = `${calcDewPoint(data.main.temp, data.main.humidity)}°C`;

  document.getElementById('sunrise').textContent = formatTime(data.sys.sunrise);
  document.getElementById('sunset').textContent  = formatTime(data.sys.sunset);

  const dayMs = (data.sys.sunset - data.sys.sunrise) * 1000;
  const h = Math.floor(dayMs / 3600000);
  const m = Math.floor((dayMs % 3600000) / 60000);
  document.getElementById('daylight-duration').textContent = `${h}h ${m}m`;

  document.getElementById('google-map').src = `https://www.google.com/maps?q=${data.coord.lat},${data.coord.lon}&output=embed`;
}

function fetchExtra(data) {
  const { lat, lon } = data.coord;
  document.getElementById('coordinates').textContent = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  const tz = data.timezone / 3600;
  document.getElementById('timezone').textContent = `UTC${tz >= 0 ? '+' : ''}${tz}`;
  document.getElementById('uv-index').textContent  = 'N/A';
  document.getElementById('elevation').textContent = '— m';
  document.getElementById('rain-probability').textContent = 'N/A';
}

// ===========================
// FORECASTS
// ===========================
async function fetch5Day(lat, lon) {
  try {
    const res  = await fetch(`${API_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ro&appid=${API_KEY}`);
    const data = await res.json();
    const days = data.list.filter(i => i.dt_txt.includes('12:00:00')).slice(0, 5);
    const el   = document.getElementById('forecast');
    el.innerHTML = days.map(d => {
      const date = new Date(d.dt * 1000);
      return `
        <div class="forecast-day">
          <div class="forecast-date">${date.toLocaleDateString('ro-RO', { weekday: 'short' })}</div>
          <div class="forecast-sub">${date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}</div>
          <img class="forecast-icon" src="https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png" alt="${d.weather[0].description}">
          <div class="forecast-temp">${Math.round(d.main.temp)}°C</div>
          <div class="forecast-desc">${d.weather[0].description}</div>
        </div>`;
    }).join('');
  } catch (e) { console.error('Forecast 5d:', e); }
}

async function fetchHourly(lat, lon) {
  try {
    const res  = await fetch(`${API_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&lang=ro&appid=${API_KEY}`);
    const data = await res.json();
    const el   = document.getElementById('hourly-forecast');
    el.innerHTML = data.list.slice(0, 12).map(h => {
      const time = new Date(h.dt * 1000).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="hourly-item">
          <div class="hourly-time">${time}</div>
          <img class="hourly-icon" src="https://openweathermap.org/img/wn/${h.weather[0].icon}.png" alt="${h.weather[0].description}">
          <div class="hourly-temp">${Math.round(h.main.temp)}°C</div>
          <div class="hourly-detail">💧 ${h.main.humidity}%</div>
          <div class="hourly-detail">💨 ${Math.round(h.wind.speed * 3.6)} km/h</div>
        </div>`;
    }).join('');
  } catch (e) { console.error('Hourly:', e); }
}

// ===========================
// AIR QUALITY
// ===========================
async function fetchAirQuality(lat, lon) {
  try {
    const res  = await fetch(`${API_BASE}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
    const data = await res.json();
    const item = data.list[0];
    const aqi  = item.main.aqi;
    const labels  = ['Excelent','Bun','Moderat','Slab','Foarte slab'];
    const classes = ['aqi-good','aqi-fair','aqi-moderate','aqi-poor','aqi-very-poor'];

    const valEl  = document.getElementById('aqi-value');
    const lblEl  = document.getElementById('aqi-label');
    valEl.textContent  = aqi;
    valEl.className    = 'aqi-num ' + classes[aqi - 1];
    lblEl.textContent  = labels[aqi - 1];
    lblEl.className    = 'aqi-desc ' + classes[aqi - 1];

    document.getElementById('pm25').textContent = `${item.components.pm2_5.toFixed(1)} μg/m³`;
    document.getElementById('pm10').textContent = `${item.components.pm10.toFixed(1)} μg/m³`;
    document.getElementById('o3').textContent   = `${item.components.o3.toFixed(1)} μg/m³`;
    document.getElementById('no2').textContent  = `${item.components.no2.toFixed(1)} μg/m³`;
  } catch {
    document.getElementById('aqi-value').textContent = '—';
    document.getElementById('aqi-label').textContent = 'Indisponibil';
  }
}

// ===========================
// EVENTS
// ===========================
cityInput.addEventListener('focus', () => { if (!cityInput.value) showSuggestions(''); });
cityInput.addEventListener('input', e => showSuggestions(e.target.value));
cityInput.addEventListener('blur', () => setTimeout(() => suggestDiv.classList.remove('active'), 200));
cityInput.addEventListener('keydown', e => { if (e.key === 'Enter' && cityInput.value.trim()) { checkWeather(cityInput.value.trim()); suggestDiv.classList.remove('active'); } });

searchBtn.addEventListener('click', () => { if (cityInput.value.trim()) checkWeather(cityInput.value.trim()); });

suggestDiv.addEventListener('click', e => {
  const item = e.target.closest('.suggestion-item');
  if (!item || e.target.classList.contains('remove-recent')) return;
  const query = item.dataset.query || item.dataset.city;
  cityInput.value = (item.querySelector('.suggestion-text')?.textContent.replace('🕐 ', '') || query).split(',')[0].trim();
  suggestDiv.classList.remove('active');
  checkWeather(query);
});

document.addEventListener('click', e => { if (!e.target.closest('.search-container')) suggestDiv.classList.remove('active'); });

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) { alert('Geolocația nu este suportată de browser.'); return; }
  locateBtn.innerHTML = '⏳ Localizare…';
  navigator.geolocation.getCurrentPosition(
    pos => { checkWeatherByCoords(pos.coords.latitude, pos.coords.longitude).then(() => { locateBtn.innerHTML = '<span>📍</span> Locația mea'; }); },
    ()  => { alert('Nu s-a putut obține locația.'); locateBtn.innerHTML = '<span>📍</span> Locația mea'; }
  );
});

// ===========================
// INIT
// ===========================
window.addEventListener('load', () => {
  const defaultCity = recentSearches[0] || 'București';
  checkWeather(defaultCity);
});
