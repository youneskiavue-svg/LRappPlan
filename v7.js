(()=>{'use strict';
const M=window.LR_MAP,G=window.LR_GRAPH,T=window.LR_TRANSIT,S=window.LR_SCHEDULE,APP=window.__LR_APP_TEST__,router=window.LRExactRouter;
if(!M||!G||!T||!S||!APP||!router)return;
const $=id=>document.getElementById(id);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const roadName=e=>M.names[M.roads[e[5]]?.[2]]||'';
const edgeIndex=new WeakMap(),edgeMeta=[];G.edges.forEach((e,i)=>edgeIndex.set(e,i));
const nodeXY=i=>({x:+G.nodes[i][1],z:+G.nodes[i][2]});
const serviceXY=i=>({x:+T.serviceNodes[i][2],z:+T.serviceNodes[i][3]});
const LR_ZONE=M.zones.find(z=>z[0]==='VIL-LR'||z[1]==='Los Rico');
function ringContains(r,x,z){let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const xi=r[i][0],zi=r[i][1],xj=r[j][0],zj=r[j][1];if(((zi>z)!==(zj>z))&&x<(xj-xi)*(z-zi)/(zj-zi||1e-9)+xi)inside=!inside}return inside}
function geomContains(g,x,z){if(!Array.isArray(g)||!g.length)return false;if(typeof g[0]?.[0]==='number')return ringContains(g,x,z);let hit=false;for(const sub of g)if(geomContains(sub,x,z))hit=!hit;return hit}
function inLosRico(x,z){return !!LR_ZONE&&geomContains(LR_ZONE[7],x,z)}
function chosenRoadDate(){const active=document.querySelector('[data-time-choice].active')?.dataset.timeChoice;if(!active||active==='now')return new Date;const date=$('routeDate')?.value,time=$('routeTime')?.value||'12:00';if(!date)return new Date;const [y,m,d]=date.split('-').map(Number),[h,mi]=time.split(':').map(Number);return new Date(y,m-1,d,h||0,mi||0)}
function minuteDate(base,minutes){const d=new Date(base);d.setMinutes(d.getMinutes()+minutes);return d}
function timeBand(date){const day=date.getDay(),weekend=day===0||day===6,h=date.getHours()+date.getMinutes()/60;if(weekend){if(h>=11&&h<14.5)return{key:'weekend_mid',label:'Circulation modérée',urban:.86,major:.89,fast:.93,bus:1.08};if(h>=16.5&&h<20.5)return{key:'weekend_evening',label:'Circulation dense',urban:.78,major:.83,fast:.89,bus:1.13};if(h>=22||h<6)return{key:'night',label:'Circulation fluide',urban:.98,major:1,fast:1,bus:1};return{key:'weekend',label:'Circulation habituelle',urban:.9,major:.93,fast:.96,bus:1.05}}
if(h>=6.5&&h<9.5)return{key:'am_peak',label:'Circulation très dense',urban:.56,major:.62,fast:.73,bus:1.2};
if(h>=16&&h<19.75)return{key:'pm_peak',label:'Circulation très dense',urban:.51,major:.58,fast:.69,bus:1.25};
if(h>=9.5&&h<16)return{key:'day',label:'Circulation modérée',urban:.76,major:.82,fast:.89,bus:1.09};
if(h>=19.75&&h<22.5)return{key:'evening',label:'Circulation habituelle',urban:.84,major:.88,fast:.93,bus:1.06};
if(h>=22.5||h<5.5)return{key:'night',label:'Circulation fluide',urban:.98,major:1,fast:1,bus:1};
return{key:'shoulder',label:'Circulation habituelle',urban:.86,major:.9,fast:.95,bus:1.05}}
function classifyRoad(e){const n=norm(roadName(e)),raw=Math.max(8,+e[3]||0);if(/bretelle|echangeur|ramp/.test(n))return'ramp';if(/autoroute|motorway|highway|\ba\s?\d{1,3}\b/.test(n))return'fast';if(/voie rapide|rocade|express/.test(n)||raw>=80)return'fast';if(/boulevard|avenue|route|quai|cours|pont|tunnel|peripherique/.test(n)||raw>=40)return'major';return'urban'}
function isPeripheral(e){return /peripherique/.test(norm(roadName(e)))}
function referenceCarSpeed(cls,city,peripheral){if(peripheral)return 37.5;if(cls==='fast')return 45;if(cls==='ramp')return 30;if(city)return 11.4;return 17.5}
function bandCarSpeed(meta,band){
  if(meta.peripheral){const v={am_peak:35.5,pm_peak:35,day:37.5,evening:38.5,night:40,shoulder:39,weekend_mid:37.5,weekend_evening:36.5,weekend:38.5};return v[band.key]??37.5}
  // Autoroutes et axes rapides gardent leur vitesse propre même à l'intérieur de Los Rico.
  if(meta.cls==='fast'){const v={am_peak:41,pm_peak:40,day:45,evening:47,night:50,shoulder:48,weekend_mid:46,weekend_evening:43,weekend:47};return v[band.key]??45}
  // Les bretelles restent plus lentes que l'autoroute, mais ne sont plus assimilées à une rue urbaine à 11,4 km/h.
  if(meta.cls==='ramp'){const v={am_peak:25,pm_peak:25,day:30,evening:32,night:35,shoulder:33,weekend_mid:31,weekend_evening:28,weekend:32};return v[band.key]??30}
  if(meta.city){const f={am_peak:.80,pm_peak:.74,day:1,evening:.95,night:1.12,shoulder:1.03,weekend_mid:1,weekend_evening:.94,weekend:1.04};return 11.4*(f[band.key]??1)}
  const v={am_peak:15.5,pm_peak:15,day:17.5,evening:18.5,night:20,shoulder:19,weekend_mid:18,weekend_evening:16.5,weekend:18.5};return v[band.key]??17.5
}
function roadClass(e){return edgeMeta[edgeIndex.get(e)]?.cls||classifyRoad(e)}
function freeFlowSpeed(e){const m=edgeMeta[edgeIndex.get(e)];if(m)return m.referenceSpeed;const n1=nodeXY(e[0]),n2=nodeXY(e[1]),city=inLosRico((n1.x+n2.x)/2,(n1.z+n2.z)/2),cls=classifyRoad(e),peripheral=isPeripheral(e);return referenceCarSpeed(cls,city,peripheral)}
function edgeTraffic(e,date){const m=edgeMeta[edgeIndex.get(e)]||(()=>{const n1=nodeXY(e[0]),n2=nodeXY(e[1]),city=inLosRico((n1.x+n2.x)/2,(n1.z+n2.z)/2),cls=classifyRoad(e),peripheral=isPeripheral(e);return{city,cls,peripheral,referenceSpeed:referenceCarSpeed(cls,city,peripheral)}})(),band=timeBand(date);let speed=bandCarSpeed(m,band);const h=(e[5]*1103515245+date.getHours()*12345)>>>0;if((band.key==='am_peak'||band.key==='pm_peak')&&h%17===0)speed*=.86;return{mult:speed/m.referenceSpeed,speed,band,cls:m.cls,city:m.city,peripheral:m.peripheral}}
function edgeMinutes(e,mode,date,elapsed=0,partial=1,toNode=e[1]){const dist=Math.max(0,+e[2]||0)*partial;if(mode==='walk')return dist/(3000/60);if(mode==='bike')return dist/(10000/60);const at=minuteDate(date,elapsed),tr=edgeTraffic(e,at);return dist/(Math.max(5,tr.speed)*1000/60)}
function baseEdgeMinutes(e,mode,partial=1,toNode=e[1]){const dist=Math.max(0,+e[2]||0)*partial;if(mode==='walk')return dist/(3000/60);if(mode==='bike')return dist/(10000/60);return dist/(Math.max(5,freeFlowSpeed(e))*1000/60)}
class Heap{constructor(){this.a=[]}push(n,p){let a=this.a,i=a.length;a.push([p,n]);while(i){let q=(i-1)>>1;if(a[q][0]<=p)break;a[i]=a[q];i=q}a[i]=[p,n]}pop(){let a=this.a;if(!a.length)return null;let root=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){let l=i*2+1,r=l+1,b=i;if(l<a.length&&a[l][0]<a[b][0])b=l;if(r<a.length&&a[r][0]<a[b][0])b=r;if(b===i)break;[a[i],a[b]]=[a[b],a[i]];i=b}}return[root[1],root[0]]}get length(){return this.a.length}}
const roadAdj=Array.from({length:G.nodes.length},()=>[]),allDriveAdj=Array.from({length:G.nodes.length},()=>[]),driveAdj=Array.from({length:G.nodes.length},()=>[]),driveRev=Array.from({length:G.nodes.length},()=>[]),roadDegree=new Uint16Array(G.nodes.length),walkDegree=new Uint16Array(G.nodes.length),walkBridges=[],edgeGrid=new Map,EDGE_CELL=420;
function edgeFlags(e,mode,dir){if(mode==='drive')return dir===1?!!(e[4]&1):!!(e[4]&2);return !!(e[4]&4)}
function orientedCoords(e){const cached=edgeMeta[edgeIndex.get(e)]?.coords;if(cached)return cached;let c=[...(M.roads[e[5]]?.[4]||[])];if(c.length<4){const a=nodeXY(e[0]),b=nodeXY(e[1]);return[a.x,a.z,b.x,b.z]}const a=nodeXY(e[0]);if(Math.hypot(c[0]-a.x,c[1]-a.z)>Math.hypot(c.at(-2)-a.x,c.at(-1)-a.z)){let r=[];for(let i=c.length-2;i>=0;i-=2)r.push(c[i],c[i+1]);c=r}return c}
function bbox(c){let xs=[],zs=[];for(let i=0;i<c.length;i+=2){xs.push(c[i]);zs.push(c[i+1])}return[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)]}
function polyStats(c){let cum=[0],total=0;for(let i=2;i<c.length;i+=2){total+=Math.hypot(c[i]-c[i-2],c[i+1]-c[i-1]);cum.push(total)}return{cum,total}}
for(let i=0;i<G.edges.length;i++){const e=G.edges[i],hasDrive=!!(e[4]&3);if((e[4]&1)||(e[4]&4)){roadAdj[e[0]].push([e[1],i,1]);roadDegree[e[0]]++}if((e[4]&2)||(e[4]&4)){roadAdj[e[1]].push([e[0],i,-1]);roadDegree[e[1]]++}if(e[4]&1){driveAdj[e[0]].push(e[1]);driveRev[e[1]].push(e[0])}if(e[4]&2){driveAdj[e[1]].push(e[0]);driveRev[e[0]].push(e[1])}if(hasDrive){allDriveAdj[e[0]].push([e[1],i,1]);allDriveAdj[e[1]].push([e[0],i,-1])}if(e[4]&4){walkDegree[e[0]]++;walkDegree[e[1]]++;}let c=[...(M.roads[e[5]]?.[4]||[])];if(c.length<4){const a=nodeXY(e[0]),b=nodeXY(e[1]);c=[a.x,a.z,b.x,b.z]}else{const a=nodeXY(e[0]);if(Math.hypot(c[0]-a.x,c[1]-a.z)>Math.hypot(c.at(-2)-a.x,c.at(-1)-a.z)){let r=[];for(let j=c.length-2;j>=0;j-=2)r.push(c[j],c[j+1]);c=r}}const b=bbox(c),n1=nodeXY(e[0]),n2=nodeXY(e[1]),city=inLosRico((n1.x+n2.x)/2,(n1.z+n2.z)/2),cls=classifyRoad(e),peripheral=isPeripheral(e),raw=Math.max(8,+e[3]||0),label=roadName(e)&&!/track|fence|line/i.test(roadName(e))?roadName(e):'la voie';edgeMeta[i]={coords:c,stats:polyStats(c),city,cls,peripheral,referenceSpeed:referenceCarSpeed(cls,city,peripheral),label};const x0=Math.floor((b[0]+9000)/EDGE_CELL),x1=Math.floor((b[2]+9000)/EDGE_CELL),z0=Math.floor((b[1]+9000)/EDGE_CELL),z1=Math.floor((b[3]+9000)/EDGE_CELL);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+'|'+z;if(!edgeGrid.has(k))edgeGrid.set(k,[]);edgeGrid.get(k).push(i)}}

// Strongly connected road components identify tiny one-way islands caused by imperfect SIG direction data.
function buildDriveScc(){const N=G.nodes.length,seen=new Uint8Array(N),order=[];for(let start=0;start<N;start++)if(!seen[start]){const stack=[[start,0]];seen[start]=1;while(stack.length){const top=stack[stack.length-1],u=top[0],i=top[1];if(i<driveAdj[u].length){top[1]++;const v=driveAdj[u][i];if(!seen[v]){seen[v]=1;stack.push([v,0])}}else{order.push(u);stack.pop()}}}const id=new Int32Array(N);id.fill(-1);const sizes=[];for(let oi=order.length-1;oi>=0;oi--){const start=order[oi];if(id[start]>=0)continue;const cid=sizes.length,q=[start];id[start]=cid;for(let k=0;k<q.length;k++)for(const v of driveRev[q[k]])if(id[v]<0){id[v]=cid;q.push(v)}sizes.push(q.length)}return{id,sizes}}
const driveScc=buildDriveScc();
function repairableWrongWay(u,v){const a=driveScc.sizes[driveScc.id[u]]||0,b=driveScc.sizes[driveScc.id[v]]||0;return Math.min(a,b)<=3||((driveAdj[u].length===0||driveRev[v].length===0)&&Math.min(a,b)<=12)}


// Short pedestrian bridges reconnect sidewalks or crossings split into distinct graph components.
const bridgeGrid=new Map,BRIDGE_CELL=48,bridgePairs=new Set;
for(let i=0;i<G.nodes.length;i++)if(walkDegree[i]){const n=nodeXY(i),k=Math.floor((n.x+9000)/BRIDGE_CELL)+'|'+Math.floor((n.z+9000)/BRIDGE_CELL);if(!bridgeGrid.has(k))bridgeGrid.set(k,[]);bridgeGrid.get(k).push(i)}
for(let i=0;i<G.nodes.length;i++)if(walkDegree[i]){const a=nodeXY(i),gx=Math.floor((a.x+9000)/BRIDGE_CELL),gz=Math.floor((a.z+9000)/BRIDGE_CELL),ca=G.walkComp[i],near=[];for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const j of bridgeGrid.get((gx+dx)+'|'+(gz+dz))||[]){if(j<=i||G.walkComp[j]===ca)continue;const b=nodeXY(j),d=Math.hypot(a.x-b.x,a.z-b.z);if(d<=42)near.push([d,j])}near.sort((x,y)=>x[0]-y[0]);for(const [dist,j] of near.slice(0,2)){const key=i+'|'+j;if(bridgePairs.has(key))continue;bridgePairs.add(key);const idx=walkBridges.length;walkBridges.push({a:i,b:j,d:Math.max(1,dist),coords:[a.x,a.z,G.nodes[j][1],G.nodes[j][2]]});roadAdj[i].push([j,-idx-1,0]);roadAdj[j].push([i,-idx-1,0])}}
function project(c,x,z,ps=polyStats(c)){let best=null;for(let i=0;i<c.length-2;i+=2){const ax=c[i],az=c[i+1],bx=c[i+2],bz=c[i+3],dx=bx-ax,dz=bz-az,den=dx*dx+dz*dz,t=den?clamp(((x-ax)*dx+(z-az)*dz)/den,0,1):0,px=ax+dx*t,pz=az+dz*t,d=Math.hypot(px-x,pz-z),seg=Math.hypot(dx,dz),along=ps.cum[i/2]+seg*t;if(!best||d<best.d)best={x:px,z:pz,d,along,total:ps.total,seg:i/2,t}}return best}
function pointAt(c,dist,ps=polyStats(c)){const d=clamp(dist,0,ps.total);for(let i=1;i<ps.cum.length;i++)if(ps.cum[i]>=d){const a=ps.cum[i-1],b=ps.cum[i],t=(d-a)/(b-a||1);return[c[(i-1)*2]+(c[i*2]-c[(i-1)*2])*t,c[(i-1)*2+1]+(c[i*2+1]-c[(i-1)*2+1])*t]}return[c.at(-2),c.at(-1)]}
function slicePath(c,from,to,ps=polyStats(c)){if(from===to){const p=pointAt(c,from,ps);return[p[0],p[1]]}let reverse=from>to,a=Math.min(from,to),b=Math.max(from,to),out=[...pointAt(c,a,ps)];for(let i=1;i<ps.cum.length-1;i++)if(ps.cum[i]>a&&ps.cum[i]<b)out.push(c[i*2],c[i*2+1]);out.push(...pointAt(c,b,ps));if(reverse){let r=[];for(let i=out.length-2;i>=0;i-=2)r.push(out[i],out[i+1]);return r}return out}
function appendPath(out,c){if(!c?.length)return;if(!out.length){out.push(...c);return}const cut=Math.hypot(out.at(-2)-c[0],out.at(-1)-c[1])<12?2:0;out.push(...c.slice(cut))}
function snapCandidates(point,mode,limit=9,extra=220){const gx=Math.floor((point.x+9000)/EDGE_CELL),gz=Math.floor((point.z+9000)/EDGE_CELL),ids=new Set;for(let r=0;r<=4;r++){for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){if(r&&Math.abs(dx)!==r&&Math.abs(dz)!==r)continue;for(const id of edgeGrid.get((gx+dx)+'|'+(gz+dz))||[])ids.add(id)}if(ids.size>180&&r>=1)break}let out=[];for(const id of ids){const e=G.edges[id];if(mode==='drive'&&!((e[4]&1)||(e[4]&2)))continue;if(mode!=='drive'&&!(e[4]&4))continue;const meta=edgeMeta[id],c=meta.coords,p=project(c,point.x,point.z,meta.stats);out.push({edge:id,e,c,p,score:p.d+(meta.cls==='fast'&&mode!=='drive'?180:0)})}out.sort((a,b)=>a.score-b.score);const nearest=out[0]?.score??Infinity;return out.filter(x=>x.score<=nearest+extra).slice(0,limit)}
function roadLabel(e){return edgeMeta[edgeIndex.get(e)]?.label||'la voie'}
function addGroup(groups,e,distance){if(distance<1)return;const name=roadLabel(e),last=groups.at(-1);if(last&&last.name===name)last.distance+=distance;else groups.push({name,distance})}
function connectorMinutes(d,mode){return mode==='drive'?.12+d/(11400/60):mode==='bike'?d/(6000/60):d/(3000/60)}
function startOptions(point,mode,date){let out=[];for(const s of snapCandidates(point,mode,mode==='drive'?26:30,mode==='drive'?480:220)){const {e,c,p,edge}=s,ratio=p.total?p.along/p.total:0,conn=connectorMinutes(p.d,mode);if(edgeFlags(e,mode,1)){const part=1-ratio,path=slicePath(c,p.along,p.total);out.push({node:e[1],cost:conn+edgeMinutes(e,mode,date,conn,part,e[1]),base:conn+baseEdgeMinutes(e,mode,part,e[1]),path:[[point.x,point.z,p.x,p.z],path],edge,dir:1,dist:p.d+e[2]*part})}if(edgeFlags(e,mode,-1)){const part=ratio,path=slicePath(c,p.along,0);out.push({node:e[0],cost:conn+edgeMinutes(e,mode,date,conn,part,e[0]),base:conn+baseEdgeMinutes(e,mode,part,e[0]),path:[[point.x,point.z,p.x,p.z],path],edge,dir:-1,dist:p.d+e[2]*part})}}return out.sort((a,b)=>a.cost-b.cost).slice(0,14)}
function endOptions(point,mode,date){let out=[];for(const s of snapCandidates(point,mode,mode==='drive'?26:30,mode==='drive'?480:220)){const {e,c,p,edge}=s,ratio=p.total?p.along/p.total:0,conn=connectorMinutes(p.d,mode);if(edgeFlags(e,mode,1)){const part=ratio,path=slicePath(c,0,p.along);out.push({node:e[0],cost:edgeMinutes(e,mode,date,0,part,e[1])+conn,base:baseEdgeMinutes(e,mode,part,e[1])+conn,path:[path,[p.x,p.z,point.x,point.z]],edge,dir:1,dist:p.d+e[2]*part})}if(edgeFlags(e,mode,-1)){const part=1-ratio,path=slicePath(c,p.total,p.along);out.push({node:e[1],cost:edgeMinutes(e,mode,date,0,part,e[0])+conn,base:baseEdgeMinutes(e,mode,part,e[0])+conn,path:[path,[p.x,p.z,point.x,point.z]],edge,dir:-1,dist:p.d+e[2]*part})}}return out.sort((a,b)=>a.cost-b.cost).slice(0,14)}
function directSameEdge(a,b,mode,date){let A=snapCandidates(a,mode,6),B=snapCandidates(b,mode,6),best=null;for(const x of A)for(const y of B)if(x.edge===y.edge){const e=x.e,ra=x.p.total?x.p.along/x.p.total:0,rb=y.p.total?y.p.along/y.p.total:0,dir=rb>=ra?1:-1;if(!edgeFlags(e,mode,dir))continue;const part=Math.abs(rb-ra),connA=connectorMinutes(x.p.d,mode),connB=connectorMinutes(y.p.d,mode),cost=connA+edgeMinutes(e,mode,date,connA,part,dir===1?e[1]:e[0])+connB,base=connA+baseEdgeMinutes(e,mode,part,dir===1?e[1]:e[0])+connB,c=[];appendPath(c,[a.x,a.z,x.p.x,x.p.z]);appendPath(c,slicePath(x.c,x.p.along,y.p.along));appendPath(c,[y.p.x,y.p.z,b.x,b.z]);const r={cost,base,coords:c,distance:x.p.d+y.p.d+e[2]*part,groups:[{name:roadLabel(e),distance:e[2]*part}]};if(!best||cost<best.cost)best=r}return best}
function enhancedRoadRoute(a,b,mode,opts={}){
  const date=opts.date instanceof Date?opts.date:chosenRoadDate(),starts=startOptions(a,mode,date),ends=endOptions(b,mode,date);
  if(!starts.length||!ends.length)return null;
  const endMap=new Map;
  for(let i=0;i<ends.length;i++){const q=ends[i];if(!endMap.has(q.node))endMap.set(q.node,[]);endMap.get(q.node).push([i,q])}
  function run(relaxed=false){
    const N=G.nodes.length,d=new Float64Array(N),baseD=new Float64Array(N),prev=new Int32Array(N),prevEdge=new Int32Array(N),prevDir=new Int8Array(N),prevWrong=new Uint8Array(N),src=new Int16Array(N);
    d.fill(Infinity);baseD.fill(Infinity);prev.fill(-1);prevEdge.fill(-1);src.fill(-1);
    const h=new Heap;
    starts.forEach((st,i)=>{if(st.cost<d[st.node]){d[st.node]=st.cost;baseD[st.node]=st.base;src[st.node]=i;h.push(st.node,st.cost)}});
    let best=null,bestCost=Infinity;
    while(h.length){
      const [u,du]=h.pop();if(du!==d[u])continue;if(du>=bestCost)break;
      for(const [endIndex,q] of endMap.get(u)||[]){const cost=du+q.cost;if(cost<bestCost){bestCost=cost;best={node:u,endIndex,source:src[u],base:baseD[u]+q.base}}}
      const adjacency=relaxed&&mode==='drive'?allDriveAdj[u]:roadAdj[u];
      for(const [v,ei,dir] of adjacency){
        let step,baseStep,wrong=0;
        if(ei<0){
          if(mode!=='walk')continue;
          const br=walkBridges[-ei-1];step=baseStep=br.d/(3000/60);
        }else{
          const e=G.edges[ei],allowed=edgeFlags(e,mode,dir);
          if(!allowed){if(!(relaxed&&mode==='drive'&&repairableWrongWay(u,v)))continue;wrong=1}
          step=edgeMinutes(e,mode,date,du,1,v);baseStep=baseEdgeMinutes(e,mode,1,v);
          if(wrong){step=Math.max(step*1.55,e[2]/(9000/60))+.35;baseStep=Math.max(baseStep*1.35,e[2]/(10000/60))+.25}
        }
        const nd=du+step;
        if(nd<d[v]){d[v]=nd;baseD[v]=baseD[u]+baseStep;prev[v]=u;prevEdge[v]=ei;prevDir[v]=dir;prevWrong[v]=wrong;src[v]=src[u];h.push(v,nd)}
      }
    }
    return{best,bestCost,baseD,prev,prevEdge,prevDir,prevWrong,src,relaxed};
  }
  let search=run(false);
  if(!search.best&&mode==='drive')search=run(true);
  const direct=directSameEdge(a,b,mode,date);
  if(direct&&(!search.best||direct.cost<search.bestCost)){
    const ratio=direct.base?direct.cost/direct.base:1,delay=Math.max(0,direct.cost-direct.base),traffic=timeBand(date);
    return{minutes:direct.cost,distance:direct.distance,coords:direct.coords,groups:direct.groups,baseMinutes:direct.base,delayMinutes:delay,traffic:mode==='drive'?{label:delay>3?'Circulation dense':traffic.label,ratio}:null,averageSpeed:mode==='drive'?direct.distance/1000/(direct.cost/60):null,departureDate:date,networkRepair:false};
  }
  if(!search.best)return null;
  const {best,bestCost,prev,prevEdge,prevDir,prevWrong}=search;
  const path=[];
  for(let u=best.node;prev[u]>=0;u=prev[u])path.push([prevEdge[u],prevDir[u],!!prevWrong[u]]);
  path.reverse();
  const st=starts[best.source],en=ends[best.endIndex],coords=[],groups=[];
  for(const p of st.path)appendPath(coords,p);addGroup(groups,G.edges[st.edge],st.dist);
  let distance=st.dist,networkRepair=false;
  for(const [ei,dir,wrong] of path){
    if(ei<0){
      const br=walkBridges[-ei-1],p=dir===0&&coords.length&&Math.hypot(coords.at(-2)-br.coords[0],coords.at(-1)-br.coords[1])>Math.hypot(coords.at(-2)-br.coords[2],coords.at(-1)-br.coords[3])?[br.coords[2],br.coords[3],br.coords[0],br.coords[1]]:br.coords;
      appendPath(coords,p);distance+=br.d;const last=groups.at(-1);last&&last.name==='liaison piétonne'?last.distance+=br.d:groups.push({name:'liaison piétonne',distance:br.d});continue;
    }
    const e=G.edges[ei],meta=edgeMeta[ei],c=meta.coords,p=dir===1?c:slicePath(c,meta.stats.total,0,meta.stats);
    appendPath(coords,p);distance+=e[2];addGroup(groups,e,e[2]);if(wrong)networkRepair=true;
  }
  for(const p of en.path)appendPath(coords,p);distance+=en.dist;addGroup(groups,G.edges[en.edge],en.dist);
  const delay=Math.max(0,bestCost-best.base),ratio=best.base?bestCost/best.base:1,band=timeBand(date);let label=band.label;
  if(mode==='drive'){if(delay>=8||ratio>=1.45)label='Bouchons importants';else if(delay>=4||ratio>=1.25)label='Circulation dense';else if(delay<1.2)label='Circulation fluide'}
  return{minutes:bestCost,distance,coords,groups,baseMinutes:best.base,delayMinutes:delay,traffic:mode==='drive'?{label,ratio,band:band.key}:null,averageSpeed:mode==='drive'?distance/1000/(bestCost/60):null,departureDate:date,networkRepair};
}
APP.roadRoute=enhancedRoadRoute;
window.LRTraffic={timeBand,enhancedRoadRoute,inLosRico,freeFlowSpeed,edgeTraffic,classifyRoad,referenceCarSpeed};
// Bus schedules remain exact at the origin; downstream times include expected congestion.
const serviceKey=d=>{const n=d.getDay();return n===5?'friday':n===6?'saturday':n===0?'sunday':'weekday'};
const serviceNodeCity=T.serviceNodes.map(n=>inLosRico(+n[2],+n[3]));
const infoFor=line=>T.lineInfo['BUS-'+line]||Object.values(T.lineInfo).find(x=>x.line===line)||{color:'#735acb',mode:'Bus'};
function busAdjustedTimes(date,shift,scheduled,nodes){if(scheduled.length<2)return{times:scheduled,delay:0};let out=[scheduled[0]],clock=scheduled[0];for(let i=1;i<scheduled.length;i++){const planned=Math.max(.5,scheduled[i]-scheduled[i-1]),a=serviceXY(nodes[i-1]),b=serviceXY(nodes[i]),actual=minuteDate(date,clock-shift),band=timeBand(actual),city=!!(serviceNodeCity[nodes[i-1]]||serviceNodeCity[nodes[i]]),factor=band.bus-(city?0:.035);clock+=planned*clamp(factor,1,1.3);out.push(clock)}return{times:out,delay:Math.max(0,out.at(-1)-scheduled.at(-1))}}
router.addServiceDay=function(cache,date,shift){const key=serviceKey(date);for(const [line,data] of Object.entries(S.rail)){for(const block of data.x||[]){if(block.d!==key)continue;const mapped=this.resolveSequence(line,block.s,block);for(const mission of block.m||[]){let nodes=[],times=[],names=[];for(let i=0;i<mission[5].length;i++){const tm=mission[5][i],node=mapped[i];if(tm==null||tm<0||node==null)continue;nodes.push(node);times.push(tm+shift);names.push(block.s[i][0])}if(nodes.length<2)continue;const info=infoFor(line);this.addTrip(cache,{line,mode:data.m||info.mode,color:info.color||'#3478d4',code:mission[0],destination:mission[3]||block.b,nodes,times,names,pattern:`${line}|${nodes.join(',')}|${mission[3]||block.b}`})}}}
for(const [line,data] of Object.entries(S.bus)){const day=data.d?.[key];if(!day)continue;for(const dir of day.x||[]){const mapped=this.resolveSequence(line,dir.s,dir),valid=[];for(let i=0;i<dir.s.length;i++)if(mapped[i]!=null)valid.push(i);if(valid.length<2)continue;const info=infoFor(line);for(const dep of dir.t||[]){const nodes=valid.map(i=>mapped[i]),scheduled=valid.map(i=>dep+(+dir.s[i][1]||0)+shift),names=valid.map(i=>dir.s[i][0]),adj=busAdjustedTimes(date,shift,scheduled,nodes);this.addTrip(cache,{line,mode:'Bus',color:info.color||'#735acb',code:`${line}-${dir.k}-${Math.round(dep)}`,destination:dir.b,nodes,times:adj.times,scheduledTimes:scheduled,trafficDelay:adj.delay,names,pattern:`${line}|${dir.k}|${nodes.join(',')}`})}}}};
router.cache=null;
// Remove implausible transfer shortcuts from the transport graph.
for(let u=0;u<router.transferAdj.length;u++){router.transferAdj[u]=router.transferAdj[u].filter(e=>{const a=serviceXY(u),b=serviceXY(e.to),dist=Math.hypot(a.x-b.x,a.z-b.z),max=e.kind===1?420:1250;if(dist>max)return false;e.time=Math.max(+e.time||0,dist/(e.kind===1?3800/60:3000/60)+(e.kind===1?.65:.25));return e.time<35})}
const walkCache=new Map;
function cachedWalk(a,b){const key=[Math.round(a.x/10),Math.round(a.z/10),Math.round(b.x/10),Math.round(b.z/10)].join('|');if(walkCache.has(key))return walkCache.get(key);const r=enhancedRoadRoute(a,b,'walk',{date:new Date(2026,0,1,12)});if(walkCache.size>1500)walkCache.clear();walkCache.set(key,r);return r}
router.walkingRoute=function(a,b){const r=cachedWalk(a,b);if(r)return r;return null};
router.prepareEndpoints=function(a,b,cache){const starts=[],ends=new Map,collect=(point,isStart)=>{let kept=0;for(const g of this.physicalCandidates(point,cache,18)){if(g.d>1750)continue;const target={x:g.x,z:g.z,name:this.nodes[g.ids[0]][1]},walk=isStart?cachedWalk(point,target):cachedWalk(target,point);if(!walk||walk.distance>1800||walk.distance>Math.max(650,g.d*3.1)||walk.minutes>38)continue;for(const node of g.ids){if(isStart)starts.push({node,time:walk.minutes,walk});else if(!ends.has(node)||walk.minutes<ends.get(node).walk.minutes)ends.set(node,{walk})}if(++kept>=10)break}};collect(a,true);collect(b,false);return{starts,ends}};
const originalSearch=router.search.bind(router);
function routeGeometryValid(coords,maxJump=1800){if(!coords||coords.length<4)return false;for(let i=2;i<coords.length;i+=2)if(Math.hypot(coords[i]-coords[i-2],coords[i+1]-coords[i-1])>maxJump)return false;return true}
function rebuildWalking(result){
  if(!result)return null;
  let out=[],clock=result.departure,currentNode=null;
  for(const step of result.steps){
    if(step.kind==='wait')continue;
    if(step.kind==='ride'){
      if(step.fromTime<clock-.12)return null;
      if(step.fromTime-clock>.55)out.push({kind:'wait',fromTime:clock,toTime:step.fromTime,minutes:step.fromTime-clock,title:`Attendre la ligne ${step.line}`,atNode:step.fromNode});
      const s={...step,minutes:step.toTime-step.fromTime};
      if(String(s.mode).toLowerCase().includes('bus')&&s.trip?.scheduledTimes){const sched=s.trip.scheduledTimes[s.toIndex]-s.trip.scheduledTimes[s.fromIndex],actual=s.toTime-s.fromTime;s.trafficDelay=Math.max(0,actual-sched);s.trafficLabel=s.trafficDelay>=4?'Trafic très dense':s.trafficDelay>=1.5?'Trafic dense':s.trafficDelay>.4?'Circulation modérée':'Circulation fluide'}
      out.push(s);clock=s.toTime;currentNode=s.toNode;continue;
    }
    let from,to;
    if(step.toNode!=null){from=currentNode==null?result.a:serviceXY(currentNode);to=serviceXY(step.toNode)}else{if(currentNode==null)return null;from=serviceXY(currentNode);to=result.b}
    const wr=cachedWalk(from,to);if(!wr)return null;
    const duration=Math.max(wr.minutes,step.kind==='transfer'?1:0);
    const s={...step,fromTime:clock,toTime:clock+duration,minutes:duration,distance:wr.distance,coords:wr.coords};
    out.push(s);clock=s.toTime;if(step.toNode!=null)currentNode=step.toNode;
  }
  result.steps=router.compactSteps(out);result.arrival=clock;result.minutes=clock-result.departure;router.decorate(result);
  result.walkMinutes=result.steps.filter(x=>x.kind==='walk'||x.kind==='transfer').reduce((a,b)=>a+(b.minutes||0),0);
  const rides=result.steps.filter(x=>x.kind==='ride');result.transfers=Math.max(0,rides.length-1);result.signature=rides.map(x=>x.line).join('>')||'walk';
  if(result.minutes<=0||result.minutes>360||result.walkMinutes>42||result.transfers>4||rides.some(x=>x.minutes<=0||x.stops<1||!routeGeometryValid(x.coords)))return null;
  let t=result.departure;for(const x of result.steps){if(x.fromTime<t-.15||x.toTime<x.fromTime-.01)return null;t=x.toTime}if(Math.abs(t-result.arrival)>.2)return null;
  return result;
}
router.search=function(...args){return rebuildWalking(originalSearch(...args))};
router.cache=null;
// Expose a compact test hook without rendering files in the interface.
window.__LR_V7_TEST__={roadRoute:enhancedRoadRoute,trafficBand:timeBand,rebuildWalking,originalSearch,snapCandidates,startOptions,endOptions,cachedWalk};
if(new URLSearchParams(location.search).get('selftest')==='1')setTimeout(()=>{try{const a=APP.search('Gare de Los Rico',1)[0],b=APP.search('Aéroport Los Rico Sud 1',1)[0],aa={x:+a[4],z:+a[5],name:a[2]},bb={x:+b[4],z:+b[5],name:b[2]},walk=enhancedRoadRoute(aa,bb,'walk'),off=enhancedRoadRoute(aa,bb,'drive',{date:new Date(2026,6,9,13,0)}),peak=enhancedRoadRoute(aa,bb,'drive',{date:new Date(2026,6,9,18,0)});document.body.dataset.v7selftest=walk?.coords?.length&&off&&peak&&peak.minutes>=off.minutes?'ok':'fail';document.body.dataset.v7walk=Math.round(walk?.distance||0);document.body.dataset.v7driveOff=Math.round(off?.minutes||0);document.body.dataset.v7drivePeak=Math.round(peak?.minutes||0)}catch(e){document.body.dataset.v7selftest='error';document.body.dataset.v7error=e.message}},500);
setTimeout(()=>{const t=$('toast');if(t){t.textContent='Plans Voyageur 9 · autoroutes et voies rapides corrigées';t.classList.remove('hidden');setTimeout(()=>t.classList.add('hidden'),2600)}},1250);
})();
