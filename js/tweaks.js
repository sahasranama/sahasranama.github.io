/* ============================================================
   SAHASRANAMA ATLAS — Tweaks (vanilla)
   Replaces the design-tool's React edit-mode harness with a real,
   always-available popover so visitors can tune the atmosphere.
   Motion · thread accent · glow · display face. Persisted to
   localStorage; applied on load so the page always matches the
   chosen design even before the panel is opened.
   ============================================================ */
(function(){
'use strict';

const DEFAULTS = { motion:'gentle', accent:'#D9A441', glow:1, face:'Fraunces' };
const KEY = 'sahasranama.tweaks';
const MOTION = { still:[0.06,0.5], gentle:[0.32,1], lively:[0.62,1.7] };
const ACCENTS = ['#D9A441','#3FB8A1','#E4708E','#E6A54A'];
const FACES = ['Fraunces','Cormorant Garamond','EB Garamond'];

const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/></svg>';

function load(){
  try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY)||'{}')); }
  catch(e){ return Object.assign({}, DEFAULTS); }
}
function save(t){ try{ localStorage.setItem(KEY, JSON.stringify(t)); }catch(e){} }

function applyTweaks(t){
  const A = window.Atlas;
  if(A){
    const m = MOTION[t.motion] || MOTION.gentle;
    A.twinkleAmp = m[0]; A.twinkleSpeed = m[1];
    A.accent = t.accent;
    A.glowMul = t.glow;
    A.labelFont = "'"+t.face+"',serif";
    A.glowCache = {};
  }
  document.documentElement.style.setProperty('--font-serif', "'"+t.face+"','Cormorant Garamond',Georgia,serif");
}

let T = load();

function render(){
  const p = document.getElementById('tweakPanel');
  p.innerHTML = `
    <div class="twk-sec">Motion</div>
    <div class="twk-seg" data-group="motion">
      ${['still','gentle','lively'].map(v=>`<button data-v="${v}" aria-pressed="${T.motion===v}">${v}</button>`).join('')}
    </div>
    <div class="twk-sec">Thread accent</div>
    <div class="twk-swatches" data-group="accent">
      ${ACCENTS.map(c=>`<button data-v="${c}" aria-pressed="${T.accent.toLowerCase()===c.toLowerCase()}" style="background:${c}" title="${c}"></button>`).join('')}
    </div>
    <div class="twk-sec">Glow</div>
    <input type="range" class="twk-range" id="twkGlow" min="0.6" max="1.8" step="0.1" value="${T.glow}">
    <div class="twk-sec">Display face</div>
    <div class="twk-faces" data-group="face">
      ${FACES.map(f=>`<button data-v="${f}" aria-pressed="${T.face===f}" style="font-family:'${f}',serif">${f}</button>`).join('')}
    </div>`;

  p.querySelectorAll('[data-group] button').forEach(b=>{
    b.onclick = ()=>{
      const g = b.closest('[data-group]').dataset.group;
      let v = b.dataset.v; if(g==='glow') v=+v;
      set(g, v);
      b.closest('[data-group]').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed', x===b));
    };
  });
  const glow = p.querySelector('#twkGlow');
  glow.oninput = ()=> set('glow', +glow.value);
}

function set(k,v){ T[k]=v; save(T); applyTweaks(T); }

function init(){
  const btn = document.getElementById('tweakBtn');
  if(!btn) return;
  btn.innerHTML = GEAR;
  const panel = document.getElementById('tweakPanel');
  render();
  btn.onclick = (e)=>{
    e.stopPropagation();
    const open = panel.hasAttribute('hidden');
    if(open){ panel.removeAttribute('hidden'); btn.classList.add('on'); }
    else { panel.setAttribute('hidden',''); btn.classList.remove('on'); }
  };
  document.addEventListener('click', e=>{
    if(!panel.hasAttribute('hidden') && !panel.contains(e.target) && e.target!==btn){
      panel.setAttribute('hidden',''); btn.classList.remove('on');
    }
  });
  applyTweaks(T);
}

// Atlas object exists synchronously (engine.js); apply immediately so the
// look is correct from the first frame, then wire the panel once DOM is ready.
applyTweaks(T);
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
