/* ============================================================
   SAHASRANAMA ATLAS - application / chrome / state
   ============================================================ */
(function(){
'use strict';

const $=s=>document.querySelector(s);
const el=(t,c,h)=>{const e=document.createElement(t); if(c)e.className=c; if(h!=null)e.innerHTML=h; return e;};

const IC={
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"/><path d="M12 11v5"/><circle cx="12" cy="7.6" r="0.4" fill="currentColor" stroke-width="1.4"/></svg>',
  reset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11a9 9 0 1 1 2.5 6.3M3 11V5m0 6h6"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.2 6.2 0 0 0 10.5 10.5z"/></svg>',
  constellation:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="7" r="1.3" fill="currentColor"/><circle cx="17" cy="5" r="1.3" fill="currentColor"/><circle cx="12" cy="13" r="1.3" fill="currentColor"/><circle cx="19" cy="17" r="1.3" fill="currentColor"/><circle cx="6" cy="18" r="1.3" fill="currentColor"/><path d="M6 7l6 6M17 5l-5 8M12 13l7 4M12 13l-6 5" opacity=".55"/></svg>',
  mandala:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.4"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/></svg>',
  litany:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 6h14M5 10h14M5 14h10M5 18h7"/></svg>',
};

const CONN=[
  {id:'roots', label:'Shared roots', sub:'morphology'},
  {id:'recurring', label:'Recurring names', sub:'the same name returns'},
  {id:'avatars', label:'Avatars', sub:'incarnations'},
  {id:'themes', label:'Themes of life', sub:'shared meaning'},
  {id:'litany', label:'Litany sequence', sub:'order of chanting'},
];

let DATA=null, themeMode='night', lens='constellation', conn='roots';
const filter={theme:null, avatar:null};
let interacted=false;

function markInteract(){ if(!interacted){ interacted=true; $('#hint').classList.add('gone'); } }

// ---------------- BOOT ----------------
async function boot(){
  const res=await fetch('data/atlas.json'); DATA=await res.json();
  buildChrome();
  buildLitany();
  Atlas.init($('#atlas-canvas'), DATA, {
    onSelect:(node)=>{ if(node) openDetail(node.n); else closeDetail(); },
    onHover:()=>{},
  });
  Atlas.setLayout('constellation');
  Atlas.setConnection(conn);
  updateScalebar();
  bindKeys();
  readURL();
  setTimeout(()=>{ $('#loader').classList.add('gone');
    setTimeout(()=>$('#loader').remove(), 900); }, 650);
}

// ---------------- CHROME ----------------
function buildChrome(){
  // lens switch
  const ls=$('#lensSwitch');
  [['constellation','Constellation',IC.constellation],['mandala','Mandala',IC.mandala],['litany','Litany',IC.litany]].forEach(([id,lab,ic])=>{
    const b=el('button',null,`<span class="ic">${ic}</span>${lab}`);
    b.setAttribute('aria-pressed', id===lens);
    b.onclick=()=>setLens(id);
    b.dataset.lens=id; ls.appendChild(b);
  });

  // connections
  const cl=$('#connList');
  CONN.forEach(c=>{
    const b=el('button',null,`<span class="dot"></span><span class="ct">${c.label}</span>`);
    b.setAttribute('aria-pressed', c.id===conn);
    b.dataset.conn=c.id;
    b.onclick=()=>setConn(c.id);
    cl.appendChild(b);
  });

  // theme chips
  const tc=$('#themeChips');
  DATA.themes.forEach(t=>{
    const col=Atlas.THEME_COLORS[t.id][themeMode];
    const b=el('button','chip',`<span class="cd" style="background:${col}"></span>${t.label.replace(/ &.*/,'')}<span class="cn">${t.prim}</span>`);
    b.dataset.theme=t.id; b.title=t.label;
    b.onclick=()=>toggleTheme(t.id);
    tc.appendChild(b);
  });

  // avatar chips
  const ac=$('#avatarChips');
  DATA.avatars.filter(a=>a.count>0).forEach(a=>{
    const b=el('button','chip',`<span class="cd" style="background:var(--gold)"></span>${a.label}<span class="cn">${a.count}</span>`);
    b.dataset.avatar=a.id;
    b.onclick=()=>toggleAvatar(a.id);
    ac.appendChild(b);
  });

  // search
  const si=$('#searchInput');
  $('#searchBtn').innerHTML=IC.search;
  $('#searchBtn').onclick=()=>{ const s=$('#search'); s.classList.toggle('open');
    if(s.classList.contains('open')) si.focus(); else { si.value=''; renderSearch(''); } };
  si.addEventListener('input',()=>renderSearch(si.value));
  si.addEventListener('keydown',e=>{ if(e.key==='Escape'){ $('#search').classList.remove('open'); si.value=''; renderSearch(''); }});

  $('#themeBtn').onclick=toggleMode;
  $('#themeBtn').innerHTML=IC.sun;
  $('#aboutBtn').innerHTML=IC.info;
  $('#aboutBtn').onclick=()=>$('#about').classList.add('open');
  $('#aboutClose').onclick=()=>$('#about').classList.remove('open');
  $('#about').onclick=e=>{ if(e.target.id==='about') $('#about').classList.remove('open'); };
  $('#resetBtn').innerHTML=IC.reset+' reset view';
  $('#resetBtn').onclick=()=>{ markInteract(); clearFilters(); Atlas.select(null); closeDetail(); Atlas.resetView(true); };
  $('#detailClose').innerHTML=IC.x;
  $('#detailClose').onclick=()=>{ Atlas.select(null); closeDetail(); };
  buildAbout();
}

function setLens(id){
  if(id===lens) return; markInteract();
  document.querySelectorAll('#lensSwitch button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.lens===id));
  lens=id;
  const litany=$('#litany');
  if(id==='litany'){ litany.classList.add('show'); $('#scalebar').style.display='none'; $('#hint').style.display='none'; syncLitanySel(); }
  else {
    litany.classList.remove('show'); $('#scalebar').style.display=''; $('#hint').style.display='';
    Atlas.setLayout(id);
  }
  syncURL();
}
function setConn(id){
  markInteract(); conn=id; Atlas.setConnection(id);
  document.querySelectorAll('#connList button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.conn===id));
  if(Atlas.selected!=null) openDetail(Atlas.selected); // refresh related
  syncURL();
}
function toggleTheme(id){
  markInteract();
  filter.theme = filter.theme===id ? null : id;
  if(filter.theme) filter.avatar=null;
  syncFilterUI(); Atlas.setFilter(filter); updateScalebar(); syncURL();
}
function toggleAvatar(id){
  markInteract();
  filter.avatar = filter.avatar===id ? null : id;
  if(filter.avatar) filter.theme=null;
  syncFilterUI(); Atlas.setFilter(filter); updateScalebar(); syncURL();
}
function clearFilters(){ filter.theme=null; filter.avatar=null; syncFilterUI(); Atlas.setFilter(filter); updateScalebar(); syncURL(); }
function syncFilterUI(){
  document.querySelectorAll('#themeChips .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.theme===filter.theme));
  document.querySelectorAll('#avatarChips .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.avatar===filter.avatar));
}
function updateScalebar(){
  let n=DATA.nodes.length;
  if(filter.theme) n=DATA.nodes.filter(d=>d.primaryTheme===filter.theme).length;
  else if(filter.avatar) n=DATA.nodes.filter(d=>d.avatars.includes(filter.avatar)).length;
  const label = (filter.theme||filter.avatar) ? 'shown' : 'names';
  $('#scalebar').innerHTML=`<b>${n}</b> ${label} <span style="opacity:.5">of 1000</span>`;
}

function toggleMode(){
  themeMode = themeMode==='night' ? 'day' : 'night';
  document.documentElement.setAttribute('data-theme', themeMode);
  Atlas.setMode(themeMode);
  $('#themeBtn').innerHTML = themeMode==='night' ? IC.sun : IC.moon;
  // recolor theme chip dots
  document.querySelectorAll('#themeChips .chip').forEach(b=>{
    const c=b.dataset.theme; b.querySelector('.cd').style.background=Atlas.THEME_COLORS[c][themeMode];
  });
}

// ---------------- SEARCH ----------------
function renderSearch(q){
  const box=$('#searchResults'); q=q.trim().toLowerCase();
  if(!q){ box.classList.remove('has'); box.innerHTML=''; return; }
  const out=[];
  for(const d of DATA.nodes){
    if(d.name.toLowerCase().includes(q) || d.meaning.toLowerCase().includes(q)){ out.push(d); if(out.length>=40)break; }
  }
  box.innerHTML='';
  if(!out.length){ box.classList.add('has'); box.appendChild(el('div','rel-empty','No name matches.')); return; }
  out.forEach(d=>{
    const it=el('div','sr-item',`<span class="sn">${d.n}</span><span class="snm">${d.name}</span><span class="sm">${d.meaning.split(/;| or /)[0]}</span>`);
    it.onclick=()=>{ selectNode(d.n); $('#search').classList.remove('open'); $('#searchInput').value=''; renderSearch(''); };
    box.appendChild(it);
  });
  box.classList.add('has');
}

// ---------------- selecting ----------------
function selectNode(n){
  markInteract();
  Atlas.select(n);
  openDetail(n);
  if(lens==='litany'){ scrollToVerse(n); }
  else { Atlas.centerOn(n); }
  syncURL();
}

// ---------------- deep links (shareable URL hash) ----------------
let restoring=false;
function syncURL(){
  if(restoring) return;
  const p=new URLSearchParams();
  if(lens!=='constellation') p.set('lens',lens);
  if(conn!=='roots') p.set('conn',conn);
  if(filter.theme) p.set('theme',filter.theme);
  if(filter.avatar) p.set('avatar',filter.avatar);
  if(Atlas.selected!=null) p.set('n',Atlas.selected);
  const s=p.toString();
  history.replaceState(null,'', s ? '#'+s : location.pathname+location.search);
}
function readURL(){
  const p=new URLSearchParams(location.hash.slice(1));
  restoring=true;
  const C=p.get('conn'); if(C && CONN.some(c=>c.id===C)) setConn(C);
  const L=p.get('lens'); if(L && ['constellation','mandala','litany'].includes(L)) setLens(L);
  const th=p.get('theme'); if(th && DATA.themes.some(t=>t.id===th)) toggleTheme(th);
  const av=p.get('avatar'); if(av && DATA.avatars.some(a=>a.id===av)) toggleAvatar(av);
  restoring=false;
  const n=+p.get('n'); if(n>=1 && n<=1000) setTimeout(()=>selectNode(n), 400);
  else syncURL();
}

// ---------------- keyboard ----------------
function bindKeys(){
  document.addEventListener('keydown', e=>{
    const typing = e.target.tagName==='INPUT' || e.target.isContentEditable;
    if(e.key==='Escape'){
      if($('#about').classList.contains('open')){ $('#about').classList.remove('open'); return; }
      if(!$('#tweakPanel').hasAttribute('hidden')){ $('#tweakPanel').setAttribute('hidden',''); $('#tweakBtn').classList.remove('on'); return; }
      if($('#detail').classList.contains('open')){ Atlas.select(null); closeDetail(); return; }
    }
    if(typing) return;
    if(e.key==='/'){ e.preventDefault(); const s=$('#search'); s.classList.add('open'); $('#searchInput').focus(); }
    else if(e.key==='ArrowRight' && Atlas.selected!=null){ e.preventDefault(); selectNode(Math.min(1000, Atlas.selected+1)); }
    else if(e.key==='ArrowLeft' && Atlas.selected!=null){ e.preventDefault(); selectNode(Math.max(1, Atlas.selected-1)); }
    else if(e.key==='1'){ setLens('constellation'); }
    else if(e.key==='2'){ setLens('mandala'); }
    else if(e.key==='3'){ setLens('litany'); }
  });
}

// ---------------- DETAIL PANEL ----------------
function themeMeta(id){ return DATA.themes.find(t=>t.id===id); }
function rootMeta(id){ return DATA.roots.find(r=>r.id===id); }
function avatarMeta(id){ return DATA.avatars.find(a=>a.id===id); }

function openDetail(n){
  const d=DATA.nodes[n-1]; const body=$('#detailBody');
  const meanings=d.meaning.split(/; or |;\s*/).filter(Boolean);
  const meanHTML = meanings.map((m,i)=> i===0
    ? `<span>${cap(m)}</span>` : `<span class="alt">; ${m}</span>`).join('');

  // tags
  const themeTags=d.themes.map(t=>{ const m=themeMeta(t); const col=Atlas.THEME_COLORS[t][themeMode];
    return `<span class="tag"><span class="cd" style="background:${col}"></span>${m?m.label:t}</span>`; }).join('');
  const avTags=d.avatars.map(a=>{ const m=avatarMeta(a); return `<span class="tag av">${m?m.label:a} avatāra</span>`; }).join('');

  // roots
  let rootHTML='';
  if(d.roots.length){
    rootHTML='<div class="d-sec"><h3>Shared roots</h3><div class="root-row">'+
      d.roots.map(r=>{ const m=rootMeta(r); return `<div class="root"><span class="rd">${devForRoot(r)}</span><span class="rt">${m.label}</span><span class="rg">${m.gloss}</span></div>`; }).join('')+'</div></div>';
  }

  // recurring twins
  let twinHTML='';
  if(d.recurring){
    const twins=(Atlas.index.byKey[d.key]||[]).map(i=>i+1).filter(x=>x!==n);
    if(twins.length) twinHTML='<div class="d-sec"><h3>The same name returns</h3><div class="d-twins">'+
      twins.map(x=>`<span class="twin" data-go="${x}"><b>${x}</b> ${DATA.nodes[x-1].name}</span>`).join('')+'</div></div>';
  }

  // related (by current connection)
  const connLabel=CONN.find(c=>c.id===conn).label;
  let kin=Atlas.kinOf(n)||[];
  // for themes, kin can be huge -> sample nearby in litany order
  let relHTML;
  if(!kin.length){ relHTML='<div class="rel-empty">No connections under this lens.</div>'; }
  else {
    const show=kin.map(i=>i+1).sort((a,b)=>Math.abs(a-n)-Math.abs(b-n)).slice(0,14);
    relHTML=show.map(x=>{ const r=DATA.nodes[x-1];
      return `<div class="rel" data-go="${x}"><span class="rn">${x}</span><span class="rnm">${r.name}</span><span class="rm">${r.meaning.split(/;| or /)[0]}</span></div>`;
    }).join('');
    if(kin.length>show.length) relHTML+=`<div class="rel-empty">+ ${kin.length-show.length} more under "${connLabel}".</div>`;
  }

  const devBlock = d.dev
    ? `<div class="d-dev">${d.dev}</div>`
    : `<div class="d-dev romanonly">${d.name}</div>`;
  const translit = d.iast ? d.iast : d.name.toLowerCase();

  body.innerHTML=`
    <div class="d-num">Name <b>${n}</b> of 1000 <span class="d-sloka">sloka ${d.sloka}</span></div>
    ${devBlock}
    <h2 class="d-name">${d.name}</h2>
    <div class="d-translit">${translit}</div>
    <div class="d-rule"></div>
    <div class="d-mean">${meanHTML}</div>
    <div class="d-sec"><h3>Themes of life</h3><div class="tag-row">${themeTags}${avTags}</div></div>
    ${rootHTML}
    ${twinHTML}
    <div class="d-sec"><h3>Related by ${connLabel}</h3><div class="rel-row">${relHTML}</div></div>
  `;
  body.querySelectorAll('[data-go]').forEach(e=>e.onclick=()=>selectNode(+e.dataset.go));
  $('#detail').classList.add('open');
  syncLitanySel();
}
function closeDetail(){ $('#detail').classList.remove('open'); syncLitanySel(); syncURL(); }
function cap(s){ s=s.trim(); return s.charAt(0).toUpperCase()+s.slice(1); }
function devForRoot(r){ const map={bhuta:'भूत',maha:'महा',vishva:'विश्व',atma:'आत्मन्',veda:'वेद',ishvara:'ईश्वर',prabha:'प्रभा',padma:'पद्म',chatur:'चतुर्',siddha:'सिद्ध',ananta:'अनन्त',yoga:'योग',hari:'हरि',nabha:'नाभ',deva:'देव',gati:'गति',kara:'कर',dhara:'धर'}; return map[r]||'॥'; }

// ---------------- LITANY LENS (sloka-grouped recitation) ----------------
function buildLitany(){
  const inner=$('#litanyInner');
  const head=el('div','litany-head',`<div class="om">ॐ</div><div class="lt">the thousand names, in the order they are sung</div>`);
  inner.appendChild(head);
  // Devanagari stanza for each sloka = its names, in order
  const stanza={};
  DATA.nodes.forEach(d=>{ (stanza[d.sloka]=stanza[d.sloka]||[]).push(d.dev||d.name); });
  const frag=document.createDocumentFragment();
  let cur=0;
  DATA.nodes.forEach(d=>{
    if(d.sloka!==cur){
      cur=d.sloka;
      const h=el('div','litany-sloka');
      h.innerHTML=`<div class="ls-num">श्लोक <b>${cur}</b></div>
        <div class="ls-verse">${stanza[cur].join(' ')}</div>`;
      frag.appendChild(h);
    }
    const col=Atlas.THEME_COLORS[d.primaryTheme][themeMode];
    const v=el('div','verse');
    v.id='v'+d.n; v.dataset.n=d.n;
    v.innerHTML=`<div class="vn">${d.n}</div><div class="vbody">
      <div class="vname">${d.name}${d.dev?`<span class="vdev">${d.dev}</span>`:''}</div>
      ${d.iast?`<div class="viast">${d.iast}</div>`:''}
      <div class="vmean">${cap(d.meaning)}</div>
      <div class="vdotwrap"><span class="vdot" data-col style="background:${col}"></span></div></div>`;
    v.onclick=()=>{ Atlas.select(d.n); openDetail(d.n); syncLitanySel(); };
    frag.appendChild(v);
  });
  inner.appendChild(frag);
}
function scrollToVerse(n){
  const v=$('#v'+n); if(v){ $('#litany').scrollTo({top:v.offsetTop-140, behavior:'smooth'}); }
  syncLitanySel();
}
function syncLitanySel(){
  document.querySelectorAll('.verse.sel').forEach(v=>v.classList.remove('sel'));
  if(Atlas.selected!=null){ const v=$('#v'+Atlas.selected); if(v)v.classList.add('sel'); }
  // recolor dots if theme mode changed
  if(themeMode){ document.querySelectorAll('.verse').forEach(v=>{ const d=DATA.nodes[+v.dataset.n-1];
    const dot=v.querySelector('[data-col]'); if(dot) dot.style.background=Atlas.THEME_COLORS[d.primaryTheme][themeMode]; }); }
}

// ---------------- ABOUT ----------------
function buildAbout(){
  const recur=Object.values(Atlas?Atlas.index?Atlas.index.byKey:{}:{}); // not ready yet; compute from data
  const recurGroups=(()=>{ const m={}; DATA.nodes.forEach(d=>m[d.key]=(m[d.key]||0)+1); return Object.values(m).filter(v=>v>1).length; })();
  const dev=DATA.nodes.filter(d=>d.dev).length;
  $('#aboutBody').innerHTML=`
    <span class="om">ॐ</span>
    <h2>Sahasranama <em>Atlas</em></h2>
    <div class="ac-sub">the thousand names of Viṣṇu, connected</div>
    <p>The <b>Viṣṇu Sahasranāma</b>, from the Anuśāsana Parva of the Mahābhārata, is a litany of one thousand names. It is not a flat list. Names <b>recur</b> with new shades of meaning, <b>cluster</b> around shared roots, gesture toward the <b>avatāras</b>, and together map an entire inner life.</p>
    <p class="ac-story">Bhīṣma lay on a bed of arrows, waiting for his chosen hour to die. Yudhiṣṭhira came to him with a question: of all that is, which is the one refuge, the highest praise a person can hold? The grandsire's answer was these thousand names of Viṣṇu, the lord of all that has been and will be.</p>
    <p>This atlas turns that answer into something you can <b>wander</b>. Three lenses offer three ways of seeing: a <b>Constellation</b> where names gather by theme, a <b>Mandala</b> that spirals them in the order they are sung, and the <b>Litany</b> itself as an illuminated scroll. Press <b>1 2 3</b> to switch, <b>/</b> to search, arrow keys to walk the litany, and share any view by its link.</p>
    <div class="ac-grid">
      <div class="ac-cell"><div class="acn">1000</div><div class="acl">names</div></div>
      <div class="ac-cell"><div class="acn">107</div><div class="acl">slokas</div></div>
      <div class="ac-cell"><div class="acn">${recurGroups}</div><div class="acl">recurring names</div></div>
      <div class="ac-cell"><div class="acn">12</div><div class="acl">themes of life</div></div>
    </div>
    <p class="ac-note">Names and meanings are the project's own dataset of 1000 entries; themes, roots, avatars and recurrences are computed from that text. <b>Devanāgarī now covers all ${dev} names</b> (from the drikpanchang namavali, cross-checked by transliteration), with IAST generated from it. The Litany groups the names into their <b>107 ślokas</b> (grouping from swami-krishnananda.org). Sacred text, machine-assembled; verify before liturgical use.</p>
  `;
}

document.addEventListener('DOMContentLoaded', boot);
})();
