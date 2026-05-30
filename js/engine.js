/* ============================================================
   ATLAS ENGINE - canvas renderer for the 1000 names
   Two layouts (constellation / mandala), pan-zoom, glow sprites,
   animated morph between layouts, on-demand connection threads.
   Vanilla JS. Exposed as window.Atlas.
   ============================================================ */
(function(){
'use strict';

const GOLD_ANGLE = Math.PI * (3 - Math.sqrt(5));

const THEME_COLORS = {
  cosmos:{night:'#7FA0E0',day:'#3A5A86'},
  time:{night:'#46C2B0',day:'#1F7A68'},
  creation:{night:'#74C98A',day:'#2E6F52'},
  knowledge:{night:'#E8B84E',day:'#9A6B14'},
  power:{night:'#E5697E',day:'#B63A5A'},
  soul:{night:'#86D8C9',day:'#2C8C79'},
  light:{night:'#F4A93B',day:'#C8781F'},
  grace:{night:'#E98CAC',day:'#C04E78'},
  purity:{night:'#E7DBBE',day:'#9A864F'},
  form:{night:'#DC8E5E',day:'#8E4F2B'},
  lordship:{night:'#CFA24E',day:'#9A6A1E'},
  essence:{night:'#B6A2DA',day:'#6A4E88'},
};
const THREAD = {night:'rgba(217,164,65,', day:'rgba(142,79,43,'};

function lerp(a,b,t){return a+(b-a)*t;}
function easeOut(t){return 1-Math.pow(1-t,3);}

const Atlas = {
  canvas:null, ctx:null, dpr:1,
  nodes:[], data:null, mode:'night',
  layout:'constellation', connection:'roots',
  filter:{theme:null, avatar:null},
  selected:null, hover:null,
  index:{byKey:{},byRoot:{},byAvatar:{},byTheme:{}},
  // aesthetic opts (driven by Tweaks)
  accent:'#D9A441', twinkleAmp:0.32, twinkleSpeed:1, glowMul:1, labelFont:"'Fraunces',serif",
  accentRGBA(a){ return this._fade(this.accent,a); },
  glowCache:{},
  // view transform
  scale:1, ox:0, oy:0, fitScale:1,
  // morph
  morphT:1, morphStart:0, morphing:false,
  drag:null,
  cb:{onSelect:()=>{}, onHover:()=>{}},
  W:0, H:0, t0:performance.now(),

  init(canvas, data, cb){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.data=data; this.nodes=data.nodes.map((d,i)=>({d, i,
      phase:Math.random()*Math.PI*2, tw:0.5+Math.random()*0.5,
      cx:0,cy:0, mx:0,my:0, x:0,y:0, fx:0,fy:0 }));
    if(cb) Object.assign(this.cb, cb);
    this.buildIndex();
    this.computeLayouts();
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
    this.bindEvents();
    // start at mandala-fit; default layout set by app afterwards
    this.nodes.forEach(n=>{n.x=n.cx;n.y=n.cy;});
    this.resetView(false);
    this.t0=performance.now();
    requestAnimationFrame(()=>this.frame());
  },

  buildIndex(){
    const ix=this.index;
    this.nodes.forEach((n)=>{
      const d=n.d;
      (ix.byKey[d.key]=ix.byKey[d.key]||[]).push(n.i);
      d.roots.forEach(r=>(ix.byRoot[r]=ix.byRoot[r]||[]).push(n.i));
      d.avatars.forEach(a=>(ix.byAvatar[a]=ix.byAvatar[a]||[]).push(n.i));
      (ix.byTheme[d.primaryTheme]=ix.byTheme[d.primaryTheme]||[]).push(n.i);
    });
  },

  computeLayouts(){
    const N=this.nodes.length;
    // ---- MANDALA: phyllotaxis seed-head, ordered by litany n ----
    const K=30;
    this.nodes.forEach(n=>{
      const i=n.d.n-1;
      const r=K*Math.sqrt(i+4);
      const a=i*GOLD_ANGLE;
      n.mx=Math.cos(a)*r; n.my=Math.sin(a)*r;
    });
    // ---- CONSTELLATION: clusters by primary theme around a ring ----
    const themes=this.data.themes.map(t=>t.id);
    const CR=940;
    const centers={};
    themes.forEach((id,k)=>{
      const ang=(k/themes.length)*Math.PI*2 - Math.PI/2;
      centers[id]={x:Math.cos(ang)*CR, y:Math.sin(ang)*CR, ang};
    });
    const counters={};
    this.nodes.forEach(n=>{
      const th=n.d.primaryTheme;
      const c=centers[th]||{x:0,y:0};
      const j=(counters[th]=(counters[th]||0)+1)-1;
      const lr=17*Math.sqrt(j+1);
      const la=j*GOLD_ANGLE + (centers[th]?centers[th].ang:0);
      n.cx=c.x+Math.cos(la)*lr;
      n.cy=c.y+Math.sin(la)*lr;
    });
  },

  setLayout(name){
    if(name===this.layout) return;
    // capture current as 'from'
    this.nodes.forEach(n=>{n.fx=n.x; n.fy=n.y;});
    this.layout=name;
    this.morphStart=performance.now(); this.morphing=true; this.morphT=0;
    this.resetView(true);
  },
  targetXY(n){ return this.layout==='mandala' ? [n.mx,n.my] : [n.cx,n.cy]; },

  setMode(m){ this.mode=m; this.glowCache={}; },
  setConnection(c){ this.connection=c; },
  setFilter(f){ this.filter=Object.assign({theme:null,avatar:null}, f); },

  select(n){ this.selected=n; this.cb.onSelect(n==null?null:this.data.nodes[n-1]); },
  setHover(n){ if(this.hover!==n){ this.hover=n; this.cb.onHover(n); } },

  // ----- which node-indices are "kin" of selected (for threads/glow) -----
  kinOf(nNum){
    if(nNum==null) return null;
    const node=this.data.nodes[nNum-1];
    const ix=this.index; let set=[];
    switch(this.connection){
      case 'recurring': set=(ix.byKey[node.key]||[]).filter(i=>i!==nNum-1); break;
      case 'roots': { const s=new Set(); node.roots.forEach(r=>(ix.byRoot[r]||[]).forEach(i=>s.add(i))); s.delete(nNum-1); set=[...s]; break; }
      case 'avatars': { const s=new Set(); node.avatars.forEach(a=>(ix.byAvatar[a]||[]).forEach(i=>s.add(i))); s.delete(nNum-1); set=[...s]; break; }
      case 'litany': { set=[]; if(nNum>1)set.push(nNum-2); if(nNum<1000)set.push(nNum); break; }
      case 'themes': default: set=(ix.byTheme[node.primaryTheme]||[]).filter(i=>i!==nNum-1); break;
    }
    return set;
  },

  // ---------- view ----------
  resetView(animate){
    // fit the whole field
    const maxR = this.layout==='mandala' ? 1000 : 1280;
    const fit = Math.min(this.W, this.H) / (maxR*2) * 0.92;
    this.fitScale=fit;
    const tScale=fit, tox=this.W/2, toy=this.H/2;
    if(animate){ this._animView(tScale,tox,toy); }
    else { this.scale=tScale; this.ox=tox; this.oy=toy; }
  },
  _animView(ts,tx,ty){
    this._va={s0:this.scale,o0x:this.ox,o0y:this.oy,s1:ts,o1x:tx,o1y:ty,t:performance.now()};
  },
  centerOn(nNum, zoom){
    const n=this.nodes[nNum-1]; if(!n) return;
    const [tx,ty]=this.targetXY(n);
    const ts=zoom||Math.max(this.fitScale*3.2, 0.9);
    this._va={s0:this.scale,o0x:this.ox,o0y:this.oy,
      s1:ts, o1x:this.W/2 - tx*ts, o1y:this.H*0.5 - ty*ts, t:performance.now()};
  },

  worldToScreen(x,y){ return [x*this.scale+this.ox, y*this.scale+this.oy]; },
  screenToWorld(sx,sy){ return [(sx-this.ox)/this.scale, (sy-this.oy)/this.scale]; },

  // ---------- events ----------
  bindEvents(){
    const c=this.canvas;
    c.addEventListener('mousedown',e=>{
      this.drag={x:e.clientX,y:e.clientY,ox:this.ox,oy:this.oy,moved:false};
      c.classList.add('grabbing');
    });
    window.addEventListener('mousemove',e=>{
      if(this.drag){
        const dx=e.clientX-this.drag.x, dy=e.clientY-this.drag.y;
        if(Math.abs(dx)+Math.abs(dy)>3) this.drag.moved=true;
        this.ox=this.drag.ox+dx; this.oy=this.drag.oy+dy;
      } else {
        const r=c.getBoundingClientRect();
        this.pointer={x:e.clientX-r.left, y:e.clientY-r.top};
        this.updateHover();
      }
    });
    window.addEventListener('mouseup',e=>{
      if(this.drag){
        if(!this.drag.moved){ this.handleClick(); }
        this.drag=null; c.classList.remove('grabbing');
      }
    });
    c.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=c.getBoundingClientRect();
      const mx=e.clientX-r.left, my=e.clientY-r.top;
      const [wx,wy]=this.screenToWorld(mx,my);
      const f=Math.pow(1.0015, -e.deltaY);
      this.scale=Math.max(this.fitScale*0.55, Math.min(this.fitScale*14, this.scale*f));
      this.ox=mx-wx*this.scale; this.oy=my-wy*this.scale;
      this._va=null;
    },{passive:false});
    c.addEventListener('mouseleave',()=>{ this.pointer=null; this.setHover(null); });
  },

  hitTest(){
    if(!this.pointer) return null;
    let best=null, bd=22*22;
    for(const n of this.nodes){
      if(this._dim(n)) continue;
      const [sx,sy]=this.worldToScreen(n.x,n.y);
      if(sx<-30||sy<-30||sx>this.W+30||sy>this.H+30) continue;
      const dx=sx-this.pointer.x, dy=sy-this.pointer.y;
      const d=dx*dx+dy*dy;
      if(d<bd){bd=d; best=n;}
    }
    return best;
  },
  updateHover(){ const h=this.hitTest(); this.setHover(h?h.d.n:null);
    this.canvas.classList.toggle('over-node', !!h); },
  handleClick(){ const h=this.hitTest(); if(h){ this.select(h.d.n); } },

  _dim(n){
    const f=this.filter;
    if(f.theme && n.d.primaryTheme!==f.theme) return true;
    if(f.avatar && !n.d.avatars.includes(f.avatar)) return true;
    return false;
  },

  resize(){
    this.dpr=Math.min(window.devicePixelRatio||1, 2);
    this.W=window.innerWidth;
    this.H=window.innerHeight;
    this.canvas.style.width=this.W+'px'; this.canvas.style.height=this.H+'px';
    this.canvas.width=this.W*this.dpr; this.canvas.height=this.H*this.dpr;
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    // keep field roughly centered if no view anim
    if(this.fitScale){ /* recompute fit but preserve user pan loosely */ }
  },

  glow(color, size){
    const key=color+'_'+size;
    if(this.glowCache[key]) return this.glowCache[key];
    const s=size*2; const cv=document.createElement('canvas');
    cv.width=s; cv.height=s; const g=cv.getContext('2d');
    const grd=g.createRadialGradient(size,size,0,size,size,size);
    grd.addColorStop(0,color); grd.addColorStop(0.35,color);
    grd.addColorStop(0.6, this._fade(color,0.35));
    grd.addColorStop(1, this._fade(color,0));
    g.fillStyle=grd; g.beginPath(); g.arc(size,size,size,0,7); g.fill();
    this.glowCache[key]=cv; return cv;
  },
  _fade(hex,a){
    const c=hex.replace('#',''); const r=parseInt(c.substr(0,2),16),
      gg=parseInt(c.substr(2,2),16), b=parseInt(c.substr(4,2),16);
    return `rgba(${r},${gg},${b},${a})`;
  },

  frame(){
    const now=performance.now();
    const ctx=this.ctx;
    // view anim
    if(this._va){
      const k=Math.min(1,(now-this._va.t)/750); const e=easeOut(k);
      this.scale=lerp(this._va.s0,this._va.s1,e);
      this.ox=lerp(this._va.o0x,this._va.o1x,e);
      this.oy=lerp(this._va.o0y,this._va.o1y,e);
      if(k>=1) this._va=null;
    }
    // morph anim
    if(this.morphing){
      const k=Math.min(1,(now-this.morphStart)/950); this.morphT=easeOut(k);
      if(k>=1){this.morphing=false; this.morphT=1;}
    }
    // positions
    for(const n of this.nodes){
      const [tx,ty]=this.targetXY(n);
      if(this.morphing){ n.x=lerp(n.fx,tx,this.morphT); n.y=lerp(n.fy,ty,this.morphT); }
      else { n.x=tx; n.y=ty; }
    }
    if(this.pointer && !this.drag) this.updateHover();

    ctx.clearRect(0,0,this.W,this.H);
    const tsec=(now-this.t0)/1000;

    const focus = this.selected!=null ? this.selected : this.hover;
    const kin = focus!=null ? new Set(this.kinOf(focus)) : null;
    const anyFocus = focus!=null;

    // ----- sequence spiral (mandala + litany connection) -----
    if(this.layout==='mandala' && this.connection==='litany' && !anyFocus){
      ctx.save(); ctx.lineWidth=1; ctx.strokeStyle=this.accentRGBA(0.18);
      ctx.beginPath();
      for(let i=0;i<this.nodes.length;i++){
        const n=this.nodes[i]; const [sx,sy]=this.worldToScreen(n.x,n.y);
        if(i===0)ctx.moveTo(sx,sy); else ctx.lineTo(sx,sy);
      }
      ctx.stroke(); ctx.restore();
    }

    // ----- threads from focus to kin -----
    if(anyFocus && kin && this.connection!=='themes'){
      const fn=this.nodes[focus-1]; const [fx,fy]=this.worldToScreen(fn.x,fn.y);
      ctx.save(); ctx.lineWidth=1;
      kin.forEach(i=>{
        const m=this.nodes[i]; if(this._dim(m)) return;
        const [sx,sy]=this.worldToScreen(m.x,m.y);
        const grd=ctx.createLinearGradient(fx,fy,sx,sy);
        grd.addColorStop(0,this.accentRGBA(0.6));
        grd.addColorStop(1,this.accentRGBA(0.08));
        ctx.strokeStyle=grd; ctx.beginPath();
        ctx.moveTo(fx,fy);
        const mxp=(fx+sx)/2, myp=(fy+sy)/2;
        ctx.quadraticCurveTo(mxp,myp,sx,sy);
        ctx.stroke();
      });
      ctx.restore();
    }

    // ----- nodes -----
    ctx.globalCompositeOperation = this.mode==='night' ? 'lighter' : 'source-over';
    for(const n of this.nodes){
      const dim=this._dim(n);
      const [sx,sy]=this.worldToScreen(n.x,n.y);
      if(sx<-40||sy<-40||sx>this.W+40||sy>this.H+40) continue;
      const col=THEME_COLORS[n.d.primaryTheme][this.mode];
      const isFocus = n.d.n===focus;
      const isKin = kin && kin.has(n.i);
      const tw = (1-this.twinkleAmp) + this.twinkleAmp*Math.sin(tsec*n.tw*this.twinkleSpeed + n.phase);
      let r = (n.d.recurring?2.0:1.5) + this.scale*0.9;
      r=Math.min(r, 5.5);
      let alpha;
      if(dim){ alpha=0.06; }
      else if(anyFocus){ alpha = (isFocus||isKin) ? 1 : 0.14; }
      else { alpha = (0.55 + 0.45*tw); }
      if(isFocus) r*=2.6; else if(isKin) r*=1.5;

      ctx.globalAlpha=alpha;
      const sprite=this.glow(col, 22);
      const gr=r*4.2*this.glowMul;
      ctx.drawImage(sprite, sx-gr, sy-gr, gr*2, gr*2);
      // crisp core
      ctx.globalAlpha=Math.min(1,alpha+0.2);
      ctx.fillStyle = this.mode==='night' ? '#FFF7E8' : col;
      ctx.beginPath(); ctx.arc(sx,sy, Math.max(0.6,r*0.5),0,7); ctx.fill();
    }
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=1;

    // ----- labels -----
    this.drawLabels(focus, kin, anyFocus);

    requestAnimationFrame(()=>this.frame());
  },

  drawLabels(focus, kin, anyFocus){
    const ctx=this.ctx;
    const label=(n, big)=>{
      const [sx,sy]=this.worldToScreen(n.x,n.y);
      ctx.font = (big?'italic 600 17px ':'italic 500 13.5px ')+this.labelFont;
      const txt=n.d.name;
      const w=ctx.measureText(txt).width;
      const px=sx+ (big?12:9), py=sy+4;
      ctx.fillStyle = this.mode==='night'?'rgba(16,11,9,0.66)':'rgba(255,253,249,0.72)';
      ctx.fillRect(px-5, py-15, w+10, 21);
      ctx.fillStyle = this.mode==='night'?'#F3E9DA':'#2B1810';
      ctx.fillText(txt, px, py);
    };
    // high-zoom: label visible nodes
    if(this.scale > this.fitScale*4.2 && !anyFocus){
      let cnt=0;
      for(const n of this.nodes){
        if(this._dim(n)) continue;
        const [sx,sy]=this.worldToScreen(n.x,n.y);
        if(sx<0||sy<0||sx>this.W||sy>this.H) continue;
        if(cnt++>110) break;
        ctx.globalAlpha=Math.min(1,(this.scale/(this.fitScale*4.2)-1)*1.4);
        ctx.font="italic 500 12px "+this.labelFont;
        ctx.fillStyle=this.mode==='night'?'#C9B79C':'#6B3A20';
        ctx.fillText(n.d.name, sx+7, sy+4);
      }
      ctx.globalAlpha=1;
    }
    // focus + hover labels always
    if(this.hover!=null && this.hover!==this.selected){ ctx.globalAlpha=1; label(this.nodes[this.hover-1], false); }
    if(this.selected!=null){ ctx.globalAlpha=1; label(this.nodes[this.selected-1], true); }
    ctx.globalAlpha=1;
  },

  THEME_COLORS, // expose for chrome
};

window.Atlas=Atlas;
})();
