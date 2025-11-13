/* global L, Chart */
const DATA_URL = 'data/properties.geojson';
let properties = [];
let filtered = [];
let currentPage = 1;
const pageSize = 9;
let markerCluster;
let useClusters = true;

// DOM
const listingsEl = document.getElementById('listings');
const resultsInfo = document.getElementById('resultsInfo');
const paginationEl = document.getElementById('pagination');
const metricCount = document.getElementById('metricCount');
const metricAvg = document.getElementById('metricAvg');
const metricTop = document.getElementById('metricTop');

const priceFilter = document.getElementById('priceFilter');
const priceLabel = document.getElementById('priceLabel');
const typeFilter = document.getElementById('typeFilter');
const bedsFilter = document.getElementById('bedsFilter');
const areaFilter = document.getElementById('areaFilter');
const searchInput = document.getElementById('searchInput') || {value:''};
const applyBtn = document.getElementById('applyBtn');
const resetBtn = document.getElementById('resetBtn');
const heroSearch = document.getElementById('heroSearch');
const heroType = document.getElementById('heroType');
const heroBtn = document.getElementById('heroBtn');

const btnCluster = document.getElementById('btnCluster');
const btnHeat = document.getElementById('btnHeat');
const sortBy = document.getElementById('sortBy');

const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');

document.getElementById('openAll').addEventListener('click', ()=> { document.getElementById('globalSearch').value=''; applyFilters(); });

// MAP init
const map = L.map('map').setView([30.0444, 31.2357], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:''}).addTo(map);
markerCluster = L.markerClusterGroup();

// utils
function formatNumber(n){ return Number(n).toLocaleString(); }

// load data
fetch(DATA_URL).then(r=>r.json()).then(g => {
  properties = g.features.map(f=>{
    return {
      id: f.properties.id || Math.random().toString(36).slice(2,9),
      name: f.properties.name || 'No name',
      price: +f.properties.price || 0,
      area: +f.properties.area || 0,
      type: f.properties.type || 'Other',
      beds: +f.properties.beds || 0,
      desc: f.properties.desc || '',
      image: f.properties.image || 'https://placehold.co/800x600',
      coords: f.geometry.coordinates
    };
  });
  const maxPrice = Math.max(...properties.map(p=>p.price), 5000000);
  priceFilter.max = maxPrice;
  priceFilter.value = maxPrice;
  priceLabel.innerText = formatNumber(+priceFilter.value);
  applyFilters();
  renderMetrics();
  renderChart();
}).catch(err=>console.error('Load data error',err));

// events
priceFilter.addEventListener('input', ()=> priceLabel.innerText = formatNumber(+priceFilter.value));
applyBtn.addEventListener('click', ()=> { currentPage=1; applyFilters(); });
resetBtn.addEventListener('click', ()=>{ typeFilter.value='all'; priceFilter.value=priceFilter.max; bedsFilter.value=0; areaFilter.value=0; document.getElementById('globalSearch').value=''; currentPage=1; applyFilters(); });
heroBtn.addEventListener('click', ()=>{ document.getElementById('globalSearch').value = heroSearch.value; typeFilter.value = heroType.value; currentPage=1; applyFilters(); });
btnCluster.addEventListener('click', ()=> toggleClusters());
sortBy.addEventListener('change', ()=>{ currentPage=1; applyFilters(); });
document.getElementById('globalSearch').addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ currentPage=1; applyFilters(); } });

// filters
function applyFilters(){
  const type = typeFilter.value;
  const maxPrice = +priceFilter.value;
  const beds = +bedsFilter.value;
  const area = +areaFilter.value;
  const q = (document.getElementById('globalSearch').value || '').trim().toLowerCase();

  filtered = properties.filter(p=>{
    if(type !== 'all' && p.type !== type) return false;
    if(p.price > maxPrice) return false;
    if(beds && p.beds > 0 && p.beds < beds) return false;
    if(area && p.area > 0 && p.area < area) return false;
    if(q && !(p.name.toLowerCase().includes(q) || (p.desc && p.desc.toLowerCase().includes(q)))) return false;
    return true;
  });

  // sorting
  const s = sortBy.value;
  if(s === 'price_asc') filtered.sort((a,b)=>a.price-b.price);
  if(s === 'price_desc') filtered.sort((a,b)=>b.price-a.price);
  if(s === 'area_desc') filtered.sort((a,b)=>b.area-a.area);

  renderMap();
  renderListings();
  renderMetrics();
  renderChart();
}

// render map
function renderMap(){
  try{ if(window._currentMarkerLayer) map.removeLayer(window._currentMarkerLayer); } catch(e){}

  if(useClusters){
    markerCluster = L.markerClusterGroup();
  } else {
    markerCluster = L.layerGroup();
  }

  filtered.forEach(p=>{
    const lat = +p.coords[1], lon = +p.coords[0];
    if(isNaN(lat) || isNaN(lon)) return;
    const el = L.divIcon({className:'custom-marker', html:`<div class="pulse"></div>`, iconSize:[18,18]});
    const m = L.marker([lat,lon],{icon:el});
    m.bindPopup(`<b>${p.name}</b><br/>${p.type} • ${p.area} m²<br/><b>$${formatNumber(p.price)}</b><br/><a href="property.html?id=${p.id}">تفاصيل</a>`);
    m.on('click', ()=> { setTimeout(()=> showModalById(p.id), 250); });
    markerCluster.addLayer(m);
  });

  window._currentMarkerLayer = markerCluster;
  markerCluster.addTo(map);
}

// listings + pagination
function renderListings(){
  const start = (currentPage-1)*pageSize;
  const end = start + pageSize;
  const pageItems = filtered.slice(start, end);

  listingsEl.innerHTML = '';
  if(pageItems.length === 0){
    listingsEl.innerHTML = '<div style="padding:18px">لا توجد نتائج مطابقة للفلترة.</div>';
  } else {
    pageItems.forEach(p=>{
      const card = document.createElement('div'); card.className = 'card-item';
      card.innerHTML = `
        <img src="${p.image}" alt="${p.name}" />
        <div class="card-body">
          <div class="card-title">${p.name}</div>
          <div class="card-meta">${p.type} • ${p.area} m² • ${p.beds} غرف</div>
          <div class="card-price">$${formatNumber(p.price)}</div>
          <div style="margin-top:8px"><a class="btn ghost" href="property.html?id=${p.id}">تفاصيل</a></div>
        </div>`;
      card.onclick = ()=> showModalById(p.id);
      listingsEl.appendChild(card);
    });
  }

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  paginationEl.innerHTML = '';
  for(let i=1;i<=totalPages;i++){
    const btn = document.createElement('button');
    btn.className = 'btn ghost';
    if(i===currentPage) btn.className = 'btn primary';
    btn.innerText = i;
    btn.onclick = ()=> { currentPage = i; renderListings(); window.scrollTo({top:400,behavior:'smooth'}); };
    paginationEl.appendChild(btn);
  }

  resultsInfo.innerText = `${filtered.length} نتائج`;
}

// modal
function showModalById(id){
  const p = properties.find(x => x.id == id);
  if(!p) return;
  modalContent.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <img src="${p.image}" style="width:45%;min-width:260px;border-radius:8px;object-fit:cover"/>
      <div style="flex:1">
        <h2 style="margin:0 0 8px">${p.name}</h2>
        <p style="margin:4px 0"><b>السعر:</b> $${formatNumber(p.price)}</p>
        <p style="margin:4px 0"><b>المساحة:</b> ${p.area} m²</p>
        <p style="margin:4px 0"><b>النوع:</b> ${p.type}</p>
        <p style="margin:4px 0"><b>الغرف:</b> ${p.beds}</p>
        <p style="margin:8px 0">${p.desc || ''}</p>
        <div style="display:flex;gap:8px;margin-top:12px">
          <a class="btn primary" href="#">تواصل</a>
          <a class="btn ghost" href="property.html?id=${p.id}">صفحة كاملة</a>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}
modalClose.addEventListener('click', ()=> modal.style.display='none');
window.addEventListener('click', (e)=> { if(e.target === modal) modal.style.display='none'; });

// metrics & chart
function renderMetrics(){
  metricCount.innerText = formatNumber(properties.length);
  const avg = properties.length ? Math.round(properties.reduce((s,p)=>s+p.price,0)/properties.length) : 0;
  metricAvg.innerText = properties.length ? `$${formatNumber(avg)}` : '-';
  const counts = {};
  properties.forEach(p=> counts[p.type] = (counts[p.type]||0)+1);
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  metricTop.innerText = top ? top[0] : '-';
}

let chartInstance = null;
function renderChart(){
  const types = {};
  filtered.forEach(p=> types[p.type] = (types[p.type]||0)+1);
  const labels = Object.keys(types);
  const values = Object.values(types);
  const ctx = document.getElementById('chartType').getContext('2d');
  if(chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets:[{data:values, backgroundColor:['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6'] }]},
    options: {plugins:{legend:{position:'bottom'}}}
  });
}

// clustering toggle
function toggleClusters(){
  useClusters = !useClusters;
  renderMap();
}

// init
function init(){
  renderListings();
  renderMap();
  renderMetrics();
}
init();
