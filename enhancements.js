(()=>{'use strict';
const T=window.LR_TRANSIT,SCH=window.LR_SCHEDULE,M=window.LR_MAP,R=window.LR_RENDER,APP=window.__LR_APP_TEST__,$=id=>document.getElementById(id);
if(!T||!SCH||!APP)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const fmtClock=m=>{if(m==null||m<0)return'—';m=Math.round(m);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const fmtDuration=m=>{m=Math.max(0,Math.round(m||0));return m>=60?Math.floor(m/60)+' h '+(m%60?m%60+' min':''):m+' min'};
const fmtNumber=n=>new Intl.NumberFormat('fr-FR').format(n||0);
const lineInfos=Object.entries(T.lineInfo);
function lineInfo(code,key){return (key&&T.lineInfo[key])||T.lineInfo['BUS-'+code]||lineInfos.find(([,x])=>x.line===code)?.[1]||{line:code,color:'#64748b',mode:'Transport',name:'Ligne '+code};}
function lineColor(code){return lineInfo(code).color||'#64748b'}
function dayData(){let now=new Date(),minutes=now.getHours()*60+now.getMinutes(),serviceDate=new Date(now);if(minutes<240){minutes+=1440;serviceDate.setDate(serviceDate.getDate()-1)}let dow=serviceDate.getDay(),key=dow===5?'friday':dow===6?'saturday':dow===0?'sunday':'weekday';return{key,minutes,date:serviceDate}}
function nextAfter(times,now,n=5){let out=times.filter(x=>x!=null&&x>=now).sort((a,b)=>a-b).slice(0,n);if(out.length<n)out.push(...times.filter(x=>x!=null).sort((a,b)=>a-b).slice(0,n-out.length).map(x=>x+1440));return out}
function currentHeadway(times,now){const a=times.filter(x=>x!=null).sort((x,y)=>x-y);if(a.length<2)return null;let i=a.findIndex(x=>x>=now);if(i<0)i=a.length-1;let vals=[];for(let j=Math.max(1,i-3);j<Math.min(a.length,i+4);j++)vals.push(a[j]-a[j-1]);vals=vals.filter(x=>x>0&&x<120);if(!vals.length)return null;vals.sort((x,y)=>x-y);return Math.round(vals[Math.floor(vals.length/2)])}
function serviceLabel(key){return{weekday:'Lundi à jeudi',friday:'Vendredi',saturday:'Samedi',sunday:'Dimanche'}[key]||key}

// Home overview
const modeCounts={metro:0,train:0,tram:0,bus:Object.keys(SCH.bus).length};
for(const [k,x] of lineInfos){const m=String(x.mode||'').toLowerCase();if(k.startsWith('BUS-'))continue;if(m.includes('métro'))modeCounts.metro++;else if(m.includes('tram'))modeCounts.tram++;else if(m.includes('train')||m.includes('express'))modeCounts.train++}
$('networkChips').innerHTML=[['M',modeCounts.metro,'#3478d4'],['R',modeCounts.train,'#df6434'],['T',modeCounts.tram,'#2ca45e'],['BUS',modeCounts.bus,'#735acb']].map(([a,n,c])=>`<span style="background:${c}" title="${n} lignes">${a}</span>`).join('');
$('networkSummary').textContent=`${modeCounts.metro} lignes de métro, ${modeCounts.train} lignes ferroviaires, ${modeCounts.tram} tramways et ${modeCounts.bus} lignes de bus avec horaires.`;
$('auditLines').textContent=fmtNumber(modeCounts.metro+modeCounts.train+modeCounts.tram+modeCounts.bus);
$('auditStops').textContent=fmtNumber(T.stations.length+T.busStops.length);
$('auditPois').textContent=fmtNumber(M.pois.length);

// Search presets
for(const b of document.querySelectorAll('[data-search-preset]'))b.addEventListener('click',()=>{const i=$('globalSearch');i.value=b.dataset.searchPreset;i.dispatchEvent(new Event('input',{bubbles:true}));i.focus()});
$('nearbyBtn').addEventListener('click',()=>{const i=$('globalSearch');i.value='gare';i.dispatchEvent(new Event('input',{bubbles:true}));i.focus()});
$('openNetwork').addEventListener('click',()=>$('transportBtn').click());
$('routeSettingsBtn').addEventListener('click',()=>showToast('Voiture : vitesses effectives selon la rue, les carrefours et le trafic horaire · marche : 3 km/h sur la voirie · vélo : 10 km/h.'));
function showToast(text){const t=$('toast');t.textContent=text;t.classList.remove('hidden');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.add('hidden'),3200)}

// Audit panel
function auditHTML(){const m=SCH.meta,bc=m.busControl||{},bs=m.busStatuses||{},railOk=m.railSpacingViolations===0;return`
<div class="auditHero"><strong>${railOk?'Réseau chargé sans violation horaire':'Contrôle requis'}</strong><p>${railOk?'Les espacements ferroviaires respectent les seuils du fichier final.':'Des espacements ferroviaires restent sous le seuil.'}</p></div>
<div class="auditGrid">
 <div class="auditTile"><strong>${fmtNumber(M.addresses.length)}</strong><span>adresses et bâtiments</span></div>
 <div class="auditTile"><strong>${fmtNumber(M.pois.length)}</strong><span>lieux d’intérêt</span></div>
 <div class="auditTile"><strong>${fmtNumber(T.stations.length)}</strong><span>stations ferroviaires</span></div>
 <div class="auditTile"><strong>${fmtNumber(T.busStops.length)}</strong><span>arrêts de bus</span></div>
 <div class="auditTile"><strong>${fmtNumber(SCH.meta.railMissions)}</strong><span>missions rail hebdomadaires-type</span></div>
 <div class="auditTile"><strong>${fmtNumber(SCH.meta.busTrips)}</strong><span>courses bus hebdomadaires-type</span></div>
</div>
<div class="auditSection"><h3>Transport et géométrie</h3>
 <div class="auditRow"><span>Tracés rail</span><span>${T.meta.railTraces} / 22</span></div>
 <div class="auditRow"><span>Blocs de tracé bus</span><span>${fmtNumber(T.meta.busTraceBlocks)}</span></div>
 <div class="auditRow"><span>Paires bus non appariées</span><span>${T.meta.unmappedBusPairs}</span></div>
 <div class="auditRow"><span>Espacements ferroviaires sous seuil</span><span>${m.railSpacingViolations}</span></div>
</div>
<div class="auditSection"><h3>Contrôle des lignes de bus</h3>
 <div class="auditRow"><span><i class="auditDot" style="background:#34c759"></i>Conformes</span><span>${bs['Conforme']||0}</span></div>
 <div class="auditRow"><span><i class="auditDot" style="background:#ff9f0a"></i>À vérifier</span><span>${bs['À vérifier']||0}</span></div>
 <div class="auditRow"><span><i class="auditDot" style="background:#ff453a"></i>Anomalies</span><span>${bs['Anomalie']||0}</span></div>
 <div class="auditRow"><span><i class="auditDot" style="background:#8e8e93"></i>Hors référentiel</span><span>${bs['Hors référentiel']||0}</span></div>
 <p class="auditNote">Les mentions « à vérifier » proviennent du registre de contrôle, notamment lorsque certains arrêts ne sont desservis que dans un sens. Elles ne signifient pas que le tracé est inutilisable.</p>
</div>
<div class="auditSection"><h3>Paramètres du moteur</h3>
 <div class="auditRow"><span>Voiture dans Los Rico</span><span>16–34 km/h selon voie et trafic</span></div>
 <div class="auditRow"><span>Voiture hors Los Rico</span><span>20–100 km/h selon voie et trafic</span></div>
 <div class="auditRow"><span>Marche</span><span>3 km/h</span></div>
 <div class="auditRow"><span>Vélo</span><span>10 km/h</span></div>
 <div class="auditRow"><span>Calcul de distance</span><span>sur la voirie</span></div>
</div>
<div class="auditSection"><h3>Sources actives</h3>
 <div class="auditRow"><span>Données bus</span><span>${esc(bc['Version des données']||'version finale')}</span></div>
 <div class="auditRow"><span>Horaires</span><span>9 juillet 2026</span></div>
 <div class="auditRow"><span>Application</span><span>Voyageur 6.0</span></div>
</div>`}
$('auditContent').innerHTML=auditHTML();
$('infoBtn').addEventListener('click',()=>$('auditPanel').classList.remove('hidden'));
$('miniAudit').addEventListener('click',()=>$('auditPanel').classList.remove('hidden'));
$('closeAudit').addEventListener('click',()=>$('auditPanel').classList.add('hidden'));

// Line inspector
let inspector={code:null,key:null,dir:0};
function railBlocks(code){const d=dayData();return (SCH.rail[code]?.x||[]).filter(x=>x.d===d.key)}
function busDirs(code){const d=dayData();return SCH.bus[code]?.d?.[d.key]?.x||[]}
function railFrequency(code,now){const d=dayData();let rows=SCH.freq.filter(x=>x.l===code&&(!x.j||/semaine/i.test(x.j))&&x.a!=null&&x.b!=null);let row=rows.find(x=>{let a=x.a,b=x.b;if(b<a)b+=1440;let n=now;if(n<a&&n+1440<=b)n+=1440;return n>=a&&n<=b})||rows[0];return row?(row.f?`${row.f} min`:'selon horaire'):'horaire détaillé'}
function renderLine(code,key,dirIndex=0){const info=lineInfo(code,key),rail=SCH.rail[code],bus=SCH.bus[code],d=dayData();let dirs=rail?railBlocks(code):busDirs(code);if(!dirs.length&&rail)dirs=rail.x.filter((x,i)=>i<2);if(!dirs.length&&bus){const first=Object.values(bus.d)[0];dirs=first?.x||[]}dirIndex=Math.max(0,Math.min(dirIndex,dirs.length-1));inspector={code,key,dir:dirIndex};const dir=dirs[dirIndex];let stops=[],departures=[],service='',duration=0,headway='—';if(rail&&dir){stops=dir.s.map((x,i)=>({name:x[0],branch:x[1],offset:null,index:i}));for(const m of dir.m){const vals=m[5].filter(x=>x>=0);if(!vals.length)continue;const tm=vals[0];departures.push({t:tm,code:m[0],dest:m[3],type:m[1]});duration=Math.max(duration,vals.at(-1)-vals[0])}headway=railFrequency(code,d.minutes);service=`${serviceLabel(d.key)} · horaires techniques exacts · ${dir.m.length} missions dans ce sens`;}else if(bus&&dir){stops=dir.s.map((x,i)=>({name:x[0],offset:x[1],index:i}));departures=dir.t.map((t,i)=>({t,code:String(i+1).padStart(3,'0'),dest:dir.b,type:''}));duration=stops.at(-1)?.offset||0;const hw=currentHeadway(dir.t,d.minutes);headway=hw?`${hw} min`:'variable';const day=bus.d[d.key]||Object.values(bus.d)[0];service=`${serviceLabel(d.key)} · ${day?.h||'amplitude selon fiche'}${day?.p?' · parc '+day.p:''}`;}let next=nextAfter(departures.map(x=>x.t),d.minutes,5).map(t=>{let base=t>1700?t-1440:t;let exact=departures.find(x=>x.t===base)||departures.find(x=>x.t===t)||departures[0];return{...exact,t}});const tabs=dirs.map((x,i)=>`<button class="${i===dirIndex?'active':''}" data-inspector-dir="${i}">${esc(x.a||'Sens '+(i+1))} → ${esc(x.b||'')}</button>`).join('');const stopHtml=stops.map((s,i)=>`<div class="stopRow" style="--lineColor:${info.color||'#007aff'}"><strong>${esc(s.name)}</strong><small>${s.branch?esc(s.branch)+' · ':''}${s.offset!=null?(i?'+'+Math.round(s.offset)+' min':'Départ'):i===0?'Départ':i===stops.length-1?'Terminus':''}</small></div>`).join('');const depHtml=next.map(x=>`<div class="departureRow"><time>${fmtClock(x.t)}</time><span>${esc(x.dest||dir?.b||'Terminus')}<small>${x.code?'Mission '+esc(x.code):''}</small></span><b>${x.t>=d.minutes?'dans '+Math.max(0,x.t-d.minutes)+' min':''}</b></div>`).join('')||'<p class="auditNote">Aucun départ renseigné pour cette journée.</p>';$('lineInspectorContent').innerHTML=`
<div class="lineHead"><div class="lineHeroBadge" style="background:${info.color||'#64748b'}">${esc(code)}</div><div><h2>${esc(info.name||'Ligne '+code)}</h2><p>${esc(info.mode||rail?.m||bus?.s||'Transport')} · ${esc(info.a||rail?.a||bus?.a||'')} → ${esc(info.b||rail?.b||bus?.b||'')}</p></div></div>
<div class="lineStats"><div><strong>${stops.length}</strong><span>arrêts</span></div><div><strong>${fmtDuration(duration)}</strong><span>parcours</span></div><div><strong>Exact</strong><span>fiche horaire</span></div></div>
<div class="serviceStrip">${esc(service)}${bus?.o?'<br>'+esc(bus.o):''}</div>
<div class="directionTabs">${tabs}</div>
<div class="lineDepartures"><h3>Prochains départs du terminus</h3>${depHtml}</div>
<div class="stopList">${stopHtml}</div>`;$('lineInspector').classList.remove('hidden');$('detailCard').classList.add('hidden')}
$('closeLineInspector').addEventListener('click',()=>$('lineInspector').classList.add('hidden'));
$('lineInspectorContent').addEventListener('click',e=>{const b=e.target.closest('[data-inspector-dir]');if(b)renderLine(inspector.code,inspector.key,+b.dataset.inspectorDir)});
$('lineList').addEventListener('click',e=>{const b=e.target.closest('[data-code]');if(!b)return;setTimeout(()=>{if(APP.state.selectedLine)renderLine(b.dataset.code,b.dataset.key);else $('lineInspector').classList.add('hidden')},0)});
$('detailBadges').addEventListener('click',e=>{const b=e.target.closest('[data-line]');if(b)setTimeout(()=>renderLine(b.dataset.line,null,0),0)});

// Departures at selected stations and bus stops
function stationDepartures(name){const d=dayData(),out=[];for(const [code,line] of Object.entries(SCH.rail)){for(const block of line.x.filter(x=>x.d===d.key)){const indexes=[];block.s.forEach((s,i)=>{if(norm(s[0])===norm(name))indexes.push(i)});if(!indexes.length)continue;for(const m of block.m){for(const ix of indexes){let t=m[5][ix];if(t>=d.minutes)out.push({t,line:code,dest:m[3],color:lineColor(code)});else if(t>=0&&t+1440>=d.minutes)out.push({t:t+1440,line:code,dest:m[3],color:lineColor(code)})}}}}return out.sort((a,b)=>a.t-b.t).slice(0,6)}
function busDepartures(name,lines){const d=dayData(),out=[];for(const code of lines){const data=SCH.bus[code],dirs=data?.d?.[d.key]?.x||[];for(const dir of dirs){const stop=dir.s.find(x=>norm(x[0])===norm(name));if(!stop)continue;const off=Math.round(stop[1]||0);for(const dep of dir.t){let t=dep+off;if(t<d.minutes)t+=1440;if(t>=d.minutes)out.push({t,line:code,dest:dir.b,color:lineColor(code)})}}}return out.sort((a,b)=>a.t-b.t).slice(0,6)}
function updateDetailDepartures(){const sel=APP.state.selected?.item,box=$('departurePreview');if(!sel||$('detailCard').classList.contains('hidden')){box.innerHTML='';return}let deps=[];if(sel[0]==='station')deps=stationDepartures(sel[2]);else if(sel[0]==='bus'){const stop=T.busStops.find(x=>String(x[0])===String(sel[1]));const lines=String(stop?.[2]||'').split(/,\s*/).filter(Boolean);deps=busDepartures(sel[2],lines)}if(!deps.length){box.innerHTML='';return}const d=dayData();box.innerHTML=deps.slice(0,4).map(x=>`<div class="nextDeparture"><span class="lineBadge" style="background:${x.color}">${esc(x.line)}</span><span>${esc(x.dest)}</span><b>${fmtClock(x.t)} · ${Math.max(0,x.t-d.minutes)} min</b></div>`).join('')}
new MutationObserver(()=>setTimeout(updateDetailDepartures,0)).observe($('detailTitle'),{childList:true,subtree:true});
$('detailCard').addEventListener('click',()=>setTimeout(updateDetailDepartures,0));

// Make navigation panels mutually understandable.
$('routeBtn').addEventListener('click',()=>{$('auditPanel').classList.add('hidden');$('transportPanel').classList.add('hidden')});
$('transportBtn').addEventListener('click',()=>{$('auditPanel').classList.add('hidden');$('routePanel').classList.add('hidden')});
$('infoBtn').addEventListener('click',()=>{$('routePanel').classList.add('hidden');$('transportPanel').classList.add('hidden')});

// Initial quality notice.
setTimeout(()=>showToast(`${T.stations.length} stations · ${T.busStops.length} arrêts bus · horaires finaux chargés`),900);
})();
