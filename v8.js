(()=>{'use strict';
const T=window.LR_TRANSIT,APP=window.__LR_APP_TEST__,V5=window.__LR_V5_TEST__,$=id=>document.getElementById(id);
if(!T||!APP||!V5)return;

function syncRouteModeOptions(){
  const transit=APP.state.routeMode==='transit';
  const button=$('routeSettingsBtn');
  if(button){button.hidden=!transit;button.setAttribute('aria-hidden',transit?'false':'true')}
  if(!transit)$('routeModesPopover')?.classList.add('hidden');
}
document.querySelectorAll('.modeTabs [data-mode]').forEach(b=>b.addEventListener('click',()=>setTimeout(syncRouteModeOptions,0)));
syncRouteModeOptions();

function maxStep(coords){let m=0;for(let i=2;i<(coords||[]).length;i+=2)m=Math.max(m,Math.hypot(coords[i]-coords[i-2],coords[i+1]-coords[i-1]));return m}
const airportPort=T.busLines.filter(x=>x[0]==='Aéroport–Port');
const airportPortAudit={features:airportPort.length,maxGap:Math.max(0,...airportPort.map(x=>maxStep(x[4]))),continuous:airportPort.length===2&&airportPort.every(x=>maxStep(x[4])<300)};
window.__LR_V8_TEST__={airportPortAudit,maxStep};

if(new URLSearchParams(location.search).get('selftest')==='1')setTimeout(()=>{
  try{
    const find=q=>APP.search(q,1)[0],a=find('Gare de Los Rico'),b=find('Aéroport Los Rico Sud 1');
    if(!a||!b)throw new Error('Points de contrôle introuvables');
    const aa={x:+a[4],z:+a[5],name:a[2]},bb={x:+b[4],z:+b[5],name:b[2]};
    const target=new Date(2026,6,9,18,30),moment=V5.serviceMoment(target),allowed=new Set(['train','metro','tram']);
    const arrive=V5.router.arriveBy(aa,bb,moment,allowed);
    const noBus=arrive.every(r=>r.steps.filter(s=>s.kind==='ride').every(s=>String(s.mode).toLowerCase()!=='bus'));
    const onTime=arrive.length&&arrive.every(r=>new Date(r.base).setMinutes(r.arrival)<=target.getTime()+15000);
    document.body.dataset.v8selftest=airportPortAudit.continuous&&noBus&&onTime?'ok':'fail';
    document.body.dataset.v8airportFeatures=String(airportPortAudit.features);
    document.body.dataset.v8airportGap=String(Math.round(airportPortAudit.maxGap));
    document.body.dataset.v8arriveAlternatives=String(arrive.length);
    document.body.dataset.v8modeFilter=noBus?'ok':'fail';
  }catch(e){document.body.dataset.v8selftest='error';document.body.dataset.v8error=e.message}
},900);

setTimeout(()=>{const t=$('toast');if(t){t.textContent='Plans Voyageur 8 · tracés continus, arrivée/départ et filtres de modes';t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2600)}},1550);
})();
