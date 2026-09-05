
// Hero image uses a real IMG element for reliable local and GitHub rendering.
(function(){
  const heroImage=document.getElementById('heroImage');
  if(heroImage){
    const headers=Array.isArray(window.TOMS_TRAILS_HEADERS) ? window.TOMS_TRAILS_HEADERS : [];
    if(headers.length){
      let index=Math.floor(Math.random()*headers.length);
      try{
        const previous=Number(sessionStorage.getItem('tomsTrailsLastHeader'));
        if(headers.length>1 && Number.isInteger(previous) && index===previous){
          index=(index+1+Math.floor(Math.random()*(headers.length-1)))%headers.length;
        }
        sessionStorage.setItem('tomsTrailsLastHeader',String(index));
      }catch(e){}
      const selected=headers[index];
      heroImage.src=selected.file;
      heroImage.alt=`Tom's Trails panorama — ${selected.location || 'Switzerland'}`;
    }
  }
})();

const routes = window.TOMS_ROUTES || [];
const peaks = window.TOMS_PEAKS || [];
const wesenFinds = window.TOMS_WESEN || [];


const THEME_KEY='tomstrails-theme';
function preferredTheme(){
  const saved=localStorage.getItem(THEME_KEY);
  if(saved==='dark'||saved==='light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme(theme){
  document.documentElement.classList.toggle('dark-theme',theme==='dark');
  document.body.classList.toggle('dark-theme',theme==='dark');
  const btn=document.getElementById('themeToggle');
  if(btn){btn.textContent=theme==='dark'?'Light mode':'Dark mode';btn.setAttribute('aria-pressed',theme==='dark'?'true':'false');}
}
applyTheme(preferredTheme());
document.getElementById('themeToggle').addEventListener('click',()=>{
  const next=document.documentElement.classList.contains('dark-theme')?'light':'dark';
  localStorage.setItem(THEME_KEY,next); applyTheme(next);
});




const wesenPhotoState=Object.fromEntries(wesenFinds.map(f=>[f.id,0]));
const wesenLayer=L.layerGroup();
const wesenMarkers={};

const map = L.map('map', {preferCanvas:true});
const baseLayers = {
  'Hiking map (OpenTopoMap)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {maxZoom:17, attribution:'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'}),
  'Standard map (OpenStreetMap)': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'&copy; OpenStreetMap contributors'}),
  'Satellite (Esri World Imagery)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19, attribution:'Tiles &copy; Esri'})
};
let currentBaseLayer = baseLayers['Standard map (OpenStreetMap)'].addTo(map);
const peaksLayer = L.layerGroup();
const layers = new Map();
const visible = new Map();
const allBounds=[];
routes.forEach((r,idx)=>{
  visible.set(r.id, true);
  if(r.points && r.points.length>1){
    const line=L.polyline(r.points, {color:r.color, weight:2.5, opacity:0.88}).addTo(map);
    const actions = popupActionHtml(r);
    line.bindPopup(`<b>${escapeHtml(r.title)}</b><br>${displayDate(r.date)}<br>${fmt(r.km)} km - ${escapeHtml(r.hours_text || '')}<br>Gain: ${fmt(r.gain_m,0)} m${actions}`);
    line.on('mouseover', ()=>highlightRoute(r.id));
    line.on('mouseout', ()=>clearHighlight(r.id));
    layers.set(r.id, line);
    r.points.forEach(p=>allBounds.push(p));
  }
});
if(allBounds.length) map.fitBounds(allBounds, {padding:[30,30], maxZoom:13}); else map.setView([47.349,7.903],12);
setTimeout(()=>map.invalidateSize(), 250);

function escapeHtml(s){return String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function fmt(v, decimals=2){ if(v===null || v===undefined || v==='') return ''; const n=Number(v); return Number.isFinite(n)?n.toFixed(decimals):escapeHtml(v); }
function displayDate(iso){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : escapeHtml(iso);
}

function routeVideos(route){ return (route && route.youtube_videos) ? route.youtube_videos : []; }
function firstVideo(route){ const v=routeVideos(route); return v.length ? v[0] : null; }
function videoThumb(videoId){ return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`; }
function youtubeEmbed(videoId){ return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&autoplay=1&playsinline=1`; }
function routeActionHtml(r){
  const parts=[];
  if(r.komoot_url){ parts.push(`<a class="route-action" href="${escapeHtml(r.komoot_url)}" target="_blank" rel="noopener" title="Open on Komoot" aria-label="Open ${escapeHtml(r.title)} on Komoot">🥾</a>`); }
  const vids=routeVideos(r);
  if(vids.length){ parts.push(`<button class="route-action video-action" type="button" data-video-route-id="${escapeHtml(r.id)}" title="Watch video${vids.length>1?'s':''}" aria-label="Watch video${vids.length>1?'s':''} for ${escapeHtml(r.title)}">▶</button>`); }
  return parts.length ? `<span class="route-actions">${parts.join('')}</span>` : '';
}
function popupActionHtml(r){
  const parts=[];
  if(r.komoot_url){ parts.push(`<a class="popup-action" href="${escapeHtml(r.komoot_url)}" target="_blank" rel="noopener">🥾 Komoot</a>`); }
  const vids=routeVideos(r);
  if(vids.length){ parts.push(`<button class="popup-action video" type="button" onclick="event.preventDefault(); event.stopPropagation(); openVideoForRoute('${escapeHtml(r.id)}'); return false;">▶ Video${vids.length>1?'s':''}</button>`); }
  return parts.length ? `<div class="popup-actions">${parts.join('')}</div>` : '';
}
function allVideos(){
  const out=[];
  routes.filter(r=>r._sheet_id!==undefined).forEach(r=>{
    routeVideos(r).forEach(v=>out.push({routeId:r.id, routeTitle:r.title, routeDate:r.date, id:v.id, title:v.title||r.title, url:v.url||('https://youtu.be/'+v.id)}));
  });
  return out;
}
window.openVideo=function(videoId, title, url){
  const modal=document.getElementById('videoModal'), content=document.getElementById('videoModalContent');
  const cleanUrl=url || ('https://youtu.be/'+videoId);
  content.innerHTML=`<h2>${escapeHtml(title||'Tom\'s Trails video')}</h2><div class="video-frame-wrap"><iframe src="${youtubeEmbed(videoId)}" title="${escapeHtml(title||'YouTube video')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div><div class="video-modal-actions"><a class="video-open-link" href="${escapeHtml(cleanUrl)}" target="_blank" rel="noopener">Open on YouTube ↗</a></div>`;
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open-video');
};
window.openVideoForRoute=function(routeId){
  const r=routes.find(x=>x.id===routeId); if(!r) return;
  const vids=routeVideos(r);
  if(!vids.length) return;
  if(vids.length===1){ openVideo(vids[0].id, vids[0].title||r.title, vids[0].url); return; }
  const modal=document.getElementById('videoModal'), content=document.getElementById('videoModalContent');
  content.innerHTML=`<h2>${escapeHtml(r.title)}</h2><div class="video-choice-list">${vids.map(v=>`<button class="video-choice" type="button" data-video-id="${escapeHtml(v.id)}" data-video-title="${escapeHtml(v.title||r.title)}" data-video-url="${escapeHtml(v.url||('https://youtu.be/'+v.id))}"><img src="${videoThumb(v.id)}" alt=""><span><span class="video-choice-title">${escapeHtml(v.title||r.title)}</span><br><span class="video-card-meta">▶ Watch video</span></span></button>`).join('')}</div>`;
  content.querySelectorAll('.video-choice').forEach(btn=>btn.addEventListener('click',()=>openVideo(btn.dataset.videoId, btn.dataset.videoTitle, btn.dataset.videoUrl)));
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open-video');
};
window.openVideoGallery=function(){
  const vids=allVideos();
  const modal=document.getElementById('videoModal'), content=document.getElementById('videoModalContent');
  content.innerHTML=`<h2>Tom's Trails Videos</h2><div class="video-gallery">${vids.map(v=>`<button class="video-card" type="button" data-video-id="${escapeHtml(v.id)}" data-video-title="${escapeHtml(v.title)}" data-video-url="${escapeHtml(v.url)}"><img src="${videoThumb(v.id)}" alt=""><span class="video-card-body"><span class="video-card-title">${escapeHtml(v.title)}</span><br><span class="video-card-meta">${displayDate(v.routeDate)} · ${escapeHtml(v.routeTitle)}</span></span></button>`).join('')}</div>`;
  content.querySelectorAll('.video-card').forEach(btn=>btn.addEventListener('click',()=>openVideo(btn.dataset.videoId, btn.dataset.videoTitle, btn.dataset.videoUrl)));
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open-video');
};
window.closeVideoModal=function(){
  const modal=document.getElementById('videoModal'), content=document.getElementById('videoModalContent');
  content.innerHTML=''; modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open-video');
};

function hoursToText(hours){
  const mins=Math.round(Number(hours || 0)*60); const h=Math.floor(mins/60); const m=mins%60;
  return `${h}h ${String(m).padStart(2,'0')}m`;
}
function filteredRoutes(){
  const f=document.getElementById('q').value.toLowerCase();
  return routes.filter(r=>r._sheet_id !== undefined && (r.date+' '+displayDate(r.date)+' '+r.title).toLowerCase().includes(f));
}
const MASTER_TOTALS = {hikes:82, peaks:117, km:931.47, gain:44061, time:'191:32 h'};
function updateSummary(){
  // Overall totals are locked to the Excel tracking sheet, which is the source of truth.
  document.getElementById('sumHikes').textContent=MASTER_TOTALS.hikes;
  document.getElementById('sumPeaks').textContent=MASTER_TOTALS.peaks;
  document.getElementById('sumKm').textContent=MASTER_TOTALS.km.toFixed(2);
  document.getElementById('sumGain').textContent=MASTER_TOTALS.gain.toLocaleString()+' m';
  document.getElementById('sumTime').textContent=MASTER_TOTALS.time;
}
function highlightRoute(id){
  const layer=layers.get(id);
  if(layer && visible.get(id)) layer.setStyle({weight:4, opacity:1});
  const row=document.querySelector(`tr[data-id="${id}"]`);
  if(row) row.classList.add('route-highlight');
}
function clearHighlight(id){
  const layer=layers.get(id);
  const r=routes.find(x=>x.id===id);
  if(layer && r) layer.setStyle({color:r.color, weight:2.5, opacity:0.88});
  const row=document.querySelector(`tr[data-id="${id}"]`);
  if(row) row.classList.remove('route-highlight');
}
function applyVisibility(id, isVisible){
  visible.set(id, isVisible);
  const layer=layers.get(id);
  if(layer){ isVisible ? layer.addTo(map) : map.removeLayer(layer); }
  document.querySelectorAll(`[data-id="${id}"]`).forEach(el=>el.classList.toggle('dimmed', !isVisible));
  document.querySelectorAll(`input[data-route-id="${id}"]`).forEach(cb=>cb.checked=isVisible);
  updateSummary();
}
function zoomToRoute(r){
  const layer=layers.get(r.id);
  if(layer){ map.fitBounds(layer.getBounds(), {padding:[40,40], maxZoom:14}); layer.openPopup(); window.scrollTo({top:document.querySelector('.app').offsetTop-8, behavior:'smooth'}); }
}
function zoomToVisible(){
  const pts=[];
  routes.forEach(r=>{ if(visible.get(r.id) && r.points) r.points.forEach(p=>pts.push(p)); });
  if(pts.length) map.fitBounds(pts, {padding:[30,30], maxZoom:13});
}

function normalizeText(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function metersBetween(a,b){
  const R=6371000, toRad=x=>x*Math.PI/180;
  const dLat=toRad(b[0]-a[0]), dLon=toRad(b[1]-a[1]);
  const lat1=toRad(a[0]), lat2=toRad(b[0]);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
const peakNameCounts = peaks.reduce((acc,p)=>{ const n=normalizeText(p.name); acc[n]=(acc[n]||0)+1; return acc; },{});
function routeMentionsPeak(route, peak){
  const peakName=normalizeText(peak.name);
  if(peakNameCounts[peakName] > 1) return false; // duplicate peak names are matched by coordinate proximity only
  const t=normalizeText(route.title+' '+(route.gpx_title||'')+' '+(route.file||''));
  const names=[peak.name].concat(peak.aliases||[]).map(normalizeText).filter(Boolean);
  return names.some(n=>n && t.includes(n));
}
function routesNearPeak(peak){
  const found=[];
  routes.filter(r=>r._sheet_id!==undefined).forEach(r=>{
    let why='';
    if(routeMentionsPeak(r, peak)) why='title match';
    if(!why && peak.lat && peak.lon && r.points){
      let min=Infinity;
      for(const p of r.points){ const d=metersBetween([peak.lat, peak.lon], p); if(d<min) min=d; if(min<350) break; }
      if(min<350) why=Math.round(min)+' m away';
    }
    if(why) found.push({route:r, why});
  });
  return found;
}
function peakPopupHtml(peak){
  const visited=routesNearPeak(peak);
  const items=visited.length ? visited.slice(0,8).map(v=>`<li><a href="#" class="peak-route-link" data-route-id="${v.route.id}">${escapeHtml(v.route.title)}</a></li>`).join('') : '<li class="muted">No matching hike detected yet</li>';
  const more=visited.length>8 ? `<div class="muted">+ ${visited.length-8} more</div>` : '';
  const manual=peak.collection_method==='manual';
  const method=manual ? 'Manual collection' : 'Automatic collection (Komoot)';
  const note=peak.note ? `<div class="peak-note">${escapeHtml(peak.note)}</div>` : '';
  return `<div class="peak-popup"><h3>${escapeHtml(peak.name)}</h3><div class="peak-elev">${Number(peak.elevation_m).toLocaleString()} m</div><div class="peak-collection"><b>Collection</b><br>${method}${note}</div><b>Nearby hikes:</b><ul>${items}</ul>${more}</div>`;
}
function addPeakMarker(peak){
  if(!peak.lat || !peak.lon) return;
  const manual=peak.collection_method==='manual';
  const markerSvg=manual
    ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 14.5 14H1.5Z" fill="white" fill-opacity="0.92" stroke="#c2185b" stroke-width="2" stroke-linejoin="round"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 14.5 14H1.5Z" fill="#c2185b" stroke="white" stroke-width="0.8" stroke-linejoin="round"/></svg>';
  const icon=L.divIcon({className:'peak-svg-icon', html:markerSvg, iconSize:[16,16], iconAnchor:[8,14], popupAnchor:[0,-14]});
  const marker=L.marker([peak.lat, peak.lon], {icon, title:peak.name}).bindPopup(peakPopupHtml(peak));
  marker.on('popupopen', e=>{
    e.popup.getElement().querySelectorAll('.peak-route-link').forEach(a=>{
      a.addEventListener('click', evt=>{evt.preventDefault(); const r=routes.find(x=>x.id===a.dataset.routeId); if(r) zoomToRoute(r);});
    });
  });
  marker.addTo(peaksLayer);
}
function initPeaks(){
  peaks.forEach(addPeakMarker);
  peaksLayer.addTo(map);
  document.getElementById('sumPeaks').textContent=peaks.length;
  // Best-effort browser-side geocoding for any peaks without sheet/GPX coordinates.
  // Results are cached locally by the browser and use the Swiss GeoAdmin search service.
  const missing=peaks.filter(p=>!p.lat || !p.lon);
  missing.forEach((peak, idx)=>{
    const key='tomstrails_peak_'+normalizeText(peak.name)+'_'+peak.elevation_m;
    try{
      const cached=localStorage.getItem(key);
      if(cached){ const c=JSON.parse(cached); if(c.lat&&c.lon){ peak.lat=c.lat; peak.lon=c.lon; addPeakMarker(peak); return; } }
    }catch(e){}
    setTimeout(()=>{
      const url='https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText='+encodeURIComponent(peak.name)+'&type=locations&origins=swissnames&limit=8&sr=4326';
      fetch(url).then(r=>r.json()).then(data=>{
        const results=(data.results||[]).map(x=>{
          let lat=null, lon=null;
          if(x.attrs){
            lat=parseFloat(x.attrs.lat||x.attrs.latitude); lon=parseFloat(x.attrs.lon||x.attrs.lng||x.attrs.longitude);
          }
          if((!lat||!lon) && x.geom && x.geom.coordinates){
            const c=x.geom.coordinates;
            if(Math.abs(c[0])<=180 && Math.abs(c[1])<=90){ lon=parseFloat(c[0]); lat=parseFloat(c[1]); }
          }
          return {lat,lon,label:(x.attrs&&x.attrs.label)||''};
        }).filter(x=>x.lat && x.lon && x.lat>46.8 && x.lat<47.6 && x.lon>7.0 && x.lon<8.5);
        if(results.length){
          // choose the candidate closest to the center of all hiking routes
          const center=[47.35,7.75];
          results.sort((a,b)=>metersBetween(center,[a.lat,a.lon])-metersBetween(center,[b.lat,b.lon]));
          peak.lat=+results[0].lat.toFixed(6); peak.lon=+results[0].lon.toFixed(6);
          try{localStorage.setItem(key, JSON.stringify({lat:peak.lat, lon:peak.lon}));}catch(e){}
          addPeakMarker(peak);
        }
      }).catch(()=>{});
    }, idx*180);
  });
}

function wesenLabel(f){ return f.official ? `${escapeHtml(f.id)} · No. ${escapeHtml(f.official)}` : escapeHtml(f.id); }
function routesNearWesen(f){
  const found=[];
  routes.forEach(r=>{
    if(!r.points || !r.points.length) return;
    let min=Infinity;
    for(const p of r.points){
      const d=metersBetween([f.lat,f.lon], p);
      if(d<min) min=d;
      if(min<=180) break;
    }
    if(min<=180) found.push({route:r, dist:min});
  });
  found.sort((a,b)=>a.dist-b.dist);
  return found;
}
function wesenPopupHtml(f){
  const i=wesenPhotoState[f.id]||0;
  const popupPhoto=(typeof f.hero === 'string' && f.hero) ? f.hero : ((f.photoData && f.photoData.length) ? f.photoData[i] : '');
  const img=popupPhoto ? `<img class="wesen-thumb" src="${popupPhoto}" alt="${escapeHtml(f.title)}">` : '';
  const maps=escapeHtml(f.map||('https://maps.google.com/?q='+f.lat+','+f.lon));
  return `<div class="wesen-popup-compact">${img}<div class="wesen-id">${wesenLabel(f)}</div><h3>${escapeHtml(f.title)}</h3><div style="font-size:12px;color:#475569;margin:0 0 6px"><b>Date:</b> ${escapeHtml(f.date||'')}</div><div class="wesen-popup-actions"><button class="wesen-btn" onclick="event.preventDefault(); event.stopPropagation(); openWesenDetails('${f.id}'); return false;">Open details</button><a class="wesen-link" href="${maps}" target="_blank" rel="noopener">Google Maps</a></div></div>`;
}
function wesenDetailHtml(f){
  const i=wesenPhotoState[f.id]||0;
  const hasPhotos=f.photoData && f.photoData.length;
  const img=hasPhotos ? `<div><div class="wesen-photo-wrap"><img class="wesen-modal-img" src="${f.photoData[i]}" alt="${escapeHtml(f.title)}"></div>${f.photoData.length>1 ? `<div class="wesen-controls"><a class="wesen-nav-btn" href="#" onclick="event.preventDefault(); changeWesenModalPhoto('${f.id}',-1); return false;">‹</a><span>Photo ${i+1} / ${f.photoData.length}</span><a class="wesen-nav-btn" href="#" onclick="event.preventDefault(); changeWesenModalPhoto('${f.id}',1); return false;">›</a></div>` : ''}</div>` : `<div class="wesen-photo-wrap muted">No photo</div>`;
  const related=routesNearWesen(f);
  const routeItems=related.length ? related.slice(0,6).map(v=>`<li><a href="#" class="wesen-route-link" data-route-id="${v.route.id}">${escapeHtml(v.route.title)}</a></li>`).join('') : '<li class="muted">No nearby hike detected yet</li>';
  const maps=escapeHtml(f.map||('https://maps.google.com/?q='+f.lat+','+f.lon));
  const found=escapeHtml(f.date||'Not available');
  return `${img}<div class="wesen-modal-info"><div class="wesen-id">${wesenLabel(f)}</div><h2>${escapeHtml(f.title)}</h2><div class="wesen-field-grid"><div class="wesen-field"><b>Found</b><span>${found}</span></div><div class="wesen-field"><b>Location</b><span>${escapeHtml(f.feature||'Not available')}</span></div><div class="wesen-field"><b>Motif</b><span>${escapeHtml(f.motif||'Not available')}</span></div><div class="wesen-field"><b>Altitude</b><span>${escapeHtml(f.alt||'Not available')}</span></div><div class="wesen-field"><b>Coordinates</b><span>${Number(f.lat).toFixed(7)}, ${Number(f.lon).toFixed(7)}</span></div></div><h3>Nearby hikes</h3><ul>${routeItems}</ul><a class="wesen-link" href="${maps}" target="_blank" rel="noopener">Open in Google Maps</a></div>`;
}
window.openWesenDetails=function(id){
  const f=wesenFinds.find(x=>x.id===id); if(!f) return;
  const modal=document.getElementById('wesenModal');
  const content=document.getElementById('wesenModalContent');
  content.innerHTML=wesenDetailHtml(f);
  content.querySelectorAll('.wesen-route-link').forEach(a=>{
    a.addEventListener('click', evt=>{evt.preventDefault(); const r=routes.find(x=>x.id===a.dataset.routeId); if(r){ closeWesenDetails(); zoomToRoute(r); }});
  });
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
}
window.closeWesenDetails=function(){
  const modal=document.getElementById('wesenModal');
  modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open');
}
window.changeWesenModalPhoto=function(id,d){
  const f=wesenFinds.find(x=>x.id===id); if(!f || !f.photoData || !f.photoData.length) return;
  wesenPhotoState[id]=(wesenPhotoState[id]+d+f.photoData.length)%f.photoData.length;
  const content=document.getElementById('wesenModalContent');
  content.innerHTML=wesenDetailHtml(f);
  content.querySelectorAll('.wesen-route-link').forEach(a=>{
    a.addEventListener('click', evt=>{evt.preventDefault(); const r=routes.find(x=>x.id===a.dataset.routeId); if(r){ closeWesenDetails(); zoomToRoute(r); }});
  });
  const marker=wesenMarkers[id]; if(marker){ marker.setPopupContent(wesenPopupHtml(f)); }
}
window.changeWesenPopupPhoto=function(id,d){ changeWesenModalPhoto(id,d); }
document.getElementById('wesenModalClose').addEventListener('click', closeWesenDetails);
document.getElementById('wesenModal').addEventListener('click', e=>{ if(e.target.id==='wesenModal') closeWesenDetails(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeWesenDetails(); });
document.getElementById('videoModalClose').addEventListener('click', closeVideoModal);
document.getElementById('videoModal').addEventListener('click', e=>{ if(e.target.id==='videoModal') closeVideoModal(); });
document.getElementById('videoHeroPill').addEventListener('click', e=>{ e.preventDefault(); openVideoGallery(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeVideoModal(); });

function addWesenMarker(f){
  if(!f.lat || !f.lon) return;
  const icon=L.divIcon({className:'', html:'<div class="wesen-marker"></div>', iconSize:[18,18], iconAnchor:[9,9], popupAnchor:[0,-10]});
  const marker=L.marker([f.lat,f.lon], {icon, title:f.title}).bindPopup(wesenPopupHtml(f), {maxWidth:220, minWidth:190});
  marker.on('popupopen', e=>{
    e.popup.getElement().querySelectorAll('.wesen-route-link').forEach(a=>{
      a.addEventListener('click', evt=>{evt.preventDefault(); const r=routes.find(x=>x.id===a.dataset.routeId); if(r) zoomToRoute(r);});
    });
  });
  marker.addTo(wesenLayer);
  wesenMarkers[f.id]=marker;
}
function initWesen(){
  wesenFinds.forEach(addWesenMarker);
  wesenLayer.addTo(map);
  const el=document.getElementById('sumWesen'); if(el) el.textContent=wesenFinds.length;
}

function renderRouteList(){
  const box=document.getElementById('routeList'); if(!box) return; box.innerHTML='';
  routes.filter(r=>r._sheet_id !== undefined).forEach(r=>{
    const label=document.createElement('label'); label.className='route-toggle'; label.dataset.id=r.id;
    label.innerHTML=`<input type="checkbox" data-route-id="${r.id}" ${visible.get(r.id)?'checked':''}><span class="swatch" style="background:${r.color}"></span><span>${escapeHtml(r.title)}</span>`;
    const cb=label.querySelector('input');
    cb.addEventListener('change', ()=>applyVisibility(r.id, cb.checked));
    label.addEventListener('mouseenter', ()=>highlightRoute(r.id));
    label.addEventListener('mouseleave', ()=>clearHighlight(r.id));
    box.appendChild(label);
  });
}
function render(){
 const tbody=document.querySelector('#tbl tbody'); tbody.innerHTML='';
 filteredRoutes().forEach(r=>{
  const tr=document.createElement('tr'); tr.dataset.id=r.id; tr.classList.toggle('dimmed', !visible.get(r.id));
  const titleHtml = escapeHtml(r.title) + routeActionHtml(r);
  tr.innerHTML=`<td class="check"><input type="checkbox" data-route-id="${r.id}" ${visible.get(r.id)?'checked':''} aria-label="Show ${escapeHtml(r.title)}"></td><td class="date">${displayDate(r.date)}</td><td class="title"><span class="swatch" style="background:${r.color}"></span>${titleHtml}${r.file?'':' <span class="muted">(sheet only)</span>'}</td><td>${escapeHtml(r.hours_text||'')}</td><td>${fmt(r.km)}</td><td>${fmt(r.gain_m,0)} m</td><td>${fmt(r.speed,2)}</td>`;
  const cb=tr.querySelector('input');
  cb.addEventListener('click', e=>{e.stopPropagation(); applyVisibility(r.id, cb.checked);});
  tr.querySelectorAll('.route-action').forEach(el=>{
    el.addEventListener('click', e=>{ e.stopPropagation(); if(el.dataset.videoRouteId){ e.preventDefault(); openVideoForRoute(el.dataset.videoRouteId); } });
  });
  tr.addEventListener('click', ()=>zoomToRoute(r));
  tr.addEventListener('mouseenter', ()=>highlightRoute(r.id));
  tr.addEventListener('mouseleave', ()=>clearHighlight(r.id));
  tbody.appendChild(tr);
 });
 updateSummary();
}
document.getElementById('q').addEventListener('input', render);
document.getElementById('toggleTrails').addEventListener('change', e=>{ routes.forEach(r=>applyVisibility(r.id,e.target.checked)); render(); renderRouteList(); });
document.getElementById('zoomVisible').addEventListener('click', zoomToVisible);
document.getElementById('baseLayerSelect').addEventListener('change', e=>{
  const next=baseLayers[e.target.value];
  if(next && next!==currentBaseLayer){
    map.removeLayer(currentBaseLayer);
    currentBaseLayer=next.addTo(map);
  }
});
document.getElementById('togglePeaks').addEventListener('change', e=>{
  e.target.checked ? peaksLayer.addTo(map) : map.removeLayer(peaksLayer);
});
document.getElementById('toggleWesen').addEventListener('change', e=>{
  e.target.checked ? wesenLayer.addTo(map) : map.removeLayer(wesenLayer);
});
renderRouteList();
initPeaks();
initWesen();
render();
