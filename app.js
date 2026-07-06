/* ============================================================
   Capturador de propiedades — Hauser / Inmobitera
   app.js  ·  v0.7 (Capturadora Hauser — Bloque 1: baños split, indivisos, cuota mant., comisión otra, trazabilidad META, historial solo-lectura)
   ============================================================ */
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};

/* ---------- config local ---------- */
var GAS_DEFAULT='https://script.google.com/macros/s/AKfycbwz6hm5MtyZdkaGXNpxi-AVJlCZvLntyMHGe055bsyrBubI862il09AR_CQmejfYu9p/exec';
var CFG=load('cfg',{resp:'Daniel',endpoint:GAS_DEFAULT});
if(!CFG.endpoint)CFG.endpoint=GAS_DEFAULT; // migrar instancias sin endpoint
function load(k,def){try{var v=localStorage.getItem('cap_'+k);return v?JSON.parse(v):def;}catch(e){return def;}}
function save(k,v){try{localStorage.setItem('cap_'+k,JSON.stringify(v));}catch(e){}}

/* ===================== TEMA (dark / light) ===================== */
(function(){
  function applyTheme(dark){
    document.documentElement.setAttribute('data-theme',dark?'dark':'light');
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=dark?'#1a1a1a':'#27a048';
    save('theme',dark?'dark':'light');
    // ícono = modo destino (🌙 para ir a dark, ☀️ para ir a light)
    var icon=dark?'☀️':'🌙';
    // #btnTheme en home (solo texto), #btnThemeNav en navbar (tiene <span class="ic">)
    [$('btnTheme'),$('btnThemeNav'),$('captureFabTheme')].forEach(function(b){
      if(!b)return;
      var ic=b.querySelector('.ic');
      if(ic)ic.textContent=icon;else b.textContent=icon;
    });
  }
  function doToggle(){applyTheme(document.documentElement.getAttribute('data-theme')!=='dark');}
  var saved=load('theme',null);
  applyTheme(saved==='dark'); // default: light si no hay preferencia guardada
  [$('btnTheme'),$('btnThemeNav'),$('captureFabTheme')].forEach(function(b){if(b)b.addEventListener('click',doToggle);});
  // FAB menú/salir de captura
  (function(){
    var modal=$('captureExitModal');
    function openExit(){modal.classList.add('show');}
    function closeExit(){modal.classList.remove('show');}
    function exitTo(view){closeExit();showView(view);}
    $('captureFabMenu').addEventListener('click',openExit);
    $('captureExitClose').addEventListener('click',closeExit);
    $('capExitCancel').addEventListener('click',closeExit);
    $('capExitHome').addEventListener('click',function(){exitTo('viewHome');});
    $('capExitHistory').addEventListener('click',function(){exitTo('viewHistory');});
    $('capExitHelp').addEventListener('click',function(){exitTo('viewHelp');});
    modal.addEventListener('click',function(e){if(e.target===modal)closeExit();});
  })();
})();

/* zonas conocidas: semilla + las que se agreguen/usen */
var ZONAS_SEED=['Lomas de Cortés','Rancho Tetela','Nueva Francia','Domingo Diez / Gayosso','Compositores','Lomas de Atzingo','Vista Hermosa','Tabachines','Burgos','Burgos Bugambilias','Sumiya','Real de Tetela','Acapantzingo','Delicias','Palmira'];
var zonasLocal=load('zonas',[]);
function zonasAll(){
  var map={};
  ZONAS_SEED.forEach(function(z){map[z]={n:z,uses:0};});
  zonasLocal.forEach(function(z){map[z.n]=z;});
  return Object.keys(map).map(function(k){return map[k];});
}
function zonaTouch(n){
  if(!n||n==='S/I')return;
  var found=zonasLocal.filter(function(z){return z.n===n;})[0];
  if(found){found.uses=(found.uses||0)+1;found.last=Date.now();}
  else zonasLocal.push({n:n,uses:1,last:Date.now(),nueva:ZONAS_SEED.indexOf(n)===-1});
  save('zonas',zonasLocal);
}
function addZonaToLocal(n){
  if(!n||n==='S/I')return;
  if(zonasAll().some(function(z){return z.n.toLowerCase()===n.toLowerCase();}))return;
  zonasLocal.push({n:n,uses:0,last:Date.now(),nueva:true});
  save('zonas',zonasLocal);
}

var state={tipo:'',oper:'Venta',ofrece:'',crm:'No',modo:'A · Reventa de lote',
  serv:[],caract:[],caractTerr:[],lat:null,lng:null,
  people:[],editId:null,rentaMin:''};

var hoy=new Date().toISOString().slice(0,10);
$('f_fecha').value=hoy;$('f_seguimiento').value=hoy;
$('f_resp').value=CFG.resp;
if(CFG.gasKey==null)CFG.gasKey='';
$('cfg_resp').value=CFG.resp;$('cfg_endpoint').value=CFG.endpoint;$('cfg_gaskey').value=CFG.gasKey;save('cfg',CFG);

/* ===================== NAVEGACIÓN ===================== */
// Un solo listener cubre navbar, tarjetas del menú y botones "← Menú"
document.addEventListener('click',function(e){
  var b=e.target.closest('button[data-view]');if(!b)return;
  showView(b.dataset.view);
});
function showView(id){
  var _prev=document.querySelector('.view.active');var _prevId=_prev?_prev.id:null;
  // 2c (v0.7.1): al SALIR de la captura hacia el menú/otra vista, guardar el
  // borrador (excepto al ir a viewResult tras generar, o si editas, o si el
  // prompt de continuar sigue abierto sin resolver → no tocar el borrador).
  if(_prevId==='viewCapture'&&id!=='viewCapture'&&id!=='viewResult'&&!state.editId&&!_draftPromptActive){
    saveDraft(qkOn);
  }
  if(_prevId==='viewCapture'&&id!=='viewCapture'&&_draftPromptActive){
    $('draftOverlay').classList.remove('show');_draftPromptActive=false;
  }
  // mascota: reset al salir de viewResult
  if(id!=='viewResult'){var vr=$('viewResult');if(vr&&vr.classList.contains('active')){id==='viewCapture'?updateTimerUI():setMascotState('idle');}}
  document.querySelectorAll('.view').forEach(function(v){v.classList.toggle('active',v.id===id);});
  document.querySelectorAll('#navbar button').forEach(function(b){b.classList.toggle('active',b.dataset.view===id);});
  document.body.classList.toggle('capture-active',id==='viewCapture');
  // v0.7 B6: entrada/salida del modo Captura Rápida
  // 1a (v0.7.1): CUALQUIER navegación que no entre al modo rápido garantiza
  // limpieza total (qkStop es idempotente) — cubre guardar/salir/editar/navegar
  if(id==='viewCapture'){
    var _wantsQuick=quickPending;quickPending=false;
    // 2c: si hay borrador y no estás editando, ofrecer continuar ANTES de arrancar
    if(!state.editId&&getDraft()&&!_draftPromptActive){
      _draftQuickWanted=_wantsQuick;
      setTimeout(showDraftPrompt,0);
    }else if(_wantsQuick){setTimeout(qkStart,0);}
  }
  else qkStop();
  // A1: el pase al modo rápido solo sobrevive el trayecto Home⚡→Asesor→Captura;
  // cualquier otra navegación lo cancela (evita contaminar la edición)
  if(id!=='viewCapture'&&id!=='viewAdvisor')quickPending=false;
  document.body.classList.toggle('contact-active',id==='viewContact');
  window.scrollTo(0,0);
  if(id==='viewHistory')renderHist();
  if(id==='viewConfig')renderCfgCount();
  if(id==='viewAdvisor')renderAsesorGrid();
  if(id==='viewLeaderboard')renderRanking();
  if(id==='viewContact'){renderCtHist();if(asesorActivo&&$('ct_asesor'))$('ct_asesor').value=asesorActivo.nombre||CFG.resp||'';initCtMascot();}
  if(id==='viewCapture')updateProgress();
  if(id==='viewHome')initHomeMascot();
}
var MASCOT_SRC={
  'idle':       './mascota/idle.mp4',
  'dancing':    './mascota/walking.mp4',
  'focused':    './mascota/jogging.mp4',
  'angry':      './mascota/running.mp4',
  'sad':        './mascota/sad.mp4',
  'expired':    './mascota/sad.mp4',
  'celebrating':'./mascota/celebrating.mp4'
};
// maps timer state name → canonical data-state for CSS brightness selectors
var MASCOT_STATE_KEY={
  'idle':'idle','dancing':'walking','focused':'jogging',
  'angry':'running','sad':'sad','expired':'sad','celebrating':'celebrating'
};
function _setMascotVideo(v,st){
  if(!v)return;
  var wasChroma=v.classList.contains('chroma-src');
  v.setAttribute('class','mascot state-'+st+(wasChroma?' chroma-src':''));
  var stateKey=MASCOT_STATE_KEY[st]||'idle';
  v.dataset.state=stateKey;
  var src=MASCOT_SRC[st]||MASCOT_SRC['idle'];
  if(v.dataset.mst!==st){
    v.dataset.mst=st;
    v.muted=true; // iOS requiere muted antes de play
    v.src=src;v.load();
    var p=v.play();if(p&&p.catch)p.catch(function(){});
  }
  attachChroma(v);
}

/* ===================== MASCOTA: CHROMA KEY CANVAS — v0.7 =====================
   Los MP4 traen fondo blanco/gris (no alpha). En vez de mix-blend-mode
   (parche v0.6), se renderiza el video en un canvas y se hace transparente
   SOLO el fondo conectado al borde (flood fill): la panza blanca de la casita
   queda protegida por su contorno oscuro. Si canvas falla (navegador raro,
   canvas tainted), se revierte solo al <video> visible de siempre. */
var CHROMA_OK=(function(){
  try{var c=document.createElement('canvas');return !!(c.getContext&&c.getContext('2d'));}
  catch(e){return false;}
})();
var _CHROMA_W=320,_CHROMA_H=320;
function attachChroma(v){
  if(!CHROMA_OK||!v||v.dataset.chroma==='1')return;
  var parent=v.parentNode;if(!parent)return;
  var cv=document.createElement('canvas');
  cv.className='mascot-canvas';cv.width=_CHROMA_W;cv.height=_CHROMA_H;
  var ctx=cv.getContext('2d',{willReadFrequently:true});
  if(!ctx)return;
  v.dataset.chroma='1';
  parent.classList.add('chroma-on');
  parent.insertBefore(cv,v.nextSibling);
  v.classList.add('chroma-src');
  var N=_CHROMA_W*_CHROMA_H;
  var fondo=new Uint8Array(N);      // píxel con color de fondo (blanco/gris claro)
  var pasable=new Uint8Array(N);    // fondo erosionado: cierra huecos finos del contorno
  var visited=new Uint8Array(N);    // región de fondo conectada al borde
  var tmp=new Uint8Array(N);
  var queue=new Int32Array(N);
  var W=_CHROMA_W,H=_CHROMA_H;
  function frame(){
    if(v.dataset.chroma!=='1')return; // desactivado por fallback
    if(v.readyState>=2&&!document.hidden&&v.offsetParent!==null){
      try{
        ctx.drawImage(v,0,0,W,H);
        var img=ctx.getImageData(0,0,W,H);
        var d=img.data;
        var x,y,i,j;
        // 1. máscara de color de fondo (blanco a gris claro, baja saturación)
        for(i=0;i<N;i++){
          var r=d[i*4],g=d[i*4+1],b=d[i*4+2];
          var mx=r>g?(r>b?r:b):(g>b?g:b);
          var mn=r<g?(r<b?r:b):(g<b?g:b);
          // umbral calibrado 02-jul: saturación ≤16 evita que el glow verde
          // pálido del teléfono haga puente entre fondo y cuerpo blanco
          fondo[i]=(mx>=200&&(mx-mn)<=16)?1:0;
        }
        // 2. erosión 3x3: solo es "pasable" el fondo rodeado de fondo — los
        //    huecos de 1-2 px del contorno (anti-alias) dejan de ser puente
        for(y=0;y<H;y++)for(x=0;x<W;x++){
          i=y*W+x;
          if(!fondo[i]){pasable[i]=0;continue;}
          var ok=1;
          if(x>0&&!fondo[i-1])ok=0;
          else if(x<W-1&&!fondo[i+1])ok=0;
          else if(y>0&&!fondo[i-W])ok=0;
          else if(y<H-1&&!fondo[i+W])ok=0;
          else if(x>0&&y>0&&!fondo[i-W-1])ok=0;
          else if(x<W-1&&y>0&&!fondo[i-W+1])ok=0;
          else if(x>0&&y<H-1&&!fondo[i+W-1])ok=0;
          else if(x<W-1&&y<H-1&&!fondo[i+W+1])ok=0;
          pasable[i]=ok;
        }
        // 3. flood fill desde los 4 bordes sobre la máscara erosionada
        visited.fill(0);
        var qh=0,qt=0;
        for(x=0;x<W;x++){
          i=x;if(pasable[i]&&!visited[i]){visited[i]=1;queue[qt++]=i;}
          i=(H-1)*W+x;if(pasable[i]&&!visited[i]){visited[i]=1;queue[qt++]=i;}
        }
        for(y=0;y<H;y++){
          i=y*W;if(pasable[i]&&!visited[i]){visited[i]=1;queue[qt++]=i;}
          i=y*W+(W-1);if(pasable[i]&&!visited[i]){visited[i]=1;queue[qt++]=i;}
        }
        while(qh<qt){
          i=queue[qh++];
          x=i%W;y=(i-x)/W;
          if(x>0&&!visited[i-1]&&pasable[i-1]){visited[i-1]=1;queue[qt++]=i-1;}
          if(x<W-1&&!visited[i+1]&&pasable[i+1]){visited[i+1]=1;queue[qt++]=i+1;}
          if(y>0&&!visited[i-W]&&pasable[i-W]){visited[i-W]=1;queue[qt++]=i-W;}
          if(y<H-1&&!visited[i+W]&&pasable[i+W]){visited[i+W]=1;queue[qt++]=i+W;}
        }
        // 4. dilatar 2 px el resultado SOLO sobre píxeles de fondo: recupera el
        //    anillo erosionado pegado al contorno y evita el halo blanco
        for(j=0;j<2;j++){
          tmp.set(visited);
          for(y=0;y<H;y++)for(x=0;x<W;x++){
            i=y*W+x;
            if(visited[i]||!fondo[i])continue;
            if((x>0&&tmp[i-1])||(x<W-1&&tmp[i+1])||(y>0&&tmp[i-W])||(y<H-1&&tmp[i+W]))visited[i]=1;
          }
        }
        // 5. transparencia
        for(i=0;i<N;i++)if(visited[i])d[i*4+3]=0;
        ctx.putImageData(img,0,0);
      }catch(e){
        // fallback: quitar canvas (sin listeners) y mostrar el video normal
        v.dataset.chroma='0';
        parent.classList.remove('chroma-on');
        v.classList.remove('chroma-src');
        if(cv.parentNode)cv.parentNode.removeChild(cv);
        return;
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
/* iOS: autoplay de video requiere un gesto previo — al primer toque/click se
   (re)arrancan todas las mascotas visibles. */
var _mascotUnlocked=false;
function _unlockMascots(){
  if(_mascotUnlocked)return;_mascotUnlocked=true;
  document.querySelectorAll('video.mascot').forEach(function(v){
    v.muted=true;var p=v.play();if(p&&p.catch)p.catch(function(){});
  });
}
document.addEventListener('touchstart',_unlockMascots,{once:true,passive:true});
document.addEventListener('click',_unlockMascots,{once:true});
function initHomeMascot(){
  var wrap=$('homeMascotWrap');if(!wrap||wrap.hasChildNodes())return;
  var v=document.createElement('video');
  v.autoplay=true;v.loop=true;v.muted=true;
  v.setAttribute('playsinline','');
  v.setAttribute('preload','auto');
  v.className='mascot state-idle';
  v.style.cssText='width:100%;height:100%;object-fit:contain';
  v.dataset.mst='idle';v.dataset.state='idle';
  v.src='./mascota/idle.mp4';
  wrap.appendChild(v);
  v.muted=true;
  var p=v.play();if(p&&p.catch)p.catch(function(){});
  attachChroma(v);
}

/* ===================== MASCOTA EN CAPTURA DE CONTACTO ===================== */
var CT_MASCOT_CYCLE=['idle','dancing','focused','angry','sad','celebrating'];
var ctMascotIdx=0;
var ctMascotEl=null;
function initCtMascot(){
  var wrap=$('ctMascotFloat');if(!wrap)return;
  if(!ctMascotEl){
    var v=document.createElement('video');
    v.autoplay=true;v.loop=true;v.muted=true;
    v.setAttribute('playsinline','');v.setAttribute('preload','auto');
    v.style.cssText='width:100%;height:100%;object-fit:contain';
    ctMascotEl=v;
    wrap.appendChild(v);
    wrap.addEventListener('click',function(){
      ctMascotIdx=(ctMascotIdx+1)%CT_MASCOT_CYCLE.length;
      _setMascotVideo(ctMascotEl,CT_MASCOT_CYCLE[ctMascotIdx]);
    });
  }
  ctMascotIdx=0;
  _setMascotVideo(ctMascotEl,'idle');
}

/* ===================== MÓDULO DE ASESORES ===================== */
var ASESORES_SEED=[
  {id:'as_daniel',nombre:'Daniel'},
  {id:'as_erica',nombre:'Erica'},
  {id:'as_carlos',nombre:'Carlos'},
  {id:'as_gabriel',nombre:'Gabriel'}
];
var asesoresLocal=(function(){
  var s=load('asesores',null);if(!s){save('asesores',ASESORES_SEED);return ASESORES_SEED;}
  return s;
})();
var asesorActivo=load('asesor_activo',null);

function getAsesores(){return load('asesores',ASESORES_SEED);}
function saveAsesores(arr){asesoresLocal=arr;save('asesores',arr);}

function poblarSelectResp(){
  var lista=getAsesores();
  ['f_resp','cfg_resp'].forEach(function(sid){
    var sel=$(sid);if(!sel)return;
    var cur=sel.value;sel.innerHTML='';
    lista.forEach(function(a){
      var opt=document.createElement('option');opt.value=a.nombre;opt.textContent=a.nombre;sel.appendChild(opt);
    });
    if(cur&&Array.prototype.some.call(sel.options,function(o){return o.value===cur;}))sel.value=cur;
  });
}

function syncAsesor(){
  if(!asesorActivo)return;
  poblarSelectResp();
  $('f_resp').value=asesorActivo.nombre;
  if($('cfg_resp'))$('cfg_resp').value=asesorActivo.nombre;
  CFG.resp=asesorActivo.nombre;save('cfg',CFG);
  var badge=$('asesorBadge');
  if(badge)badge.textContent='👤 '+asesorActivo.nombre;
}

poblarSelectResp();
if(asesorActivo)syncAsesor();

function renderAsesorGrid(){
  var grid=$('asesorGrid');if(!grid)return;
  grid.innerHTML='';
  var lista=getAsesores();
  lista.forEach(function(a){
    var card=document.createElement('button');card.type='button';card.className='home-card';
    if(asesorActivo&&asesorActivo.id===a.id)card.classList.add('asesor-sel');
    var init=a.nombre.split(' ').map(function(p){return p[0];}).join('').toUpperCase().slice(0,2);
    card.innerHTML='<span class="asesor-avatar">'+init+'</span><span class="home-label">'+a.nombre+'</span>';
    card.addEventListener('click',function(){
      asesorActivo=a;save('asesor_activo',a);
      grid.querySelectorAll('.home-card').forEach(function(c){c.classList.remove('asesor-sel');});
      card.classList.add('asesor-sel');
      $('btnEmpezarCaptura').disabled=false;
      syncAsesor();
    });
    grid.appendChild(card);
  });
  $('btnEmpezarCaptura').disabled=!asesorActivo;
}
$('btnEmpezarCaptura').addEventListener('click',function(){resetTimerToReady();showView('viewCapture');});
$('btnAgregarAsesor').addEventListener('click',function(){
  var nombre=prompt('Nombre del nuevo asesor:');
  if(!nombre||!nombre.trim())return;
  nombre=nombre.trim();
  var lista=getAsesores();
  if(lista.some(function(a){return a.nombre.toLowerCase()===nombre.toLowerCase();})){
    alert('Ya existe un asesor con ese nombre.');return;
  }
  var nuevo={id:'as'+Date.now(),nombre:nombre};
  lista.push(nuevo);saveAsesores(lista);
  asesorActivo=nuevo;save('asesor_activo',nuevo);
  renderAsesorGrid();syncAsesor();
  $('btnEmpezarCaptura').disabled=false;
});

/* ===================== MÓDULO DE TEMPORIZADOR + MASCOTA ===================== */
var TIMER_C=2*Math.PI*54;           // circunferencia anillo SVG (r=54) = 339.29
var timerLimit=load('cfg_timer_limit',600);
var timerState='ready';             // 'ready'|'running'|'paused'|'expired'
var timerRemaining=timerLimit;
var timerElapsed=0;
var timerInterval=null;
var timerStartedAt=null;
var timerWasPaused=false;
var timerPauseCount=0;
// tiempo real desde inicio de captura (ignora pausas del contador visual)
function realElapsed(){return timerStartedAt?Math.round((Date.now()-timerStartedAt)/1000):timerElapsed;}

function timerFmt(s){
  var m=Math.floor(s/60),sc=s%60;
  return(m<10?'0':'')+m+':'+(sc<10?'0':'')+sc;
}
function setTimerArc(rem,lim){
  var arc=$('timerArc');if(!arc)return;
  var pct=lim>0?rem/lim:0;
  arc.style.strokeDashoffset=TIMER_C*(1-Math.max(0,Math.min(1,pct)));
}
function setMascotState(st){_setMascotVideo($('mascotSvg'),st);}
function setResMascotState(st){_setMascotVideo($('resMascotSvg'),st);}
function updateTimerUI(){
  var d=$('timerDisplay');if(d)d.textContent=timerFmt(timerRemaining);
  setTimerArc(timerRemaining,timerLimit);
  // 2a (v0.7.1): barra de progreso del modo rápido (se rellena con lo transcurrido)
  var qf=$('qkTimerFill');
  if(qf){var pf=timerLimit>0?timerElapsed/timerLimit:0;qf.style.width=(Math.max(0,Math.min(1,pf))*100)+'%';}
  var qt=$('qkTimerTxt');if(qt)qt.textContent=timerFmt(timerRemaining);
  var ts;
  if(timerState==='ready'){ts='ready';}
  else if(timerState==='expired'){ts='expired';}
  else if(timerRemaining>300){ts='happy';}
  else if(timerRemaining>120){ts='focused';}
  else{ts='urgent';}
  // Sonidos en transiciones de estado del temporizador
  if(timerState==='running'){
    if(ts==='focused'&&_timerAudioTs==='happy')sndStep();
    else if(ts==='urgent'&&_timerAudioTs==='focused')sndUrgent();
  }
  if(timerState==='expired'&&_timerAudioTs!=='expired')sndTimeout();
  if(ts!=='ready')_timerAudioTs=ts;else _timerAudioTs='ready';
  var w=$('timerWidget');
  if(w){
    w.className='timer-widget'+(timerState!=='ready'?' running':'')+(timerState==='paused'?' paused':'');
    if(ts!=='ready')w.classList.add('state-'+ts);
  }
  var MSGS={
    happy:'Vas bien. 💪',
    focused:'Quedan 5 min o menos. ⚡',
    urgent:'¡Últimos 2 minutos! 🔥',
    expired:'Tiempo agotado — igualmente puedes terminar.'
  };
  var msgEl=$('timerMsg');if(msgEl&&ts!=='ready')msgEl.textContent=MSGS[ts]||'';
  var MAS={ready:'idle',happy:'dancing',focused:'focused',urgent:'angry',expired:'sad'};
  setMascotState(MAS[ts]||'idle');
}
function startTimer(){
  if(timerState==='running')return;
  timerState='running';timerRemaining=timerLimit;timerElapsed=0;
  timerStartedAt=Date.now();timerWasPaused=false;timerPauseCount=0;
  _timerAudioTs='happy';sndStep();
  var rw=$('timerRingWrap');if(rw)rw.style.display='flex';
  var rc=$('timerRunningCtrl');if(rc)rc.style.display='';
  var rd=$('timerReadyCtrl');if(rd)rd.style.display='none';
  var pb=$('btnPausarTimer');if(pb)pb.textContent='⏸ Pausar';
  updateTimerUI();
  timerInterval=setInterval(function(){
    if(timerState!=='running')return;
    timerElapsed++;timerRemaining=Math.max(0,timerLimit-timerElapsed);
    updateTimerUI();
    if(timerRemaining===0){timerState='expired';clearInterval(timerInterval);timerInterval=null;updateTimerUI();}
  },1000);
}
function pauseTimer(){
  if(timerState!=='running')return;
  timerState='paused';timerWasPaused=true;timerPauseCount++;
  clearInterval(timerInterval);timerInterval=null;
  var pb=$('btnPausarTimer');if(pb)pb.textContent='▶ Reanudar';
  updateTimerUI();
}
function resumeTimer(){
  if(timerState!=='paused')return;
  timerState='running';
  timerInterval=setInterval(function(){
    if(timerState!=='running')return;
    timerElapsed++;timerRemaining=Math.max(0,timerLimit-timerElapsed);
    updateTimerUI();
    if(timerRemaining===0){timerState='expired';clearInterval(timerInterval);timerInterval=null;updateTimerUI();}
  },1000);
  var pb=$('btnPausarTimer');if(pb)pb.textContent='⏸ Pausar';
  updateTimerUI();
}
function resetTimerToReady(){
  clearInterval(timerInterval);timerInterval=null;
  timerState='ready';timerRemaining=timerLimit;timerElapsed=0;
  timerWasPaused=false;timerPauseCount=0;
  var rw=$('timerRingWrap');if(rw)rw.style.display='none';
  var rc=$('timerRunningCtrl');if(rc)rc.style.display='none';
  var rd=$('timerReadyCtrl');if(rd)rd.style.display='';
  var w=$('timerWidget');if(w)w.className='timer-widget';
  var d=$('timerDisplay');if(d)d.textContent=timerFmt(timerLimit);
  setTimerArc(1,1);
  _timerAudioTs='ready';
  setMascotState('idle');
}
// inicializar display y chip según preferencia guardada
(function(){
  var d=$('timerDisplay');if(d)d.textContent=timerFmt(timerLimit);
  var savedMin=timerLimit/60;
  var tc=$('timeChips');if(!tc)return;
  tc.querySelectorAll('.chip').forEach(function(c){
    c.classList.toggle('sel',parseInt(c.dataset.min)===savedMin);
  });
})();
$('timeChips').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c||!c.dataset.min)return;
  this.querySelectorAll('.chip').forEach(function(x){x.classList.remove('sel');});
  c.classList.add('sel');
  timerLimit=parseInt(c.dataset.min)*60;
  save('cfg_timer_limit',timerLimit);
  if(timerState==='ready'){var d=$('timerDisplay');if(d)d.textContent=timerFmt(timerLimit);}
});
$('btnIniciarCaptura').addEventListener('click',function(){
  startTimer();
  window.scrollTo({top:0,behavior:'smooth'});
});
$('btnPausarTimer').addEventListener('click',function(e){
  e.stopPropagation();
  if(timerState==='running')pauseTimer();
  else if(timerState==='paused')resumeTimer();
});
// 5.3 — Tap en el widget fijo pausa/reanuda (stopPropagation evita doble disparo con autoStartTimer)
$('timerWidget').addEventListener('click',function(e){
  e.stopPropagation();
  if(timerState==='running')pauseTimer();
  else if(timerState==='paused')resumeTimer();
});
// 5.2 — Auto-start en primer input; 5.3b — auto-resume si estaba pausado al tocar un campo
function autoStartTimer(){
  if(timerState==='ready')startTimer();
  else if(timerState==='paused')resumeTimer();
}
['input','change','click'].forEach(function(ev){
  $('viewCapture').addEventListener(ev,autoStartTimer,{passive:true});
});

/* ===================== MÓDULO DE SONIDOS — FASE 4 ===================== */
var sndCfg=load('cfg_sounds',{on:true,vol:0.6});
var _audioCtx=null;
var _timerAudioTs='ready';

function _getAudioCtx(){
  if(!_audioCtx){try{_audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){return null;}}
  if(_audioCtx.state==='suspended')_audioCtx.resume();
  return _audioCtx;
}
function _tone(freq,dur,type,vol,at){
  var ctx=_getAudioCtx();if(!ctx)return;
  var t=at!=null?at:ctx.currentTime;
  var v=Math.max(0.001,Math.min(1,(vol!=null?vol:1)*sndCfg.vol));
  var osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.connect(gain);gain.connect(ctx.destination);
  osc.type=type||'sine';
  osc.frequency.setValueAtTime(freq,t);
  gain.gain.setValueAtTime(v,t);
  gain.gain.exponentialRampToValueAtTime(0.001,t+dur);
  osc.start(t);osc.stop(t+dur+0.02);
}
function sndClick(){if(!sndCfg.on)return;_tone(660,0.06,'sine',0.4);}
function sndChip(){if(!sndCfg.on)return;_tone(880,0.05,'sine',0.35);}
function sndStep(){
  if(!sndCfg.on)return;var ctx=_getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;_tone(523,0.09,'sine',0.5,t);_tone(784,0.12,'sine',0.55,t+0.07);
}
function sndError(){
  if(!sndCfg.on)return;var ctx=_getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;_tone(280,0.12,'sawtooth',0.28,t);_tone(220,0.18,'sawtooth',0.28,t+0.1);
}
function sndStar(){
  if(!sndCfg.on)return;var ctx=_getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;
  [523,659,784,1047].forEach(function(f,i){_tone(f,i<3?0.07:0.15,'sine',0.6,t+i*0.065);});
}
function sndSuccess(){
  if(!sndCfg.on)return;var ctx=_getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;
  [523,659,784,1047,784,1047].forEach(function(f,i){_tone(f,i<5?0.08:0.28,'sine',0.65,t+i*0.075);});
}
function sndTimeout(){
  if(!sndCfg.on)return;var ctx=_getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;
  [440,330,220].forEach(function(f,i){_tone(f,i<2?0.15:0.28,'triangle',0.5,t+i*0.13);});
}
function sndUrgent(){
  if(!sndCfg.on)return;var ctx=_getAudioCtx();if(!ctx)return;
  var t=ctx.currentTime;_tone(330,0.07,'square',0.2,t);_tone(330,0.07,'square',0.2,t+0.1);
}
// Hooks globales: chip → sndChip, botones/tarjetas → sndClick
document.addEventListener('click',function(e){
  if(!sndCfg.on)return;
  if(e.target.closest('.chip')){sndChip();return;}
  var b=e.target.closest('.btn,.home-card,.btn-back,.close-x');
  if(b&&!b.disabled&&!b.hasAttribute('disabled'))sndClick();
});

/* ===================== CHIPS ===================== */
function bindChips(gid,key,cb){
  var el=$(gid);if(!el)return;
  el.addEventListener('click',function(e){
    var c=e.target.closest('.chip');if(!c)return;
    el.querySelectorAll('.chip').forEach(function(x){x.classList.remove('sel');});
    c.classList.add('sel');state[key]=c.dataset.v;
    if(cb)cb(c.dataset.v);updateProgress();
  });
}
function setChip(gid,key,val,cb){
  var found=null;
  $(gid).querySelectorAll('.chip').forEach(function(x){
    x.classList.toggle('sel',x.dataset.v===val);
    if(x.dataset.v===val)found=x;
  });
  if(found){state[key]=val;if(cb)cb(val);}
}
function onTipo(v){
  var t=(v==='Terreno');
  document.querySelectorAll('[data-construccion]').forEach(function(el){el.style.display=t?'none':'';});
  $('terrenoExtra').style.display=t?'':'none';
  buildCaract();refreshUnits();
}
function onOper(v){
  var venta=(v==='Venta'||v==='Venta y Renta');
  var renta=(v==='Renta'||v==='Venta y Renta');
  var soloRenta=(v==='Renta');
  $('rowPrecioVenta').style.display=venta?'':'none';
  $('rowPrecioRenta').style.display=renta?'':'none';
  $('rowRentaMin').style.display=renta?'':'none';
  $('rowComisionVenta').style.display=venta?'':'none';
  $('rowComisionRenta').style.display=renta?'':'none';
  if(soloRenta&&!naOn('f_m2t')&&!siOn('f_m2t')&&!$('f_m2t').value.trim()){setNaState('f_m2t',true);_m2tAutoNA=true;}
  else if(!soloRenta&&_m2tAutoNA){setNaState('f_m2t',false);_m2tAutoNA=false;}
  autoFillComisionRenta();
}
bindChips('tipoChips','tipo',onTipo);
bindChips('operChips','oper',onOper);
bindChips('ofreceChips','ofrece',onOfrece);
bindChips('crmChips','crm',function(v){renderCRM();});
bindChips('modoChips','modo');
bindChips('rentaMinChips','rentaMin');

/* servicios multi-select */
$('servChips').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  c.classList.toggle('sel');var v=c.dataset.v;
  if(c.classList.contains('sel'))state.serv.push(v);
  else state.serv=state.serv.filter(function(x){return x!==v;});
  updateProgress();
});

/* ===================== ¿QUIÉN OFRECE? → CRM ===================== */
function onOfrece(v){
  var roleMap={
    'Propietario directo':'Propietario (B)',
    'Asesor / broker':'Asesor inmobiliario',
    'Socio inmobiliario':'Proveedor',
    'Desarrollador':'Proveedor',
    'Referido':'Referido'
  };
  state.people=state.people.filter(function(p){return !(p.auto&&!p.touched);});
  if(roleMap[v]){
    state.people.unshift({id:'p'+Date.now(),nombre:'',tipos:[roleMap[v]],tel:'',auto:true,touched:false});
  }
  renderCRM();
}

/* ===================== CRM dinámico ===================== */
var TIPOS_CONTACTO=['Propietario (B)','Comprador (A)','Inversionista','Arrendatario','Asesor inmobiliario','Portero','Admin','Proveedor','Referido'];
var ETAPAS_LEAD=['Nuevo','Contactado','Calificado','En seguimiento','Cliente activo','Cerrado/Ganado','Perdido'];
var FUENTES_CT=['Portal','Redes sociales','Recorrido/Scouteo','Referido','Lona/Cartel','WhatsApp','Llamada','Imprenta','Asesor inmobiliario','Amistad'];
var TEMPS_CT=['🔥 Caliente','🌤️ Tibio','❄️ Frío'];
function personTipos(p){return p.tipos&&p.tipos.length?p.tipos:(p.rol?[p.rol]:[]);}
function personEsComprador(p){var t=personTipos(p);return t.some(function(x){return /Comprador|Inversionista/.test(x);});}
function renderCRM(){
  var wrap=$('crmCards');wrap.innerHTML='';
  if(state.crm==='Sí'&&!state.people.some(personEsComprador)){
    state.people.push({id:'pc'+Date.now(),nombre:'',tipos:['Comprador (A)'],tel:'',auto:true,touched:false});
  }
  state.people.forEach(function(p){
    var card=document.createElement('div');card.className='person-card';
    var dataState=(p.nombre||p.tel)?'ok':'';
    var stTxt=(p.nombre||p.tel)?'Datos capturados':'Faltan datos';
    var rolStr=personTipos(p).join(' · ')||'S/I';
    card.innerHTML='<div class="pc-top"><div><div class="pc-name">'+(p.nombre||'(sin nombre)')+'</div>'+
      '<div class="pc-role">'+esc(rolStr)+(p.tel?(' · '+p.tel):'')+'</div></div>'+
      '<span class="pc-state '+dataState+'">'+stTxt+'</span></div>'+
      '<div class="btn-row"><button type="button" class="btn chip-sm" data-edit="'+p.id+'">Completar datos</button>'+
      '<button type="button" class="btn chip-sm btn-danger" data-del="'+p.id+'">Quitar</button></div>';
    wrap.appendChild(card);
  });
  var add=document.createElement('button');
  add.type='button';add.className='btn chip-sm';add.textContent='+ Agregar persona';
  add.style.marginTop='12px';
  add.addEventListener('click',function(){openPerson(null);});
  wrap.appendChild(add);
}
$('crmCards').addEventListener('click',function(e){
  var ed=e.target.closest('[data-edit]');var dl=e.target.closest('[data-del]');
  if(ed)openPerson(ed.dataset.edit);
  if(dl){state.people=state.people.filter(function(p){return p.id!==dl.dataset.del;});renderCRM();}
});

function openPerson(id){
  var p=id?state.people.filter(function(x){return x.id===id;})[0]:null;
  var isNew=!p;
  var today=new Date().toISOString().split('T')[0];
  if(isNew)p={id:'p'+Date.now(),tipos:[]};
  var tiposArr=(p.tipos&&p.tipos.length?p.tipos:(p.rol?[p.rol]:[])).slice();
  var zonaIntArr=(Array.isArray(p.zonaInt)?p.zonaInt:(p.zonaInt?[p.zonaInt]:[])).slice();
  var zonaOpArr=(Array.isArray(p.zonaOp)?p.zonaOp:(p.zonaOp?[p.zonaOp]:[])).slice();
  state.editId=p.id;state._editIsNew=isNew;
  state._editTmp=Object.assign({},p,{tipos:tiposArr,zonaIntArr:zonaIntArr,zonaOpArr:zonaOpArr});
  $('personTitle').textContent=p.nombre?('Datos de '+p.nombre):'Completar datos';

  var showPresup=tiposArr.some(function(t){return /Comprador|Inversionista/.test(t);});
  var tiposChips=TIPOS_CONTACTO.map(function(t){
    return '<button type="button" class="chip chip-sm'+(tiposArr.indexOf(t)>=0?' sel':'')+'" data-tipo="'+esc(t)+'">'+esc(t)+'</button>';
  }).join('');
  var zonaIntChips=zonasAll().sort(function(a,b){return(b.uses||0)-(a.uses||0);}).map(function(z){
    return '<button type="button" class="chip chip-sm'+(zonaIntArr.indexOf(z.n)>=0?' sel':'')+'" data-zint="'+esc(z.n)+'">'+esc(z.n)+'</button>';
  }).join('');
  var zonaOpChips=zonasAll().sort(function(a,b){return(b.uses||0)-(a.uses||0);}).map(function(z){
    return '<button type="button" class="chip chip-sm'+(zonaOpArr.indexOf(z.n)>=0?' sel':'')+'" data-zop="'+esc(z.n)+'">'+esc(z.n)+'</button>';
  }).join('');

  var html=
    '<div class="field"><div class="field-top"><label>Nombre</label></div>'+
    '<input type="text" id="pf_nombre" value="'+esc(p.nombre||'')+'"></div>'+
    '<div class="field"><div class="field-top"><label>Teléfono</label></div>'+
    '<input type="tel" id="pf_tel" value="'+esc(p.tel||'')+'"></div>'+
    '<div class="field"><div class="field-top"><label>WhatsApp</label></div>'+
    '<input type="tel" id="pf_wa" value="'+esc(p.wa!=null?p.wa:(p.tel||''))+'"></div>'+
    '<div class="field"><div class="field-top"><label>Email</label></div>'+
    '<input type="email" id="pf_email" value="'+esc(p.email||'')+'"></div>'+
    '<div class="field"><div class="field-top"><label>Empresa</label></div>'+
    '<input type="text" id="pf_empresa" value="'+esc(p.empresa||'')+'"></div>'+
    '<div class="field"><div class="field-top"><label>Tipo de contacto</label></div>'+
    '<div id="pf_tiposChips" class="chips-wrap">'+tiposChips+'</div></div>'+
    '<div class="field"><div class="field-top"><label>Etapa del lead</label></div>'+
    '<select id="pf_etapa">'+ETAPAS_LEAD.map(function(o){return '<option'+(( p.etapa||'Nuevo')===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></div>'+
    '<div class="field"><div class="field-top"><label>Fuente</label></div>'+
    '<select id="pf_fuente"><option value="">S/I</option>'+FUENTES_CT.map(function(o){return '<option'+(p.fuente===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></div>'+
    '<div class="field"><div class="field-top"><label>Temperatura</label></div>'+
    '<select id="pf_temp"><option value="">S/I</option>'+TEMPS_CT.map(function(o){return '<option'+(p.temp===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></div>'+
    '<div class="field" id="pf_presupWrap" style="display:'+(showPresup?'':'none')+'"><div class="field-top"><label>Presupuesto (MX$)</label></div>'+
    '<input type="number" id="pf_presup" value="'+esc(p.presupuesto||'')+'"></div>'+
    '<div class="field"><div class="field-top"><label>Zona de interés</label></div>'+
    '<div id="pf_zonaIntChips" class="chips-wrap">'+zonaIntChips+'</div>'+
    '<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><input type="text" id="pf_zonaIntExtra" placeholder="Otra zona..." style="flex:1;margin:0"><button type="button" class="btn chip-sm btn-accent" id="pf_btnZonaInt" style="flex-shrink:0;padding:10px 14px">+</button></div></div>'+
    '<div class="field"><div class="field-top"><label>Zona de operación</label></div>'+
    '<div id="pf_zonaOpChips" class="chips-wrap">'+zonaOpChips+'</div>'+
    '<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><input type="text" id="pf_zonaOpExtra" placeholder="Otra zona..." style="flex:1;margin:0"><button type="button" class="btn chip-sm btn-accent" id="pf_btnZonaOp" style="flex-shrink:0;padding:10px 14px">+</button></div></div>'+
    '<div class="field"><div class="field-top"><label>Notas</label></div>'+
    '<textarea id="pf_notas">'+esc(p.notas||'')+'</textarea></div>'+
    '<div class="field"><div class="field-top"><label>Fecha de seguimiento</label></div>'+
    '<input type="date" id="pf_fechaSeg" value="'+(p.fechaSeg||today)+'"></div>';

  $('personBody').innerHTML=html;

  // Teléfono → WhatsApp autofill (one-way: only while wa matches tel)
  var telEl=$('pf_tel'),waEl=$('pf_wa');
  var _lastTel=telEl.value;
  telEl.addEventListener('input',function(){
    if(waEl.value===_lastTel)waEl.value=telEl.value;
    _lastTel=telEl.value;
  });

  // Tipo de contacto chips
  $('pf_tiposChips').addEventListener('click',function(e){
    var c=e.target.closest('[data-tipo]');if(!c)return;
    c.classList.toggle('sel');
    var t=c.dataset.tipo,arr=state._editTmp.tipos,idx=arr.indexOf(t);
    if(idx>=0)arr.splice(idx,1);else arr.push(t);
    var sp=arr.some(function(x){return /Comprador|Inversionista/.test(x);});
    $('pf_presupWrap').style.display=sp?'':'none';
  });

  // Zona de interés chips
  $('pf_zonaIntChips').addEventListener('click',function(e){
    var c=e.target.closest('[data-zint]');if(!c)return;
    c.classList.toggle('sel');
    var v=c.dataset.zint,arr=state._editTmp.zonaIntArr,idx=arr.indexOf(v);
    if(idx>=0)arr.splice(idx,1);else arr.push(v);
  });

  // Zona de operación chips
  $('pf_zonaOpChips').addEventListener('click',function(e){
    var c=e.target.closest('[data-zop]');if(!c)return;
    c.classList.toggle('sel');
    var v=c.dataset.zop,arr=state._editTmp.zonaOpArr,idx=arr.indexOf(v);
    if(idx>=0)arr.splice(idx,1);else arr.push(v);
  });

  // Rebuild ambos clouds de zona desde zonasAll() + estado actual
  function pfRebuildZonas(){
    var wi=$('pf_zonaIntChips'),wo=$('pf_zonaOpChips');
    var ia=state._editTmp.zonaIntArr,oa=state._editTmp.zonaOpArr;
    var sorted=zonasAll().sort(function(a,b){return(b.uses||0)-(a.uses||0);});
    if(wi)wi.innerHTML=sorted.map(function(z){return '<button type="button" class="chip chip-sm'+(ia.indexOf(z.n)>=0?' sel':'')+'" data-zint="'+esc(z.n)+'">'+esc(z.n)+'</button>';}).join('');
    if(wo)wo.innerHTML=sorted.map(function(z){return '<button type="button" class="chip chip-sm'+(oa.indexOf(z.n)>=0?' sel':'')+'" data-zop="'+esc(z.n)+'">'+esc(z.n)+'</button>';}).join('');
  }
  function pfAddZI(){
    var inp=$('pf_zonaIntExtra');if(!inp)return;
    var v=inp.value.trim();if(!v)return;
    var arr=state._editTmp.zonaIntArr;
    if(arr.indexOf(v)<0){arr.push(v);addZonaToLocal(v);pfRebuildZonas();}
    inp.value='';
  }
  function pfAddZO(){
    var inp=$('pf_zonaOpExtra');if(!inp)return;
    var v=inp.value.trim();if(!v)return;
    var arr=state._editTmp.zonaOpArr;
    if(arr.indexOf(v)<0){arr.push(v);addZonaToLocal(v);pfRebuildZonas();}
    inp.value='';
  }
  var pfBtnZI=$('pf_btnZonaInt');if(pfBtnZI)pfBtnZI.addEventListener('click',pfAddZI);
  var pfInpZI=$('pf_zonaIntExtra');if(pfInpZI)pfInpZI.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();pfAddZI();}});
  var pfBtnZO=$('pf_btnZonaOp');if(pfBtnZO)pfBtnZO.addEventListener('click',pfAddZO);
  var pfInpZO=$('pf_zonaOpExtra');if(pfInpZO)pfInpZO.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();pfAddZO();}});

  $('personOverlay').classList.add('show');
}
function esc(s){return String(s).replace(/"/g,'&quot;').replace(/</g,'&lt;');}
$('personClose').addEventListener('click',closePerson);
$('personCancel').addEventListener('click',closePerson);
function closePerson(){$('personOverlay').classList.remove('show');state.editId=null;}
$('personSave').addEventListener('click',function(){
  var p=state._editTmp;
  p.nombre=($('pf_nombre').value||'').trim();
  p.tel=($('pf_tel').value||'').trim();
  p.wa=($('pf_wa').value||'').trim();
  p.email=($('pf_email').value||'').trim();
  p.empresa=($('pf_empresa').value||'').trim();
  p.etapa=($('pf_etapa').value||'').trim();
  p.fuente=($('pf_fuente').value||'').trim();
  p.temp=($('pf_temp').value||'').trim();
  p.presupuesto=($('pf_presup').value||'').trim();
  var ziExtra=($('pf_zonaIntExtra').value||'').trim();
  p.zonaInt=p.zonaIntArr.slice();
  if(ziExtra&&p.zonaInt.indexOf(ziExtra)<0)p.zonaInt.push(ziExtra);
  var zoExtra=($('pf_zonaOpExtra').value||'').trim();
  p.zonaOp=p.zonaOpArr.slice();
  if(zoExtra&&p.zonaOp.indexOf(zoExtra)<0)p.zonaOp.push(zoExtra);
  p.notas=($('pf_notas').value||'').trim();
  p.fechaSeg=($('pf_fechaSeg').value||'').trim();
  p.touched=true;p.auto=false;
  if(state._editIsNew)state.people.push(p);
  else state.people=state.people.map(function(x){return x.id===p.id?p:x;});
  closePerson();renderCRM();
});

/* ===================== CARACTERÍSTICAS por tipo ===================== */
var CAR_CASA=[
  // Top 30 — visibles por defecto
  'Alberca','Alberca climatizada','Jardín privado','Terraza','Vigilancia 24h','Acceso controlado',
  'Cocina integral','Amenidades completas','Estacionamiento techado','Cuarto de servicio','Estudio / home office',
  'Acepta mascotas','Elevador','Balcón','Roof garden','Clóset vestidor',
  'Recámara en PB','Cuarto de lavado','Cámaras de seguridad','Bodega','Jacuzzi',
  'Área de BBQ / asador','Iluminación natural','Ventilación natural','Vista panorámica','Juegos infantiles',
  'Salón de eventos','Gimnasio','Pádel','Paneles solares','Cisterna propia','Acabados de lujo',
  // Siguientes 21 — colapsados bajo "Ver más"
  'Cocina americana','Isla de cocina','Recámara principal amplia','Baño en suite','Patio privado',
  'Vista al jardín','En condominio','Áreas comunes','Coworking en amenidades','Parque privado / pet park',
  'Videoportero','Portón automático','Domótica','Internet de fibra','Doble altura',
  'Pisos de madera','Vista a la montaña','Sauna / vapor','Amueblada','Nueva','Gas instalado'
];
var CAR_TERR=[
  'Plano','Gran frente','Frente amplio','Esquina','Doble esquina','Dos accesos','Forma regular',
  'Con vista','Vista panorámica','Vista a la ciudad','Vista a la montaña',
  'Bardeado','Arbolado','Topografía favorable','Sin construcciones previas','Limpio y nivelado',
  'Agua','Luz','Drenaje','Gas natural','Servicios completos','Calle pavimentada',
  'Uso habitacional','Uso mixto','Potencial de desarrollo','Alta densidad constructiva',
  'Sin restricciones de altura','Para inversión','Alta plusvalía',
  'Zona exclusiva','Zona residencial','Zona consolidada',
  'Cerca de servicios','Cerca de escuelas','Cerca de comercios','Buena vialidad','Fácil acceso',
  'Escrituras limpias','Sin adeudos','Avalúo reciente','Permiso tramitado',
  'Proyecto arquitectónico incluido','Potencial comercial','Pozo de agua','Cisterna',
  'Colindancia favorable','Apto para desarrollo inmediato','Cesión de derechos'
];
var CAR_LOCAL=[
  'Sobre avenida','Esquina comercial','Alta visibilidad','Alto flujo peatonal','Alto flujo vehicular',
  'Frente visible','Señalización exterior','Vidriera amplia','Zona comercial',
  'Cerca de autopista','Sobre boulevard',
  'Estacionamiento propio','Cajones de visita','Rampa de acceso','Acceso de carga trasera',
  'Área de maniobra','Patio de maniobras',
  'Doble altura','Techo alto','Entrepiso / mezzanine','Piso epóxico','Losa reforzada',
  'Bodega integrada','Cuarto frío','Cortina metálica','Puerta de acceso amplia',
  'Gas natural','Línea trifásica','Internet de fibra','Climatización','Ventilación industrial',
  'Iluminación LED','Baños para clientes','Baños para empleados',
  'Cocina / comedor','Sala de juntas','Recepción','Área de descanso',
  'Vigilancia / CCTV','Control de acceso','Acceso 24h','Los 365 días',
  'Administración incluida','Cisterna propia','Planta de emergencia',
  'Alarma contra incendio','Acceso para discapacitados','En parque industrial','Uso comercial'
];
/* características personalizadas del asesor — persisten en localStorage (v0.7) */
var caractCustom=load('caractCustom',[]);
function persistCaractCustom(c){
  if(!c)return;
  var base=_poolBase();
  if(base.indexOf(c)===-1&&caractCustom.indexOf(c)===-1){
    caractCustom.push(c);save('caractCustom',caractCustom);
  }
}
function _poolBase(){
  if(state.tipo==='Terreno')return CAR_TERR;
  if(['Local comercial','Oficina','Bodega'].indexOf(state.tipo)!==-1)return CAR_LOCAL;
  return CAR_CASA;
}
function poolFor(){
  var base=_poolBase();
  var extra=caractCustom.filter(function(c){return base.indexOf(c)===-1;});
  return extra.length?base.concat(extra):base;
}
var CARACT_TOP=30;
var caractExpanded=false;
var caractTerrExpanded=false;
var CARACT_ALIASES={
  'seguridad privada':'Vigilancia 24h','guardia':'Vigilancia 24h','vigilancia 24/7':'Vigilancia 24h',
  'control de acceso':'Acceso controlado','filtro de acceso':'Acceso controlado',
  'estacionamiento':'Estacionamiento techado',
  'pet friendly':'Acepta mascotas','permite mascotas':'Acepta mascotas',
  'walking closet':'Clóset vestidor','vestidor':'Clóset vestidor',
  'baño propio':'Baño en suite','baño en recámara':'Baño en suite',
  'asador':'Área de BBQ / asador','parrilla':'Área de BBQ / asador','grill':'Área de BBQ / asador',
  'celdas solares':'Paneles solares','fotovoltaicos':'Paneles solares',
  'fibra óptica':'Internet de fibra'
};
function normalizeCaract(arr){
  return arr.map(function(c){return CARACT_ALIASES[c.toLowerCase()]||c;});
}
function buildCaract(){caractExpanded=false;caractOrden=null;renderCaract();}

/* D: pool solo con NO seleccionadas (las elegidas viven arriba como tags con ✕).
   Al elegir: el estado se actualiza al instante, la chip se desvanece con
   animación y el hueco se rellena con la siguiente oculta al re-render. */
function _renderCaractPool(poolFn,selArr,chipsEl,btnMasId,expanded,refreshFn){
  var pool=poolFn().filter(function(c){return selArr.indexOf(c)===-1;});
  var vis=expanded?pool:pool.slice(0,CARACT_TOP);
  var chips=$(chipsEl);chips.innerHTML='';
  vis.forEach(function(c){
    var b=document.createElement('button');b.type='button';b.className='chip chip-sm';b.textContent=c;
    b.addEventListener('click',function(){
      selArr.push(c);updateProgress();
      b.style.maxWidth=b.offsetWidth+'px';void b.offsetWidth;
      b.classList.add('chip-out');b.disabled=true;
      setTimeout(refreshFn,170);
    });
    chips.appendChild(b);
  });
  var btn=$(btnMasId);
  if(btn){
    btn.style.display=pool.length>CARACT_TOP?'':'none';
    btn.textContent=expanded?'Ver menos ↑':'Ver más ↓';
  }
}
function shuffleArr(a){
  a=a.slice();
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}
  return a;
}
var caractOrden=null; // orden barajado de la sesión (↻ Refrescar)
function poolForShuffled(){
  var p=poolFor();
  if(!caractOrden)return p;
  var out=caractOrden.filter(function(c){return p.indexOf(c)!==-1;});
  p.forEach(function(c){if(out.indexOf(c)===-1)out.push(c);});
  return out;
}

function renderCaract(){
  state.caract=normalizeCaract(state.caract);
  // Tags seleccionados
  var tags=$('caractTags');tags.innerHTML='';
  state.caract.forEach(function(c){
    var t=document.createElement('span');t.className='tag';t.appendChild(document.createTextNode(c));
    var x=document.createElement('button');x.type='button';x.textContent='✕';
    x.addEventListener('click',function(){state.caract=state.caract.filter(function(v){return v!==c;});renderCaract();updateProgress();});
    t.appendChild(x);tags.appendChild(t);
  });
  _renderCaractPool(poolForShuffled,state.caract,'caractChips','btnCaractMas',caractExpanded,renderCaract);
}
function addCaract(c){
  if(!c)return;
  persistCaractCustom(c);
  if(state.caract.indexOf(c)===-1){state.caract.push(c);renderCaract();}
}
$('btnCaractAdd').addEventListener('click',function(){
  var inp=$('f_caract_buscar');var v=inp.value.trim();
  if(v){addCaract(v);inp.value='';renderCaract();updateProgress();}
});
$('btnCaractMas').addEventListener('click',function(){caractExpanded=!caractExpanded;renderCaract();});
$('btnCaractRefresh').addEventListener('click',function(){
  // D: barajar las no seleccionadas para proponer otras
  caractOrden=shuffleArr(poolFor());
  caractExpanded=false;renderCaract();
});
$('f_caract_buscar').addEventListener('keydown',function(e){
  if(e.key==='Enter'){e.preventDefault();var v=this.value.trim();if(v){addCaract(v);this.value='';updateProgress();}}
});
$('f_caract_buscar').addEventListener('input',function(){
  var q=this.value.trim().toLowerCase();if(!q){renderCaract();return;}
  var pool=poolFor().filter(function(c){return state.caract.indexOf(c)===-1&&c.toLowerCase().indexOf(q)!==-1;});
  var chips=$('caractChips');chips.innerHTML='';
  pool.forEach(function(c){
    var b=document.createElement('button');b.type='button';b.className='chip chip-sm';b.textContent=c;
    b.addEventListener('click',function(){addCaract(c);$('f_caract_buscar').value='';updateProgress();});
    chips.appendChild(b);
  });
});

/* características de terreno (sección aparte) */
function renderCaractTerr(){
  var tags=$('caractTerrTags');tags.innerHTML='';
  state.caractTerr.forEach(function(c){
    var t=document.createElement('span');t.className='tag';t.appendChild(document.createTextNode(c));
    var x=document.createElement('button');x.type='button';x.textContent='✕';
    x.addEventListener('click',function(){state.caractTerr=state.caractTerr.filter(function(v){return v!==c;});renderCaractTerr();});
    t.appendChild(x);tags.appendChild(t);
  });
  _renderCaractPool(function(){return CAR_TERR;},state.caractTerr,'caractTerrChips','btnCaractTerrMas',caractTerrExpanded,renderCaractTerr);
}
$('btnCaractTerrMas').addEventListener('click',function(){caractTerrExpanded=!caractTerrExpanded;renderCaractTerr();});
renderCaract();renderCaractTerr();renderCRM();initHomeMascot();
// sel-wrap: envuelve todos los <select> para la flechita CSS ::after
document.querySelectorAll('select').forEach(function(sel){
  if(sel.parentNode.classList.contains('sel-wrap'))return;
  var w=document.createElement('div');w.className='sel-wrap';
  sel.parentNode.insertBefore(w,sel);w.appendChild(sel);
});

/* ===================== S/I + N/A ===================== */
document.querySelectorAll('.si-btn').forEach(function(b){
  b.addEventListener('click',function(){
    var inp=$(b.dataset.for);var on=!b.classList.contains('active');
    var naB=document.querySelector('.na-btn[data-for-na="'+b.dataset.for+'"]');
    if(naB&&on)naB.classList.remove('active');
    b.classList.toggle('active',on);inp.disabled=on;if(on)inp.value='';
    updateProgress();
  });
});
function siOn(id){var b=document.querySelector('.si-btn[data-for="'+id+'"]');return !!(b&&b.classList.contains('active'));}

/* Insertar botones N/A dinámicamente junto a cada S/I */
document.querySelectorAll('.si-btn').forEach(function(siBtn){
  var naBtn=document.createElement('button');
  naBtn.type='button';naBtn.className='na-btn';naBtn.dataset.forNa=siBtn.dataset.for;naBtn.textContent='N/A';
  siBtn.parentNode.insertBefore(naBtn,siBtn.nextSibling);
  naBtn.addEventListener('click',function(){
    var id=naBtn.dataset.forNa;var inp=$(id);var on=!naBtn.classList.contains('active');
    var siB=document.querySelector('.si-btn[data-for="'+id+'"]');
    if(siB&&on)siB.classList.remove('active');
    naBtn.classList.toggle('active',on);inp.disabled=on;if(on)inp.value='';
    updateProgress();
  });
});
function naOn(id){var b=document.querySelector('.na-btn[data-for-na="'+id+'"]');return !!(b&&b.classList.contains('active'));}

var _m2tAutoNA=false;
function setNaState(id,on){
  var naB=document.querySelector('.na-btn[data-for-na="'+id+'"]');
  var siB=document.querySelector('.si-btn[data-for="'+id+'"]');
  var inp=$(id);if(!naB||!inp)return;
  if(on){if(siB)siB.classList.remove('active');naB.classList.add('active');inp.disabled=true;inp.value='';
    var normId='n_'+id.replace('f_','');var nm=$(normId);if(nm)nm.textContent='';}
  else{naB.classList.remove('active');inp.disabled=false;}
  updateProgress();
}
function autoFillComisionRenta(){
  var inp=$('f_comision_renta');if(!inp||inp.getAttribute('data-manual')==='true')return;
  var rv=numVal('f_precio_renta');
  inp.value=rv!=null?(fmt(rv)+' MXN'):'';
}

/* ===================== INDIVISOS (v0.7) ===================== */
/* m² terreno = privados. "+ indivisos" despliega m² indivisos con S/I (sí tiene,
   sin dato) y N/A (no tiene). Sin tocar → Tiene indivisos: S/I. */
$('btnIndiv').addEventListener('click',function(){
  $('indivBox').style.display='';this.style.display='none';
  updateProgress();
});
$('btnIndivQuitar').addEventListener('click',function(){
  var inp=$('f_m2t_indiv');inp.value='';inp.disabled=false;
  var si=document.querySelector('.si-btn[data-for="f_m2t_indiv"]');if(si)si.classList.remove('active');
  var na=document.querySelector('.na-btn[data-for-na="f_m2t_indiv"]');if(na)na.classList.remove('active');
  var nm=$('n_m2t_indiv');if(nm)nm.textContent='';
  $('indivBox').style.display='none';$('btnIndiv').style.display='';
  updateProgress();
});
function syncIndivBox(){
  var has=$('f_m2t_indiv').value.trim()!==''||siOn('f_m2t_indiv')||naOn('f_m2t_indiv');
  $('indivBox').style.display=has?'':'none';
  $('btnIndiv').style.display=has?'none':'';
}
function indivisosVal(){
  var abierto=$('indivBox').style.display!=='none';
  if(!abierto)return{tiene:'S/I',cell:{val:null,pend:true}};
  if(naOn('f_m2t_indiv'))return{tiene:'No',cell:{val:null,pend:false,na:true}};
  if(siOn('f_m2t_indiv'))return{tiene:'Sí',cell:{val:null,pend:true}};
  var v=numVal('f_m2t_indiv');
  if(v!=null)return{tiene:'Sí',cell:{val:v,pend:false}};
  return{tiene:'S/I',cell:{val:null,pend:true}};
}

/* ===================== ZONA / COLONIA — chip cloud multi-select ===================== */
var zonasSel=[];  // [{n:'Nombre', nueva:bool}] — multi-select, sin límite
var zonaExpanded=false;
var ZONA_TOP=20;

function renderZonaChips(){
  var wrap=$('zonaChips');if(!wrap)return;
  wrap.innerHTML='';
  var all=zonasAll().sort(function(a,b){return(b.uses||0)-(a.uses||0);});
  var knownLow=all.map(function(z){return z.n.toLowerCase();});
  zonasSel.forEach(function(s){if(knownLow.indexOf(s.n.toLowerCase())<0)all.push({n:s.n,uses:0,last:0,nueva:true});});
  var top=all.slice(0,ZONA_TOP),rest=all.slice(ZONA_TOP);
  function makeChip(z){
    var b=document.createElement('button');b.type='button';b.className='chip chip-sm';b.textContent=z.n;b.dataset.v=z.n;
    b.classList.toggle('sel',zonasSel.some(function(s){return s.n===z.n;}));
    b.addEventListener('click',function(){
      if(zonasSel.some(function(s){return s.n===z.n;})){
        zonasSel=zonasSel.filter(function(s){return s.n!==z.n;});
      }else{
        zonasSel.push({n:z.n,nueva:!!(z.nueva)});
      }
      renderZonaChips();updateHintZona();updateProgress();
    });
    return b;
  }
  top.forEach(function(z){wrap.appendChild(makeChip(z));});
  rest.forEach(function(z){if(zonasSel.some(function(s){return s.n===z.n;}))wrap.appendChild(makeChip(z));});
  if(zonaExpanded){rest.forEach(function(z){if(!zonasSel.some(function(s){return s.n===z.n;}))wrap.appendChild(makeChip(z));});}
  var btn=$('btnZonaMas');
  if(btn){btn.textContent=zonaExpanded?'Ver menos ↑':'Ver más ↓';btn.style.display=rest.length?'':'none';}
}
$('btnZonaMas').addEventListener('click',function(){zonaExpanded=!zonaExpanded;renderZonaChips();});
function addZonaCaptura(){
  var inp=$('f_zona_extra');if(!inp)return;
  var v=inp.value.trim();if(!v)return;
  var isNueva=zonasAll().every(function(z){return z.n.toLowerCase()!==v.toLowerCase();});
  if(isNueva)addZonaToLocal(v);
  if(!zonasSel.some(function(s){return s.n.toLowerCase()===v.toLowerCase();})){
    zonasSel.push({n:v,nueva:isNueva});
  }
  inp.value='';renderZonaChips();updateHintZona();updateProgress();
}
$('btnZonaAdd').addEventListener('click',addZonaCaptura);
$('f_zona_extra').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();addZonaCaptura();}});
function updateHintZona(){
  var h=$('zonaHint');if(!h)return;
  var nuevas=zonasSel.filter(function(z){return z.nueva;});
  h.textContent=nuevas.length?'Zona'+(nuevas.length>1?'s nuevas (*)':' nueva (*)')+': el markdown instruirá crearlas en 📍 Zonas.':'';
}
function pickZona(n,nueva){
  if(!n)return;
  if(!zonasSel.some(function(s){return s.n===n;})){
    zonasSel.push({n:n,nueva:!!nueva});
  }
  renderZonaChips();updateHintZona();updateProgress();
}
function zonaVal(){return zonasSel.length?zonasSel[0].n:'S/I';}
renderZonaChips();

/* ===================== FUENTE otra ===================== */
$('f_fuente').addEventListener('change',function(){
  $('boxFuenteOtra').style.display=(this.value==='__otra')?'':'none';
});
/* ===================== COMISIÓN "Otra" (v0.7) ===================== */
$('f_comision').addEventListener('change',function(){
  $('f_comision_otra').style.display=(this.value==='__otra')?'':'none';
});
/* Única fuente de verdad de la comisión de venta: o la opción del select o el
   texto libre de "Otra" — nunca ambos. */
function comisionVal(){
  if($('f_comision').value==='__otra')return $('f_comision_otra').value.trim()||'S/I';
  return $('f_comision').value;
}
function fuenteVal(){
  if($('f_fuente').value==='__otra'){var v=$('f_fuente_otra').value.trim();return{nombre:v||'S/I',nueva:!!v};}
  return{nombre:$('f_fuente').value,nueva:false};
}

/* ===================== ESTATUS auto ===================== */
$('f_estatus').addEventListener('change',function(){
  $('estatusHint').textContent='';
});

/* ===================== NORMALIZADOR ES ===================== */
var UNI={'cero':0,'un':1,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,'trece':13,'catorce':14,'quince':15,'dieciseis':16,'diecisiete':17,'dieciocho':18,'diecinueve':19,'veinte':20,'veintiun':21,'veintiuno':21,'veintidos':22,'veintitres':23,'veinticuatro':24,'veinticinco':25,'veintiseis':26,'veintisiete':27,'veintiocho':28,'veintinueve':29,'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,'ochenta':80,'noventa':90,'cien':100,'ciento':100,'doscientos':200,'trescientos':300,'cuatrocientos':400,'quinientos':500,'seiscientos':600,'setecientos':700,'ochocientos':800,'novecientos':900,'medio':0.5,'media':0.5};
function quitaAcentos(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function parseNumeroES(raw){
  if(raw==null)return null;
  var s=quitaAcentos(String(raw).toLowerCase().trim()).replace(/\$/g,'').replace(/\b(mxn|pesos|peso|usd|dolares|de)\b/g,' ').trim();
  if(!s)return null;
  if(/^[\d.,\s]+(mdp|m|k)?$/.test(s)){
    var suf=1,ms=s.match(/(mdp|m|k)$/);
    if(ms){suf=(ms[1]==='k')?1e3:1e6;s=s.replace(/(mdp|m|k)$/,'').trim();}
    var t=s.replace(/\s/g,'');
    if(/^\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$/.test(t)){
      var dec=t.match(/[.,](\d{1,2})$/);
      t=t.replace(/[.,]\d{1,2}$/,'').replace(/[.,]/g,'');
      var v1=parseFloat(t);if(dec)v1+=parseFloat('0.'+dec[1]);
      return v1*suf;
    }
    t=t.replace(',','.');var v2=parseFloat(t);return isNaN(v2)?null:v2*suf;
  }
  var toks=s.split(/[\s-]+/).filter(Boolean);
  var total=0,cur=0,usado=false;
  for(var i=0;i<toks.length;i++){
    var tk=toks[i];
    if(/^[\d.,]+$/.test(tk)){var vn=parseFloat(tk.replace(/,/g,''));if(!isNaN(vn)){cur+=vn;usado=true;}continue;}
    if(tk==='y')continue;
    if(tk==='mil'||tk==='miles'){total+=(cur||1)*1000;cur=0;usado=true;continue;}
    if(tk==='millon'||tk==='millones'){total+=(cur||1)*1e6;cur=0;usado=true;continue;}
    if(UNI.hasOwnProperty(tk)){cur+=UNI[tk];usado=true;continue;}
  }
  total+=cur;return usado?total:null;
}
function fmt(n){return Number(n).toLocaleString('es-MX');}
function bindNorm(id,outId){
  $(id).addEventListener('blur',function(){
    var v=parseNumeroES($(id).value);
    $(outId).textContent=(v!=null&&$(id).value.trim()!=='')?('Se registrará: '+fmt(v)):'';
    updateProgress();
  });
  $(id).addEventListener('input',updateProgress);
}
bindNorm('f_precio','n_precio');bindNorm('f_precio_renta','n_precio_renta');
bindNorm('f_m2t','n_m2t');bindNorm('f_m2c','n_m2c');
bindNorm('f_m2t_indiv','n_m2t_indiv');bindNorm('f_cuota','n_cuota');
$('f_precio_renta').addEventListener('input',autoFillComisionRenta);
$('f_precio_renta').addEventListener('blur',autoFillComisionRenta);
$('f_comision_renta').addEventListener('input',function(){this.setAttribute('data-manual','true');});
function numVal(id){var v=parseNumeroES($(id).value);return(v!=null&&$(id).value.trim()!=='')?v:null;}

/* ===================== FORMATEO DE PRECIOS CON COMAS ===================== */
function bindPriceFormat(id){
  var el=$(id);if(!el)return;
  el.addEventListener('input',function(){
    var raw=el.value;
    // Solo formatear si es puramente numérico (no texto como "3 millones")
    if(!/^[\d,]*$/.test(raw))return;
    var digits=raw.replace(/,/g,'');
    if(!digits){el.value='';return;}
    var num=parseInt(digits,10);
    if(isNaN(num))return;
    var formatted=num.toLocaleString('en-US');
    if(formatted===raw)return;
    // Preservar posición del cursor contando dígitos antes del cursor
    var sel=el.selectionStart;
    var digitsBeforeCursor=raw.substring(0,sel).replace(/,/g,'').length;
    el.value=formatted;
    // Restaurar cursor
    var newPos=0,dCount=0;
    for(var i=0;i<formatted.length;i++){
      if(/\d/.test(formatted[i])){dCount++;if(dCount===digitsBeforeCursor){newPos=i+1;break;}}
    }
    if(dCount<digitsBeforeCursor)newPos=formatted.length;
    el.setSelectionRange(newPos,newPos);
  });
}
bindPriceFormat('f_precio');
bindPriceFormat('f_precio_renta');
bindPriceFormat('ct_presupuesto');

/* ===================== NOMBRE / UNIDADES / DRIVE ===================== */
function nombreBase(){
  var n=$('f_nombre').value.trim();if(n)return n;
  var zona=zonaVal();var dir=$('f_direccion').value.trim().split(',')[0];
  n=((state.tipo||'Propiedad')+' '+(zona!=='S/I'?zona:'')+(dir?' - '+dir:'')).replace(/\s+/g,' ').trim();
  return n||'Propiedad sin nombre';
}
function sufijoTipo(){
  if(state.tipo==='Terreno')return 'lote';
  if(state.tipo==='Departamento')return 'dpto';
  if(['Local comercial','Oficina','Bodega'].indexOf(state.tipo)!==-1)return 'local';
  return 'casa';
}
function refreshUnits(){
  var n=Math.max(1,parseInt($('f_unidades').value,10)||1);
  $('unitsBox').style.display=(n>1)?'':'none';
  var list=$('unitsList');
  if(n<=1){list.innerHTML='';var m=$('unitsIgualMsg');if(m)m.style.display='none';return;}
  // Expandir si cambia n (el usuario está modificando, no igualando)
  list.style.display='';
  var m=$('unitsIgualMsg');if(m)m.style.display='none';
  var base=nombreBase();
  var prev=Array.prototype.map.call(list.querySelectorAll('.unit-card'),function(card){
    return {nombre:card.querySelector('[data-u=nombre]').value,
      m2t:(card.querySelector('[data-u=m2t]')||{value:''}).value,
      m2c:(card.querySelector('[data-u=m2c]')||{value:''}).value,
      precio:card.querySelector('[data-u=precio]').value,
      nota:card.querySelector('[data-u=nota]').value};
  });
  var gM2t=$('f_m2t').value.trim();
  var gM2c=$('f_m2c').value.trim();
  var gPrecio='';
  if(state.oper==='Venta'||state.oper==='Venta y Renta')gPrecio=$('f_precio').value.trim();
  if(state.oper==='Renta'||state.oper==='Venta y Renta')gPrecio=gPrecio||$('f_precio_renta').value.trim();
  list.innerHTML='';
  for(var i=1;i<=n;i++){
    var p=prev[i-1]||{};
    var card=document.createElement('div');card.className='unit-card';
    card.innerHTML='<div class="unit-head">Unidad '+i+'</div>'+
      '<input type="text" data-u="nombre" value="'+esc(p.nombre||(base+' - '+sufijoTipo()+' '+i))+'">'+
      '<div class="row2" style="margin-top:8px">'+
        '<div><div style="font-size:.75rem;color:var(--text-soft);margin-bottom:3px">m² terreno</div>'+
        '<input type="text" data-u="m2t" placeholder="'+esc(gM2t||'ej. 150')+'" value="'+esc(p.m2t||gM2t)+'"></div>'+
        '<div><div style="font-size:.75rem;color:var(--text-soft);margin-bottom:3px">m² construcción</div>'+
        '<input type="text" data-u="m2c" placeholder="'+esc(gM2c||'ej. 90')+'" value="'+esc(p.m2c||gM2c)+'"></div>'+
      '</div>'+
      '<input type="text" data-u="precio" placeholder="Precio ('+esc(gPrecio||'igual al campo global')+')" value="'+esc(p.precio||'')+'" style="margin-top:8px">'+
      '<input type="text" data-u="nota" placeholder="Nota (opcional)" value="'+esc(p.nota||'')+'" style="margin-top:8px">';
    list.appendChild(card);
  }
}
$('f_unidades').addEventListener('input',refreshUnits);
$('btnIgualaTodo').addEventListener('click',function(){
  var gM2t=$('f_m2t').value.trim();
  var gM2c=$('f_m2c').value.trim();
  var gPrecio='';
  if(state.oper==='Venta'||state.oper==='Venta y Renta')gPrecio=$('f_precio').value.trim();
  if(state.oper==='Renta'||state.oper==='Venta y Renta')gPrecio=gPrecio||$('f_precio_renta').value.trim();
  $('unitsList').querySelectorAll('.unit-card').forEach(function(card){
    if(gM2t)card.querySelector('[data-u=m2t]').value=gM2t;
    if(gM2c)card.querySelector('[data-u=m2c]').value=gM2c;
    if(gPrecio)card.querySelector('[data-u=precio]').value=gPrecio;
  });
  // Colapsar lista y mostrar resumen
  var n=$('unitsList').querySelectorAll('.unit-card').length;
  $('unitsList').style.display='none';
  var msg=$('unitsIgualMsg');
  msg.innerHTML='✓ '+n+' unidades igualadas desde valores globales. <button type="button" class="btn chip-sm" id="btnEditarIndiv" style="margin-left:6px">Editar individualmente</button>';
  msg.style.display='';
  $('btnEditarIndiv').addEventListener('click',function(){
    $('unitsList').style.display='';
    msg.style.display='none';
  });
});
/* ===================== DIRECCIÓN: autocompletado ===================== */
var sugTimer=null;
$('f_direccion').addEventListener('input',function(){
  updateProgress();
  var q=$('f_direccion').value.trim();clearTimeout(sugTimer);
  if(q.length<5){$('dirSuggest').style.display='none';return;}
  sugTimer=setTimeout(function(){buscarDireccion(q);},300);
});
function buscarDireccion(q){
  fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=mx&accept-language=es&q='+encodeURIComponent(q+' Cuernavaca'))
  .then(function(r){return r.json();})
  .then(function(res){
    var box=$('dirSuggest');box.innerHTML='';
    if(!res||!res.length){box.style.display='none';return;}
    res.forEach(function(it){
      var d=document.createElement('div');d.textContent='📍 '+it.display_name;
      d.addEventListener('click',function(){
        $('f_direccion').value=it.display_name;
        setGeo(parseFloat(it.lat),parseFloat(it.lon),'Dirección y coordenadas cargadas. Corrige el número exterior si hace falta.');
        autoZonaFromAddr(it);box.style.display='none';updateProgress();
      });
      box.appendChild(d);
    });
    box.style.display='block';
  })
  .catch(function(){
    $('dirSuggest').style.display='none';
    $('geoStatus').className='status';
    $('geoStatus').textContent='Las sugerencias de mapa no cargaron aquí; al abrir la URL en el navegador del celular sí funcionan.';
  });
}
function autoZonaFromAddr(it){
  if(zonasSel.length)return;
  var a=it.address||{};
  var z=a.neighbourhood||a.suburb||a.quarter||a.residential;
  if(z){pickZona(z,zonasAll().every(function(x){return x.n.toLowerCase()!==z.toLowerCase();}));}
}

/* ===================== GEO ===================== */
function setGeo(lat,lng,msg){
  state.lat=lat;state.lng=lng;
  $('f_maps').value='https://www.google.com/maps?q='+lat.toFixed(6)+','+lng.toFixed(6);
  $('geoStatus').className='status ok';
  $('geoStatus').textContent=msg||('Coordenadas guardadas: '+lat.toFixed(5)+', '+lng.toFixed(5));
}
function reverseGeo(lat,lng){
  fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=es&lat='+lat+'&lon='+lng)
  .then(function(r){return r.json();})
  .then(function(d){
    if(d&&d.display_name&&!$('f_direccion').value.trim()){$('f_direccion').value=d.display_name;}
    if(d)autoZonaFromAddr(d);updateProgress();
  }).catch(function(){});
}
$('btnGeo').addEventListener('click',function(){
  if(!navigator.geolocation){$('geoStatus').className='status err';$('geoStatus').textContent='Tu dispositivo no permite geolocalización.';return;}
  $('geoStatus').className='status';$('geoStatus').textContent='Obteniendo tu ubicación…';
  navigator.geolocation.getCurrentPosition(function(pos){
    setGeo(pos.coords.latitude,pos.coords.longitude);reverseGeo(pos.coords.latitude,pos.coords.longitude);
  },function(){
    $('geoStatus').className='status err';$('geoStatus').textContent='No se pudo obtener la ubicación. Da permiso de ubicación o usa el mapa.';
  },{enableHighAccuracy:true,timeout:10000});
});

/* link de Maps pegado → coords */
$('f_maps').addEventListener('blur',function(){
  var u=this.value;var m=u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||u.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if(m){state.lat=parseFloat(m[1]);state.lng=parseFloat(m[2]);
    $('geoStatus').className='status ok';$('geoStatus').textContent='Coordenadas leídas del link.';}
});

/* MAPA modal */
var map=null,marker=null,pick=null,leafletLoaded=false;
function loadLeaflet(){
  return new Promise(function(res,rej){
    if(leafletLoaded&&window.L)return res();
    var css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css);
    var s=document.createElement('script');s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload=function(){leafletLoaded=true;res();};s.onerror=rej;document.head.appendChild(s);
  });
}
$('btnMap').addEventListener('click',function(){
  $('mapOverlay').classList.add('show');
  loadLeaflet().then(function(){
    if(!map){
      map=L.map('mapDiv').setView([state.lat||18.9261,state.lng||-99.2308],14);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
      map.on('click',function(e){
        pick=e.latlng;
        if(marker)marker.setLatLng(pick);else marker=L.marker(pick).addTo(map);
        $('mapCoords').textContent=pick.lat.toFixed(5)+', '+pick.lng.toFixed(5);
        $('mapUse').disabled=false;
      });
    }
    setTimeout(function(){map.invalidateSize();},150);
  }).catch(function(){
    $('mapCoords').textContent='El mapa no cargó (restricción de red). Abre la URL en el navegador del celular, o usa 📍 / escribe la dirección.';
  });
});
$('mapClose').addEventListener('click',function(){$('mapOverlay').classList.remove('show');});
$('mapUse').addEventListener('click',function(){
  if(!pick)return;setGeo(pick.lat,pick.lng);reverseGeo(pick.lat,pick.lng);
  $('mapOverlay').classList.remove('show');
});

/* ===================== LEER ANUNCIO (IA) ===================== */
$('btnAnuncio').addEventListener('click',function(){
  var url=$('f_anuncio').value.trim();
  if(!url){$('anuncioStatus').textContent='Pega primero el link del anuncio.';return;}
  $('btnAnuncio').disabled=true;$('anuncioStatus').className='status';
  $('anuncioStatus').textContent='Leyendo el anuncio… unos segundos.';
  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      model:'claude-sonnet-4-6',max_tokens:1000,
      messages:[{role:'user',content:'Visita este anuncio inmobiliario y extrae sus datos: '+url+'\n\nResponde ÚNICAMENTE con un objeto JSON (sin backticks, sin texto extra) con estas llaves (usa null si no aparece; números planos sin símbolos):\n{"tipo":"Casa|Departamento|Terreno|Local comercial|Oficina|Bodega|Otro","operacion":"Venta|Renta|Venta y Renta","precio_venta":null,"precio_renta":null,"moneda":"MXN|USD","direccion":null,"colonia":null,"municipio":null,"m2_terreno":null,"m2_construccion":null,"recamaras":null,"banos":null,"estacionamientos":null,"caracteristicas":[],"portal":null,"publicador":null,"telefono":null,"descripcion_breve":null}'}],
      tools:[{type:'web_search_20250305',name:'web_search'}]
    })
  })
  .then(function(r){return r.json();})
  .then(function(d){
    var text=(d.content||[]).filter(function(x){return x.type==='text';}).map(function(x){return x.text;}).join('\n').replace(/```(json)?/g,'').trim();
    var j=null,mjson=text.match(/\{[\s\S]*\}/);if(mjson){try{j=JSON.parse(mjson[0]);}catch(e){}}
    if(!j)throw new Error('sin JSON');
    var llenos=[];
    if(j.tipo){setChip('tipoChips','tipo',j.tipo,onTipo);llenos.push('tipo');}
    if(j.operacion){setChip('operChips','oper',j.operacion,onOper);llenos.push('operación');}
    if(j.precio_venta!=null){$('f_precio').value=String(j.precio_venta);$('n_precio').textContent='Se registrará: '+fmt(j.precio_venta);llenos.push('precio venta');}
    if(j.precio_renta!=null){$('f_precio_renta').value=String(j.precio_renta);$('n_precio_renta').textContent='Se registrará: '+fmt(j.precio_renta);llenos.push('precio renta');}
    if(j.moneda)$('f_moneda').value=j.moneda;
    if(j.direccion&&!$('f_direccion').value.trim()){$('f_direccion').value=j.direccion;llenos.push('dirección');}
    if(j.colonia){pickZona(j.colonia,zonasAll().every(function(z){return z.n.toLowerCase()!==String(j.colonia).toLowerCase();}));llenos.push('zona');}
    if(j.m2_terreno!=null){$('f_m2t').value=String(j.m2_terreno);llenos.push('m² terreno');}
    if(j.m2_construccion!=null){$('f_m2c').value=String(j.m2_construccion);llenos.push('m² construcción');}
    if(j.recamaras!=null){$('f_rec').value=String(j.recamaras);llenos.push('recámaras');}
    if(j.banos!=null){$('f_ban').value=String(j.banos);llenos.push('baños');}
    if(j.estacionamientos!=null){$('f_est').value=String(j.estacionamientos);llenos.push('estacionamientos');}
    if(j.caracteristicas&&j.caracteristicas.length){j.caracteristicas.forEach(function(c){addCaract(String(c));});llenos.push('características');}
    $('f_fuente').value='Portal';$('boxFuenteOtra').style.display='none';
    if(j.publicador||j.telefono){
      state.people.push({id:'pa'+Date.now(),nombre:j.publicador||'',rol:'Asesor inmobiliario',tel:j.telefono||'',fuente:'Portal',auto:false,touched:true});
      renderCRM();llenos.push('publicador→CRM');
    }
    if(j.descripcion_breve){var n=$('f_notas');n.value=(n.value?n.value+'\n':'')+'Del anuncio'+(j.portal?' ('+j.portal+')':'')+': '+j.descripcion_breve;}
    state.anuncioUrl=url;
    $('anuncioStatus').className='status ok';
    $('anuncioStatus').textContent='✓ Anuncio leído. Rellenado: '+(llenos.join(', ')||'nada')+'. Revisa y corrige.';
    updateProgress();
  })
  .catch(function(){
    $('anuncioStatus').className='status err';
    $('anuncioStatus').textContent='No se pudo leer el anuncio aquí. Esta función opera dentro de Claude o con backend; en archivo suelto, captura manual. El portal también puede bloquear la lectura.';
  })
  .finally(function(){$('btnAnuncio').disabled=false;});
});

/* ===================== PROGRESO ===================== */
function filled(id){var el=$(id);if(!el)return false;return siOn(id)||naOn(id)||el.value.trim()!=='';}
function updateProgress(){
  var t=(state.tipo==='Terreno');
  var ids=['f_direccion','f_m2t'];
  if(state.oper==='Venta'||state.oper==='Venta y Renta')ids.push('f_precio');
  if(state.oper==='Renta'||state.oper==='Venta y Renta')ids.push('f_precio_renta');
  if(t)ids=ids.concat(['f_uso','f_frente']);
  else if(state.tipo)ids=ids.concat(['f_m2c','f_rec','f_ban','f_est']);
  var total=ids.length+3,done=0;  // +3: tipo, ofrece, zona
  ids.forEach(function(id){if(filled(id))done++;});
  if(state.tipo)done++;if(state.ofrece)done++;
  if(zonasSel.length)done++;
  if(t){total+=1;if(state.serv.length)done++;}
  var pct=total?Math.round(done/total*100):0;
  animCountUp($('progText'),_progPrev,done,total);_progPrev=done;
  $('progPct').textContent=pct+'%';$('progFill').style.width=pct+'%';
  syncLimpiarBtn(done>0||state.tipo||state.ofrece||zonasSel.length);
}
function syncLimpiarBtn(hasDatos){
  var lw=$('btnLimpiarWrap');
  if(lw)lw.style.display=hasDatos?'':'none';
}
['f_zona','f_uso','f_frente','f_fondo','f_rec','f_ban','f_est','f_notas','f_m2c'].forEach(function(id){
  var el=$(id);if(el){el.addEventListener('input',updateProgress);el.addEventListener('change',updateProgress);}
});
// Delegate: captura cualquier input/change en viewCapture que no esté cableado individualmente
$('viewCapture').addEventListener('input',updateProgress);
$('viewCapture').addEventListener('change',updateProgress);
updateProgress();

/* ===================== HELPERS SALIDA ===================== */
function txt(id){return siOn(id)?'S/I':(naOn(id)?'N/A':($(id).value.trim()||'S/I'));}
function numCell(id){
  if(siOn(id))return{val:null,pend:true};
  if(naOn(id))return{val:null,pend:false,na:true};
  var v=numVal(id);if(v==null)return{val:null,pend:true};
  return{val:v,pend:false};
}
function lineas(id){return $(id).value.split('\n').map(function(s){return s.trim();}).filter(Boolean);}

/* tipos sin obligación de m² terreno cuando está en S/I o N/A (regla v0.7) */
var SIN_M2T_OBLIG=['Departamento','Penthouse'];

/* requisitos de "captura completa": m2, recámaras, baños, responsable */
function faltantesCompletitud(){
  var f=[];var esTerreno=(state.tipo==='Terreno');
  // Regla v0.7: en Departamento/Penthouse, m² terreno con S/I o N/A no es
  // obligatorio y no marca la captura como incompleta.
  var m2tExento=(SIN_M2T_OBLIG.indexOf(state.tipo)!==-1&&(siOn('f_m2t')||naOn('f_m2t')));
  if(numCell('f_m2t').pend&&!m2tExento)f.push('m² terreno');
  if(!esTerreno && numCell('f_m2c').pend)f.push('m² construcción');
  if(!esTerreno){
    if(numCell('f_rec').pend)f.push('recámaras');
    if((siOn('f_ban')||!$('f_ban').value.trim())&&!naOn('f_ban'))f.push('baños completos');
  }
  if(!$('f_resp').value)f.push('quién captura (responsable)');
  return f;
}

/* ===================== SISTEMA DE ESTRELLAS — FASE 5 ===================== */
function calcularEstrellas(){
  var esTerreno=(state.tipo==='Terreno');
  var conVenta=(state.oper==='Venta'||state.oper==='Venta y Renta');
  var conRenta=(state.oper==='Renta'||state.oper==='Venta y Renta');
  function ok(id){return siOn(id)||naOn(id)||($(id)&&$(id).value.trim()!=='');}
  function okNum(id){return siOn(id)||naOn(id)||numVal(id)!=null;}

  // ⭐ 1: velocidad ≤ 5 min (tiempo real, no el countdown pausable)
  var re=realElapsed();
  var s1=re>0&&re<=300;

  // ⭐ 2: datos esenciales
  var falt2=[];
  if(!state.tipo)falt2.push('Tipo de inmueble');
  if(!$('f_direccion').value.trim()&&!state.lat)falt2.push('Dirección o ubicación');
  if(!zonasSel.length)falt2.push('Zona/colonia');
  if(conVenta&&!okNum('f_precio'))falt2.push('Precio de venta');
  if(conRenta&&!okNum('f_precio_renta'))falt2.push('Precio de renta');
  if(!okNum('f_m2t'))falt2.push('m² terreno');
  if(!esTerreno&&!okNum('f_m2c'))falt2.push('m² construcción');
  if(!$('f_resp').value.trim())falt2.push('Responsable/asesor');
  if(!state.ofrece)falt2.push('Quién ofrece la propiedad');
  if(state.ofrece&&state.ofrece!=='No sé aún'&&
     !state.people.some(function(p){return p.nombre||p.tel;}))
    falt2.push('Contacto del oferente');
  if(!esTerreno&&state.tipo){
    if(!ok('f_rec'))falt2.push('Recámaras');
    if(!ok('f_ban'))falt2.push('Baños');
    if(!ok('f_est'))falt2.push('Estacionamientos');
  }
  if(esTerreno){
    if(!state.serv.length)falt2.push('Servicios disponibles');
    if(!ok('f_uso'))falt2.push('Uso de suelo/densidad');
  }
  var s2=falt2.length===0;

  // ⭐ 3: completa — extras sobre estrella 2
  var falt3=[];
  if(!state.lat&&!($('f_maps')&&$('f_maps').value.trim()))falt3.push('Coordenadas o link de Maps');
  if(esTerreno){
    if(!ok('f_frente'))falt3.push('Frente del terreno');
    if(!ok('f_fondo'))falt3.push('Fondo del terreno');
  }
  if(state.ofrece&&state.ofrece!=='No sé aún'&&
     !state.people.some(function(p){return p.nombre&&(p.tel||p.wa||p.email);}))
    falt3.push('Contacto con nombre y teléfono/email');
  var s3=s2&&falt3.length===0;

  var count=(s1?1:0)+(s2?1:0)+(s3?1:0);
  var quality=!s2?'Incompleta':(s3?'Completa':(s1?'Publicable':'Esencial'));
  return{s1:s1,s2:s2,s3:s3,count:count,quality:quality,falt2:falt2,falt3Extra:falt3};
}

/* ===================== GENERAR MARKDOWN ===================== */
var mdActual='';var lastCaptureId=null;
$('btnGen').addEventListener('click',function(){
  try{generar();}catch(err){alert('Error generando markdown: '+err.message);console.error(err);}
});

function cell(v,nota){return {v:(v==null||v==='')?'':String(v),nota:nota||''};}
function row(campo,tipo,c){return '| '+campo+' | '+tipo+' | '+(c.v||' ')+' | '+(c.nota||' ')+' |';}

function generar(){
  var esTerreno=(state.tipo==='Terreno');
  var conVenta=(state.oper==='Venta'||state.oper==='Venta y Renta');
  var conRenta=(state.oper==='Renta'||state.oper==='Venta y Renta');
  var zonasArr=zonasSel.slice();var zona=zonaVal();var fuente=fuenteVal();var nombre=nombreBase();
  var nU=Math.max(1,parseInt($('f_unidades').value,10)||1);

  // estrellas + estatus
  var estrellas=calcularEstrellas();
  var faltC=faltantesCompletitud();
  var estatusCaptura=estrellas.count===3?'Listo':(estrellas.count>=2?'En progreso':'Sin empezar');
  var estatusProp=$('f_estatus').value||'Disponible';
  if(estrellas.count===3)$('estatusHint').textContent='🌟 Captura completa (3 ⭐) → Estatus de captura: Listo.';
  else if(faltC.length)$('estatusHint').textContent='Faltan datos: '+faltC.slice(0,3).join(', ')+(faltC.length>3?' …':'')+'.';

  var pv=conVenta?numCell('f_precio'):{val:null,pend:false,na:true};
  var pr=conRenta?numCell('f_precio_renta'):{val:null,pend:false,na:true};
  var m2t=numCell('f_m2t');
  var m2c=esTerreno?{val:null,na:true}:numCell('f_m2c');
  var rec=esTerreno?{val:null,na:true}:numCell('f_rec');
  var est=esTerreno?{val:null,na:true}:numCell('f_est');
  var ban=esTerreno?{val:null,pend:false,na:true}:numCell('f_ban');
  var banMed=esTerreno?{val:null,pend:false,na:true}:numCell('f_ban_medios');
  var cuota=numCell('f_cuota');
  var indiv=indivisosVal();

  /* trazabilidad (v0.7): UUID + fechas + contador de ediciones, definidos ANTES
     de construir el markdown para poder emitir el bloque META parseable. */
  var nowIso=new Date().toISOString();
  var meta;var origDriveUrl='';
  if(state.editId){
    var _orig=getHist().filter(function(x){return x.id===state.editId;})[0];
    meta={uuid:state.editId,
      creado:_orig?(_orig.capturadoEn||_orig.fecha):nowIso,
      modificado:nowIso,
      ediciones:_orig?((_orig.ediciones||0)+1):1};
    origDriveUrl=(_orig&&_orig.driveUrl)||'';
  }else{
    meta={uuid:genUUID(),creado:nowIso,modificado:nowIso,ediciones:0};
  }

  function valNum(o){return o.na?'':(o.pend?'':(o.val!=null?String(o.val):''));}
  function notaNum(o){return o.na?'N/A':(o.pend?'S/I':'');}

  var moneda=$('f_moneda').value;
  var unidades=[];
  if(nU>1){
    unidades=Array.prototype.map.call($('unitsList').querySelectorAll('.unit-card'),function(card){
      return {nombre:card.querySelector('[data-u=nombre]').value.trim(),
        m2t:(card.querySelector('[data-u=m2t]')||{value:''}).value.trim(),
        m2c:(card.querySelector('[data-u=m2c]')||{value:''}).value.trim(),
        precio:card.querySelector('[data-u=precio]').value.trim(),
        nota:card.querySelector('[data-u=nota]').value.trim()};
    }).filter(function(u){return u.nombre;});
  }

  /* ---------- construir markdown ---------- */
  var md='';
  // Bloque META parseable (líneas "clave: valor") para el bot de duplicados.
  md+='<!-- META\n';
  md+='uuid: '+meta.uuid+'\n';
  md+='creado: '+meta.creado+'\n';
  md+='modificado: '+meta.modificado+'\n';
  md+='ediciones: '+meta.ediciones+'\n';
  md+='-->\n\n';
  md+='# Alta de propiedad en Notion — '+nombre+'\n\n';
  md+='> Instrucción para el agente de Notion (sistema Hauser, Cuernavaca). Crea o actualiza la propiedad en la base 🏠 **Propiedades** y vincula las bases relacionadas. No inventes datos: respeta S/I (sin información) y N/A (no aplica).\n\n';

  md+='## 1. Acción principal\n';
  if(nU>1){
    md+='Crear **'+unidades.length+' páginas** en 🏠 Propiedades, una por unidad (no agrupar en una sola). Clonar los datos comunes de abajo y respetar los datos específicos de cada unidad.\n\n';
  }else{
    md+='Crear **1 página** en 🏠 Propiedades con el nombre **'+nombre+'** (si ya existe una con esa dirección, actualizarla).\n\n';
  }

  md+='## 2. Campos de la base 🏠 Propiedades\n';
  md+='| Campo Notion | Tipo esperado | Valor para Notion | Nota interna |\n';
  md+='|---|---|---|---|\n';

  // dirección genérica + instrucción de geolocalización (Decisión 1)
  var dirVal=$('f_direccion').value.trim();
  var dirNota=dirVal
    ?'Direccion generica capturada en campo. Instruccion al agente: buscar esta direccion en web / Google Maps, identificar la ubicacion exacta y rellenar Direccion con referencia tipo Google Maps (link y/o coordenadas).'
    :'S/I';

  // v0.7 (decisión del dueño 02-jul-2026): servicios/uso de suelo/estatus legal
  // son propiedades REALES de Notion; Notas vuelve a ser solo notas de campo.
  var notasValorNotion=$('f_notas').value.trim();
  var notaNotionRow='';
  var usoTrim=$('f_uso').value.trim();
  var usoCell={v:(siOn('f_uso')||naOn('f_uso'))?'':usoTrim,
    nota:siOn('f_uso')?'S/I':(naOn('f_uso')?'N/A':(usoTrim?'':'S/I'))};
  var servCell={v:state.serv.join(', '),nota:state.serv.length?'':'S/I'};

  // Operación → multi_select de Notion
  var operArr=[];
  if(state.oper==='Venta y Renta'){operArr=['Venta','Renta'];}
  else{operArr=[state.oper];}
  var operStr=operArr.join(', ');

  var zonasStr=zonasArr.length?zonasArr.map(function(z){return z.n+(z.nueva?'*':'');}).join(', '):'S/I';
  var zonasNota=zonasArr.length?zonasArr.map(function(z){return z.n+(z.nueva?' [CREAR y relacionar]':' [buscar y relacionar]');}).join('; '):'S/I';

  md+=row('Propiedad','Title',cell(nombre))+'\n';
  md+=row('Tipo de inmueble','Select',cell(state.tipo,state.tipo?'':'S/I'))+'\n';
  md+=row('Operación','Multi-select',{v:operStr,nota:operArr.length>1?'Registrar ambas opciones en el multi-select de Operación':''})+'\n';
  md+=row('Dirección','Text',cell(dirVal,dirNota))+'\n';
  md+=row('Zona','Relación (multi) → 📍 Zonas',{v:zonasStr,nota:zonasNota})+'\n';
  if(conVenta)md+=row('Precio de Venta','Number',{v:valNum(pv),nota:notaNum(pv)+(pv.val&&moneda?' ('+moneda+', sin símbolo)':'')})+'\n';
  if(conRenta){
    md+=row('Precio de Renta','Number',{v:valNum(pr),nota:notaNum(pr)+(pr.val&&moneda?' renta mensual, '+moneda:'')})+'\n';
    md+=row('Ganancia renta','Number',{v:pr.val!=null?String(pr.val):'',nota:pr.val!=null?'= un mes de renta ('+fmt(pr.val)+' '+moneda+')':'S/I — precio de renta no capturado.'})+'\n';
    md+=row('Tiempo mínimo de renta','Select',{v:state.rentaMin||'S/I',nota:'Opciones: 6 meses / 1 año'})+'\n';
  }
  md+=row('m² terreno','Number',{v:valNum(m2t),nota:notaNum(m2t)+(m2t.val!=null?' (m² privados)':'')})+'\n';
  md+=row('m² terreno indivisos','Number',{v:valNum(indiv.cell),nota:notaNum(indiv.cell)})+'\n';
  md+=row('Tiene indivisos','Select',{v:indiv.tiene,nota:'Opciones: Sí / No / S/I'})+'\n';
  if(esTerreno){
    md+=row('Uso de suelo','Text',usoCell)+'\n';
    md+=row('Estatus legal','Select',{v:$('f_legal').value,nota:'Opciones: Título limpio / Con gravamen / Ejidal / En trámite / S-I'})+'\n';
    md+=row('Servicios disponibles','Multi-select',servCell)+'\n';
  }
  if(!esTerreno)md+=row('m² construcción','Number',{v:valNum(m2c),nota:notaNum(m2c)})+'\n';
  if(!esTerreno)md+=row('Recámaras','Number',{v:valNum(rec),nota:notaNum(rec)})+'\n';
  if(!esTerreno)md+=row('Baños','Number',{v:valNum(ban),nota:notaNum(ban)+(ban.val!=null?' (baños completos)':'')})+'\n';
  if(!esTerreno)md+=row('Medios baños','Number',{v:valNum(banMed),nota:notaNum(banMed)})+'\n';
  if(!esTerreno)md+=row('Estacionamientos','Number',{v:valNum(est),nota:notaNum(est)})+'\n';
  md+=row('Cuota de mantenimiento','Number',{v:valNum(cuota),nota:notaNum(cuota)+(cuota.val!=null?' (MXN/mes)':'')})+'\n';
  if(conVenta)md+=row('Comisión de venta','Text',{v:comisionVal(),nota:'Texto libre (ej. "3%", "1.75%")'})+'\n';
  if(nU>1)md+=row('Cantidad disponible','Number',{v:String(nU),nota:'Unidades en el conjunto'})+'\n';
  md+=row('Estatus de captura','Status',{v:estatusCaptura,nota:'3⭐→Listo, 2⭐→En progreso, <2⭐→Sin empezar'})+'\n';
  md+=row('Estatus de propiedad','Status',{v:estatusProp,nota:''})+'\n';
  md+=row('Fuente','Select',cell(fuente.nombre,fuente.nueva?'OPCIÓN NUEVA: agregar al select de Fuente en Notion':''))+'\n';
  md+=row('Propietario','Relación → 👥 Contactos',cell(propietarioNombre(),propietarioNota()))+'\n';
  md+=row('Contacto operativo','Relación → 👥 Contactos',cell(contactoOperativoNombre(),contactoOperativoNota()))+'\n';
  md+=row('Notas','Texto',{v:notasValorNotion,nota:notaNotionRow})+'\n';
  md+=row('UUID Captura','Text',cell(meta.uuid,'Identificador único de la capturadora'))+'\n';
  md+=row('Fecha captura','Date',{v:meta.creado,nota:'Fecha de captura original (ISO-8601)'})+'\n';
  md+=row('Revisión duplicado','Select',{v:'Sin revisar',nota:'Default; lo gestiona el bot de duplicados'})+'\n';
  md+=row('Observaciones captura','Text',{v:meta.ediciones>0?('Editada '+meta.ediciones+(meta.ediciones===1?' vez':' veces')+' · última modificación: '+meta.modificado):'',nota:meta.ediciones>0?'':'Captura original sin ediciones'})+'\n';
  md+=row('Carpeta Drive','URL',{v:origDriveUrl,nota:origDriveUrl?'Carpeta de fotos de la propiedad en Drive':'Pendiente — la crea el GAS al guardar y queda visible en el historial (📷)'})+'\n';
  md+='\n';

  md+='## 3. Reglas de relaciones\n';
  md+='- **Zona**: relación multi-valor a 📍 Zonas. Para cada zona: busca y relaciona si existe; si no, crea el registro (Municipio: Cuernavaca por defecto) y luego relaciona. No dejar como texto suelto.\n';
  md+='- **Propietario**: relación a 👥 Contactos (el dueño legal del inmueble). El asesor/broker NO es el propietario; si solo hay asesor, Propietario queda S/I.\n';
  md+='- **Contacto operativo**: relación a 👥 Contactos (quien gestiona la operación: asesor, portero, admin). Es distinto del propietario.\n';
  md+='- **Operaciones / Proyectos / Tareas**: son relaciones; créalas como registros aparte y vincula, no las metas como texto en Propiedades.\n';
  md+='- Las frases largas (notas, descripción) van en el **contenido de la página**, no en campos de relación.\n\n';

  // 4. CRM
  md+='## 4. Personas / CRM (base 👥 Contactos)\n';
  var people=state.people.filter(function(p){return p.nombre||p.tel||p.touched;});
  if(!people.length){
    md+='- Sin contactos capturados. Propietario legal: **S/I**.\n\n';
  }else{
    people.forEach(function(p){
      var tipos=personTipos(p);
      md+='### '+(p.nombre||'(nombre S/I)')+' — '+(tipos.join(' · ')||'S/I')+'\n';
      md+='Crear o actualizar en 👥 Contactos y relacionar con esta propiedad según su rol.\n';
      md+='| Campo | Valor | Nota |\n|---|---|---|\n';
      md+='| Nombre | '+(p.nombre||'S/I')+' | |\n';
      md+='| Tipo de contacto | '+(tipos.join(', ')||'S/I')+' | multi-select |\n';
      if(p.tel)md+='| Teléfono | '+p.tel+' | |\n';
      if(p.email)md+='| Email | '+p.email+' | |\n';
      if(p.empresa)md+='| Empresa | '+p.empresa+' | |\n';
      if(p.etapa)md+='| Etapa del lead | '+p.etapa+' | |\n';
      if(p.fuente)md+='| Fuente | '+p.fuente+' | |\n';
      if(p.temp)md+='| Temperatura | '+p.temp+' | |\n';
      if(p.presupuesto)md+='| Presupuesto | '+p.presupuesto+' | MX$ |\n';
      var zonaIntArr=Array.isArray(p.zonaInt)?p.zonaInt:(p.zonaInt?[p.zonaInt]:[]);
      if(zonaIntArr.length){
        md+='| Zona de interés | '+zonaIntArr.join(', ')+' | relación → 📍 Zonas |\n';
        zonaIntArr.forEach(function(z){
          if(zonasAll().every(function(x){return x.n.toLowerCase()!==z.toLowerCase();}))
            md+='> ⚠️ Zona "'+z+'" no existe en 📍 Zonas — crear antes de relacionar.\n';
        });
      }
      var zonaOpArr=Array.isArray(p.zonaOp)?p.zonaOp:(p.zonaOp?[p.zonaOp]:[]);
      var hasContent=p.wa||zonaOpArr.length||p.fechaSeg||p.notas;
      if(hasContent){
        md+='\n**Contenido de página** (no va como propiedad Notion):\n';
        if(p.wa)md+='- WhatsApp: '+p.wa+'\n';
        if(zonaOpArr.length)md+='- Zona de operación: '+zonaOpArr.join(', ')+'\n';
        if(p.fechaSeg)md+='- Fecha de seguimiento: '+p.fechaSeg+'\n';
        if(p.notas)md+='- Notas: '+p.notas+'\n';
      }
      md+='\n';
    });
  }

  // 5. Operaciones
  var comprador=people.filter(personEsComprador)[0];
  md+='## 5. Operaciones\n';
  if(comprador){
    md+='Hay comprador interesado ('+(comprador.nombre||'S/I')+'). Crear una **Operación** en 🤝 Operaciones, relacionarla con esta propiedad y con el contacto comprador.\n';
    var comArr=[];
    if(conVenta)comArr.push('Venta: '+comisionVal());
    if(conRenta)comArr.push('Renta: '+($('f_comision_renta').value||'S/I')+' (1er mes)');
    md+='- Comisión esperada: '+(comArr.join(' · ')||'S/I')+(comprador.presupuesto?(' · presupuesto comprador: '+comprador.presupuesto):'')+'.\n\n';
  }else{
    md+='Sin comprador aún. No crear Operación todavía.\n\n';
  }

  // 6. Tareas de seguimiento
  md+='## 6. Tareas de seguimiento\n';
  md+='Crear en ✅ Tareas, relacionadas con la propiedad/proyecto:\n';
  md+='- '+($('f_proxima').value.trim()||'Confirmar datos pendientes con el contacto')+' (responsable: '+$('f_resp').value+', fecha: '+$('f_seguimiento').value+').\n';
  if(faltC.length)md+='- Completar datos mínimos faltantes: '+faltC.join(', ')+'.\n';
  md+='\n';

  // 7. Terreno extra
  if(esTerreno){
    md+='## 7. Datos de terreno (contexto para corrida financiera)\n';
    md+='> Servicios, Uso de suelo y Estatus legal ya van como propiedades de Notion en la tabla de la seccion 2. Esta seccion es contexto adicional para el analisis financiero.\n\n';
    md+='- Servicios: '+(state.serv.length?state.serv.join(', '):'S/I')+'\n';
    md+='- Frente: '+txt('f_frente')+' m · Fondo: '+txt('f_fondo')+' m\n';
    md+='- Uso de suelo/densidad: '+txt('f_uso')+'\n';
    md+='- Estatus legal: '+$('f_legal').value+'\n';
    md+='- Características: '+(state.caractTerr.length?state.caractTerr.join(', '):'S/I')+'\n';
    md+='- Modo de análisis: '+state.modo+'\n\n';
  }

  // 9. Unidades
  if(nU>1){
    md+='## 9. Unidades del conjunto\n';
    md+='| Unidad | m² terreno | m² construcción | Precio | Nota |\n|---|---|---|---|---|\n';
    unidades.forEach(function(u){md+='| '+u.nombre+' | '+(u.m2t||'(global)')+' | '+(u.m2c||'(global)')+' | '+(u.precio||'(global)')+' | '+(u.nota||'')+' |\n';});
    md+='\n';
  }

  // 10. Contenido de página
  md+='## 10. Contenido interno de la página\n';
  var fuertes=lineas('f_fuertes');
  if(fuertes.length){md+='**Puntos fuertes:**\n';fuertes.forEach(function(x){md+='- '+x+'\n';});}
  if(state.caract.length&&!esTerreno)md+='\n**Características:** '+state.caract.join(', ')+'\n';
  if($('f_notas').value.trim())md+='\n**Notas de campo:** '+$('f_notas').value.trim()+'\n';
  if(state.lat)md+='\n**Coordenadas:** '+state.lat.toFixed(6)+', '+state.lng.toFixed(6)+' · '+$('f_maps').value+'\n';
  if(state.anuncioUrl)md+='\n**Anuncio original:** '+state.anuncioUrl+'\n';
  md+='\n';

  // 11. Riesgos y pendientes
  md+='## 11. Riesgos / dudas / pendientes\n';
  var riesgos=lineas('f_riesgos');
  riesgos.forEach(function(r){md+='- '+r+'\n';});
  faltC.forEach(function(f){md+='- Falta dato mínimo: '+f+'\n';});
  if(!riesgos.length&&!faltC.length)md+='- Sin riesgos ni pendientes en la captura inicial.\n';
  md+='\n';

  // 12. Info faltante
  var falt=camposSI();
  md+='## 12. Información faltante (S/I)\n';
  if(falt.length)falt.forEach(function(f){md+='- '+f+'\n';});else md+='- Ninguno marcado como S/I.\n';
  md+='\n';

  // 13. Resumen
  md+='## 13. Resumen de la captura\n';
  md+='- '+nombre+' · '+(state.tipo||'tipo S/I')+' · '+state.oper+(nU>1?(' · '+unidades.length+' unidades'):'')+'\n';
  md+='- Zona: '+zonasStr+' · Captura: '+estatusCaptura+' · Propiedad: '+estatusProp+' · Responsable: '+$('f_resp').value+'\n';
  md+='- Capturada: '+$('f_fecha').value+' · Fuente: '+fuente.nombre+'\n\n';

  // 14. Confirmación
  md+='## 14. Confirmación solicitada al agente\n';
  md+='Al terminar, confirma: 1) nombre de las páginas creadas/actualizadas; 2) si fue alta o actualización; 3) campos vacíos por S/I; 4) relaciones creadas (Zona, Contactos, Operaciones, Tareas); 5) si se agregó alguna opción nueva (fuente/zona); 6) datos pendientes para publicar; 7) si se geolocalizo la dirección y qué referencia de Maps quedó registrada.\n';

  mdActual=md;$('mdOut').textContent=md;

  var precioTxt=conVenta?(pv.val!=null?('$'+fmt(pv.val)+' '+moneda):'precio S/I'):'';
  var rentaTxt=conRenta?(pr.val!=null?('$'+fmt(pr.val)+'/mes'):'renta S/I'):'';
  $('exitoBox').innerHTML='<strong>✅ Markdown generado</strong>Cópialo y pégalo en el chat del agente de Notion, o usa 📤 Enviar. Quedó guardado en el Historial.';
  $('resumenBox').innerHTML='<strong>Resumen</strong>'+nombre+' · '+(state.tipo||'tipo S/I')+' · '+state.oper+
    (nU>1?(' · '+unidades.length+' unidades'):'')+(precioTxt?(' · '+precioTxt):'')+(rentaTxt?(' · '+rentaTxt):'')+
    ' · Zona: '+zonasStr+'.<br>Incluye alta en Propiedades, '+people.length+' contacto(s) CRM y contenido de página.';
  if(falt.length){
    $('faltanteBox').style.display='';
    $('faltanteBox').innerHTML='<strong>⚠ Información faltante ('+falt.length+')</strong><ul>'+falt.map(function(f){return '<li>'+f+'</li>';}).join('')+'</ul>Ya quedó como pendiente en el markdown.';
  }else $('faltanteBox').style.display='none';
  $('outputArea').style.display='block';

  // guardar en historial
  var re=realElapsed();
  lastCaptureId=saveCapture(md,estatusProp,falt,estrellas.count,estrellas.quality,re,meta);
  // B4: al GAS va el asesor ORIGINAL del registro (no quien edita) + editadoPor
  var recGuardado=getHist().filter(function(x){return x.id===lastCaptureId;})[0]||{};
  gasSaveMarkdown(lastCaptureId,recGuardado.asesorNombre||'S/I',meta.modificado,'propiedad',estrellas.count===3?'completa':'sin terminar',nombre,md,dirVal,recGuardado.editadoPor||'');
  if(asesorActivo)updateAsesorStats(asesorActivo.id,estrellas,re);
  clearDraft(); // 2c: captura generada → el borrador ya no aplica
  sndSuccess();
  mostrarResultado(estrellas);
  checkLogros();
}

function propietarioNombre(){
  var prop=state.people.filter(function(p){return personTipos(p).some(function(t){return /Propietario|Cliente B/.test(t);});})[0];
  return prop&&prop.nombre?prop.nombre:'';
}
function propietarioNota(){
  var prop=state.people.filter(function(p){return personTipos(p).some(function(t){return /Propietario|Cliente B/.test(t);});})[0];
  if(prop&&prop.nombre)return 'relacionar contacto';
  if(state.ofrece==='Asesor / broker')return 'S/I — ofrecido por asesor, NO usar al asesor como propietario';
  return 'S/I';
}
function contactoOperativoNombre(){
  var op=state.people.filter(function(p){return personTipos(p).some(function(t){return /Asesor|Admin|Portero|Proveedor|Referido/.test(t);});})[0];
  return op&&op.nombre?op.nombre:'';
}
function contactoOperativoNota(){
  var op=state.people.filter(function(p){return personTipos(p).some(function(t){return /Asesor|Admin|Portero|Proveedor|Referido/.test(t);});})[0];
  if(op&&op.nombre)return 'relacionar contacto ('+personTipos(op).join(', ')+')';
  return 'S/I';
}
function camposSI(){
  var f=[];
  [['f_m2t','m² terreno'],['f_m2c','m² construcción'],['f_rec','recámaras'],['f_ban','baños completos'],['f_ban_medios','medios baños'],['f_est','estacionamientos'],['f_precio','precio venta'],['f_precio_renta','precio renta'],['f_cuota','cuota de mantenimiento'],['f_m2t_indiv','m² indivisos'],['f_frente','frente'],['f_fondo','fondo'],['f_uso','uso de suelo']].forEach(function(p){
    // Regla v0.7: Departamento/Penthouse con m² terreno en S/I o N/A no cuenta como faltante.
    if(p[0]==='f_m2t'&&SIN_M2T_OBLIG.indexOf(state.tipo)!==-1)return;
    if($(p[0])&&siOn(p[0]))f.push(p[1]+' (S/I)');
    else if($(p[0])&&naOn(p[0]))f.push(p[1]+' (N/A)');
  });
  if(zonasSel.length===0)f.push('zona');
  return f;
}

/* ===================== EASTER EGGS / LOGROS — v0.7 ===================== */
/* Hitos por asesor, derivados SIEMPRE del historial local (cap_hist). Los ya
   otorgados persisten en cap_logros para no repetir la celebración. */
var LOGROS=[
  {id:'primera',emoji:'🎉',titulo:'¡Primera captura!',desc:'Tu primera propiedad en Hauser. El primer ladrillo.',check:function(s){return s.total>=1;}},
  {id:'cap10',emoji:'🔥',titulo:'10 capturas',desc:'Diez propiedades capturadas. Máquina de scouteo.',check:function(s){return s.total>=10;}},
  {id:'cap25',emoji:'🏆',titulo:'25 capturas',desc:'Veinticinco propiedades. Leyenda de Hauser.',check:function(s){return s.total>=25;}},
  {id:'perfectas5',emoji:'💎',titulo:'5 capturas perfectas',desc:'Cinco capturas de 3 estrellas. Calidad pura.',check:function(s){return s.perfectas>=5;}},
  {id:'racha3',emoji:'⚡',titulo:'Racha de 3 días',desc:'Tres días seguidos capturando. Constancia.',check:function(s){return s.racha>=3;}},
  {id:'racha7',emoji:'🌟',titulo:'Racha de 7 días',desc:'Una semana entera sin fallar. Imparable.',check:function(s){return s.racha>=7;}}
];
function _logroStats(nombre){
  var caps=getHist().filter(function(r){return (r.asesorNombre||r.resp||'S/I')===nombre;});
  var dias={};
  caps.forEach(function(r){
    var d=new Date(r.capturadoEn||r.fecha);
    if(!isNaN(d))dias[d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate()]=1;
  });
  var racha=0,cur=new Date();
  while(dias[cur.getFullYear()+'-'+cur.getMonth()+'-'+cur.getDate()]){
    racha++;cur.setDate(cur.getDate()-1);
  }
  return{total:caps.length,
    perfectas:caps.filter(function(r){return (r.estrellas||0)>=3;}).length,
    racha:racha};
}
var _logroQueue=[];
function checkLogros(){
  var nombre=asesorActivo?asesorActivo.nombre:($('f_resp').value||'S/I');
  var earned=load('logros',{});
  var mios=earned[nombre]||[];
  var s=_logroStats(nombre);
  LOGROS.forEach(function(l){
    if(mios.indexOf(l.id)!==-1)return;
    if(l.check(s)){mios.push(l.id);_logroQueue.push(l);}
  });
  earned[nombre]=mios;save('logros',earned);
  // esperar a que la animación de estrellas del resultado termine
  if(_logroQueue.length)setTimeout(_showNextLogro,1600);
}
function _showNextLogro(){
  var l=_logroQueue.shift();if(!l)return;
  $('logroEmoji').textContent=l.emoji;
  $('logroTitulo').textContent=l.titulo;
  $('logroDesc').textContent=l.desc;
  $('logroOverlay').classList.add('show');
  launchConfetti();sndSuccess();
  if(navigator.vibrate)navigator.vibrate([40,60,40]);
}
function _closeLogro(){
  $('logroOverlay').classList.remove('show');
  if(_logroQueue.length)setTimeout(_showNextLogro,350);
}
$('logroCerrar').addEventListener('click',_closeLogro);
$('logroOverlay').addEventListener('click',function(e){if(e.target===this)_closeLogro();});

/* ===================== RESULTADO + CONFETTI — FASE 5 ===================== */
function updateAsesorStats(id,strs,elapsed){
  var lista=getAsesores();
  var a=lista.filter(function(x){return x.id===id;})[0];if(!a)return;
  a.totalCapturas=(a.totalCapturas||0)+1;
  a.totalEstrellas=(a.totalEstrellas||0)+strs.count;
  if(strs.s2)a.capturasEsenciales=(a.capturasEsenciales||0)+1;
  if(strs.s3)a.capturasCompletas=(a.capturasCompletas||0)+1;
  if(elapsed>0&&(!a.mejorTiempo||elapsed<a.mejorTiempo))a.mejorTiempo=elapsed;
  a.ultimaCaptura=new Date().toISOString();
  saveAsesores(lista);
}

function launchConfetti(){
  var box=$('confettiBox');if(!box)return;
  box.innerHTML='';box.style.display='block';
  var cols=['#2e6f40','#F0C040','#52C462','#7DD3FC','#fff','#f59e0b','#c4554d'];
  for(var i=0;i<60;i++){
    var c=document.createElement('div');c.className='confetti-p';
    c.style.left=Math.random()*100+'%';
    c.style.background=cols[Math.floor(Math.random()*cols.length)];
    c.style.animationDelay=(Math.random()*1.4)+'s';
    c.style.animationDuration=(Math.random()*1.2+1.8)+'s';
    c.style.width=(Math.random()*7+4)+'px';c.style.height=(Math.random()*7+4)+'px';
    c.style.borderRadius=Math.random()>.5?'50%':'2px';
    box.appendChild(c);
  }
  setTimeout(function(){box.style.display='none';box.innerHTML='';},4200);
}

function mostrarResultado(strs){
  $('resPropName').textContent=nombreBase();
  var re=realElapsed();
  var elapsedFmt=re>0?timerFmt(re):'sin cronómetro';
  $('resMeta').textContent=($('f_resp').value||'Asesor')+' · '+elapsedFmt+' · '+$('f_fecha').value;

  // badge de calidad
  var qLabels={Incompleta:'⚠ Incompleta',Esencial:'✓ Esencial',Publicable:'✓ Publicable',Completa:'🌟 Completa'};
  var qBadge=$('resQualityBadge');
  qBadge.textContent=qLabels[strs.quality]||strs.quality;
  qBadge.className='res-quality-badge res-q-'+(strs.quality||'').toLowerCase();

  // detalle de cada estrella
  var s1Txt=strs.s1?'¡En '+timerFmt(re)+' (≤ 5 min)!':'No alcanzó 5 min'+(re>0?' ('+timerFmt(re)+')':' — sin cronómetro')+'.';
  var s2Txt=strs.s2?'Todos los campos esenciales completos.':'Faltan: '+strs.falt2.slice(0,4).join(', ')+(strs.falt2.length>4?' y '+(strs.falt2.length-4)+' más':'')+'.';
  var s3Txt=strs.s3?'¡Excelente, captura íntegra!':(!strs.s2?'Completa primero los datos esenciales.':(strs.falt3Extra.length?'Falta: '+strs.falt3Extra.slice(0,3).join(', ')+'.':'Revisa todos los campos.'));
  $('resStarsDetail').innerHTML=
    '<div class="star-row'+(strs.s1?' earned':'')+'"><span class="sr-icon">'+(strs.s1?'⭐':'☆')+'</span><div class="sr-text"><strong>Velocidad</strong> · '+s1Txt+'</div></div>'+
    '<div class="star-row'+(strs.s2?' earned':'')+'"><span class="sr-icon">'+(strs.s2?'⭐':'☆')+'</span><div class="sr-text"><strong>Datos esenciales</strong> · '+s2Txt+'</div></div>'+
    '<div class="star-row'+(strs.s3?' earned':'')+'"><span class="sr-icon">'+(strs.s3?'⭐':'☆')+'</span><div class="sr-text"><strong>Captura completa</strong> · '+s3Txt+'</div></div>';

  // callout faltantes
  var showFalt=!strs.s2?strs.falt2:(!strs.s3?strs.falt3Extra:[]);
  if(showFalt.length){
    $('resFaltCallout').style.display='';
    $('resFaltList').innerHTML=showFalt.map(function(f){return '<li>'+f+'</li>';}).join('');
  }else{
    $('resFaltCallout').style.display='none';
  }

  // mostrar vista + mascota resultado
  showView('viewResult');
  var msg0=$('res0StarMsg');if(msg0)msg0.style.display=strs.count===0?'':'none';
  setTimeout(function(){
    if(strs.count>=2)setResMascotState('celebrating');
    else if(strs.count===1)setResMascotState('idle');
    else setResMascotState('sad');
  },100);

  // animar estrellas en secuencia
  var stars=[strs.s1,strs.s2,strs.s3];
  [$('resStar1'),$('resStar2'),$('resStar3')].forEach(function(el,i){
    el.className='res-star';
    setTimeout(function(){
      el.classList.add(stars[i]?'earned':'empty');
      if(stars[i])sndStar();
    },(i+1)*420);
  });

  // confetti con 3 estrellas; sonido de fallo con 0
  if(strs.count===3)setTimeout(launchConfetti,1380);
  if(strs.count===0)setTimeout(function(){sndError();},1000);
}

/* listeners pantalla de resultado */
$('resBtnCopy').addEventListener('click',function(){
  copyText(mdActual);
  var b=this;b.textContent='Copiado ✓';
  setTimeout(function(){b.textContent='Copiar markdown';},1800);
});
$('resBtnVerMd').addEventListener('click',function(){
  showView('viewCapture');
  if($('outputArea').scrollIntoView)$('outputArea').scrollIntoView({behavior:'smooth'});
});
$('resBtnOtra').addEventListener('click',function(){doReset();showView('viewCapture');});
$('resBtnCompletar').addEventListener('click',function(){showView('viewCapture');window.scrollTo({top:0,behavior:'smooth'});});

/* ===================== RANKING — FASE 6 ===================== */
function repStar(n){return (n||0)+' ⭐';}

function sortAsesores(lista){
  return lista.slice().sort(function(a,b){
    var stA=a.totalEstrellas||0,stB=b.totalEstrellas||0;
    if(stA!==stB)return stB-stA;
    var capA=a.totalCapturas||0,capB=b.totalCapturas||0;
    var avA=capA?stA/capA:0,avB=capB?stB/capB:0;
    if(Math.abs(avA-avB)>.005)return avB-avA;
    return (a.mejorTiempo||99999)-(b.mejorTiempo||99999);
  });
}

/* ===== ranking v0.7: filtros fecha/asesor + paginación (solo modo nube) ===== */
var rankFiltro={fecha:'todo',asesor:''};
var RANK_PAGE=10;var rankShown=RANK_PAGE;
var _rankCapturasCache=null;var _rankMode='local';

function _rankSetFiltrosVisible(on){
  var f=$('rankingFiltros');var a=$('rankingAsesores');
  if(f)f.style.display=on?'flex':'none';
  if(a)a.style.display=on?'flex':'none';
}
function rankCutoff(){
  var now=Date.now();
  if(rankFiltro.fecha==='hoy'){var d=new Date();d.setHours(0,0,0,0);return d.getTime();}
  if(rankFiltro.fecha==='7d')return now-7*864e5;
  if(rankFiltro.fecha==='30d')return now-30*864e5;
  return 0;
}
/* misma agregación que hace el GAS, pero client-side sobre filas ya filtradas */
function aggAsesoresFromCapturas(rows){
  var map={};
  rows.forEach(function(c){
    var a=String(c.asesor||'S/I');
    var m=map[a]||(map[a]={id:null,nombre:a,totalCapturas:0,totalEstrellas:0,
      capturasCompletas:0,capturasEsenciales:0,mejorTiempo:null,ultimaCaptura:null});
    m.totalCapturas++;
    m.totalEstrellas+=parseInt(c.estrellas,10)||0;
    var cal=String(c.calidad||'');
    if(cal==='Completa')m.capturasCompletas++;
    if(cal==='Completa'||cal==='Publicable'||cal==='Esencial')m.capturasEsenciales++;
    var el=0;try{el=parseInt(JSON.parse(c.propiedad_json).elapsed,10)||0;}catch(e){}
    if(el>0&&(!m.mejorTiempo||el<m.mejorTiempo))m.mejorTiempo=el;
    var ts=String(c.timestamp||c.capturadoEn||'');
    if(ts&&(!m.ultimaCaptura||ts>m.ultimaCaptura))m.ultimaCaptura=ts;
  });
  return Object.keys(map).map(function(k){return map[k];});
}
function renderRankAsesorChips(rows){
  var wrap=$('rankingAsesores');if(!wrap)return;
  var names={};rows.forEach(function(c){names[String(c.asesor||'S/I')]=1;});
  var list=Object.keys(names).sort();
  var html='<button type="button" class="chip chip-sm'+(rankFiltro.asesor===''?' sel':'')+'" data-a="">Todos</button>';
  list.forEach(function(n){
    html+='<button type="button" class="chip chip-sm'+(rankFiltro.asesor===n?' sel':'')+'" data-a="'+esc(n)+'">'+esc(n)+'</button>';
  });
  wrap.innerHTML=html;
}
function renderRankingFiltrado(){
  var rows=(_rankCapturasCache||[]).filter(function(c){return String(c.tipo)==='propiedad';});
  renderRankAsesorChips(rows);
  var cut=rankCutoff();
  var f=rows.filter(function(c){
    if(cut){var t=Date.parse(c.timestamp||c.capturadoEn||'');if(!(t&&t>=cut))return false;}
    if(rankFiltro.asesor&&String(c.asesor||'S/I')!==rankFiltro.asesor)return false;
    return true;
  });
  var modoEl=$('rankingModo');
  var filtrado=(rankFiltro.fecha!=='todo'||rankFiltro.asesor);
  if(modoEl)modoEl.textContent='🌐 Ranking compartido ('+f.length+' capturas'+(filtrado?' · filtrado':' de todos los dispositivos')+')';
  renderRankingConLista(sortAsesores(aggAsesoresFromCapturas(f)));
}
$('rankingFiltros').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  this.querySelectorAll('.chip').forEach(function(x){x.classList.remove('sel');});
  c.classList.add('sel');
  rankFiltro.fecha=c.dataset.v;rankShown=RANK_PAGE;
  if(_rankMode==='cloud')renderRankingFiltrado();
});
$('rankingAsesores').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  rankFiltro.asesor=c.dataset.a||'';rankShown=RANK_PAGE;
  if(_rankMode==='cloud')renderRankingFiltrado();
});
$('rankingList').addEventListener('click',function(e){
  if(!e.target.closest('[data-rank-more]'))return;
  rankShown+=RANK_PAGE;
  if(_rankMode==='cloud')renderRankingFiltrado();else renderRankingLocal();
});

function renderRanking(){
  var wrap=$('rankingList');if(!wrap)return;
  var modoEl=$('rankingModo');
  rankShown=RANK_PAGE;
  if(CFG.endpoint){
    wrap.innerHTML='<div class="empty" style="margin-top:48px">⏳ Cargando ranking compartido…</div>';
    if(modoEl)modoEl.textContent='';
    gasGet(function(data){
      if(data&&data.capturas&&data.capturas.length>1){
        _rankMode='cloud';
        _rankCapturasCache=parseGasRows(data.capturas);
        _rankSetFiltrosVisible(true);
        renderRankingFiltrado();
      }else{
        _rankMode='local';_rankSetFiltrosVisible(false);
        if(modoEl)modoEl.textContent='📱 Ranking local (sin datos en la nube aún)';
        renderRankingLocal();
      }
    });
  }else{
    _rankMode='local';_rankSetFiltrosVisible(false);
    if(modoEl)modoEl.textContent='📱 Ranking local · Configura un endpoint en ⚙️ para compartir';
    renderRankingLocal();
  }
}
function renderRankingLocal(){
  renderRankingConLista(sortAsesores(getAsesores()));
}
function renderRankingConLista(full){
  var wrap=$('rankingList');if(!wrap)return;
  var lista=full.filter(function(a){return a.totalCapturas>0;});
  if(!lista.length){
    wrap.innerHTML='<div class="empty" style="margin-top:48px">Sin capturas aún.<br>Captura propiedades para aparecer en el ranking.</div>';
    return;
  }
  var html='';

  // podio top-3
  html+='<div class="podio">';
  var podioOrder=[1,0,2];  // izq=plata, centro=oro, der=bronce
  podioOrder.forEach(function(idx){
    if(idx>=lista.length)return;
    var a=lista[idx];
    var medal=['🥇','🥈','🥉'][idx];
    var posClass='pos-'+(idx+1);
    var init=a.nombre.split(' ').map(function(p){return p[0];}).join('').toUpperCase().slice(0,2);
    var avg=a.totalCapturas?(a.totalEstrellas/a.totalCapturas).toFixed(1):'0.0';
    html+='<div class="podio-card '+posClass+'">'+
      '<div class="podio-medal">'+medal+'</div>'+
      '<div class="podio-avatar">'+init+'</div>'+
      '<div class="podio-name">'+a.nombre+'</div>'+
      '<div class="podio-stars">'+repStar(a.totalEstrellas||0)+'</div>'+
      '<div class="podio-meta">'+(a.totalCapturas||0)+' cap · '+avg+' prom</div>'+
      '</div>';
  });
  html+='</div>';

  // tarjetas de asesores (paginadas v0.7: rankShown por página)
  var visibles=lista.slice(0,rankShown);
  visibles.forEach(function(a,i){
    var pos=i+1;
    var init=a.nombre.split(' ').map(function(p){return p[0];}).join('').toUpperCase().slice(0,2);
    var avg=a.totalCapturas?(a.totalEstrellas/a.totalCapturas).toFixed(1):'—';
    var best=a.mejorTiempo?timerFmt(a.mejorTiempo):'—';
    var last=a.ultimaCaptura?new Date(a.ultimaCaptura).toLocaleDateString('es-MX'):'—';
    html+='<div class="rank-card">'+
      '<div class="rank-pos">'+pos+'</div>'+
      '<div class="rank-avatar">'+init+'</div>'+
      '<div class="rank-body">'+
        '<div class="rank-name">'+a.nombre+'</div>'+
        '<div class="rank-stats">'+
          '<span>⭐ '+(a.totalEstrellas||0)+' total</span>'+
          '<span>📊 '+avg+' prom</span>'+
          '<span>🏠 '+(a.totalCapturas||0)+' cap</span>'+
          (a.mejorTiempo?'<span>⚡ '+best+'</span>':'')+
        '</div>'+
        '<div class="rank-sub">'+
          (a.capturasCompletas?'<span>🌟 '+a.capturasCompletas+' completa(s)</span>':'')+
          (a.capturasEsenciales?'<span>✓ '+a.capturasEsenciales+' esencial(es)</span>':'')+
          (last!=='—'?'<span class="rank-last">Última: '+last+'</span>':'')+
        '</div>'+
      '</div>'+
      '</div>';
  });

  // botón de paginación
  if(lista.length>rankShown){
    html+='<button type="button" class="btn" data-rank-more style="width:100%;margin-top:10px">Ver más ↓ ('+(lista.length-rankShown)+' restante'+(lista.length-rankShown===1?'':'s')+')</button>';
  }

  // asesores sin capturas al final
  var sinCap=full.filter(function(a){return !a.totalCapturas;});
  if(sinCap.length){
    html+='<div class="rank-sin-cap">Sin capturas: '+sinCap.map(function(a){return a.nombre;}).join(', ')+'</div>';
  }

  wrap.innerHTML=html;
}

/* ===================== HISTORIAL ===================== */
function histStars(n,quality){
  var s='';for(var i=0;i<3;i++)s+=(i<(n||0)?'⭐':'☆');
  return s+(quality?' <span class="hi-quality">'+quality+'</span>':'');
}
function getHist(){return load('hist',[]);}
function setHist(h){save('hist',h);updateBadge();}
function saveCapture(md,estatus,falt,stars,quality,elapsed,meta){
  var h=getHist();
  var now=meta?meta.modificado:new Date().toISOString();
  var isEdit=!!state.editId;
  var id=meta?meta.uuid:(isEdit?state.editId:genUUID());
  var orig=isEdit?h.filter(function(x){return x.id===id;})[0]:null;
  var capturadoEn=meta?meta.creado:(orig?(orig.capturadoEn||orig.fecha):now);
  var ediciones=meta?meta.ediciones:(orig?((orig.ediciones||0)+(isEdit?1:0)):0);
  // B4: en ediciones el asesor ORIGINAL se conserva; quien edita queda en editadoPor
  var actorNombre=asesorActivo?asesorActivo.nombre:($('f_resp').value||'S/I');
  var rec={
    id:id,fecha:now,
    capturadoEn:capturadoEn,modificadoEn:ediciones>0?now:null,
    ediciones:ediciones,
    asesorId:(isEdit&&orig&&orig.asesorId)?orig.asesorId:(asesorActivo?asesorActivo.id:null),
    asesorNombre:(isEdit&&orig&&orig.asesorNombre)?orig.asesorNombre:actorNombre,
    editadoPor:isEdit?actorNombre:((orig&&orig.editadoPor)||''),
    resp:$('f_resp').value,
    nombre:nombreBase(),direccion:$('f_direccion').value.trim(),zona:zonasSel.map(function(z){return z.n;}).join(' / ')||'S/I',
    tipo:state.tipo,oper:state.oper,estatus:estatus,estatusCaptura:stars===3?'Listo':(stars>=2?'En progreso':'Sin empezar'),fuente:fuenteVal().nombre,
    people:state.people.map(function(p){return (p.nombre||'?')+' ('+personTipos(p).join(', ')+')';}),
    anuncio:state.anuncioUrl||'',maps:$('f_maps').value,
    driveUrl:(orig&&orig.driveUrl)||'',
    md:md,estado:falt.length?'Con faltantes':'Markdown generado',
    estrellas:stars||0,calidad:quality||'',elapsed:elapsed||0,
    faltantes:falt,copiado:false,enviado:false,edit:now,
    formData:snapshotForm()
  };
  if(isEdit)h=h.filter(function(x){return x.id!==id;});
  h.unshift(rec);setHist(h);
  zonasSel.forEach(function(z){zonaTouch(z.n);});
  if(CFG.endpoint){var p=buildGasPayload(rec);gasPost(p).then(function(r){if(r&&r.ok){var hh=getHist();var rr=hh.filter(function(x){return x.id===id;})[0];if(rr){rr.enviado=true;setHist(hh);}}}).catch(function(){queueForRetry(p);});}
  return id;
}
function renderHist(){
  var wrap=$('histList');
  // Build filters once
  var filt=$('histFilters');
  if(!filt.dataset.built){
    ['Todos','Pendientes','Enviados','Con faltantes'].forEach(function(f,i){
      var b=document.createElement('button');b.type='button';b.className='chip chip-sm'+(i===0?' sel':'');b.textContent=f;b.dataset.f=f;b.dataset.estado='1';
      b.addEventListener('click',function(){filt.querySelectorAll('.chip[data-estado]').forEach(function(x){x.classList.remove('sel');});b.classList.add('sel');_renderHistList(getHist());});
      filt.appendChild(b);
    });
    // v0.7 B3: botón que despliega el panel de filtros combinables del catálogo
    catFiltersBtn=document.createElement('button');
    catFiltersBtn.type='button';catFiltersBtn.className='chip chip-sm';
    catFiltersBtn.innerHTML='🎛️ + filtros<span class="cat-fbadge"></span>';
    catFiltersBtn.addEventListener('click',function(){
      var p=$('catPanel');var abrir=p.hidden;
      if(abrir)buildCatPanel();
      p.hidden=!abrir;
      catSyncFiltersBtn();
    });
    filt.appendChild(catFiltersBtn);
    $('catPanel').addEventListener('click',catPanelClick);
    $('catActive').addEventListener('click',catActiveClick);
    $('catClear').addEventListener('click',function(){
      catFilt={precio:null,tipos:[],zonas:[],amen:[]};
      this.classList.remove('flash-ok');void this.offsetWidth;this.classList.add('flash-ok');
      buildCatPanel();catRefresh();
    });
    filt.dataset.built='1';
  }
  if(!$('catPanel').hidden)buildCatPanel();
  // Render local immediately
  _renderHistList(getHist());
  // Cloud sync in background (cloud is source of truth)
  if(CFG.endpoint){
    gasGet(function(data){
      if(data&&data.capturas&&data.capturas.length>1){
        var cloudRecs=gasCapturasToLocalHist(parseGasRows(data.capturas));
        // v0.7.1 F-1: el GET trae fotos:{uuid:fotoUrl} desde el Sheet (v3.6);
        // manda sobre lo que diga propiedad_json (puede venir de antes de subir fotos)
        if(data.fotos)cloudRecs.forEach(function(r){if(data.fotos[r.id])r.fotoUrl=data.fotos[r.id];});
        // B4: tombstones — capturas borradas con PIN cuya eliminación del Sheet
        // aún no se confirma NO deben revivir; si la nube ya no las trae, purgar
        var tomb=load('del_pend',[]);
        if(tomb.length){
          var cloudIds=cloudRecs.map(function(r){return r.id;});
          var tomb2=tomb.filter(function(id){return cloudIds.indexOf(id)!==-1;});
          if(tomb2.length!==tomb.length)save('del_pend',tomb2);
          cloudRecs=cloudRecs.filter(function(r){return tomb2.indexOf(r.id)===-1;});
        }
        var queueIds=load('gasqueue',[]).map(function(p){return p.id;});
        var localOnly=getHist().filter(function(r){return queueIds.indexOf(r.id)!==-1;});
        var merged=cloudRecs.concat(localOnly);
        merged.sort(function(a,b){return(b.fecha||'').localeCompare(a.fecha||'');});
        setHist(merged);
        _renderHistList(merged);
        maybeRefreshFotos(merged);
      }
    });
  }
}
/* v0.7.1 F-1: las carpetas Drive reciben fotos DESPUÉS de la captura; pedirle
   al GAS que recalcule miniaturas (v3.6) cuando haya registros con carpeta y
   sin foto. Throttle de 5 min para no golpear Drive en cada visita. */
function maybeRefreshFotos(hist){
  if(!CFG.endpoint)return;
  var falta=hist.some(function(r){return r.driveUrl&&!r.fotoUrl;});
  if(!falta)return;
  var last=parseInt(load('fotos_refresh_ts',0),10)||0;
  if(Date.now()-last<5*60*1000)return;
  save('fotos_refresh_ts',Date.now());
  gasPost({action:'refreshFotos'}).then(function(r){
    if(!r||!r.ok||!r.fotos)return;
    var h=getHist(),ch=false;
    h.forEach(function(rec){if(r.fotos[rec.id]&&rec.fotoUrl!==r.fotos[rec.id]){rec.fotoUrl=r.fotos[rec.id];ch=true;}});
    if(ch){setHist(h);var vh=$('viewHistory');if(vh&&vh.classList.contains('active'))_renderHistList(h);}
  }).catch(function(){});
}
function _renderHistList(h){
  var ctH=load('ct_hist',[]).map(function(r){return Object.assign({},r,{_isCt:true});});
  var all=h.concat(ctH).sort(function(a,b){return(b.fecha||'').localeCompare(a.fecha||'');});
  var filt=$('histFilters');
  var selEstado=filt.querySelector('.chip[data-estado].sel');
  var active=selEstado?selEstado.dataset.f:'Todos';
  var list=all.filter(function(r){
    if(active==='Pendientes'&&r.enviado)return false;
    if(active==='Enviados'&&!r.enviado)return false;
    if(active==='Con faltantes'&&(r._isCt||!r.faltantes||!r.faltantes.length))return false;
    return catMatch(r);
  });
  catRenderActive();
  catUpdateCount(list.length,all.length);
  var wrap=$('histList');wrap.innerHTML='';
  if(!list.length){wrap.innerHTML='<div class="empty">'+(catActiveCount()?'Sin resultados con estos filtros.':'Sin capturas todavía.')+'</div>';return;}
  list.forEach(function(r){
    var item=document.createElement('div');
    item.dataset.rid=r.id;if(r._isCt)item.dataset.ct='1';
    var editDate=r.modificadoEn?'<br><span class="hi-edit-date">Editado: '+new Date(r.modificadoEn).toLocaleString('es-MX')+'</span>':'';
    if(r._isCt){
      item.className='hist-item hist-item-ct';
      var sc=r.enviado?'sent':'gen',st=r.enviado?'Enviado':'Generado';
      item.innerHTML='<div class="hi-top"><div>'+
        '<div class="hi-name"><span class="hi-ct-badge">🤝</span>'+esc(r.nombre||'Sin nombre')+'</div>'+
        (r.estrellas?'<div class="hi-stars">'+histStars(r.estrellas,r.calidad)+'</div>':'')+
        '<div class="hi-meta">'+esc(r.tipo||'?')+' · '+(r.tel||r.email||'S/I')+' · '+(r.asesor||'S/I')+
        '<br>'+new Date(r.capturadoEn||r.fecha).toLocaleString('es-MX')+editDate+'</div></div>'+
        '<span class="hi-state '+sc+'">'+st+'</span></div>'+
        '<div class="hi-actions">'+
          '<button type="button" class="btn" data-copy-ct="'+r.id+'">Copiar</button>'+
          '<button type="button" class="btn" data-vcard2-ct="'+r.id+'">📇 vCard</button>'+
          '<button type="button" class="btn" data-view2-ct="'+r.id+'">Ver MD</button>'+
          '<button type="button" class="btn" data-edit-ct="'+r.id+'">Editar</button>'+
          (r.enviado?'<button type="button" class="btn" data-pend-ct="'+r.id+'">Marcar pendiente</button>':'<button type="button" class="btn" data-sent-ct="'+r.id+'">Marcar enviada</button>')+
          '<button type="button" class="btn btn-danger" data-del-ct="'+r.id+'">Borrar</button>'+
        '</div><pre style="display:none" id="md_ct_'+r.id+'">'+esc(r.md||'')+'</pre>';
    } else {
      // v0.7 B3: tarjeta de catálogo — hero visual arriba, precio grande, secundarios abajo
      item.className='hist-item cat-card';
      var sc=r.enviado?'sent':(r.faltantes&&r.faltantes.length?'miss':'gen');
      var st=r.enviado?'Enviada a Notion':(r.faltantes&&r.faltantes.length?'Con faltantes':'Generada');
      var fd=r.formData||{},stx=fd._state||{};
      var pr=catPrecioDe(r);
      var monedaCard=(fd.f_moneda||'MXN');
      var precioHtml=pr.v!=null
        ?'<div class="cat-price">$'+fmt(pr.v)+' <span class="cat-cur">'+esc(monedaCard)+'</span></div>'
        :(pr.r!=null
          ?'<div class="cat-price">$'+fmt(pr.r)+' <span class="cat-cur">'+esc(monedaCard)+'/mes</span></div>'
          :'<div class="cat-price cat-price-si">Precio S/I</div>');
      // F1: specs de la propiedad primero y en grande; F4: foto de Drive si existe
      var specs=[];
      if(fd.f_rec)specs.push('🛏 '+esc(fd.f_rec));
      if(fd.f_ban)specs.push('🛁 '+esc(fd.f_ban)+(fd.f_ban_medios?('+'+esc(fd.f_ban_medios)):''));
      if(fd.f_m2c)specs.push('📐 '+esc(fd.f_m2c)+' m²');
      if(fd.f_m2t)specs.push('🌱 '+esc(fd.f_m2t)+' m² terr');
      var carTop=(stx.caract||[]).slice(0,3).join(' · ');
      item.innerHTML='<div class="cat-hero">'+
        (r.fotoUrl?'<img class="cat-hero-img" src="'+esc(r.fotoUrl)+'" loading="lazy" alt="">':(CAT_TIPO_EMOJI[r.tipo]||'🏠'))+
        (r.driveUrl?'<span class="cat-hero-badge">📷</span>':'')+'</div>'+
        '<div class="cat-body">'+precioHtml+
        '<div class="hi-name">'+esc(r.nombre||'Sin nombre')+'</div>'+
        '<div class="cat-summary">'+esc(r.tipo||'?')+' · '+esc(r.oper||'?')+' · '+esc(r.zona||'?')+'</div>'+
        (specs.length?'<div class="cat-specs">'+specs.join('&ensp;')+'</div>':'')+
        (carTop?'<div class="cat-caract">✨ '+esc(carTop)+'</div>':'')+
        (r.estrellas!=null?'<div class="hi-stars">'+histStars(r.estrellas,r.calidad)+'</div>':'')+
        '<div class="hi-actions">'+
          // F2: la carpeta Drive es un BOTÓN, nunca un link/markdown crudo en la tarjeta
          (r.driveUrl?'<button type="button" class="btn" data-drive="'+r.id+'">📷 Fotos Drive</button>':'')+
          '<button type="button" class="btn" data-copy="'+r.id+'">Copiar MD</button>'+
          (r.maps?'<button type="button" class="btn" data-maps="'+r.id+'">Maps</button>':'')+
          '<button type="button" class="btn" data-edit-prop="'+r.id+'">Editar</button>'+
          (r.enviado?'<button type="button" class="btn" data-pend="'+r.id+'">Marcar pendiente</button>':'<button type="button" class="btn" data-sent="'+r.id+'">Marcar enviada</button>')+
          '<button type="button" class="btn btn-danger" data-del2="'+r.id+'">Borrar</button>'+
        '</div>'+
        // F3: metadatos de la captura pequeños y hasta abajo
        '<div class="cat-meta"><span class="hi-state '+sc+'">'+st+'</span> '+
        new Date(r.capturadoEn||r.fecha).toLocaleDateString('es-MX')+' · '+esc(r.asesorNombre||r.resp||'S/I')+
        (r.editadoPor&&r.editadoPor!==r.asesorNombre?' · ✏️ '+esc(r.editadoPor):'')+editDate+'</div></div>';
    }
    wrap.appendChild(item);
  });
}

/* ===================== CATÁLOGO FILTRABLE — v0.7 B3 =====================
   Filtros combinables (precio, tipo, zonas, amenidades) por manipulación
   directa de chips. OR dentro de tipo/zona, AND en amenidades, precio único.
   Los contactos se ocultan mientras haya filtros de catálogo activos (no
   tienen precio/zona/amenidades). */
var catFilt={precio:null,tipos:[],zonas:[],amen:[]};
var catFiltersBtn=null;
var CAT_PRECIOS_VENTA=[{l:'< $1M',min:0,max:1e6},{l:'$1–3M',min:1e6,max:3e6},{l:'$3–5M',min:3e6,max:5e6},{l:'> $5M',min:5e6,max:Infinity}];
var CAT_PRECIOS_RENTA=[{l:'< $10k',min:0,max:1e4},{l:'$10–20k',min:1e4,max:2e4},{l:'$20–35k',min:2e4,max:3.5e4},{l:'> $35k',min:3.5e4,max:Infinity}];
var CAT_TIPO_EMOJI={'Casa':'🏡','Casa fin de semana':'🏖️','Casa en condominio':'🏘️','Departamento':'🏢','Penthouse':'🌆','Terreno':'🌳','Local comercial':'🏬','Oficina':'💼','Bodega / Nave':'🏭','Edificio':'🏙️','Rancho / Quinta':'🌾'};

function catPrecioDe(r){
  var fd=r.formData||{};
  return{v:parseNumeroES(fd.f_precio||''),r:parseNumeroES(fd.f_precio_renta||'')};
}
function catZonasDe(r){
  return String(r.zona||'').split(/[\/,]/).map(function(z){return z.trim();}).filter(function(z){return z&&z!=='S/I';});
}
function catAmenDe(r){
  var st=(r.formData||{})._state||{};
  return(st.caract||[]).concat(st.caractTerr||[]);
}
function catActiveCount(){return(catFilt.precio?1:0)+catFilt.tipos.length+catFilt.zonas.length+catFilt.amen.length;}
function catMatch(r){
  if(!catActiveCount())return true;
  if(r._isCt)return false;
  if(catFilt.tipos.length&&catFilt.tipos.indexOf(r.tipo)===-1)return false;
  if(catFilt.zonas.length){
    var zs=catZonasDe(r);
    if(!catFilt.zonas.some(function(z){return zs.indexOf(z)!==-1;}))return false;
  }
  if(catFilt.amen.length){
    var am=catAmenDe(r);
    if(!catFilt.amen.every(function(a){return am.indexOf(a)!==-1;}))return false;
  }
  if(catFilt.precio){
    var p=catPrecioDe(r);
    var val=catFilt.precio.t==='venta'?p.v:p.r;
    if(val==null||val<catFilt.precio.min||val>=catFilt.precio.max)return false;
  }
  return true;
}
function catChipEl(label,cg,cv,sel,extraData){
  var b=document.createElement('button');b.type='button';
  b.className='chip'+(sel?' sel':'');b.textContent=label;
  b.dataset.cg=cg;b.dataset.cv=cv;
  if(extraData)Object.keys(extraData).forEach(function(k){b.dataset[k]=extraData[k];});
  return b;
}
function buildCatPanel(){
  var h=getHist();
  // precio (rangos fijos, agrupados venta/renta)
  [['cgPrecioVenta',CAT_PRECIOS_VENTA,'venta'],['cgPrecioRenta',CAT_PRECIOS_RENTA,'renta']].forEach(function(cfg){
    var box=$(cfg[0]);box.innerHTML='';
    cfg[1].forEach(function(rg){
      var sel=!!(catFilt.precio&&catFilt.precio.t===cfg[2]&&catFilt.precio.l===rg.l);
      box.appendChild(catChipEl(rg.l,'precio',rg.l,sel,{ct:cfg[2],min:String(rg.min),max:rg.max===Infinity?'inf':String(rg.max)}));
    });
  });
  // grupos dinámicos derivados de las capturas reales, ordenados por frecuencia
  function freqMap(getVals){
    var m={};
    h.forEach(function(r){getVals(r).forEach(function(v){if(v)m[v]=(m[v]||0)+1;});});
    return Object.keys(m).sort(function(a,b){return m[b]-m[a]||a.localeCompare(b);});
  }
  [['cgTipo','cgTipoWrap','tipos',freqMap(function(r){return r.tipo?[r.tipo]:[];}),Infinity],
   ['cgZona','cgZonaWrap','zonas',freqMap(catZonasDe),Infinity],
   ['cgAmen','cgAmenWrap','amen',freqMap(catAmenDe),12]
  ].forEach(function(cfg){
    var box=$(cfg[0]),vals=cfg[3].slice(0,cfg[4]);
    // conservar seleccionados aunque salgan del top por frecuencia
    catFilt[cfg[2]].forEach(function(v){if(vals.indexOf(v)===-1)vals.push(v);});
    box.innerHTML='';
    vals.forEach(function(v){box.appendChild(catChipEl(v,cfg[2],v,catFilt[cfg[2]].indexOf(v)!==-1));});
    $(cfg[1]).style.display=vals.length?'':'none';
  });
}
function catPanelClick(e){
  var c=e.target.closest('.chip');if(!c||!c.dataset.cg)return;
  var g=c.dataset.cg,v=c.dataset.cv;
  if(g==='precio'){
    var ya=!!(catFilt.precio&&catFilt.precio.t===c.dataset.ct&&catFilt.precio.l===v);
    catFilt.precio=ya?null:{t:c.dataset.ct,l:v,min:parseFloat(c.dataset.min),max:c.dataset.max==='inf'?Infinity:parseFloat(c.dataset.max)};
    // selección única entre venta y renta: refrescar ambos grupos
    ['cgPrecioVenta','cgPrecioRenta'].forEach(function(id){
      $(id).querySelectorAll('.chip').forEach(function(x){
        x.classList.toggle('sel',!!(catFilt.precio&&catFilt.precio.t===x.dataset.ct&&catFilt.precio.l===x.dataset.cv));
      });
    });
  }else{
    var arr=catFilt[g],i=arr.indexOf(v);
    if(i===-1)arr.push(v);else arr.splice(i,1);
    c.classList.toggle('sel',i===-1);
  }
  catRefresh();
}
function catActiveClick(e){
  var b=e.target.closest('[data-rmcg]');if(!b)return;
  var g=b.dataset.rmcg,v=b.dataset.rmcv;
  if(g==='precio')catFilt.precio=null;
  else{var arr=catFilt[g],i=arr.indexOf(v);if(i!==-1)arr.splice(i,1);}
  if(!$('catPanel').hidden)buildCatPanel();
  catRefresh();
}
function catRenderActive(){
  var box=$('catActive');if(!box)return;
  var tags=[];
  if(catFilt.precio)tags.push({g:'precio',v:catFilt.precio.l,l:'💰 '+catFilt.precio.l+(catFilt.precio.t==='renta'?' /mes':'')});
  catFilt.tipos.forEach(function(v){tags.push({g:'tipos',v:v,l:(CAT_TIPO_EMOJI[v]||'🏠')+' '+v});});
  catFilt.zonas.forEach(function(v){tags.push({g:'zonas',v:v,l:'📍 '+v});});
  catFilt.amen.forEach(function(v){tags.push({g:'amen',v:v,l:'✨ '+v});});
  box.innerHTML=tags.map(function(t){
    return '<span class="tag">'+esc(t.l)+'<button type="button" data-rmcg="'+esc(t.g)+'" data-rmcv="'+esc(t.v)+'" aria-label="Quitar filtro">×</button></span>';
  }).join('');
}
function catUpdateCount(n,total){
  var el=$('catCount');if(!el)return;
  var txt=catActiveCount()?(n+' de '+total+' capturas'):(total+' capturas');
  if(el.textContent!==txt){
    el.textContent=txt;
    el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');
  }
}
function catSyncFiltersBtn(){
  if(!catFiltersBtn)return;
  var nAct=catActiveCount();
  catFiltersBtn.classList.toggle('sel',nAct>0||!$('catPanel').hidden);
  var badge=catFiltersBtn.querySelector('.cat-fbadge');
  if(badge){badge.textContent=nAct;badge.style.display=nAct?'inline-block':'none';}
}
function catRefresh(){
  catSyncFiltersBtn();
  _renderHistList(getHist());
}
/* Feedback inmediato: flash del pill de estado tras marcar enviada/pendiente */
function flashHistState(id){
  var el=$('histList').querySelector('[data-rid="'+id+'"] .hi-state');
  if(el)el.classList.add('flash-ok');
}

$('histList').addEventListener('click',function(e){
  var t=e.target;var h=getHist();
  function find(id){return h.filter(function(r){return r.id===id;})[0];}
  function findCt(id){var ch=load('ct_hist',[]);return ch.filter(function(r){return r.id===id;})[0];}
  // Propiedades
  if(t.dataset.copy){var r=find(t.dataset.copy);if(r){copyText(r.md);r.copiado=true;setHist(h);t.textContent='Copiado ✓';t.classList.add('flash-ok');}}
  if(t.dataset.view2){var pre=$('md_'+t.dataset.view2);if(pre)pre.style.display=pre.style.display==='none'?'block':'none';}
  if(t.dataset.maps){var r2=find(t.dataset.maps);if(r2&&r2.maps)window.open(r2.maps,'_blank');}
  if(t.dataset.drive){var rDrv=find(t.dataset.drive);if(rDrv&&rDrv.driveUrl)window.open(rDrv.driveUrl,'_blank');}
  if(t.dataset.editProp){abrirEdicion(t.dataset.editProp);}
  if(t.dataset.sent){find(t.dataset.sent).enviado=true;setHist(h);_renderHistList(h);flashHistState(t.dataset.sent);}
  if(t.dataset.pend){find(t.dataset.pend).enviado=false;setHist(h);_renderHistList(h);flashHistState(t.dataset.pend);}
  if(t.dataset.del2){openPinDelete(t.dataset.del2,false);}
  // Contactos
  if(t.dataset.copyCt){var rc=findCt(t.dataset.copyCt);if(rc){copyText(rc.md);t.textContent='Copiado ✓';t.classList.add('flash-ok');}}
  if(t.dataset.vcard2Ct){shareVCard(findCt(t.dataset.vcard2Ct));}
  if(t.dataset.view2Ct){var pre2=$('md_ct_'+t.dataset.view2Ct);if(pre2)pre2.style.display=pre2.style.display==='none'?'block':'none';}
  if(t.dataset.editCt){abrirEdicionCt(t.dataset.editCt);}
  if(t.dataset.sentCt){var ch=load('ct_hist',[]);var rc2=ch.filter(function(r){return r.id===t.dataset.sentCt;})[0];if(rc2){rc2.enviado=true;save('ct_hist',ch);updateCtBadge();_renderHistList(getHist());}}
  if(t.dataset.pendCt){var ch=load('ct_hist',[]);var rc3=ch.filter(function(r){return r.id===t.dataset.pendCt;})[0];if(rc3){rc3.enviado=false;save('ct_hist',ch);updateCtBadge();_renderHistList(getHist());}}
  if(t.dataset.delCt){openPinDelete(t.dataset.delCt,true);}
  // v0.7: tap directo en la tarjeta (fuera de botones y del <pre> de markdown) = detalle SOLO LECTURA
  if(!t.closest('button')&&!t.closest('pre')){
    var it=t.closest('.hist-item');
    if(it&&it.dataset.rid)openHistDetail(it.dataset.rid,it.dataset.ct==='1');
  }
});

/* ===================== BORRADO CON PIN — v0.7 B4 =====================
   Borrar del historial exige PIN. Con PIN correcto se elimina de localStorage
   Y del Sheet vía GAS deleteCapture (que revalida el PIN como doble seguro).
   Tombstones (del_pend): mientras el Sheet no confirme el borrado, el sync de
   nube no puede revivir la captura. La carpeta Drive nunca se toca. */
var DELETE_PIN='1512';
var pinDelTarget=null;
function openPinDelete(id,isCt){
  pinDelTarget={id:id,isCt:!!isCt};
  $('pinMsg').style.display='none';
  $('pinInput').value='';
  $('pinOverlay').classList.add('show');
  setTimeout(function(){$('pinInput').focus();},60);
}
function closePinDelete(){$('pinOverlay').classList.remove('show');pinDelTarget=null;}
$('pinClose').addEventListener('click',closePinDelete);
$('pinCancel').addEventListener('click',closePinDelete);
$('pinOk').addEventListener('click',confirmPinDelete);
$('pinInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();confirmPinDelete();}});
function confirmPinDelete(){
  if(!pinDelTarget)return;
  if($('pinInput').value.trim()!==DELETE_PIN){
    $('pinMsg').style.display='';
    var modal=$('pinOverlay').querySelector('.modal');
    modal.classList.remove('pin-shake');void modal.offsetWidth;modal.classList.add('pin-shake');
    $('pinInput').value='';$('pinInput').focus();
    sndError();
    return;
  }
  var tgt=pinDelTarget;pinDelTarget=null;
  // 1c (v0.7.1): explosión del botón antes de cerrar el modal
  pinExplode($('pinOk'));
  setTimeout(function(){$('pinOverlay').classList.remove('show');},420);
  if(tgt.isCt){
    var ch=load('ct_hist',[]);save('ct_hist',ch.filter(function(r){return r.id!==tgt.id;}));
    updateCtBadge();
  }else{
    setHist(getHist().filter(function(r){return r.id!==tgt.id;}));
    var tomb=load('del_pend',[]);
    if(tomb.indexOf(tgt.id)===-1){tomb.push(tgt.id);save('del_pend',tomb);}
  }
  _renderHistList(getHist());
  gasDeleteCapture(tgt.id);
}
/* 1c (v0.7.1): burst de escala + partículas CSS al confirmar el borrado.
   Las partículas no tienen listeners: quitarlas del DOM es seguro. */
function pinExplode(btn){
  if(!btn)return;
  btn.classList.remove('pin-explode');void btn.offsetWidth;btn.classList.add('pin-explode');
  var colores=['#ff5252','#ffab40','#ffd740','#ff8a80'];
  for(var i=0;i<10;i++){
    var p=document.createElement('span');p.className='pin-part';
    var ang=(Math.PI*2*i)/10+Math.random()*.5;
    var dist=34+Math.random()*26;
    p.style.setProperty('--dx',Math.round(Math.cos(ang)*dist)+'px');
    p.style.setProperty('--dy',Math.round(Math.sin(ang)*dist)+'px');
    p.style.setProperty('--part',colores[i%colores.length]);
    btn.appendChild(p);
  }
  setTimeout(function(){btn.querySelectorAll('.pin-part').forEach(function(p){p.remove();});btn.classList.remove('pin-explode');},650);
  if(navigator.vibrate)navigator.vibrate([20,30,40]);
}
function gasDeleteCapture(uuid){
  if(!CFG.endpoint)return;
  var p={action:'deleteCapture',uuid:uuid,pin:DELETE_PIN};
  gasPost(p).then(function(r){
    // confirmado en el Sheet → el tombstone ya no hace falta
    if(r&&r.ok){var tomb=load('del_pend',[]);save('del_pend',tomb.filter(function(x){return x!==uuid;}));}
  }).catch(function(){queueForRetry(p);}); // sin red: reintento; el tombstone protege mientras tanto
}

/* ===================== DETALLE SOLO LECTURA — v0.7 ===================== */
var histDetailCur=null;
function openHistDetail(id,isCt){
  var rec=isCt
    ?load('ct_hist',[]).filter(function(r){return r.id===id;})[0]
    :getHist().filter(function(r){return r.id===id;})[0];
  if(!rec)return;
  histDetailCur={id:id,isCt:!!isCt};
  $('histDetailTitle').textContent=(isCt?'🤝 ':'🏠 ')+(rec.nombre||'(sin nombre)');
  var rows='';
  function drow(l,v){if(v!=null&&v!=='')rows+='<div class="hd-row"><span class="hd-label">'+esc(l)+'</span><span class="hd-val">'+esc(String(v))+'</span></div>';}
  drow('Tipo',rec.tipo);
  if(!isCt)drow('Operación',rec.oper);
  if(!isCt)drow('Zona',rec.zona);
  if(isCt){drow('Teléfono',rec.tel);drow('Email',rec.email);}
  drow('Estrellas',(rec.estrellas!=null?rec.estrellas+' ⭐':'')+(rec.calidad?' · '+rec.calidad:''));
  drow('Asesor',rec.asesorNombre||rec.asesor||rec.resp);
  if(!isCt)drow('Estatus',rec.estatus);
  drow('Capturada',rec.capturadoEn||rec.fecha?new Date(rec.capturadoEn||rec.fecha).toLocaleString('es-MX'):'');
  if(rec.modificadoEn)drow('Última edición',new Date(rec.modificadoEn).toLocaleString('es-MX'));
  if(rec.ediciones)drow('Ediciones',rec.ediciones);
  drow('Enviada',rec.enviado?'Sí':'No');
  if(!isCt&&rec.driveUrl)drow('Carpeta Drive',rec.driveUrl);
  if(!isCt&&rec.faltantes&&rec.faltantes.length)drow('Faltantes',rec.faltantes.join(', '));
  $('histDetailBody').innerHTML=
    '<div class="hint" style="margin-bottom:8px">👁️ Vista de solo lectura. Para modificar, usa el botón ✏️ Editar.</div>'+
    rows+
    '<pre class="hd-md">'+esc(rec.md||'(sin markdown)')+'</pre>';
  $('histDetailOverlay').classList.add('show');
}
function closeHistDetail(){$('histDetailOverlay').classList.remove('show');histDetailCur=null;}
$('histDetailClose').addEventListener('click',closeHistDetail);
$('histDetailCerrar').addEventListener('click',closeHistDetail);
$('histDetailOverlay').addEventListener('click',function(e){if(e.target===this)closeHistDetail();});
$('histDetailEditar').addEventListener('click',function(){
  if(!histDetailCur)return;
  var cur=histDetailCur;closeHistDetail();
  if(cur.isCt)abrirEdicionCt(cur.id);else abrirEdicion(cur.id);
});
function updateBadge(){
  var pend=getHist().filter(function(r){return !r.enviado;}).length;
  var pendCt=load('ct_hist',[]).filter(function(r){return !r.enviado;}).length;
  var b=$('navBadge');var total=pend+pendCt;b.textContent=total;b.style.display=total?'block':'none';
}
updateBadge();

/* ===================== COPIAR / COMPARTIR ===================== */
function copyText(s){
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(s).catch(fb);
  else fb();
  function fb(){var ta=document.createElement('textarea');ta.value=s;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);}
}
$('btnCopy').addEventListener('click',function(){
  copyText(mdActual);var b=$('btnCopy');b.classList.add('copied');b.textContent='Copiado ✓';
  if(lastCaptureId){var h=getHist();var r=h.filter(function(x){return x.id===lastCaptureId;})[0];if(r){r.copiado=true;setHist(h);}}
  setTimeout(function(){b.classList.remove('copied');b.textContent='Copiar markdown';},1800);
});
$('btnShare').addEventListener('click',function(){
  if(navigator.share)navigator.share({title:'Captura de propiedad — Hauser',text:mdActual}).catch(function(){});
  else alert('Tu navegador no permite compartir directo. Usa "Copiar markdown".');
});
$('btnMarkSent').addEventListener('click',function(){
  if(lastCaptureId){var h=getHist();var r=h.filter(function(x){return x.id===lastCaptureId;})[0];if(r){r.enviado=true;setHist(h);}this.textContent='Enviada ✓';}
});

/* ===================== IA: AJUSTES ===================== */
$('btnAI').addEventListener('click',function(){
  var instr=$('aiInput').value.trim();
  if(!instr){$('aiStatus').textContent='Escribe primero qué cambiar.';return;}
  if(!mdActual){$('aiStatus').textContent='Genera primero el markdown.';return;}
  $('btnAI').disabled=true;$('aiStatus').className='status';$('aiStatus').textContent='Aplicando ajustes…';
  fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,messages:[{role:'user',content:
'Eres editor de instrucciones para un agente de Notion (inmobiliaria Hauser, Cuernavaca). Markdown actual:\n\n'+mdActual+
'\n\nInstrucción del usuario: "'+instr+'"\n\nReglas: no inventes datos; respeta S/I y N/A; convierte números en palabras a dígitos; mantén la estructura y la tabla de campos. Responde ÚNICAMENTE con el markdown completo actualizado, sin preámbulo ni backticks.'}]})
  })
  .then(function(r){return r.json();})
  .then(function(d){
    var out=(d.content||[]).filter(function(x){return x.type==='text';}).map(function(x){return x.text;}).join('\n').replace(/```(markdown)?/g,'').trim();
    if(out){mdActual=out;$('mdOut').textContent=out;$('aiStatus').className='status ok';$('aiStatus').textContent='✓ Listo. Revisa y vuelve a copiar.';$('aiInput').value='';}
    else{$('aiStatus').className='status err';$('aiStatus').textContent='No llegó respuesta de la IA.';}
  })
  .catch(function(){$('aiStatus').className='status err';$('aiStatus').textContent='No se pudo conectar a la IA (solo funciona dentro de Claude o con backend).';})
  .finally(function(){$('btnAI').disabled=false;});
});

/* ===================== BACKEND GAS — Fase 2B ===================== */
function genUUID(){return 'CAP-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).substr(2,8).toUpperCase();}
function parseGasRows(rows){if(!rows||rows.length<2)return[];var h=rows[0];return rows.slice(1).map(function(r){var o={};h.forEach(function(k,i){o[k]=r[i];});return o;});}
function gasPost(payload){
  if(!CFG.endpoint)return Promise.reject(new Error('sin endpoint'));
  // seguridad v0.7: clave compartida opcional; el GAS la valida si tiene API_KEY
  var body=CFG.gasKey?Object.assign({k:CFG.gasKey},payload):payload;
  return fetch(CFG.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(body)}).then(function(r){return r.json();});
}
function gasGet(cb){
  if(!CFG.endpoint){cb(null);return;}
  var url=CFG.gasKey?CFG.endpoint+(CFG.endpoint.indexOf('?')<0?'?':'&')+'k='+encodeURIComponent(CFG.gasKey):CFG.endpoint;
  fetch(url).then(function(r){return r.json();}).then(function(d){cb(d.ok?d:null);}).catch(function(){cb(null);});
}
function queueForRetry(payload){var q=load('gasqueue',[]);q.push(payload);save('gasqueue',q);}
function processQueue(){
  if(!CFG.endpoint)return;
  var q=load('gasqueue',[]);if(!q.length)return;
  gasPost(q[0]).then(function(){var q2=load('gasqueue',[]);q2.shift();save('gasqueue',q2);if(q2.length)setTimeout(processQueue,500);}).catch(function(){});
}
function buildGasPayload(rec){
  var now=new Date().toISOString();
  return{id:rec.id,timestamp:rec.fecha||now,tipo:'propiedad',asesor:rec.asesorNombre||rec.resp||'S/I',
    estrellas:rec.estrellas||0,calidad:rec.calidad||'',propiedad_json:JSON.stringify(rec),contacto_json:'',
    capturadoEn:rec.fecha||now,modificadoEn:rec.edit||now};
}
function buildGasPayloadContact(rec){
  var now=new Date().toISOString();
  return{id:rec.id,timestamp:rec.fecha||now,tipo:'contacto',asesor:rec.asesor||'S/I',
    estrellas:0,calidad:'',propiedad_json:'',contacto_json:JSON.stringify(rec),
    capturadoEn:rec.fecha||now,modificadoEn:rec.fecha||now};
}
function gasSaveMarkdown(uuid,asesor,fecha,tipo,estatus,nombre,markdownText,direccion,editadoPor){
  if(!CFG.endpoint)return;
  var p={action:'saveMarkdown',uuid:uuid,asesor:asesor,fecha:fecha,tipo:tipo,estatus:estatus,nombre:nombre,direccion:direccion||'',markdown_md:markdownText,editadoPor:editadoPor||''};
  gasPost(p).then(function(r){
    // B2: el GAS crea/reutiliza la carpeta Drive de la propiedad y devuelve su URL
    if(r&&r.ok&&tipo==='propiedad'&&(r.folderUrl||r.fotoUrl)){
      var h=getHist();var rec=h.filter(function(x){return x.id===uuid;})[0];
      if(rec){
        var ch=false;
        if(r.folderUrl&&rec.driveUrl!==r.folderUrl){rec.driveUrl=r.folderUrl;ch=true;}
        if(r.fotoUrl&&rec.fotoUrl!==r.fotoUrl){rec.fotoUrl=r.fotoUrl;ch=true;} // F4 (v3.5)
        if(ch){
          setHist(h);
          // re-subir la captura con driveUrl/fotoUrl para que la nube (fuente
          // de verdad del historial) no lo pierda en el siguiente sync
          gasPost(buildGasPayload(rec)).catch(function(){});
        }
      }
    }
  }).catch(function(){queueForRetry(p);});
}
function gasCapturasToLocalHist(capturas){
  return capturas.filter(function(c){return c.tipo==='propiedad';}).map(function(c){
    try{var r=JSON.parse(c.propiedad_json);r.enviado=true;return r;}
    catch(e){return{id:c.id,fecha:c.capturadoEn||c.timestamp,asesorNombre:c.asesor,
      tipo:'',oper:'',zona:'S/I',estrellas:parseInt(c.estrellas)||0,calidad:c.calidad||'',
      md:'',nombre:'(sin nombre)',estado:'Sincronizado',faltantes:[],copiado:false,enviado:true};}
  });
}
// Retry queue en startup
if(CFG.endpoint)setTimeout(processQueue,3000);
// Stub para acciones legadas (Drive) no soportadas por GAS v2B
function api(action){return Promise.reject(new Error('No implementado: '+action));}

/* ===================== CAPTURA RÁPIDA — v0.7 B6 =====================
   El MISMO formulario de viewCapture navegado slide por slide (1-3 campos).
   No se mueve ni duplica DOM: solo se ocultan con .qk-hide los slides no
   activos (los listeners quedan intactos). Esenciales bloqueantes: valor o
   S/I / N/A EXPLÍCITO antes de avanzar; el resto se salta libre. El timer de
   5 min es referencia visual, no corta nada. Mismo markdown/historial/GAS. */
var quickPending=false,qkOn=false,qkSlides=[],qkIdx=0;

/* esenciales = los mismos campos que determinan estrellas (updateProgress) */
var QK_ESSENTIALS=[
  {sel:'tipoChips',hard:true,ok:function(){return !!state.tipo;},msg:'Elige el tipo de inmueble para continuar (define el código PROP/TERR).'},
  {sel:'zonaChips',ok:function(){return zonasSel.length>0;},msg:'Elige al menos una zona, o Saltar para dejarla S/I.'},
  {sel:'f_direccion',ok:function(){return filled('f_direccion')||$('f_nombre').value.trim()!=='';},msg:'La dirección (o el nombre) identifica la propiedad. Escríbela o Saltar para S/I.'},
  {sel:'f_precio',when:function(){return state.oper==='Venta'||state.oper==='Venta y Renta';},ok:function(){return filled('f_precio');},msg:'Precio de venta: escríbelo o márcalo S/I.'},
  {sel:'f_precio_renta',when:function(){return state.oper==='Renta'||state.oper==='Venta y Renta';},ok:function(){return filled('f_precio_renta');},msg:'Precio de renta: escríbelo o márcalo S/I.'},
  {sel:'f_m2t',when:function(){return !!state.tipo&&SIN_M2T_OBLIG.indexOf(state.tipo)===-1;},ok:function(){return filled('f_m2t');},msg:'m² de terreno: escríbelo o márcalo S/I.'},
  {sel:'f_m2c',when:function(){return !!state.tipo&&state.tipo!=='Terreno';},ok:function(){return filled('f_m2c');},msg:'m² de construcción: escríbelo o márcalo S/I.'},
  {sel:'f_rec',when:function(){return !!state.tipo&&state.tipo!=='Terreno';},ok:function(){return filled('f_rec');},msg:'Recámaras: escríbelas o márcalas S/I.'},
  {sel:'f_ban',when:function(){return !!state.tipo&&state.tipo!=='Terreno';},ok:function(){return filled('f_ban');},msg:'Baños: escríbelos o márcalos S/I.'},
  {sel:'f_uso',when:function(){return state.tipo==='Terreno';},ok:function(){return filled('f_uso');},msg:'Uso de suelo: escríbelo o márcalo S/I.'},
  {sel:'f_frente',when:function(){return state.tipo==='Terreno';},ok:function(){return filled('f_frente');},msg:'Frente del terreno: escríbelo o márcalo S/I.'}
];

function qkHiddenEl(el){return el.hidden||el.style.display==='none';}
function qkCollectSlides(){
  qkSlides=[];var titulo='';
  Array.prototype.forEach.call($('viewCapture').children,function(ch){
    if(ch.id==='outputArea'||ch.id==='qkNav'||ch.id==='qkTitle'||ch.id==='qkResumen')return;
    var cl=ch.classList;
    if(cl.contains('view-header')||cl.contains('doc-title')||cl.contains('doc-sub')||cl.contains('progress-wrap')||cl.contains('timer-widget'))return;
    if(ch.tagName==='H2'){titulo=(ch.childNodes[0]&&ch.childNodes[0].textContent||ch.textContent).trim();return;}
    if(cl.contains('actions')){qkSlides.push({el:ch,titulo:'¡Listo!',gen:true});return;} // (la danger-zone interna se oculta por CSS en quick-mode)
    var h2i=ch.querySelector&&ch.querySelector('h2');
    qkSlides.push({el:ch,titulo:h2i?(h2i.childNodes[0]&&h2i.childNodes[0].textContent||h2i.textContent).trim():titulo});
  });
}
function qkPendientes(slideEl){
  return QK_ESSENTIALS.filter(function(q){
    var el=$(q.sel);
    if(!el||!slideEl.contains(el))return false;
    if(q.when&&!q.when())return false;
    return !q.ok();
  });
}
function qkAviso(txt){
  var m=$('qkMsg');m.textContent=txt;m.hidden=false;
  sndError();
}
function qkShow(i){
  qkIdx=i;
  qkSlides.forEach(function(s,j){s.el.classList.toggle('qk-hide',j!==i);});
  var s=qkSlides[i];
  s.el.classList.remove('qk-slide-in');void s.el.offsetWidth;s.el.classList.add('qk-slide-in');
  $('qkSec').textContent=s.titulo||'Captura rápida';
  // C2: la pregunta del slide visible también en el contenido (los h2 van ocultos)
  var qt=$('qkTitle');if(qt){qt.textContent=s.titulo||'';qt.hidden=!s.titulo;}
  $('qkCount').textContent=(i+1)+' / '+qkSlides.length;
  $('qkPrev').disabled=(qkSiguiente(i,-1)===-1);
  $('qkSkip').style.visibility=s.gen?'hidden':'visible';
  $('qkNext').textContent=s.gen?'⚡ Generar Markdown':'Siguiente →';
  $('qkMsg').hidden=true;
  if(window.scrollTo)window.scrollTo(0,0);
}
/* siguiente slide visible en dirección dir (los ocultos por tipo/oper se saltan) */
function qkSiguiente(from,dir){
  for(var j=from+dir;j>=0&&j<qkSlides.length;j+=dir){
    if(!qkHiddenEl(qkSlides[j].el))return j;
  }
  return -1;
}
function qkStart(){
  qkCollectSlides();
  if(!qkSlides.length)return;
  qkOn=true;
  document.body.classList.add('quick-mode');
  $('qkNav').hidden=false;
  // timer 5 min como referencia visual (no corta nada; no pisa la preferencia guardada)
  if(timerState!=='running'){timerLimit=300;startTimer();}
  var first=qkHiddenEl(qkSlides[0].el)?qkSiguiente(0,1):0;
  qkShow(first===-1?0:first);
}
function qkStop(){
  // 1a (v0.7.1): limpieza SIEMPRE, sin early-return por flag — si qkOn se
  // desincroniza del DOM, esta función lo repara igual (idempotente)
  var estaba=qkOn;
  qkOn=false;
  document.body.classList.remove('quick-mode');
  $('qkNav').hidden=true;
  var qt=$('qkTitle');if(qt)qt.hidden=true;
  $('qkResumen').hidden=true;
  var qb=document.querySelector('#qkNav .qk-btns');if(qb)qb.style.display='';
  qkSlides.forEach(function(s){s.el.classList.remove('qk-hide','qk-slide-in');});
  if(estaba)timerLimit=load('cfg_timer_limit',600); // restaurar preferencia del asesor
}
$('homeQuickCard').addEventListener('click',function(){quickPending=true;});

/* ===================== BORRADOR DE CAPTURA (2c v0.7.1) =====================
   Al volver al menú desde una captura en curso (rápida o normal) se guarda un
   borrador; al reentrar a CUALQUIER modo de captura se ofrece continuar. No se
   guarda borrador al editar (editId) ni tras generar (clearDraft explícito). */
var _draftQuickWanted=false; // intención de modo rápido en espera del prompt
var _draftPromptActive=false;
function draftHasData(){
  if(state.editId)return false;
  if(state.tipo)return true;
  if(zonasSel.length)return true;
  return ['f_direccion','f_nombre','f_precio','f_precio_renta','f_m2t','f_m2c','f_notas'].some(function(id){
    var e=$(id);return e&&e.value.trim();
  });
}
function saveDraft(fromQuick){
  if(!draftHasData()){clearDraft();return;}
  var nombre=($('f_nombre').value.trim()||$('f_direccion').value.trim()||'').slice(0,60);
  save('draft',{snap:snapshotForm(),quick:!!fromQuick,ts:Date.now(),
    nombre:nombre,tipo:state.tipo||'',
    precio:$('f_precio').value.trim()||$('f_precio_renta').value.trim()||''});
}
function clearDraft(){try{localStorage.removeItem('cap_draft');}catch(e){}}
function getDraft(){return load('draft',null);}
function showDraftPrompt(){
  var d=getDraft();if(!d){arrancarCaptura();return;}
  _draftPromptActive=true;
  var partes=[];
  if(d.nombre)partes.push(d.nombre);
  if(d.tipo)partes.push(d.tipo);
  if(d.precio)partes.push('$'+d.precio);
  var cuando=d.ts?new Date(d.ts).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
  $('draftInfo').innerHTML=(partes.length?esc(partes.join(' · ')):'(sin datos aún)')+
    (cuando?'<br><span class="draft-when">'+esc(cuando)+(d.quick?' · modo rápido':'')+'</span>':'');
  $('draftOverlay').classList.add('show');
}
/* arranca el modo que el usuario pidió (rápido si venía de la tarjeta ⚡) */
function arrancarCaptura(){
  if(_draftQuickWanted){_draftQuickWanted=false;setTimeout(qkStart,0);}
}
$('draftContinue').addEventListener('click',function(){
  var d=getDraft();
  $('draftOverlay').classList.remove('show');_draftPromptActive=false;
  if(d&&d.snap){restoreForm(d.snap);state.editId=null;}
  clearDraft();
  // continuar en el modo del borrador si aplica, o en el que se pidió
  if((d&&d.quick)||_draftQuickWanted){_draftQuickWanted=false;setTimeout(qkStart,0);}
  updateProgress();
});
$('draftNew').addEventListener('click',function(){
  $('draftOverlay').classList.remove('show');_draftPromptActive=false;
  clearDraft();doReset();
  arrancarCaptura();
});
$('qkMenu').addEventListener('click',function(){
  saveDraft(true);          // guarda antes de que qkStop limpie la UI
  showView('viewHome');
});
// C4: steppers −/+ en numéricos (rec, baños, medios, estacionamientos)
document.addEventListener('click',function(e){
  var b=e.target.closest('.stp-btn');if(!b)return;
  var inp=$(b.dataset.stp);if(!inp)return;
  var v=parseInt(inp.value,10);if(isNaN(v))v=0;
  v=Math.max(0,v+parseInt(b.dataset.d,10));
  inp.value=v;
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  inp.dispatchEvent(new Event('change',{bubbles:true}));
});
$('qkExit').addEventListener('click',qkStop);
$('qkPrev').addEventListener('click',function(){
  var j=qkSiguiente(qkIdx,-1);if(j!==-1)qkShow(j);
});
/* E1: esenciales que quedaron SIN dato real (vacíos o en S/I) al final */
var QK_LBL={tipoChips:'Tipo de inmueble',zonaChips:'Zona',f_direccion:'Dirección',f_precio:'Precio de venta',f_precio_renta:'Precio de renta',f_m2t:'m² terreno',f_m2c:'m² construcción',f_rec:'Recámaras',f_ban:'Baños',f_uso:'Uso de suelo',f_frente:'Frente del terreno'};
function qkFaltantesFinales(){
  return QK_ESSENTIALS.filter(function(q){
    if(q.when&&!q.when())return false;
    if(q.sel==='tipoChips')return !state.tipo;
    if(q.sel==='zonaChips')return !zonasSel.length;
    if(q.sel==='f_direccion')return !$('f_direccion').value.trim()&&!$('f_nombre').value.trim();
    var el=$(q.sel);
    return !!el&&!el.value.trim(); // vacío o S/I marcado = sin dato real
  });
}
function qkOcultarResumen(){
  $('qkResumen').hidden=true;
  document.querySelector('#qkNav .qk-btns').style.display='';
}
$('qkResFill').addEventListener('click',function(){
  qkOcultarResumen();
  var f=qkFaltantesFinales()[0];
  if(!f)return;
  var el=$(f.sel);
  for(var i=0;i<qkSlides.length;i++){
    if(el&&qkSlides[i].el.contains(el)){qkShow(i);return;}
  }
});
$('qkResSave').addEventListener('click',function(){qkOcultarResumen();$('btnGen').click();});
$('qkNext').addEventListener('click',function(){
  var s=qkSlides[qkIdx];if(!s)return;
  var pend=qkPendientes(s.el);
  if(pend.length){qkAviso(pend[0].msg);return;}
  if(s.gen){
    // E1: última tarjeta si quedaron esenciales sin dato real (solo si aplica)
    var falt=qkFaltantesFinales();
    if(falt.length&&$('qkResumen').hidden){
      $('qkResLista').innerHTML=falt.map(function(q){return '<li>'+esc(QK_LBL[q.sel]||q.sel)+'</li>';}).join('');
      qkSlides.forEach(function(x){x.el.classList.add('qk-hide');});
      $('qkResumen').hidden=false;
      document.querySelector('#qkNav .qk-btns').style.display='none';
      return;
    }
    $('btnGen').click();return; // mismo pipeline; al llegar a resultado, showView apaga el modo
  }
  var j=qkSiguiente(qkIdx,1);if(j!==-1)qkShow(j);
});
$('qkSkip').addEventListener('click',function(){
  var s=qkSlides[qkIdx];if(!s||s.gen)return;
  var pend=qkPendientes(s.el);
  var dura=pend.filter(function(q){return q.hard;})[0];
  if(dura){qkAviso(dura.msg);return;}
  if(pend.length){
    if(!confirm('Hay datos esenciales sin llenar en este paso. ¿Marcarlos como S/I y continuar?'))return;
    // consentimiento explícito: activar S/I donde exista el botón
    pend.forEach(function(q){
      var b=document.querySelector('.si-btn[data-for="'+q.sel+'"]');
      if(b&&!siOn(q.sel))b.click();
    });
  }
  var j=qkSiguiente(qkIdx,1);if(j!==-1)qkShow(j);
});

/* ===================== CONTACT PICKER — v0.7 G =====================
   Trae nombre y teléfono desde los contactos del celular (Contact Picker
   API: Chrome/Android sobre HTTPS). Sin soporte → los botones quedan
   ocultos (degradación con gracia, nada se rompe). */
function _pickContacts(cb){
  navigator.contacts.select(['name','tel'],{multiple:false}).then(function(res){
    if(res&&res.length)cb({
      nombre:(res[0].name&&res[0].name[0])||'',
      tel:(res[0].tel&&res[0].tel[0])||''
    });
  }).catch(function(){});
}
(function(){
  if(!(navigator.contacts&&navigator.contacts.select))return;
  var b1=$('btnPickContact'),b2=$('btnPickContactCt');
  if(b1){b1.style.display='';b1.addEventListener('click',function(){
    _pickContacts(function(c){
      if(!c.nombre&&!c.tel)return;
      state.people.push({id:'pk'+Date.now(),nombre:c.nombre,tipos:['Propietario'],tel:c.tel,auto:false,touched:true});
      renderCRM();updateProgress();
    });
  });}
  if(b2){b2.style.display='';b2.addEventListener('click',function(){
    _pickContacts(function(c){
      if(c.nombre){$('ct_nombre').value=c.nombre;$('ct_nombre').dispatchEvent(new Event('input',{bubbles:true}));}
      if(c.tel){$('ct_tel').value=c.tel;$('ct_tel').dispatchEvent(new Event('input',{bubbles:true}));}
    });
  });}
})();

/* ===================== BLOQUE 4 — MICROINTERACCIONES ===================== */

// 1. Vibración háptica en botones primarios (.btn-accent)
document.addEventListener('click',function(e){
  if(e.target.closest('.btn-accent')&&navigator.vibrate)navigator.vibrate(30);
},{passive:true});

// 2. Chip snap: scale(1.08) 100ms al seleccionar
document.addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  c.classList.add('snap');
  setTimeout(function(){c.classList.remove('snap');},120);
},{passive:true});

// 3. countUp animado para el contador de progreso
var _progPrev=0;
function animCountUp(el,from,to,total){
  if(from===to){el.textContent=to+' de '+total+' campos clave';return;}
  var start=null,dur=280;
  function step(ts){
    if(!start)start=ts;
    var p=Math.min((ts-start)/dur,1);
    var ease=1-Math.pow(1-p,3);
    el.textContent=Math.round(from+(to-from)*ease)+' de '+total+' campos clave';
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

$('cfg_resp').addEventListener('change',function(){
  var n=this.value;CFG.resp=n;save('cfg',CFG);$('f_resp').value=n;
  var lista=getAsesores();
  var found=lista.filter(function(a){return a.nombre===n;})[0];
  if(found){asesorActivo=found;save('asesor_activo',found);var badge=$('asesorBadge');if(badge)badge.textContent='👤 '+n;}
});
// cfg_drive removed (Drive feature not implemented)
$('cfg_endpoint').addEventListener('input',function(){CFG.endpoint=this.value.trim();save('cfg',CFG);});
$('cfg_gaskey').addEventListener('input',function(){CFG.gasKey=this.value.trim();save('cfg',CFG);});
$('cfg_test').addEventListener('click',function(){
  if(!CFG.endpoint){$('cfgStatus').textContent='Pega primero el endpoint.';return;}
  $('cfgStatus').className='status';$('cfgStatus').textContent='Probando conexión…';
  gasGet(function(data){
    if(data){$('cfgStatus').className='status ok';$('cfgStatus').textContent='✓ Conectado · '+(data.capturas?data.capturas.length-1:0)+' capturas en la nube';}
    else{$('cfgStatus').className='status err';$('cfgStatus').textContent='No respondió. Revisa la URL y que esté publicado con acceso "Cualquier persona".';}
  });
});
$('cfg_sync').addEventListener('click',function(){
  if(!CFG.endpoint){$('cfgStatus').textContent='Configura primero el endpoint.';return;}
  var hist=getHist();$('cfgStatus').textContent='Enviando '+hist.length+' capturas a la nube…';
  var done=0,errs=0;
  var total=hist.length;
  if(!total){$('cfgStatus').className='status ok';$('cfgStatus').textContent='No hay capturas locales.';return;}
  hist.forEach(function(rec){
    gasPost(buildGasPayload(rec)).then(function(){done++;if(done+errs===total){save('gasqueue',[]);$('cfgStatus').className='status ok';$('cfgStatus').textContent='✓ '+done+' capturas sincronizadas'+(errs?' ('+errs+' con error)':'')+'.';}}).catch(function(){errs++;queueForRetry(buildGasPayload(rec));if(done+errs===total){$('cfgStatus').className='status err';$('cfgStatus').textContent=done+' OK · '+errs+' en cola para reintentar.';}});
  });
});
$('cfg_export').addEventListener('click',function(){
  var blob=new Blob([JSON.stringify(getHist(),null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='historial_capturas.json';a.click();
});
function renderCfgCount(){
  var q=load('gasqueue',[]).length;
  $('cfgCount').textContent=getHist().length+' captura(s) en este dispositivo'+(q?' · '+q+' pendiente(s) de sincronizar':'')+(CFG.endpoint?' · endpoint activo':' · sin endpoint');
}

/* config de sonidos */
function renderSndCfg(){
  var tog=$('cfg_snd_toggle');if(tog)tog.textContent=sndCfg.on?'🔊 Activados':'🔇 Silenciados';
  var vol=$('cfg_snd_vol');if(vol)vol.value=Math.round(sndCfg.vol*100);
  var v=$('cfg_snd_vol_val');if(v)v.textContent=Math.round(sndCfg.vol*100)+'%';
}
$('cfg_snd_toggle').addEventListener('click',function(){
  sndCfg.on=!sndCfg.on;save('cfg_sounds',sndCfg);renderSndCfg();
  if(sndCfg.on)sndClick();
});
$('cfg_snd_vol').addEventListener('input',function(){
  sndCfg.vol=parseInt(this.value)/100;save('cfg_sounds',sndCfg);
  var v=$('cfg_snd_vol_val');if(v)v.textContent=this.value+'%';
});
$('cfg_snd_test').addEventListener('click',function(){sndSuccess();});
renderSndCfg();

/* ===================== RESET ===================== */
function doReset(){
  document.querySelectorAll('#viewCapture input,#viewCapture textarea').forEach(function(i){if(i.type!=='date')i.value='';i.disabled=false;i.removeAttribute('data-manual');});
  document.querySelectorAll('.si-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.na-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('#viewCapture .chip').forEach(function(c){c.classList.remove('sel');});
  state={tipo:'',oper:'Venta',ofrece:'',crm:'No',modo:'A · Reventa de lote',serv:[],caract:[],caractTerr:[],lat:null,lng:null,people:[],editId:null,rentaMin:''};
  setChip('operChips','oper','Venta',onOper);setChip('modoChips','modo','A · Reventa de lote');
  setChip('crmChips','crm','No');
  buildCaract();renderCaractTerr();renderCRM();
  $('f_unidades').value=1;$('f_comision').value='4%';if(asesorActivo)syncAsesor();else $('f_resp').value=CFG.resp;
  $('f_fecha').value=hoy;$('f_seguimiento').value=hoy;$('f_estatus').value='Disponible';
  zonasSel=[];renderZonaChips();updateHintZona();
  $('f_fuente').value='Recorrido/Scouteo';$('boxFuenteOtra').style.display='none';
  ['unitsBox','terrenoExtra','dirSuggest','indivBox','f_comision_otra'].forEach(function(id){$(id).style.display='none';});
  $('btnIndiv').style.display='';
  document.querySelectorAll('[data-construccion]').forEach(function(el){el.style.display='';});
  ['n_precio','n_precio_renta','n_m2t','n_m2c','geoStatus','anuncioStatus','aiStatus','estatusHint'].forEach(function(id){var e=$(id);if(e)e.textContent='';});
  $('outputArea').style.display='none';
  resetTimerToReady();
  // Limpiar modo edición
  var eb=$('editBanner');if(eb)eb.style.display='none';
  var bg=$('btnGen');if(bg)bg.textContent='Generar Markdown';
  updateProgress();window.scrollTo({top:0,behavior:'smooth'});
}
$('btnLimpiarDatos').addEventListener('click',function(){
  if(!confirm('¿Limpiar todos los datos del formulario? (El historial NO se borra)'))return;
  doReset();
});
$('btnReset').addEventListener('click',function(){
  if(!confirm('¿Limpiar todos los campos? (El historial NO se borra)'))return;
  doReset();
});

/* ===================== EDICIÓN DE CAPTURAS — FASE 3 ===================== */
function snapshotForm(){
  var snap={};
  document.querySelectorAll('#viewCapture input,#viewCapture textarea,#viewCapture select').forEach(function(el){
    if(el.id)snap[el.id]=el.value;
  });
  document.querySelectorAll('#viewCapture .si-btn').forEach(function(b){
    if(b.dataset.for)snap['_si_'+b.dataset.for]=b.classList.contains('active');
  });
  document.querySelectorAll('#viewCapture .na-btn').forEach(function(b){
    if(b.dataset.forNa)snap['_na_'+b.dataset.forNa]=b.classList.contains('active');
  });
  snap._state=JSON.parse(JSON.stringify(state));
  snap._zonasSel=zonasSel.slice();
  return snap;
}
function restoreForm(snap){
  if(!snap)return;
  if(snap._state){var s=snap._state;
    state.tipo=s.tipo||'';state.oper=s.oper||'Venta';state.ofrece=s.ofrece||'';
    state.crm=s.crm||'No';state.modo=s.modo||'A · Reventa de lote';
    state.serv=s.serv||[];state.caract=s.caract||[];state.caractTerr=s.caractTerr||[];
    state.lat=s.lat||null;state.lng=s.lng||null;state.people=s.people||[];
    state.rentaMin=s.rentaMin||'';state.anuncioUrl=s.anuncioUrl||'';
  }
  if(state.tipo)setChip('tipoChips','tipo',state.tipo,onTipo);else onTipo('');
  setChip('operChips','oper',state.oper||'Venta',onOper);
  if(state.ofrece)setChip('ofreceChips','ofrece',state.ofrece,onOfrece);
  setChip('crmChips','crm',state.crm||'No');
  if(state.modo)setChip('modoChips','modo',state.modo);
  if(state.rentaMin)setChip('rentaMinChips','rentaMin',state.rentaMin);
  Object.keys(snap).forEach(function(k){
    if(k.startsWith('_'))return;
    var el=$(k);if(el)el.value=snap[k];
  });
  document.querySelectorAll('#viewCapture .si-btn').forEach(function(b){
    b.classList.toggle('active',!!snap['_si_'+b.dataset.for]);
  });
  document.querySelectorAll('#viewCapture .na-btn').forEach(function(b){
    if(snap['_na_'+b.dataset.forNa])setNaState(b.dataset.forNa,true);
  });
  if(snap._zonasSel){zonasSel=snap._zonasSel.slice();renderZonaChips();updateHintZona();}
  buildCaract();renderCaractTerr();renderCRM();
  // v0.7: sincronizar visibilidad de secciones dependientes de valores restaurados
  syncIndivBox();
  $('f_comision_otra').style.display=($('f_comision').value==='__otra')?'':'none';
  updateProgress();
}
function abrirEdicion(id){
  var h=getHist();var rec=h.filter(function(r){return r.id===id;})[0];
  if(!rec){alert('Captura no encontrada.');return;}
  doReset();
  state.editId=id;
  if(rec.formData){
    restoreForm(rec.formData);
  } else {
    if(rec.tipo)setChip('tipoChips','tipo',rec.tipo,onTipo);
    if(rec.oper)setChip('operChips','oper',rec.oper,onOper);
    if(rec.estatus)$('f_estatus').value=rec.estatus;
    if(rec.zona&&rec.zona!=='S/I'){var zn=rec.zona.split(' / ');zn.forEach(function(n){pickZona(n.trim(),false);});}
  }
  var eb=$('editBanner');var ebn=$('editBannerNombre');
  if(eb){eb.style.display='';if(ebn)ebn.textContent=rec.nombre||'(sin nombre)';}
  var bg=$('btnGen');if(bg)bg.textContent='Actualizar captura';
  quickPending=false;if(qkOn)qkStop(); // A1: editar SIEMPRE abre el formulario tradicional
  showView('viewCapture');
}
$('btnCancelEdit').addEventListener('click',function(){doReset();showView('viewHistory');});

// -- Contactos --
var ctEditId=null;var ctCapturadoEn=null;
function calcCtStars(){
  var s1=!!(ctVal('ct_nombre')&&ctState.tipos.length&&ctVal('ct_tel'));
  var s2=s1&&!!(ctVal('ct_email')||($('ct_fuente')&&$('ct_fuente').value));
  var s3=s2&&!!(ctState.zonasInteres.length||ctVal('ct_zona_interes_extra')||ctState.zonasOper.length||ctVal('ct_zona_oper_extra')||ctState.zonasOperAliado.length||ctVal('ct_zona_oper_aliado_extra'));
  return{count:s3?3:s2?2:s1?1:0,s1:s1,s2:s2,s3:s3};
}
function snapshotCtForm(){
  var snap={};
  document.querySelectorAll('#viewContact input,#viewContact textarea,#viewContact select').forEach(function(el){
    if(el.id)snap[el.id]=el.value;
  });
  snap._ctState=JSON.parse(JSON.stringify(ctState));
  return snap;
}
function restoreCtForm(snap){
  if(!snap)return;
  if(snap._ctState){Object.assign(ctState,snap._ctState);
    // backwards compat: old records stored tipo as string
    if(!Array.isArray(ctState.tipos)){ctState.tipos=ctState.tipo?[ctState.tipo]:[];delete ctState.tipo;}
    if(!Array.isArray(ctState.zonasInteres))ctState.zonasInteres=[];
    if(!Array.isArray(ctState.formaPago))ctState.formaPago=[];
    if(!Array.isArray(ctState.amenidades))ctState.amenidades=[];
    if(typeof ctState.uso!=='string')ctState.uso='';
    if(!Array.isArray(ctState.zonasOper))ctState.zonasOper=[];
    if(!Array.isArray(ctState.zonasOperAliado))ctState.zonasOperAliado=[];
    document.querySelectorAll('#ctTipoChips .chip').forEach(function(c){c.classList.toggle('sel',ctState.tipos.indexOf(c.dataset.v)>=0);});
    ctOnTipos(); // renders zona chips + section visibility
    var fpW=$('ctFormaPagoChips');if(fpW)fpW.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('sel',ctState.formaPago.indexOf(c.dataset.v)>=0);});
    var uW=$('ctUsoChips');if(uW)uW.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('sel',c.dataset.v===ctState.uso);});
    var amW=$('ctAmenidadesChips');if(amW)amW.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('sel',ctState.amenidades.indexOf(c.dataset.v)>=0);});
    var owW=$('ctZonasOperChips');if(owW)owW.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('sel',ctState.zonasOper.indexOf(c.dataset.v)>=0);});
    var oaW=$('ctZonasOperAliadoChips');if(oaW)oaW.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('sel',ctState.zonasOperAliado.indexOf(c.dataset.v)>=0);});
    ['ctConfianzaChips','ctUrgenciaChips','ctConfianzaAliado','ctEstatusChips'].forEach(function(cid){
      var key={ctConfianzaChips:'confianza',ctUrgenciaChips:'urgencia',ctConfianzaAliado:'confianzaAliado',ctEstatusChips:'estatus'}[cid];
      var w=$(cid);if(!w)return;
      w.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('sel',c.dataset.v===ctState[key]);});
    });
  }
  Object.keys(snap).forEach(function(k){
    if(k.startsWith('_'))return;
    var el=$(k);if(el)el.value=snap[k];
  });
  var telEl=$('ct_tel');var waEl=$('ct_wa');
  if(telEl&&waEl)ctWaLinked=(waEl.value===''||waEl.value===telEl.value);
  ctUpdateProgress();
}
function abrirEdicionCt(id){
  var h=load('ct_hist',[]);var rec=h.filter(function(r){return r.id===id;})[0];
  if(!rec){alert('Contacto no encontrado.');return;}
  $('ctBtnReset').click();
  ctEditId=id;ctCapturadoEn=rec.capturadoEn||rec.fecha;
  if(rec.formData){
    restoreCtForm(rec.formData);
  } else {
    if(rec.nombre)$('ct_nombre').value=rec.nombre;
    if(rec.tel)$('ct_tel').value=rec.tel;
    if(rec.email)$('ct_email').value=rec.email;
    if(rec.asesor)$('ct_asesor').value=rec.asesor;
  }
  var eb=$('ctEditBanner');var ebn=$('ctEditBannerNombre');
  if(eb){eb.style.display='';if(ebn)ebn.textContent=rec.nombre||'(sin nombre)';}
  var bg=$('ctBtnGenerar');if(bg)bg.textContent='Actualizar contacto';
  showView('viewContact');
}
$('btnCancelEditCt').addEventListener('click',function(){
  ctEditId=null;ctCapturadoEn=null;
  var eb=$('ctEditBanner');if(eb)eb.style.display='none';
  var bg=$('ctBtnGenerar');if(bg)bg.textContent='Generar markdown';
  $('ctBtnReset').click();showView('viewHistory');
});

/* ===================== CONTACTOS — FASE 7 ===================== */
var CT_COMPRADOR=['Comprador','Inversionista'];
var CT_PROPIETARIO=['Propietario','Desarrollador'];
var CT_ALIADO=['Arquitecto','Notario','Maestro de obra','Broker','Asesor inmobiliario'];

var ctState={tipos:[],confianza:'',estatus:'Nuevo',urgencia:'',confianzaAliado:'',
  zonasInteres:[],formaPago:[],amenidades:[],uso:'',zonasOper:[],zonasOperAliado:[]};
var ctMd='';var ctLastId=null;

function ctVal(id){var el=$(id);return el?el.value.trim():'';}
function ctSI(v){return v||'S/I';}

function ctOnTipos(){
  var ts=ctState.tipos;
  var esCom=ts.some(function(v){return CT_COMPRADOR.indexOf(v)>=0;});
  var esProp=ts.some(function(v){return CT_PROPIETARIO.indexOf(v)>=0;});
  var esAliado=ts.some(function(v){return CT_ALIADO.indexOf(v)>=0;});
  $('ctOtroTipoBox').style.display=(ts.indexOf('Otro')>=0)?'':'none';
  $('ctSecOper').style.display=(esCom||esProp||esAliado)?'':'none';
  $('ctSecComprador').style.display=esCom?'':'none';
  $('ctSecPropietario').style.display=esProp?'':'none';
  $('ctSecAliado').style.display=esAliado?'':'none';
  $('ctConfianzaRow').style.display=(!esCom&&!esProp&&esAliado)?'none':'';
  if(esCom)renderCtZonaChips();
  if(esProp)renderCtZonasOperChips();
  if(esAliado)renderCtZonasOperAliadoChips();
  ctUpdateProgress();
}

function ctUpdateProgress(){
  var kNombre=ctVal('ct_nombre')?1:0;
  var kTipo=ctState.tipos.length?1:0;
  var kContacto=(ctVal('ct_tel')||ctVal('ct_wa')||ctVal('ct_email'))?1:0;
  var filled=kNombre+kTipo+kContacto;
  var extras=[ctVal('ct_alias'),ctVal('ct_empresa'),ctVal('ct_puesto'),ctVal('ct_notas'),
    ctVal('ct_proxima'),ctVal('ct_seguimiento'),ctVal('ct_asesor'),
    $('ct_fuente')&&$('ct_fuente').value,ctState.confianza,ctState.estatus];
  var extFilled=extras.filter(function(f){return !!f;}).length;
  var pct=Math.round((filled/3*0.7+extFilled/extras.length*0.3)*100);
  var fill=$('ctProgFill');if(fill)fill.style.width=pct+'%';
  var pctEl=$('ctProgPct');if(pctEl)pctEl.textContent=pct+'%';
  var txtEl=$('ctProgText');if(txtEl)txtEl.textContent=filled+'/3 datos clave';
}

function ctWireChips(containerId,stateProp){
  var wrap=$(containerId);if(!wrap)return;
  wrap.querySelectorAll('.chip').forEach(function(btn){
    btn.addEventListener('click',function(){
      wrap.querySelectorAll('.chip').forEach(function(x){x.classList.remove('sel');});
      btn.classList.add('sel');
      ctState[stateProp]=btn.dataset.v;
      ctUpdateProgress();
    });
  });
}
ctWireChips('ctConfianzaChips','confianza');
ctWireChips('ctEstatusChips','estatus');
ctWireChips('ctUrgenciaChips','urgencia');
ctWireChips('ctConfianzaAliado','confianzaAliado');
ctWireChips('ctUsoChips','uso');

function renderCtZonaChips(){
  var wrap=$('ctZonasInteresChips');if(!wrap)return;
  wrap.innerHTML='';
  var zonas=zonasAll().sort(function(a,b){return(b.uses||0)-(a.uses||0);});
  var knownNamesLow=zonas.map(function(z){return z.n.toLowerCase();});
  ctState.zonasInteres.forEach(function(n){if(knownNamesLow.indexOf(n.toLowerCase())<0)zonas.push({n:n,uses:0,last:0});});
  zonas.forEach(function(z){
    var b=document.createElement('button');b.type='button';
    b.className='chip chip-sm';b.textContent=z.n;b.dataset.v=z.n;
    b.classList.toggle('sel',ctState.zonasInteres.indexOf(z.n)>=0);
    wrap.appendChild(b);
  });
}
$('ctZonasInteresChips').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  c.classList.toggle('sel');
  var v=c.dataset.v;var idx=ctState.zonasInteres.indexOf(v);
  if(idx>=0)ctState.zonasInteres.splice(idx,1);else ctState.zonasInteres.push(v);
  ctUpdateProgress();
});
$('ctFormaPagoChips').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  c.classList.toggle('sel');
  var v=c.dataset.v;var idx=ctState.formaPago.indexOf(v);
  if(idx>=0)ctState.formaPago.splice(idx,1);else ctState.formaPago.push(v);
  ctUpdateProgress();
});
$('ctAmenidadesChips').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  c.classList.toggle('sel');
  var v=c.dataset.v;var idx=ctState.amenidades.indexOf(v);
  if(idx>=0)ctState.amenidades.splice(idx,1);else ctState.amenidades.push(v);
  ctUpdateProgress();
});

$('ctTipoChips').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  c.classList.toggle('sel');
  var v=c.dataset.v;var idx=ctState.tipos.indexOf(v);
  if(idx>=0)ctState.tipos.splice(idx,1);else ctState.tipos.push(v);
  ctOnTipos();
});

function renderCtZonasOperChips(){
  var wrap=$('ctZonasOperChips');if(!wrap)return;
  wrap.innerHTML='';
  var zonas=zonasAll().sort(function(a,b){return(b.uses||0)-(a.uses||0);});
  var knownNamesLow=zonas.map(function(z){return z.n.toLowerCase();});
  ctState.zonasOper.forEach(function(n){if(knownNamesLow.indexOf(n.toLowerCase())<0)zonas.push({n:n,uses:0,last:0});});
  zonas.forEach(function(z){
    var b=document.createElement('button');b.type='button';
    b.className='chip chip-sm';b.textContent=z.n;b.dataset.v=z.n;
    b.classList.toggle('sel',ctState.zonasOper.indexOf(z.n)>=0);
    wrap.appendChild(b);
  });
}
function renderCtZonasOperAliadoChips(){
  var wrap=$('ctZonasOperAliadoChips');if(!wrap)return;
  wrap.innerHTML='';
  var zonas=zonasAll().sort(function(a,b){return(b.uses||0)-(a.uses||0);});
  var knownNamesLow=zonas.map(function(z){return z.n.toLowerCase();});
  ctState.zonasOperAliado.forEach(function(n){if(knownNamesLow.indexOf(n.toLowerCase())<0)zonas.push({n:n,uses:0,last:0});});
  zonas.forEach(function(z){
    var b=document.createElement('button');b.type='button';
    b.className='chip chip-sm';b.textContent=z.n;b.dataset.v=z.n;
    b.classList.toggle('sel',ctState.zonasOperAliado.indexOf(z.n)>=0);
    wrap.appendChild(b);
  });
}
$('ctZonasOperChips').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  c.classList.toggle('sel');
  var v=c.dataset.v;var idx=ctState.zonasOper.indexOf(v);
  if(idx>=0)ctState.zonasOper.splice(idx,1);else ctState.zonasOper.push(v);
  ctUpdateProgress();
});
$('ctZonasOperAliadoChips').addEventListener('click',function(e){
  var c=e.target.closest('.chip');if(!c)return;
  c.classList.toggle('sel');
  var v=c.dataset.v;var idx=ctState.zonasOperAliado.indexOf(v);
  if(idx>=0)ctState.zonasOperAliado.splice(idx,1);else ctState.zonasOperAliado.push(v);
  ctUpdateProgress();
});

var ctWaLinked=true;
(function(){
  var tel=$('ct_tel');var wa=$('ct_wa');
  if(!tel||!wa)return;
  tel.addEventListener('input',function(){
    if(ctWaLinked)wa.value=tel.value;
    ctUpdateProgress();
  });
  wa.addEventListener('input',function(){
    ctWaLinked=(wa.value===''||wa.value===$('ct_tel').value);
    ctUpdateProgress();
  });
})();

['ct_nombre','ct_alias','ct_empresa','ct_puesto','ct_email',
 'ct_presupuesto','ct_zona_interes_extra','ct_tipo_busca','ct_zona_oper_extra','ct_tipo_ofrece',
 'ct_propiedad_rel','ct_zona_oper_aliado_extra','ct_servicio','ct_otro_tipo',
 'ct_proxima','ct_seguimiento','ct_asesor','ct_notas',
 'ct_notas_busca','ct_notas_oferta','ct_notas_servicio',
 'ct_ocupacion','ct_habitantes'].forEach(function(id){
  var el=$(id);if(el)el.addEventListener('input',ctUpdateProgress);
});

function genContact(){
  var nombre=ctVal('ct_nombre');
  if(!nombre){alert('El nombre completo es obligatorio.');return;}
  if(!ctState.tipos.length){alert('Selecciona al menos un tipo de contacto.');return;}
  var tipo=ctState.tipos.map(function(v){return v==='Otro'?(ctVal('ct_otro_tipo')||'Otro'):v;}).join(' / ');
  var now=new Date();
  var fecha=now.toLocaleDateString('es-MX',{year:'numeric',month:'long',day:'numeric'});
  var isCtEdit=!!ctEditId;
  var id=isCtEdit?ctEditId:('CT-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).substr(2,8).toUpperCase());
  var asesor=ctVal('ct_asesor')||CFG.resp||'S/I';
  var esCom=ctState.tipos.some(function(v){return CT_COMPRADOR.indexOf(v)>=0;});
  var esProp=ctState.tipos.some(function(v){return CT_PROPIETARIO.indexOf(v)>=0;});
  var esAliado=ctState.tipos.some(function(v){return CT_ALIADO.indexOf(v)>=0;});

  // Trazabilidad v0.7 (mismo formato META que las capturas de propiedad)
  var ctPrev=isCtEdit?load('ct_hist',[]).filter(function(r){return r.id===id;})[0]:null;
  var ctEdiciones=isCtEdit?(((ctPrev&&ctPrev.ediciones)||0)+1):0;
  var ctCreadoIso=isCtEdit?(ctCapturadoEn||now.toISOString()):now.toISOString();
  var md='<!-- META\n';
  md+='uuid: '+id+'\n';
  md+='creado: '+ctCreadoIso+'\n';
  md+='modificado: '+now.toISOString()+'\n';
  md+='ediciones: '+ctEdiciones+'\n';
  md+='-->\n\n';
  md+='# Alta de contacto en Notion — '+nombre+'\n\n';
  md+='> **Acción:** Crear nuevo registro en base **Contactos / CRM**.\n\n';
  md+='## Identificación\n| Campo | Valor |\n|---|---|\n';
  md+='| Nombre completo | '+nombre+' |\n';
  md+='| Alias | '+ctSI(ctVal('ct_alias'))+' |\n';
  md+='| Tipo | '+tipo+' |\n';
  md+='| Empresa | '+ctSI(ctVal('ct_empresa'))+' |\n';
  md+='| Puesto | '+ctSI(ctVal('ct_puesto'))+' |\n\n';
  md+='## Datos de contacto\n| Campo | Valor |\n|---|---|\n';
  md+='| Teléfono | '+ctSI(ctVal('ct_tel'))+' |\n';
  md+='| WhatsApp | '+ctSI(ctVal('ct_wa'))+' |\n';
  md+='| Correo | '+ctSI(ctVal('ct_email'))+' |\n\n';

  if(esCom){
    var zonasBusca=ctState.zonasInteres.slice();
    var extraZonaInt=ctVal('ct_zona_interes_extra').trim();
    if(extraZonaInt&&zonasBusca.indexOf(extraZonaInt)<0)zonasBusca.push(extraZonaInt);
    var knownZonaNames=zonasAll().map(function(z){return z.n.toLowerCase();});
    var zonasBuscaStr=zonasBusca.length?zonasBusca.map(function(z){return knownZonaNames.indexOf(z.toLowerCase())<0?z+'*':z;}).join(' / '):'S/I';
    md+='## Búsqueda\n| Campo | Valor |\n|---|---|\n';
    md+='| Presupuesto | '+ctSI(ctVal('ct_presupuesto'))+' |\n';
    md+='| Forma de pago | '+ctSI(ctState.formaPago.join(', '))+' |\n';
    md+='| Zona(s) de interés | '+zonasBuscaStr+' |\n';
    md+='| Uso | '+ctSI(ctState.uso)+' |\n';
    md+='| Tipo de propiedad | '+ctSI(ctVal('ct_tipo_busca'))+' |\n';
    md+='| Amenidades deseadas | '+ctSI(ctState.amenidades.length?ctState.amenidades.join(', '):'')+' |\n';
    md+='| Nº de habitantes | '+ctSI(ctVal('ct_habitantes'))+' |\n';
    md+='| Ocupación | '+ctSI(ctVal('ct_ocupacion'))+' |\n';
    md+='| Urgencia | '+ctSI(ctState.urgencia)+' |\n';
    if(ctVal('ct_notas_busca'))md+='| Notas | '+ctVal('ct_notas_busca')+' |\n';
    zonasBusca.filter(function(z){return knownZonaNames.indexOf(z.toLowerCase())<0;}).forEach(function(z){md+='\n> ⚠️ Zona "'+z+'" (marcada con *) — verificar si existe en 📍 Zonas o crear.\n';});
    md+='\n';
  }
  if(esProp){
    var zonasOper=ctState.zonasOper.slice();
    var extraZonaOp=ctVal('ct_zona_oper_extra').trim();
    if(extraZonaOp&&zonasOper.indexOf(extraZonaOp)<0)zonasOper.push(extraZonaOp);
    var knZNOp=zonasAll().map(function(z){return z.n.toLowerCase();});
    var zonasOperStr=zonasOper.length?zonasOper.map(function(z){return knZNOp.indexOf(z.toLowerCase())<0?z+'*':z;}).join(' / '):'S/I';
    md+='## Oferta\n| Campo | Valor |\n|---|---|\n';
    md+='| Zona de operación | '+zonasOperStr+' |\n';
    md+='| Tipo de propiedad que ofrece | '+ctSI(ctVal('ct_tipo_ofrece'))+' |\n';
    md+='| Propiedad relacionada | '+ctSI(ctVal('ct_propiedad_rel'))+' |\n';
    if(ctVal('ct_notas_oferta'))md+='| Notas | '+ctVal('ct_notas_oferta')+' |\n';
    md+='\n';
    zonasOper.filter(function(z){return knZNOp.indexOf(z.toLowerCase())<0;}).forEach(function(z){md+='> ⚠️ Zona "'+z+'" (marcada con *) — verificar si existe en 📍 Zonas o crear.\n\n';});
    if(ctVal('ct_propiedad_rel')){md+='> ⚠️ Si la propiedad existe en la base, vincular en el campo **Propiedades** de este contacto.\n\n';}
  }
  if(esAliado){
    var zonasOpAliado=ctState.zonasOperAliado.slice();
    var extraZonaAl=ctVal('ct_zona_oper_aliado_extra').trim();
    if(extraZonaAl&&zonasOpAliado.indexOf(extraZonaAl)<0)zonasOpAliado.push(extraZonaAl);
    var knZNAl=zonasAll().map(function(z){return z.n.toLowerCase();});
    var zonasOpAliadoStr=zonasOpAliado.length?zonasOpAliado.map(function(z){return knZNAl.indexOf(z.toLowerCase())<0?z+'*':z;}).join(' / '):'S/I';
    md+='## Servicio\n| Campo | Valor |\n|---|---|\n';
    md+='| Zona de operación | '+zonasOpAliadoStr+' |\n';
    md+='| Servicio que ofrece | '+ctSI(ctVal('ct_servicio'))+' |\n';
    md+='| Nivel de confianza | '+ctSI(ctState.confianzaAliado)+' |\n';
    if(ctVal('ct_notas_servicio'))md+='| Notas | '+ctVal('ct_notas_servicio')+' |\n';
    md+='\n';
    zonasOpAliado.filter(function(z){return knZNAl.indexOf(z.toLowerCase())<0;}).forEach(function(z){md+='> ⚠️ Zona "'+z+'" (marcada con *) — verificar si existe en 📍 Zonas o crear.\n\n';});
  }
  md+='## Gestión\n| Campo | Valor |\n|---|---|\n';
  md+='| Fuente | '+ctSI($('ct_fuente')&&$('ct_fuente').value)+' |\n';
  if(!esAliado||esCom||esProp)md+='| Nivel de confianza | '+ctSI(ctState.confianza)+' |\n';
  md+='| Estatus | '+(ctState.estatus||'Nuevo')+' |\n';
  md+='| Próxima acción | '+ctSI(ctVal('ct_proxima'))+' |\n';
  md+='| Fecha de seguimiento | '+ctSI(ctVal('ct_seguimiento'))+' |\n\n';
  if(ctVal('ct_notas'))md+='## Notas\n'+ctVal('ct_notas')+'\n\n';
  md+='---\nCapturado por: **'+asesor+'** · '+fecha+' · ID provisional: `'+id+'`\n';

  ctMd=md;ctLastId=id;
  $('ctMdOut').textContent=md;
  $('ctOutputArea').style.display='';
  $('ctOutputArea').scrollIntoView({behavior:'smooth',block:'start'});
  var ctStars=calcCtStars();
  var ctSnap=snapshotCtForm();
  saveContactHist({id:id,fecha:now.toISOString(),
    capturadoEn:isCtEdit?ctCapturadoEn:now.toISOString(),
    modificadoEn:isCtEdit?now.toISOString():null,
    nombre:nombre,tipo:tipo,
    tel:ctVal('ct_tel'),email:ctVal('ct_email'),
    asesorId:asesorActivo?asesorActivo.id:null,
    asesor:asesor,md:md,enviado:false,ediciones:ctEdiciones,
    estrellas:ctStars.count,calidad:['','Esencial','Publicable','Completa'][ctStars.count]||'',
    formData:ctSnap});
  sndSuccess();
}

/* ===================== vCARD DE CONTACTOS — v0.7 ===================== */
/* Exporta la ficha como .vcf: share nativo con archivo si el navegador lo
   permite (móvil), si no descarga directa. */
function buildVCard(rec){
  var fd=rec.formData||{};
  function vesc(s){return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');}
  var lines=['BEGIN:VCARD','VERSION:3.0'];
  lines.push('FN:'+vesc(rec.nombre||'Contacto'));
  lines.push('N:'+vesc(rec.nombre||'Contacto')+';;;;');
  if(rec.tel)lines.push('TEL;TYPE=CELL:'+vesc(rec.tel));
  if(fd.ct_wa&&fd.ct_wa!==rec.tel)lines.push('TEL;TYPE=CELL:'+vesc(fd.ct_wa));
  if(rec.email)lines.push('EMAIL:'+vesc(rec.email));
  if(fd.ct_empresa)lines.push('ORG:'+vesc(fd.ct_empresa));
  if(fd.ct_puesto)lines.push('TITLE:'+vesc(fd.ct_puesto));
  lines.push('NOTE:'+vesc('Tipo: '+(rec.tipo||'S/I')+' · Capturado por: '+(rec.asesor||'S/I')+' (Capturadora Hauser)'));
  lines.push('END:VCARD');
  return lines.join('\r\n');
}
/* 1d (v0.7.1): toast de feedback — el vCard NUNCA debe "no hacer nada" */
function capToast(msg){
  var t=document.createElement('div');t.className='cap-toast';t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.classList.add('out');},2600);
  setTimeout(function(){t.remove();},3100);
}
function shareVCard(rec){
  if(!rec)return;
  var vcf=buildVCard(rec);
  var fname=((rec.nombre||'contacto').replace(/[^\w\-. À-ÿ]/g,'').trim()||'contacto')+'.vcf';
  function descargar(){
    var blob=new Blob([vcf],{type:'text/vcard'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download=fname;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},4000);
    capToast('📇 vCard descargado — ábrelo (barra de descargas) para añadir el contacto');
  }
  // 1d: bug Android/Chrome — si navigator.share rechazaba, el catch vacío se
  // lo tragaba y no pasaba NADA visible. Ahora: share nativo y, si falla por
  // cualquier razón que no sea que el usuario canceló, descarga con aviso.
  try{
    var file=new File([vcf],fname,{type:'text/vcard'});
    var shareable=navigator.canShare&&navigator.share&&
      (navigator.canShare({files:[file]})||navigator.canShare({files:[new File([vcf],fname,{type:'text/x-vcard'})]}));
    if(shareable){
      navigator.share({files:[file],title:rec.nombre||'Contacto'})
        .catch(function(err){if(!err||err.name!=='AbortError')descargar();});
      return;
    }
  }catch(e){}
  descargar();
}
function findCtRec(id){return load('ct_hist',[]).filter(function(r){return r.id===id;})[0];}

function saveContactHist(rec){
  if(!rec.id)rec.id='CT-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).substr(2,8).toUpperCase();
  if(!rec.fecha)rec.fecha=new Date().toISOString();
  var h=load('ct_hist',[]);
  h=h.filter(function(x){return x.id!==rec.id;}); // upsert: remove old version
  h.unshift(rec);save('ct_hist',h);
  // Limpiar modo edición de contacto
  ctEditId=null;ctCapturadoEn=null;
  var eb=$('ctEditBanner');if(eb)eb.style.display='none';
  var bg=$('ctBtnGenerar');if(bg)bg.textContent='Generar markdown';
  updateCtBadge();renderCtHist();
  if(CFG.endpoint){var p=buildGasPayloadContact(rec);gasPost(p).catch(function(){queueForRetry(p);});}
  gasSaveMarkdown(rec.id,rec.asesor||'S/I',rec.fecha||new Date().toISOString(),'contacto',rec.estrellas>=3?'completa':'sin terminar',rec.nombre||'S/I',rec.md||'');
}
function updateCtBadge(){
  var pend=load('ct_hist',[]).filter(function(r){return !r.enviado;}).length;
  var b=$('ctBadge');if(!b)return;
  b.textContent=pend;b.style.display=pend?'inline-flex':'none';
}
function renderCtHist(){
  var h=load('ct_hist',[]);var wrap=$('ctHistList');if(!wrap)return;
  if(!h.length){wrap.innerHTML='<div class="empty">Sin contactos capturados.</div>';return;}
  var html='';
  h.forEach(function(r){
    html+='<div class="hist-item">'+
      '<div class="hi-top"><div>'+
        '<div class="hi-name">'+esc(r.nombre)+'</div>'+
        '<div class="hi-meta">'+(r.tipo||'?')+' · '+(r.asesor||'S/I')+' · '+new Date(r.fecha).toLocaleString('es-MX')+'</div>'+
      '</div><span class="hi-state '+(r.enviado?'sent':'gen')+'">'+(r.enviado?'Enviado':'Generado')+'</span></div>'+
      '<div class="hi-actions">'+
        '<button type="button" class="btn" data-ct-copy="'+r.id+'">Copiar MD</button>'+
        '<button type="button" class="btn" data-ct-vcard="'+r.id+'">📇 vCard</button>'+
        (r.enviado?
          '<button type="button" class="btn" data-ct-pend="'+r.id+'">Marcar pendiente</button>':
          '<button type="button" class="btn" data-ct-sent="'+r.id+'">Marcar enviado</button>')+
        '<button type="button" class="btn btn-danger" data-ct-del="'+r.id+'">Borrar</button>'+
      '</div></div>';
  });
  wrap.innerHTML=html;
}
$('ctHistList').addEventListener('click',function(e){
  var t=e.target;var h=load('ct_hist',[]);
  function ctFind(id){return h.filter(function(r){return r.id===id;})[0];}
  if(t.dataset.ctCopy){var rc=ctFind(t.dataset.ctCopy);if(rc)copyText(rc.md);t.textContent='Copiado ✓';}
  if(t.dataset.ctVcard){shareVCard(ctFind(t.dataset.ctVcard));}
  if(t.dataset.ctSent){var rs=ctFind(t.dataset.ctSent);if(rs){rs.enviado=true;save('ct_hist',h);updateCtBadge();renderCtHist();}}
  if(t.dataset.ctPend){var rp=ctFind(t.dataset.ctPend);if(rp){rp.enviado=false;save('ct_hist',h);updateCtBadge();renderCtHist();}}
  if(t.dataset.ctDel){if(confirm('¿Borrar este contacto del historial?')){var nh=h.filter(function(r){return r.id!==t.dataset.ctDel;});save('ct_hist',nh);updateCtBadge();renderCtHist();}}
});
$('ctBtnGenerar').addEventListener('click',genContact);
$('ctBtnCopy').addEventListener('click',function(){
  copyText(ctMd);var b=$('ctBtnCopy');b.textContent='Copiado ✓';
  setTimeout(function(){b.textContent='Copiar markdown';},1800);
});
$('ctBtnVcard').addEventListener('click',function(){
  if(ctLastId)shareVCard(findCtRec(ctLastId));
});
$('ctBtnReset').addEventListener('click',function(){
  if(!confirm('¿Limpiar el formulario de contacto?'))return;
  ctDoReset();
});
function ctAddZonaInteres(){
  var inp=$('ct_zona_interes_extra');if(!inp)return;
  var v=inp.value.trim();if(!v)return;
  if(ctState.zonasInteres.indexOf(v)<0){
    ctState.zonasInteres.push(v);
    addZonaToLocal(v);
    renderCtZonaChips();
    renderCtZonasOperChips();
    renderCtZonasOperAliadoChips();
  }
  inp.value='';ctUpdateProgress();
}
(function(){
  var btn=$('ctBtnZonaInteresAdd');if(btn)btn.addEventListener('click',ctAddZonaInteres);
  var inp=$('ct_zona_interes_extra');
  if(inp)inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();ctAddZonaInteres();}});
})();
function ctAddZonaOper(){
  var inp=$('ct_zona_oper_extra');if(!inp)return;
  var v=inp.value.trim();if(!v)return;
  if(ctState.zonasOper.indexOf(v)<0){
    ctState.zonasOper.push(v);
    addZonaToLocal(v);
    renderCtZonasOperChips();
    renderCtZonaChips();
    renderCtZonasOperAliadoChips();
  }
  inp.value='';ctUpdateProgress();
}
function ctAddZonaOperAliado(){
  var inp=$('ct_zona_oper_aliado_extra');if(!inp)return;
  var v=inp.value.trim();if(!v)return;
  if(ctState.zonasOperAliado.indexOf(v)<0){
    ctState.zonasOperAliado.push(v);
    addZonaToLocal(v);
    renderCtZonasOperAliadoChips();
    renderCtZonaChips();
    renderCtZonasOperChips();
  }
  inp.value='';ctUpdateProgress();
}
(function(){
  var btn=$('ctBtnZonaOperAdd');if(btn)btn.addEventListener('click',ctAddZonaOper);
  var inp=$('ct_zona_oper_extra');
  if(inp)inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();ctAddZonaOper();}});
  var btnA=$('ctBtnZonaOperAliadoAdd');if(btnA)btnA.addEventListener('click',ctAddZonaOperAliado);
  var inpA=$('ct_zona_oper_aliado_extra');
  if(inpA)inpA.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();ctAddZonaOperAliado();}});
})();
function ctDoReset(){
  ['ct_nombre','ct_alias','ct_empresa','ct_puesto','ct_tel','ct_wa','ct_email',
   'ct_presupuesto','ct_zona_interes_extra','ct_tipo_busca','ct_zona_oper_extra','ct_tipo_ofrece',
   'ct_propiedad_rel','ct_zona_oper_aliado_extra','ct_servicio','ct_otro_tipo',
   'ct_proxima','ct_notas','ct_asesor',
   'ct_notas_busca','ct_notas_oferta','ct_notas_servicio',
   'ct_ocupacion','ct_habitantes'].forEach(function(id){var el=$(id);if(el)el.value='';});
  ctWaLinked=true;
  if($('ct_seguimiento'))$('ct_seguimiento').value=hoy;
  if($('ct_fuente'))$('ct_fuente').value='';
  document.querySelectorAll('#ctTipoChips .chip').forEach(function(b){b.classList.remove('sel');});
  ['ctConfianzaChips','ctUrgenciaChips','ctConfianzaAliado',
   'ctFormaPagoChips','ctUsoChips','ctAmenidadesChips'].forEach(function(cid){
    var w=$(cid);if(w)w.querySelectorAll('.chip').forEach(function(b){b.classList.remove('sel');});
  });
  renderCtZonaChips();
  renderCtZonasOperChips();
  renderCtZonasOperAliadoChips();
  var estatusWrap=$('ctEstatusChips');
  if(estatusWrap){
    estatusWrap.querySelectorAll('.chip').forEach(function(b){b.classList.toggle('sel',b.dataset.v==='Nuevo');});
  }
  ctState={tipos:[],confianza:'',estatus:'Nuevo',urgencia:'',confianzaAliado:'',
    zonasInteres:[],formaPago:[],amenidades:[],uso:'',zonasOper:[],zonasOperAliado:[]};
  $('ctOtroTipoBox').style.display='none';
  $('ctSecOper').style.display='none';
  $('ctSecComprador').style.display='none';
  $('ctSecPropietario').style.display='none';
  $('ctSecAliado').style.display='none';
  $('ctConfianzaRow').style.display='';
  $('ctOutputArea').style.display='none';
  ctMd='';ctUpdateProgress();
  window.scrollTo({top:0,behavior:'smooth'});
}
(function ctInit(){
  if($('ct_seguimiento'))$('ct_seguimiento').value=hoy;
  if(asesorActivo&&$('ct_asesor'))$('ct_asesor').value=asesorActivo.nombre||CFG.resp||'';
  else if($('ct_asesor'))$('ct_asesor').value=CFG.resp||'';
  var ew=$('ctEstatusChips');
  if(ew)ew.querySelectorAll('.chip').forEach(function(b){b.classList.toggle('sel',b.dataset.v==='Nuevo');});
  renderCtZonaChips();
  renderCtZonasOperChips();
  renderCtZonasOperAliadoChips();
  updateCtBadge();renderCtHist();
})();

/* ===================== DEV FEEDBACK (v0.7.1 Fase 0) =====================
   Herramienta TEMPORAL de QA del dueño — QUITAR COMPLETA antes del release
   final: borrar este bloque entero + el bloque .devfb- de styles.css.
   Long-press de DEVFB_HOLD_MS sobre cualquier elemento → cuadro de comentario
   con contexto automático (vista, slide del modo rápido, id del elemento).
   Botón flotante 📋 exporta todo como markdown pensado para Claude Code.
   No interfiere con taps ni scroll: nunca hace preventDefault; el timer se
   cancela con soltar, mover >12px o scroll. */
var DEV_FEEDBACK=true;            // ← apagar aquí (false) o borrar el bloque
var DEVFB_HOLD_MS=5000;           // duración del long-press, configurable
if(DEV_FEEDBACK)(function(){
  var KEY='devfb';
  function fbAll(){return load(KEY,[]);}
  function fbStore(list){save(KEY,list);fbBadge();}
  /* ---- DOM propio (creado aquí: cero rastro en index.html) ---- */
  var fab=document.createElement('button');
  fab.type='button';fab.className='devfb-fab';fab.title='Feedback dev — exportar comentarios';
  fab.innerHTML='📋<span class="devfb-badge"></span>';
  document.body.appendChild(fab);
  var badge=fab.querySelector('.devfb-badge');
  function fbBadge(){var n=fbAll().length;badge.textContent=n||'';badge.style.display=n?'flex':'none';}
  fbBadge();
  var ov=document.createElement('div');ov.className='overlay devfb-ov';
  ov.innerHTML='<div class="modal"><div class="modal-head"><h3>📝 Comentario dev</h3>'+
    '<button type="button" class="close-x devfb-x">×</button></div>'+
    '<div class="modal-body"><div class="devfb-ctx"></div>'+
    '<textarea class="devfb-txt" rows="4" placeholder="¿Qué está mal / qué mejorar aquí?"></textarea></div>'+
    '<div class="modal-foot"><button type="button" class="btn devfb-cancel">Cancelar</button>'+
    '<button type="button" class="btn btn-accent devfb-save" style="flex:1">Guardar comentario</button></div></div>';
  document.body.appendChild(ov);
  var ex=document.createElement('div');ex.className='overlay devfb-ov';
  ex.innerHTML='<div class="modal"><div class="modal-head"><h3>📋 Feedback dev</h3>'+
    '<button type="button" class="close-x devfb-x">×</button></div>'+
    '<div class="modal-body"><pre class="devfb-pre"></pre></div>'+
    '<div class="modal-foot"><button type="button" class="btn devfb-wipe">🗑 Borrar todos</button>'+
    '<button type="button" class="btn btn-accent devfb-copy" style="flex:1">Copiar markdown</button></div></div>';
  document.body.appendChild(ex);
  var ctxBox=ov.querySelector('.devfb-ctx'),txt=ov.querySelector('.devfb-txt'),pre=ex.querySelector('.devfb-pre');
  var pending=null;
  /* ---- contexto automático ---- */
  function fbCtx(target){
    var v=document.querySelector('.view.active');
    var c={ts:new Date().toISOString(),view:v?v.id:'?',slide:'',el:'',etq:''};
    if(qkOn&&qkSlides.length)c.slide=(qkIdx+1)+'/'+qkSlides.length+' · '+(($('qkSec')&&$('qkSec').textContent)||'');
    var withId=target&&target.closest?target.closest('[id]'):null;
    c.el=withId&&withId.id?'#'+withId.id:(target&&target.tagName?'<'+target.tagName.toLowerCase()+'>':'?');
    c.etq=String((target&&target.textContent)||'').trim().replace(/\s+/g,' ').slice(0,50);
    return c;
  }
  function fbOpen(target){
    pending=fbCtx(target);
    ctxBox.textContent='📍 '+pending.view+(pending.slide?' · slide '+pending.slide:'')+' · '+pending.el+(pending.etq?' («'+pending.etq+'»)':'');
    txt.value='';
    ov.classList.add('show');
    if(navigator.vibrate)navigator.vibrate(40);
    setTimeout(function(){txt.focus();},80);
  }
  /* ---- long-press sin estorbar taps/scroll ---- */
  var t=null,sx=0,sy=0,tgt=null;
  function cancel(){if(t){clearTimeout(t);t=null;}}
  document.addEventListener('pointerdown',function(e){
    if(ov.classList.contains('show')||ex.classList.contains('show'))return;
    if(e.target.closest('.devfb-fab'))return;
    tgt=e.target;sx=e.clientX;sy=e.clientY;
    cancel();
    t=setTimeout(function(){t=null;fbOpen(tgt);},DEVFB_HOLD_MS);
  },true);
  document.addEventListener('pointermove',function(e){
    if(!t)return;
    if(Math.abs(e.clientX-sx)>12||Math.abs(e.clientY-sy)>12)cancel();
  },true);
  document.addEventListener('pointerup',cancel,true);
  document.addEventListener('pointercancel',cancel,true);
  window.addEventListener('scroll',cancel,true);
  /* ---- guardar ---- */
  ov.querySelector('.devfb-save').addEventListener('click',function(){
    var texto=txt.value.trim();
    if(!texto){ov.classList.remove('show');return;}
    var list=fbAll();
    list.push({ts:pending.ts,view:pending.view,slide:pending.slide,el:pending.el,etq:pending.etq,comentario:texto});
    fbStore(list);
    ov.classList.remove('show');
  });
  ov.querySelector('.devfb-cancel').addEventListener('click',function(){ov.classList.remove('show');});
  /* ---- exportar markdown para Claude Code ---- */
  function fbMd(){
    var list=fbAll();
    var md='# 📋 Feedback dev — Capturadora Hauser v0.7.1\n'+
      'Exportado: '+new Date().toISOString()+' · '+list.length+' comentario(s)\n'+
      'Formato: un bloque por comentario con contexto automático.\n';
    list.forEach(function(c,i){
      md+='\n## '+(i+1)+' — '+c.view+' · '+c.el+'\n'+
        '- **Vista:** '+c.view+'\n'+
        (c.slide?'- **Slide (modo rápido):** '+c.slide+'\n':'')+
        '- **Elemento:** '+c.el+(c.etq?' («'+c.etq+'»)':'')+'\n'+
        '- **Timestamp:** '+c.ts+'\n'+
        '**Comentario:**\n'+c.comentario.split('\n').map(function(l){return '> '+l;}).join('\n')+'\n';
    });
    return md;
  }
  fab.addEventListener('click',function(){
    pre.textContent=fbAll().length?fbMd():'(sin comentarios todavía — mantén presionado 5 s cualquier elemento para comentar)';
    ex.classList.add('show');
  });
  ex.querySelector('.devfb-copy').addEventListener('click',function(){
    var md=fbMd();var self=this;
    function ok(){self.textContent='✓ Copiado';setTimeout(function(){self.textContent='Copiar markdown';},1500);}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(md).then(ok).catch(function(){fallback();});
    else fallback();
    function fallback(){var ta=document.createElement('textarea');ta.value=md;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');ok();}catch(e){}document.body.removeChild(ta);}
  });
  ex.querySelector('.devfb-wipe').addEventListener('click',function(){
    if(!confirm('¿Borrar TODOS los comentarios de feedback?'))return;
    fbStore([]);pre.textContent='(sin comentarios)';
  });
  ov.querySelector('.devfb-x').addEventListener('click',function(){ov.classList.remove('show');});
  ex.querySelector('.devfb-x').addEventListener('click',function(){ex.classList.remove('show');});
})();

/* ===================== SERVICE WORKER ===================== */
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
}
})();
