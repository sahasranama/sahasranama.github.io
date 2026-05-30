/* Sahasranama Atlas — graph explorer
   One dataset (data/names.json) + concept hubs (themes / roots / avatars).
   Names connect to hub nodes (not pairwise) to stay legible; recurring names
   get their own orange edges. Layout runs once (fcose) over all structural
   edges; toggles/filters then show/hide over a fixed layout. */

const $ = s => document.querySelector(s);
const state = {
  edgeOn: { theme:true, repeat:true, root:false, avatar:false, seq:false },
  themes: new Set(),   // active theme filters
  avatars: new Set(),  // active avatar filters
};
let CY, NAMES, META, byNum = {}, byKey = {};

const PALETTE = {
  name:'#e8c37e', theme:'#7fb0a5', root:'#d9a94e', avatar:'#caa0d8',
  repeat:'#e07a5f', seq:'#9c7c43'
};

init();

async function init(){
  [NAMES, META] = await Promise.all([
    fetch('data/names.json').then(r=>r.json()),
    fetch('data/meta.json').then(r=>r.json()),
  ]);
  NAMES.forEach(e => { byNum[e.n]=e; (byKey[e.key]=byKey[e.key]||[]).push(e); });

  buildChips();
  buildAbout();
  buildGraph();
  wireUI();
}

/* ----------------------------------------------------------- graph build */
function buildGraph(){
  cytoscape.use(window.cytoscapeFcose);
  const els = [];

  // hub nodes
  for (const [k,v] of Object.entries(META.themes))
    els.push({ data:{ id:'theme:'+k, kind:'theme', label:v.label, count:v.count } });
  for (const [lbl,c] of Object.entries(META.roots))
    els.push({ data:{ id:'root:'+lbl, kind:'root', label:lbl.split(' ')[0], count:c } });
  for (const [k,v] of Object.entries(META.avatars))
    if (v.count) els.push({ data:{ id:'avatar:'+k, kind:'avatar', label:v.label.split(' —')[0], count:v.count } });

  // name nodes + their hub edges
  for (const e of NAMES){
    els.push({ data:{ id:'n'+e.n, kind:'name', label:e.name, n:e.n } });
    for (const t of e.themes)
      if (META.themes[t]) els.push({ data:{ id:`te${e.n}:${t}`, source:'n'+e.n, target:'theme:'+t, kind:'theme' } });
    for (const r of e.roots)
      if (META.roots[r]) els.push({ data:{ id:`re${e.n}:${r}`, source:'n'+e.n, target:'root:'+r, kind:'root' } });
    for (const a of e.avatars)
      if ((META.avatars[a]||{}).count) els.push({ data:{ id:`ae${e.n}:${a}`, source:'n'+e.n, target:'avatar:'+a, kind:'avatar' } });
  }

  // recurring-name edges (chain occurrences) + litany sequence
  const seen = new Set();
  for (const e of NAMES){
    if (e.repeat.length && !seen.has(e.key)){
      seen.add(e.key);
      const occ = e.repeat.slice().sort((a,b)=>a-b);
      for (let i=0;i<occ.length-1;i++)
        els.push({ data:{ id:`rep${occ[i]}-${occ[i+1]}`, source:'n'+occ[i], target:'n'+occ[i+1], kind:'repeat' } });
    }
    if (e.n < 1000)
      els.push({ data:{ id:`sq${e.n}`, source:'n'+e.n, target:'n'+(e.n+1), kind:'seq' } });
  }

  CY = cytoscape({
    container: $('#cy'),
    elements: els,
    minZoom: 0.08, maxZoom: 3.5,
    pixelRatio: 'auto',          // use full devicePixelRatio — crisp on Retina
    textureOnViewport: false,    // no low-res texture while panning/zooming
    motionBlur: false,
    style: graphStyle(),
    layout: { name:'preset' }, // positions set after fcose below
  });

  // run fcose over ALL edges incl. the litany sequence — the sequence is a faint
  // backbone (kept hidden by default) so no name is ever disconnected, while the
  // hub edges still pull the thematic clusters together.
  const ideal = { seq:46, repeat:70, theme:120, root:110, avatar:130 };
  CY.layout({
    name:'fcose', quality:'default', randomize:true, animate:false,
    nodeSeparation:70, idealEdgeLength: e => ideal[e.data('kind')] || 100,
    edgeElasticity: e => e.data('kind')==='seq' ? 0.15 : 0.45,
    nodeRepulsion: 5500, numIter: 2200, gravity: 0.25,
    stop: onLayoutDone,
  }).run();
}

function onLayoutDone(){
  recompute();
  CY.fit(CY.nodes(':visible'), 40);
  $('#veil').classList.add('gone');
  setTimeout(()=>$('#veil').remove(), 600);
}

function graphStyle(){
  return [
    { selector:'node[kind="name"]', style:{
        'background-color':PALETTE.name, 'width':9,'height':9,
        'label':'data(label)','color':'#f6ecd8','font-size':9,'font-family':'Palatino,Georgia,serif',
        'text-valign':'center','text-halign':'right','text-margin-x':3,
        'min-zoomed-font-size':11,'text-opacity':.85,
    }},
    { selector:'node[kind="theme"]', style:{
        'background-color':PALETTE.theme,'width':'mapData(count,1,67,18,52)','height':'mapData(count,1,67,18,52)',
        'label':'data(label)','color':'#dff0ec','font-size':13,'font-weight':600,'text-valign':'center',
        'text-outline-color':'#16110a','text-outline-width':2,'min-zoomed-font-size':0,'z-index':10,
    }},
    { selector:'node[kind="root"]', style:{
        'background-color':PALETTE.root,'shape':'round-diamond','width':'mapData(count,1,37,16,40)','height':'mapData(count,1,37,16,40)',
        'label':'data(label)','color':'#241809','font-size':12,'font-weight':700,'text-valign':'center',
        'min-zoomed-font-size':0,'z-index':10,
    }},
    { selector:'node[kind="avatar"]', style:{
        'background-color':PALETTE.avatar,'shape':'star','width':'mapData(count,1,8,24,46)','height':'mapData(count,1,8,24,46)',
        'label':'data(label)','color':'#f3e6f7','font-size':12,'font-weight':600,'text-valign':'center',
        'text-outline-color':'#16110a','text-outline-width':2,'min-zoomed-font-size':0,'z-index':10,
    }},
    { selector:'edge', style:{ 'curve-style':'haystack','haystack-radius':0,'width':1,'opacity':.25 } },
    { selector:'edge[kind="theme"]', style:{ 'line-color':PALETTE.theme,'opacity':.13 } },
    { selector:'edge[kind="root"]',  style:{ 'line-color':PALETTE.root,'opacity':.18 } },
    { selector:'edge[kind="avatar"]',style:{ 'line-color':PALETTE.avatar,'opacity':.3 } },
    { selector:'edge[kind="repeat"]',style:{ 'line-color':PALETTE.repeat,'opacity':.55,'width':1.6,'curve-style':'bezier' } },
    { selector:'edge[kind="seq"]',   style:{ 'line-color':PALETTE.seq,'opacity':.12 } },
    // interaction states
    { selector:'.focus', style:{ 'background-color':'#fff3da','width':16,'height':16,'z-index':30,
        'text-opacity':1,'font-size':13,'min-zoomed-font-size':0,'color':PALETTE.name } },
    { selector:'.neighbor', style:{ 'text-opacity':1,'min-zoomed-font-size':0,'background-color':'#f0d49a' } },
    { selector:'.hl-edge', style:{ 'opacity':.9,'width':2.4,'line-color':'#fff3da','z-index':25 } },
    { selector:'.dim', style:{ 'opacity':.05,'text-opacity':0 } },
  ];
}

/* ----------------------------------------------------- show / hide logic */
function nameMatchesFilter(e){
  if (!state.themes.size && !state.avatars.size) return true;
  for (const t of e.themes) if (state.themes.has(t)) return true;
  for (const a of e.avatars) if (state.avatars.has(a)) return true;
  return false;
}

function recompute(){
  CY.batch(()=>{
    // name nodes
    CY.nodes('[kind="name"]').forEach(node=>{
      node.style('display', nameMatchesFilter(byNum[node.data('n')]) ? 'element':'none');
    });
    // edges by toggle + endpoint visibility
    CY.edges().forEach(edge=>{
      const k = edge.data('kind');
      const on = state.edgeOn[k];
      const ends = edge.source().style('display')!=='none' && edge.target().style('display')!=='none';
      edge.style('display', (on && ends) ? 'element':'none');
    });
    // hub nodes: visible if their edge-kind is on, this hub passes filter, and ≥1 visible neighbour
    CY.nodes('[kind!="name"]').forEach(hub=>{
      const k = hub.data('kind');
      let vis = state.edgeOn[k];
      if (vis && k==='theme' && state.themes.size) vis = state.themes.has(hub.id().slice(6));
      if (vis && k==='avatar' && state.avatars.size) vis = state.avatars.has(hub.id().slice(7));
      if (vis){
        const anyVisible = hub.connectedEdges().some(e=>e.style('display')!=='none');
        vis = anyVisible;
      }
      hub.style('display', vis?'element':'none');
    });
  });
}

/* --------------------------------------------------------- detail panel */
function focusNode(n, center=true){
  const node = CY.getElementById('n'+n);
  if (!node.length) return;
  CY.elements().removeClass('focus neighbor hl-edge dim');
  const nbrEdges = node.connectedEdges(':visible');
  const nbrs = nbrEdges.connectedNodes();
  CY.elements(':visible').not(nbrs).not(node).not(nbrEdges).addClass('dim');
  node.addClass('focus'); nbrs.addClass('neighbor'); nbrEdges.addClass('hl-edge');
  if (center) CY.animate({ center:{eles:node}, zoom: Math.max(CY.zoom(),0.9) }, { duration:350 });
  showDetail(byNum[n]);
}

function clearFocus(){
  CY.elements().removeClass('focus neighbor hl-edge dim');
  $('#detail').classList.remove('show');
}

function showDetail(e){
  const repeats = e.repeat.length
    ? `<div class="sec"><h4>One reality, many faces</h4><div class="repeats">${
        e.repeat.map(rn=>{ const o=byNum[rn]; const cur = rn===e.n;
          return `<a data-jump="${rn}" style="${cur?'outline:1px solid var(--repeat)':''}">
            <span class="rn">name ${rn}${cur?' · this one':''}</span><em>${o.meanings[0]}</em></a>`;
        }).join('')}</div></div>` : '';
  const tagRow = (title, arr, kind) => arr.length
    ? `<div class="sec"><h4>${title}</h4><div class="tags">${
        arr.map(t=>`<span class="tag" data-${kind}="${t}">${label(kind,t)}</span>`).join('')}</div></div>` : '';
  $('#detail-body').innerHTML = `
    <div class="num">NAME ${e.n} / 1000</div>
    <h2>${e.name}</h2>
    <ul class="meanings">${e.meanings.map(m=>`<li>${m}</li>`).join('')}</ul>
    ${repeats}
    ${tagRow('Themes of life', e.themes.filter(t=>META.themes[t]), 'theme')}
    ${tagRow('Roots', e.roots, 'root')}
    ${tagRow('Avatars', e.avatars, 'avatar')}
    ${e.icons.length?`<div class="sec"><h4>Iconography</h4><div class="tags">${e.icons.map(i=>`<span class="tag">${i}</span>`).join('')}</div></div>`:''}
  `;
  $('#detail').classList.add('show');
}

function label(kind, key){
  if (kind==='theme') return (META.themes[key]||{}).label || key;
  if (kind==='avatar') return (META.avatars[key]||{}).label || key;
  return key;
}

/* --------------------------------------------------------------- chips */
function buildChips(){
  const tc = $('#theme-chips');
  Object.entries(META.themes).sort((a,b)=>b[1].count-a[1].count).forEach(([k,v])=>{
    const c=document.createElement('span'); c.className='chip'; c.dataset.theme=k;
    c.innerHTML=`${v.label}<span class="c">${v.count}</span>`; tc.appendChild(c);
  });
  const ac = $('#avatar-chips');
  Object.entries(META.avatars).filter(([,v])=>v.count).sort((a,b)=>b[1].count-a[1].count).forEach(([k,v])=>{
    const c=document.createElement('span'); c.className='chip'; c.dataset.avatar=k;
    c.innerHTML=`${v.label.split(' —')[0]}<span class="c">${v.count}</span>`; ac.appendChild(c);
  });
}

/* ----------------------------------------------------------------- about */
function buildAbout(){
  $('#about-body').innerHTML = `
    <h2>The thousand names, connected</h2>
    <p class="lead">${META.subtitle}</p>
    <p style="line-height:1.7;color:var(--ink)">The Vishnu Sahasranama appears in the
      Anuśāsana Parva of the Mahābhārata — Bhīṣma, mortally wounded and awaiting his chosen
      hour of death, answers Yudhiṣṭhira's question: <em>which is the one refuge, the highest
      praise?</em> His reply is these thousand names.</p>
    <p style="line-height:1.7;color:var(--ink);margin-top:14px">This atlas turns the litany into
      a map. Each of the <b>1000 names</b> is a node. They cluster around <b>concept hubs</b> —
      ${Object.keys(META.themes).length} themes of life, ${Object.keys(META.roots).length} Sanskrit
      roots, and the ${Object.values(META.avatars).filter(a=>a.count).length} avatars that thread
      through the verses. <b style="color:var(--repeat)">${META.counts.repeatGroups} names recur</b>
      across the thousand — each time with a different meaning, the same reality refracted.</p>
    <p style="line-height:1.7;color:var(--muted);margin-top:18px;font-size:13.5px"><b>Source.</b>
      ${META.source} Tags in this prototype are auto-derived (keyword & root heuristics) and will
      be hand-curated in a later pass. Romanization quirks come from the source OCR.</p>
    <p style="line-height:1.7;color:var(--muted);margin-top:10px;font-size:13.5px">
      “It is also very important to meditate on the meaning of each word while it is sung.”</p>`;
}

/* ------------------------------------------------------------------- UI */
function wireUI(){
  // edge toggles
  const map={ 'e-theme':'theme','e-repeat':'repeat','e-root':'root','e-avatar':'avatar','e-seq':'seq' };
  for (const [id,kind] of Object.entries(map)){
    $('#'+id).addEventListener('change', ev=>{ state.edgeOn[kind]=ev.target.checked; recompute(); });
  }
  // theme / avatar chips
  $('#theme-chips').addEventListener('click', e=>{ const c=e.target.closest('.chip'); if(!c)return;
    toggleSet(state.themes, c.dataset.theme); c.classList.toggle('on'); recompute(); });
  $('#avatar-chips').addEventListener('click', e=>{ const c=e.target.closest('.chip'); if(!c)return;
    toggleSet(state.avatars, c.dataset.avatar); c.classList.toggle('on'); recompute(); });

  $('#reset').addEventListener('click', ()=>{
    state.themes.clear(); state.avatars.clear();
    document.querySelectorAll('.chip.on').forEach(c=>c.classList.remove('on'));
    clearFocus(); recompute(); CY.animate({ fit:{eles:CY.nodes(':visible'),padding:40} },{duration:400});
  });

  // graph interaction
  CY.on('tap','node[kind="name"]', ev=>focusNode(ev.target.data('n')));
  CY.on('tap','node[kind="theme"]', ev=>chipFilter('theme', ev.target.id().slice(6)));
  CY.on('tap','node[kind="avatar"]', ev=>chipFilter('avatar', ev.target.id().slice(7)));
  CY.on('tap', ev=>{ if(ev.target===CY) clearFocus(); });

  // detail-panel clicks (jump to recurrence / apply tag filter)
  $('#detail-body').addEventListener('click', e=>{
    const j=e.target.closest('[data-jump]'); if(j){ focusNode(+j.dataset.jump); return; }
    const t=e.target.closest('[data-theme]'); if(t){ chipFilter('theme', t.dataset.theme); return; }
    const a=e.target.closest('[data-avatar]'); if(a){ chipFilter('avatar', a.dataset.avatar); return; }
  });
  $('#detail-close').addEventListener('click', clearFocus);

  // search
  const q=$('#q'), res=$('#results');
  q.addEventListener('input', ()=>{
    const v=q.value.trim().toLowerCase();
    if(v.length<2){ res.classList.remove('show'); res.innerHTML=''; return; }
    const hits=NAMES.filter(e=> e.name.toLowerCase().includes(v) ||
        e.meanings.some(m=>m.toLowerCase().includes(v))).slice(0,40);
    res.innerHTML = hits.length ? hits.map(e=>
      `<div class="r" data-n="${e.n}"><b>${e.name}</b> <small>${e.n} · ${e.meanings[0]}</small></div>`).join('')
      : '<div class="r"><small>no match</small></div>';
    res.classList.add('show');
  });
  res.addEventListener('click', e=>{ const r=e.target.closest('[data-n]'); if(!r)return;
    res.classList.remove('show'); q.value=''; focusNode(+r.dataset.n); });
  document.addEventListener('click', e=>{ if(!e.target.closest('.search')) res.classList.remove('show'); });

  // mode switch
  $('#modes').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b)return;
    document.querySelectorAll('#modes button').forEach(x=>x.classList.toggle('active', x===b));
    const about = b.dataset.mode==='about';
    $('#view-about').classList.toggle('show', about);
    $('#rail').style.display = about?'none':'';
    $('#hint').style.display = about?'none':'';
    if(about) $('#detail').classList.remove('show');
  });
}

function chipFilter(kind, key){
  const set = kind==='theme'?state.themes:state.avatars;
  const sel = `.chip[data-${kind}="${key}"]`;
  toggleSet(set, key);
  document.querySelector(sel)?.classList.toggle('on', set.has(key));
  clearFocus(); recompute();
  CY.animate({ fit:{eles:CY.nodes(':visible'),padding:50} },{duration:450});
}
function toggleSet(s,v){ s.has(v)?s.delete(v):s.add(v); }
