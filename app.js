/* ============================================================
   Capturador de propiedades — Hauser / Inmobitera
   app.js  ·  v4 (PWA-ready, historial, CRM, backend opcional)
   ============================================================ */
(function(){
'use strict';
var $=function(id){return document.getElementById(id);};

/* ---------- config local ---------- */
var CFG=load('cfg',{resp:'Daniel',drive:'Hauser Propiedades',endpoint:''});
function load(k,def){try{var v=localStorage.getItem('cap_'+k);return v?JSON.parse(v):def;}catch(e){return def;}}
function save(k,v){try{localStorage.setItem('cap_'+k,JSON.stringify(v));}catch(e){}}

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

var state={tipo:'',oper:'Venta',ofrece:'',crm:'No',topo:'',modo:'A · Reventa de lote',
  madre:'No, solo individuales',driveShare:'Sí, carpeta común',
  serv:[],caract:[],caractTerr:[],lat:null,lng:null,zonaNueva:false,
  people:[],editId:null};

var hoy=new Date().toISOString().slice(0,10);
$('f_fecha').value=hoy;$('f_seguimiento').value=hoy;
$('f_resp').value=CFG.resp;
$('cfg_resp').value=CFG.resp;$('cfg_drive').value=CFG.drive;$('cfg_endpoint').value=CFG.endpoint;

/* ===================== NAVEGACIÓN ===================== */
$('navbar').addEventListener('click',function(e){
  var b=e.target.closest('button[data-view]');if(!b)return;
  showView(b.dataset.view);
});
function showView(id){
  document.querySelectorAll('.view').forEach(function(v){v.classList.toggle('active',v.id===id);});
  document.querySelectorAll('#navbar button').forEach(function(b){b.classList.toggle('active',b.dataset.view===id);});
  window.scrollTo(0,0);
  if(id==='viewHistory')renderHist();
  if(id==='viewConfig')renderCfgCount();
}

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
  buildCaract();refreshUnits();refreshDrive();
}
function onOper(v){
  var venta=(v==='Venta'||v==='Venta y Renta');
  var renta=(v==='Renta'||v==='Venta y Renta');
  $('rowPrecioVenta').style.display=venta?'':'none';
  $('rowPrecioRenta').style.display=renta?'':'none';
}
bindChips('tipoChips','tipo',onTipo);
bindChips('operChips','oper',onOper);
bindChips('ofreceChips','ofrece',onOfrece);
bindChips('crmChips','crm',function(v){renderCRM();});
bindChips('topoChips','topo');
bindChips('modoChips','modo');
bindChips('madreChips','madre');
bindChips('driveShareChips','driveShare');

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
  // sembrar una persona-base según quién ofrece
  var roleMap={
    'Propietario directo':'Propietario (B)',
    'Asesor / broker':'Asesor inmobiliario',
    'Socio inmobiliario':'Socio inmobiliario',
    'Desarrollador':'Desarrollador',
    'Referido':'Referido'
  };
  // quitar la persona auto previa (marcada con auto:true y no editada)
  state.people=state.people.filter(function(p){return !(p.auto&&!p.touched);});
  if(roleMap[v]){
    state.people.unshift({id:'p'+Date.now(),nombre:'',rol:roleMap[v],tel:'',auto:true,touched:false});
  }
  renderCRM();
}

/* ===================== CRM dinámico ===================== */
var ROLES=['Cliente A (comprador)','Cliente B (propietario/vendedor)','Asesor inmobiliario','Broker','Socio inmobiliario','Desarrollador','Referido','Otro'];
function renderCRM(){
  var wrap=$('crmCards');wrap.innerHTML='';
  // si CRM = Sí y no hay comprador, sembrar uno
  if(state.crm==='Sí' && !state.people.some(function(p){return /Cliente A/.test(p.rol);})){
    state.people.push({id:'pc'+Date.now(),nombre:'',rol:'Cliente A (comprador)',tel:'',auto:true,touched:false});
  }
  state.people.forEach(function(p){
    var card=document.createElement('div');card.className='person-card';
    var dataState=(p.nombre||p.tel)?'ok':'';
    var stTxt=(p.nombre||p.tel)?'Datos capturados':'Faltan datos';
    card.innerHTML='<div class="pc-top"><div><div class="pc-name">'+(p.nombre||'(sin nombre)')+'</div>'+
      '<div class="pc-role">'+p.rol+(p.tel?(' · '+p.tel):'')+'</div></div>'+
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
  if(isNew)p={id:'p'+Date.now(),rol:'Otro'};
  state.editId=p.id;state._editIsNew=isNew;state._editTmp=Object.assign({},p);
  $('personTitle').textContent=p.nombre?('Datos de '+p.nombre):'Completar datos';
  var f=[
    ['nombre','Nombre completo','text'],
    ['rol','Tipo de contacto','select',ROLES],
    ['empresa','Empresa / inmobiliaria','text'],
    ['puesto','Puesto / rol','text'],
    ['tel','Teléfono','tel'],
    ['wa','WhatsApp','tel'],
    ['email','Correo','email'],
    ['fuente','Fuente del contacto','text'],
    ['relacion','Relación con la propiedad','text'],
    ['acuerdo','Acuerdo comercial','text'],
    ['comision','Comisión','text'],
    ['zonaOp','Zona de operación','text'],
    ['zonaInt','Zona de interés','text'],
    ['presupuesto','Presupuesto (si compra)','text'],
    ['busca','Tipo de propiedad que busca','text'],
    ['urgencia','Urgencia','select',['S/I','Baja','Media','Alta']],
    ['confianza','Nivel de confianza','select',['S/I','Bajo','Medio','Alto']],
    ['estatus','Estatus del contacto','select',['Nuevo','En seguimiento','Cliente activo','Cerrado']],
    ['notas','Notas internas','textarea'],
    ['prox','Próxima acción','text'],
    ['fechaSeg','Fecha de seguimiento','date']
  ];
  var html='';
  f.forEach(function(fl){
    var key=fl[0],lab=fl[1],typ=fl[2],opts=fl[3];
    var val=p[key]!=null?p[key]:'';
    html+='<div class="field"><div class="field-top"><label>'+lab+'</label></div>';
    if(typ==='select'){
      html+='<select data-k="'+key+'">'+opts.map(function(o){return '<option'+(o===val?' selected':'')+'>'+o+'</option>';}).join('')+'</select>';
    }else if(typ==='textarea'){
      html+='<textarea data-k="'+key+'">'+esc(val)+'</textarea>';
    }else{
      html+='<input type="'+typ+'" data-k="'+key+'" value="'+esc(val)+'">';
    }
    html+='</div>';
  });
  $('personBody').innerHTML=html;
  $('personOverlay').classList.add('show');
}
function esc(s){return String(s).replace(/"/g,'&quot;').replace(/</g,'&lt;');}
$('personClose').addEventListener('click',closePerson);
$('personCancel').addEventListener('click',closePerson);
function closePerson(){$('personOverlay').classList.remove('show');state.editId=null;}
$('personSave').addEventListener('click',function(){
  var p=state._editTmp;
  $('personBody').querySelectorAll('[data-k]').forEach(function(el){p[el.dataset.k]=el.value.trim();});
  p.touched=true;p.auto=false;
  if(state._editIsNew)state.people.push(p);
  else state.people=state.people.map(function(x){return x.id===p.id?p:x;});
  closePerson();renderCRM();
});

/* ===================== CARACTERÍSTICAS por tipo ===================== */
var CAR_CASA=['Alberca','Terraza','Jardín','Seguridad','Roof garden','Bodega','Cuarto de servicio','Estudio','Cocina integral','Vista','Una sola planta','En condominio','Nueva','En construcción','Para remodelar','Áreas comunes','Cisterna','Paneles solares','Amueblada','Acepta mascotas','Elevador','Clóset vestidor'];
var CAR_TERR=['Plano','Con pendiente','Con vista','Bardeado','Servicios','Agua','Luz','Drenaje','Calle pavimentada','Uso habitacional','Potencial de desarrollo','Para inversión','Escrituras','Cesión de derechos','Frente amplio','Irregular','Regular','Esquina'];
var CAR_LOCAL=['Sobre avenida','Alto flujo','Estacionamiento','Doble altura','Bodega','Baños','Seguridad','Acceso de carga','Uso comercial','Frente visible','Cortina','Área de maniobra'];
function poolFor(){
  if(state.tipo==='Terreno')return CAR_TERR;
  if(['Local comercial','Oficina','Bodega'].indexOf(state.tipo)!==-1)return CAR_LOCAL;
  return CAR_CASA;
}
var carShown=6;
function buildCaract(){carShown=6;renderCaract();}
function renderCaract(){
  // tags seleccionados
  var tags=$('caractTags');tags.innerHTML='';
  state.caract.forEach(function(c){
    var t=document.createElement('span');t.className='tag';t.appendChild(document.createTextNode(c));
    var x=document.createElement('button');x.type='button';x.textContent='✕';
    x.addEventListener('click',function(){state.caract=state.caract.filter(function(v){return v!==c;});renderCaract();});
    t.appendChild(x);tags.appendChild(t);
  });
  // chips sugeridos (los del pool no seleccionados)
  var pool=poolFor().filter(function(c){return state.caract.indexOf(c)===-1;});
  var chips=$('caractChips');chips.innerHTML='';
  pool.slice(0,carShown).forEach(function(c){
    var b=document.createElement('button');b.type='button';b.className='chip chip-sm';b.textContent=c;
    b.addEventListener('click',function(){state.caract.push(c);renderCaract();updateProgress();});
    chips.appendChild(b);
  });
}
function addCaract(c){if(c&&state.caract.indexOf(c)===-1){state.caract.push(c);renderCaract();}}
$('btnCaractMas').addEventListener('click',function(){carShown+=6;renderCaract();});
$('btnCaractRefresh').addEventListener('click',function(){carShown=6;renderCaract();});
$('f_caract_buscar').addEventListener('keydown',function(e){
  if(e.key==='Enter'){e.preventDefault();var v=this.value.trim();if(v){addCaract(v);this.value='';updateProgress();}}
});
$('f_caract_buscar').addEventListener('input',function(){
  var q=this.value.trim().toLowerCase();if(!q){renderCaract();return;}
  var pool=poolFor().filter(function(c){return state.caract.indexOf(c)===-1 && c.toLowerCase().indexOf(q)!==-1;});
  var chips=$('caractChips');chips.innerHTML='';
  pool.forEach(function(c){
    var b=document.createElement('button');b.type='button';b.className='chip chip-sm';b.textContent=c;
    b.addEventListener('click',function(){addCaract(c);$('f_caract_buscar').value='';updateProgress();});
    chips.appendChild(b);
  });
});

/* características de terreno (sección aparte) */
var carTerrShown=8;
function renderCaractTerr(){
  var tags=$('caractTerrTags');tags.innerHTML='';
  state.caractTerr.forEach(function(c){
    var t=document.createElement('span');t.className='tag';t.appendChild(document.createTextNode(c));
    var x=document.createElement('button');x.type='button';x.textContent='✕';
    x.addEventListener('click',function(){state.caractTerr=state.caractTerr.filter(function(v){return v!==c;});renderCaractTerr();});
    t.appendChild(x);tags.appendChild(t);
  });
  var pool=CAR_TERR.filter(function(c){return state.caractTerr.indexOf(c)===-1;});
  var chips=$('caractTerrChips');chips.innerHTML='';
  pool.slice(0,carTerrShown).forEach(function(c){
    var b=document.createElement('button');b.type='button';b.className='chip chip-sm';b.textContent=c;
    b.addEventListener('click',function(){state.caractTerr.push(c);renderCaractTerr();});
    chips.appendChild(b);
  });
}
$('btnCaractTerrMas').addEventListener('click',function(){carTerrShown+=8;renderCaractTerr();});
renderCaract();renderCaractTerr();renderCRM();

/* ===================== S/I ===================== */
document.querySelectorAll('.si-btn').forEach(function(b){
  b.addEventListener('click',function(){
    var inp=$(b.dataset.for);var on=!b.classList.contains('active');
    b.classList.toggle('active',on);inp.disabled=on;if(on)inp.value='';
    updateProgress();
  });
});
function siOn(id){var b=document.querySelector('.si-btn[data-for="'+id+'"]');return !!(b&&b.classList.contains('active'));}

/* ===================== ZONA inteligente ===================== */
var zonaSel='';
var zonaTimer=null;
$('f_zona').addEventListener('focus',function(){renderZonaSuggest('');});
$('f_zona').addEventListener('input',function(){
  zonaSel='';state.zonaNueva=false;
  clearTimeout(zonaTimer);
  var q=this.value;
  zonaTimer=setTimeout(function(){renderZonaSuggest(q);},120);
  updateProgress();refreshDrive();
});
$('f_zona').addEventListener('blur',function(){setTimeout(function(){$('zonaSuggest').style.display='none';},200);});
function renderZonaSuggest(q){
  var box=$('zonaSuggest');box.innerHTML='';
  var all=zonasAll();
  var qn=q.trim().toLowerCase();
  var matches;
  if(!qn){
    matches=all.sort(function(a,b){return (b.uses||0)-(a.uses||0);}).slice(0,6);
  }else{
    matches=all.filter(function(z){return z.n.toLowerCase().indexOf(qn)!==-1;}).slice(0,8);
  }
  matches.forEach(function(z){
    var d=document.createElement('div');
    d.textContent=z.n+(z.uses?(' · '+z.uses+' uso(s)'):'');
    d.addEventListener('mousedown',function(e){e.preventDefault();pickZona(z.n,false);});
    box.appendChild(d);
  });
  var exact=all.some(function(z){return z.n.toLowerCase()===qn;});
  if(qn && !exact){
    var add=document.createElement('div');add.className='add-new';
    add.textContent='+ Agregar Zona / Colonia: '+q.trim();
    add.addEventListener('mousedown',function(e){e.preventDefault();pickZona(q.trim(),true);});
    box.appendChild(add);
  }
  box.style.display=box.children.length?'block':'none';
}
function pickZona(n,nueva){
  $('f_zona').value=n;zonaSel=n;state.zonaNueva=nueva;
  $('zonaSuggest').style.display='none';
  $('zonaHint').textContent=nueva?('Zona nueva: el markdown indicará crearla en la base 📍 Zonas y relacionarla.'):'';
  updateProgress();refreshDrive();
}
function zonaVal(){var v=$('f_zona').value.trim();return v||'S/I';}

/* ===================== FUENTE otra ===================== */
$('f_fuente').addEventListener('change',function(){
  $('boxFuenteOtra').style.display=(this.value==='__otra')?'':'none';
});
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
function numVal(id){var v=parseNumeroES($(id).value);return(v!=null&&$(id).value.trim()!=='')?v:null;}

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
  if(n<=1){list.innerHTML='';return;}
  var base=nombreBase();
  var prev=Array.prototype.map.call(list.querySelectorAll('.unit-card'),function(card){
    return {nombre:card.querySelector('[data-u=nombre]').value,precio:card.querySelector('[data-u=precio]').value,
      m2:card.querySelector('[data-u=m2]').value,nota:card.querySelector('[data-u=nota]').value};
  });
  list.innerHTML='';
  for(var i=1;i<=n;i++){
    var p=prev[i-1]||{};
    var card=document.createElement('div');card.className='unit-card';
    card.innerHTML='<div class="unit-head">Unidad '+i+'</div>'+
      '<input type="text" data-u="nombre" value="'+esc(p.nombre||(base+' - '+sufijoTipo()+' '+i))+'">'+
      '<div class="row2">'+
        '<input type="text" data-u="precio" placeholder="Precio" value="'+esc(p.precio||'')+'">'+
        '<input type="text" data-u="m2" placeholder="m²" value="'+esc(p.m2||'')+'">'+
      '</div>'+
      '<input type="text" data-u="nota" placeholder="Nota (opcional)" value="'+esc(p.nota||'')+'" style="margin-top:8px">';
    list.appendChild(card);
  }
}
$('f_unidades').addEventListener('input',refreshUnits);
$('f_nombre').addEventListener('input',function(){refreshDrive();});
function refreshDrive(){
  if($('f_drive').dataset.manual)return;
  $('f_drive').value=(CFG.drive||'Hauser Propiedades')+' / '+nombreBase();
}
$('f_drive').addEventListener('input',function(){this.dataset.manual='1';});
refreshDrive();

/* botón crear/confirmar carpeta drive */
$('btnDrive').addEventListener('click',function(){
  var name=$('f_drive').value.trim();
  if(!name){$('driveStatus').textContent='Escribe primero el nombre de la carpeta.';return;}
  if(CFG.endpoint){
    $('driveStatus').className='status';$('driveStatus').textContent='Creando carpeta en Drive…';
    api('createFolder',{name:name}).then(function(res){
      if(res&&res.url){$('driveStatus').className='status ok';
        $('driveStatus').textContent='✓ Carpeta lista. Ya puedes subir fotos.';
        $('btnFotos').disabled=false;$('btnFotos').dataset.url=res.url;}
      else throw new Error('sin url');
    }).catch(function(){
      $('driveStatus').className='status err';$('driveStatus').textContent='No se pudo crear automáticamente; el markdown llevará la instrucción de crearla.';
    });
  }else{
    $('driveStatus').className='status';
    $('driveStatus').textContent='Sin backend configurado: el markdown indicará crear esta carpeta. Configúralo en ⚙️ para automatizarlo.';
  }
});
$('btnFotos').addEventListener('click',function(){
  var url=this.dataset.url;if(url)window.open(url,'_blank');
  else alert('Primero crea/confirma la carpeta de Drive.');
});

/* ===================== DIRECCIÓN: autocompletado ===================== */
var sugTimer=null;
$('f_direccion').addEventListener('input',function(){
  refreshDrive();updateProgress();
  var q=$('f_direccion').value.trim();clearTimeout(sugTimer);
  if(q.length<5){$('dirSuggest').style.display='none';return;}
  sugTimer=setTimeout(function(){buscarDireccion(q);},650);
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
        autoZonaFromAddr(it);box.style.display='none';refreshDrive();updateProgress();
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
  if($('f_zona').value.trim())return;
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
    if(d&&d.display_name&&!$('f_direccion').value.trim()){$('f_direccion').value=d.display_name;refreshDrive();}
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
    updateProgress();refreshDrive();
  })
  .catch(function(){
    $('anuncioStatus').className='status err';
    $('anuncioStatus').textContent='No se pudo leer el anuncio aquí. Esta función opera dentro de Claude o con backend; en archivo suelto, captura manual. El portal también puede bloquear la lectura.';
  })
  .finally(function(){$('btnAnuncio').disabled=false;});
});

/* ===================== PROGRESO ===================== */
function filled(id){var el=$(id);if(!el)return false;return siOn(id)||el.value.trim()!=='';}
function updateProgress(){
  var t=(state.tipo==='Terreno');
  var ids=['f_direccion','f_m2t'];
  if(zonaVal()!=='S/I')ids.push('f_zona');else ids.push('f_zona');
  if(state.oper==='Venta'||state.oper==='Venta y Renta')ids.push('f_precio');
  if(state.oper==='Renta'||state.oper==='Venta y Renta')ids.push('f_precio_renta');
  if(t)ids=ids.concat(['f_uso','f_frente']);
  else if(state.tipo)ids=ids.concat(['f_m2c','f_rec','f_ban','f_est']);
  var total=ids.length+2,done=0;
  ids.forEach(function(id){if(filled(id))done++;});
  if(state.tipo)done++;if(state.ofrece)done++;
  if(t){total+=2;if(state.serv.length)done++;if(state.topo)done++;}
  var pct=total?Math.round(done/total*100):0;
  $('progText').textContent=done+' de '+total+' campos clave';
  $('progPct').textContent=pct+'%';$('progFill').style.width=pct+'%';
}
['f_zona','f_uso','f_frente','f_fondo','f_rec','f_ban','f_est','f_notas','f_m2c'].forEach(function(id){
  var el=$(id);if(el){el.addEventListener('input',updateProgress);el.addEventListener('change',updateProgress);}
});
updateProgress();

/* ===================== HELPERS SALIDA ===================== */
function txt(id){return siOn(id)?'S/I':($(id).value.trim()||'S/I');}
function numCell(id){
  if(siOn(id))return{val:null,pend:true};
  var v=numVal(id);if(v==null)return{val:null,pend:true};
  return{val:v,pend:false};
}
function lineas(id){return $(id).value.split('\n').map(function(s){return s.trim();}).filter(Boolean);}

/* requisitos de "captura completa": m2, recámaras, baños, responsable */
function faltantesCompletitud(){
  var f=[];var esTerreno=(state.tipo==='Terreno');
  if(numCell('f_m2t').pend && (esTerreno||numCell('f_m2c').pend))f.push('m² (terreno o construcción)');
  if(!esTerreno){
    if(numCell('f_rec').pend)f.push('recámaras');
    if(siOn('f_ban')||!$('f_ban').value.trim())f.push('baños');
  }
  if(!$('f_resp').value)f.push('quién captura (responsable)');
  return f;
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
  var zona=zonaVal();var fuente=fuenteVal();var nombre=nombreBase();
  var nU=Math.max(1,parseInt($('f_unidades').value,10)||1);

  // estatus automático: si faltan datos de completitud -> En análisis
  var faltC=faltantesCompletitud();
  var estatus=$('f_estatus').value;
  if(faltC.length && estatus==='Captada'){estatus='En análisis';$('f_estatus').value='En análisis';
    $('estatusHint').textContent='Se ajustó a "En análisis" porque faltan datos mínimos.';}

  var pv=conVenta?numCell('f_precio'):{val:null,pend:false,na:true};
  var pr=conRenta?numCell('f_precio_renta'):{val:null,pend:false,na:true};
  var m2t=numCell('f_m2t');
  var m2c=esTerreno?{val:null,na:true}:numCell('f_m2c');
  var rec=esTerreno?{val:null,na:true}:numCell('f_rec');
  var est=esTerreno?{val:null,na:true}:numCell('f_est');
  var banTxt;if(esTerreno)banTxt={v:null,na:true};else{var bv=$('f_ban').value.trim();banTxt=(siOn('f_ban')||!bv)?{pend:true}:{v:bv};}

  function valNum(o){return o.na?'':(o.pend?'':(o.val!=null?String(o.val):''));}
  function notaNum(o){return o.na?'N/A':(o.pend?'S/I':'');}

  var moneda=$('f_moneda').value;
  var unidades=[];
  if(nU>1){
    unidades=Array.prototype.map.call($('unitsList').querySelectorAll('.unit-card'),function(card){
      return {nombre:card.querySelector('[data-u=nombre]').value.trim(),
        precio:card.querySelector('[data-u=precio]').value.trim(),
        m2:card.querySelector('[data-u=m2]').value.trim(),
        nota:card.querySelector('[data-u=nota]').value.trim()};
    }).filter(function(u){return u.nombre;});
  }

  /* ---------- construir markdown ---------- */
  var md='';
  md+='# Alta de propiedad en Notion — '+nombre+'\n\n';
  md+='> Instrucción para el agente de Notion (sistema Hauser, Cuernavaca). Crea o actualiza la propiedad en la base 🏠 **Propiedades** y vincula las bases relacionadas. No inventes datos: respeta S/I (sin información) y N/A (no aplica).\n\n';

  md+='## 1. Acción principal\n';
  if(nU>1){
    md+='Crear **'+unidades.length+' páginas** en 🏠 Propiedades, una por unidad (no agrupar en una sola). Clonar los datos comunes de abajo y respetar los datos específicos de cada unidad.\n';
    md+='- Página madre del conjunto: **'+state.madre+'**.\n';
    md+='- Carpeta de Drive: **'+state.driveShare+'**.\n\n';
  }else{
    md+='Crear **1 página** en 🏠 Propiedades con el nombre **'+nombre+'** (si ya existe una con esa dirección, actualizarla).\n\n';
  }

  md+='## 2. Campos de la base 🏠 Propiedades\n';
  md+='| Campo Notion | Tipo esperado | Valor para Notion | Nota interna |\n';
  md+='|---|---|---|---|\n';
  md+=row('Nombre','Title',cell(nombre))+'\n';
  md+=row('Código','Text',cell($('f_codigo').value.trim(),$('f_codigo').value.trim()?'':'Asignar PROP-siguiente'))+'\n';
  md+=row('Tipo de inmueble','Select',cell(state.tipo,state.tipo?'':'S/I'))+'\n';
  md+=row('Operación','Select',cell(state.oper))+'\n';
  md+=row('Dirección','Text',cell($('f_direccion').value.trim(),$('f_direccion').value.trim()?'identificador principal':'S/I'))+'\n';
  md+=row('Zona','Relación → 📍 Zonas',cell(zona,zona==='S/I'?'S/I':(state.zonaNueva?'CREAR esta zona y relacionar':'buscar y relacionar')))+'\n';
  md+=row('Precio','Number',{v:valNum(pv),nota:notaNum(pv)+(pv.val&&moneda?(' ('+moneda+', sin símbolo)'):'')})+'\n';
  if(conRenta)md+=row('Precio renta','Number',{v:valNum(pr),nota:notaNum(pr)+' renta mensual'})+'\n';
  md+=row('m² terreno','Number',{v:valNum(m2t),nota:notaNum(m2t)})+'\n';
  md+=row('m² construcción','Number',{v:valNum(m2c),nota:notaNum(m2c)})+'\n';
  md+=row('Recámaras','Number',{v:valNum(rec),nota:notaNum(rec)})+'\n';
  md+=row('Baños','Text',{v:(banTxt.na?'':(banTxt.pend?'':banTxt.v)),nota:(banTxt.na?'N/A':(banTxt.pend?'S/I':''))})+'\n';
  md+=row('Estacionamientos','Number',{v:valNum(est),nota:notaNum(est)})+'\n';
  md+=row('Estatus','Select',cell(estatus))+'\n';
  md+=row('Publicable','Select / Checkbox',cell($('f_pub').value))+'\n';
  md+=row('Fuente','Select',cell(fuente.nombre,fuente.nueva?'OPCIÓN NUEVA: agregar al select de Fuente':''))+'\n';
  md+=row('Propietario','Relación → 👥 Contactos',cell(propietarioNombre(),propietarioNota()))+'\n';
  md+=row('Precio / m²','Fórmula',{v:'',nota:'lo calcula Notion; no escribir'})+'\n';
  md+='\n';

  md+='## 3. Reglas de relaciones\n';
  md+='- **Zona**: es relación a 📍 Zonas. Busca la zona "'+zona+'"; si no existe, créala (Municipio: Cuernavaca por defecto) y relaciónala. No la dejes como texto suelto.\n';
  md+='- **Propietario**: relación a 👥 Contactos. El **asesor/broker NO es el propietario legal**; si solo hay asesor, el Propietario legal queda **S/I**.\n';
  md+='- **Operaciones / Proyectos / Tareas**: son relaciones; créalas como registros aparte y vincula, no las metas como texto en Propiedades.\n';
  md+='- Las frases largas (notas, descripción) van en el **contenido de la página**, no en campos de relación.\n\n';

  // 4. CRM
  md+='## 4. Personas / CRM (base 👥 Contactos)\n';
  var people=state.people.filter(function(p){return p.nombre||p.tel||p.touched;});
  if(!people.length){
    md+='- Sin contactos capturados. Propietario legal: **S/I**.\n\n';
  }else{
    people.forEach(function(p){
      md+='### '+(p.nombre||'(nombre S/I)')+' — '+p.rol+'\n';
      md+='Crear o actualizar en 👥 Contactos y relacionar con esta propiedad según su rol.\n';
      md+='| Campo | Valor | Nota |\n|---|---|---|\n';
      md+='| Nombre | '+(p.nombre||' ')+' | '+(p.nombre?'':'S/I')+' |\n';
      md+='| Tipo de contacto | '+p.rol+' | |\n';
      if(p.tel)md+='| Teléfono | '+p.tel+' | |\n';
      if(p.wa)md+='| WhatsApp | '+p.wa+' | |\n';
      if(p.email)md+='| Email | '+p.email+' | |\n';
      if(p.empresa)md+='| Empresa | '+p.empresa+' | |\n';
      if(p.fuente)md+='| Fuente | '+p.fuente+' | |\n';
      if(p.relacion)md+='| Relación con propiedad | '+p.relacion+' | |\n';
      if(p.acuerdo)md+='| Acuerdo comercial | '+p.acuerdo+' | |\n';
      if(p.comision)md+='| Comisión | '+p.comision+' | |\n';
      if(p.presupuesto)md+='| Presupuesto | '+p.presupuesto+' | |\n';
      if(p.busca)md+='| Busca | '+p.busca+' | |\n';
      if(p.zonaInt)md+='| Zona de interés | '+p.zonaInt+' | relación → 📍 Zonas |\n';
      if(p.urgencia&&p.urgencia!=='S/I')md+='| Urgencia | '+p.urgencia+' | |\n';
      if(p.confianza&&p.confianza!=='S/I')md+='| Nivel de confianza | '+p.confianza+' | |\n';
      if(p.estatus)md+='| Etapa del lead | '+p.estatus+' | |\n';
      if(p.notas)md+='| Notas | '+p.notas+' | |\n';
      md+='\n';
    });
  }

  // 5. Operaciones
  var comprador=people.filter(function(p){return /Cliente A/.test(p.rol);})[0];
  md+='## 5. Operaciones\n';
  if(comprador){
    md+='Hay comprador interesado ('+(comprador.nombre||'S/I')+'). Crear una **Operación** en 🤝 Operaciones, relacionarla con esta propiedad y con el contacto comprador.\n';
    md+='- Comisión esperada: '+$('f_comision').value+(comprador.presupuesto?(' · presupuesto comprador: '+comprador.presupuesto):'')+'.\n\n';
  }else{
    md+='Sin comprador aún. No crear Operación todavía.\n\n';
  }

  // 6. Tareas de seguimiento
  md+='## 6. Tareas de seguimiento\n';
  md+='Crear en ✅ Tareas, relacionadas con la propiedad/proyecto:\n';
  md+='- '+($('f_proxima').value.trim()||'Confirmar datos pendientes con el contacto')+' (responsable: '+$('f_resp').value+', fecha: '+$('f_seguimiento').value+').\n';
  if(faltC.length)md+='- Completar datos mínimos faltantes: '+faltC.join(', ')+'.\n';
  md+='\n';

  // 7. Drive
  md+='## 7. Carpeta de Drive y fotos\n';
  md+='- Carpeta: **'+$('f_drive').value.trim()+'** (dentro de la carpeta compartida de propiedades).\n';
  md+='- Notion guarda el **link** de la carpeta, no las fotos.\n';
  md+='- Fotos pendientes: '+(esTerreno?'panorámicas del lote, frente, colindancias, calle/contexto':'fachada, interiores, '+(state.caract.indexOf('Alberca')!==-1?'alberca, ':'')+'áreas comunes, calle/contexto')+'.\n\n';

  // 8. Terreno extra
  if(esTerreno){
    md+='## 8. Datos de terreno (para corrida financiera)\n';
    md+='- Servicios: '+(state.serv.length?state.serv.join(', '):'S/I')+'\n';
    md+='- Topografía: '+(state.topo||'S/I')+'\n';
    md+='- Frente: '+txt('f_frente')+' m · Fondo: '+txt('f_fondo')+' m\n';
    md+='- Uso de suelo: '+txt('f_uso')+'\n';
    md+='- Estatus legal: '+$('f_legal').value+'\n';
    md+='- Características: '+(state.caractTerr.length?state.caractTerr.join(', '):'S/I')+'\n';
    md+='- Modo de análisis: '+state.modo+'\n\n';
  }

  // 9. Unidades
  if(nU>1){
    md+='## 9. Unidades del conjunto\n';
    md+='| Unidad | Precio | m² | Nota |\n|---|---|---|---|\n';
    unidades.forEach(function(u){md+='| '+u.nombre+' | '+(u.precio||'(común)')+' | '+(u.m2||'(común)')+' | '+(u.nota||'')+' |\n';});
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
  md+='- Zona: '+zona+' · Estatus: '+estatus+' · Responsable: '+$('f_resp').value+'\n';
  md+='- Capturada: '+$('f_fecha').value+' · Fuente: '+fuente.nombre+'\n\n';

  // 14. Confirmación
  md+='## 14. Confirmación solicitada al agente\n';
  md+='Al terminar, confirma: 1) nombre de las páginas creadas/actualizadas; 2) si fue alta o actualización; 3) campos vacíos por S/I; 4) relaciones creadas (Zona, Contactos, Operaciones, Tareas); 5) si se agregó alguna opción nueva (fuente/zona); 6) datos pendientes para publicar.\n';

  mdActual=md;$('mdOut').textContent=md;

  var precioTxt=conVenta?(pv.val!=null?('$'+fmt(pv.val)+' '+moneda):'precio S/I'):'';
  var rentaTxt=conRenta?(pr.val!=null?('$'+fmt(pr.val)+'/mes'):'renta S/I'):'';
  $('exitoBox').innerHTML='<strong>✅ Markdown generado</strong>Cópialo y pégalo en el chat del agente de Notion, o usa 📤 Enviar. Quedó guardado en el Historial.';
  $('resumenBox').innerHTML='<strong>Resumen</strong>'+nombre+' · '+(state.tipo||'tipo S/I')+' · '+state.oper+
    (nU>1?(' · '+unidades.length+' unidades'):'')+(precioTxt?(' · '+precioTxt):'')+(rentaTxt?(' · '+rentaTxt):'')+
    ' · Zona: '+zona+'.<br>Incluye alta en Propiedades, '+people.length+' contacto(s) CRM, carpeta Drive y contenido de página.';
  if(falt.length){
    $('faltanteBox').style.display='';
    $('faltanteBox').innerHTML='<strong>⚠ Información faltante ('+falt.length+')</strong><ul>'+falt.map(function(f){return '<li>'+f+'</li>';}).join('')+'</ul>Ya quedó como pendiente en el markdown.';
  }else $('faltanteBox').style.display='none';
  $('outputArea').style.display='block';

  // guardar en historial
  lastCaptureId=saveCapture(md,estatus,falt);
  if($('outputArea').scrollIntoView)$('outputArea').scrollIntoView({behavior:'smooth'});
}

function propietarioNombre(){
  var prop=state.people.filter(function(p){return /Cliente B|Propietario/.test(p.rol);})[0];
  return prop&&prop.nombre?prop.nombre:'';
}
function propietarioNota(){
  var prop=state.people.filter(function(p){return /Cliente B|Propietario/.test(p.rol);})[0];
  if(prop&&prop.nombre)return 'relacionar contacto';
  if(state.ofrece==='Asesor / broker')return 'S/I — ofrecido por asesor, NO usar al asesor como propietario';
  return 'S/I';
}
function camposSI(){
  var f=[];
  [['f_m2t','m² terreno'],['f_m2c','m² construcción'],['f_rec','recámaras'],['f_ban','baños'],['f_est','estacionamientos'],['f_precio','precio venta'],['f_precio_renta','precio renta'],['f_frente','frente'],['f_fondo','fondo'],['f_uso','uso de suelo']].forEach(function(p){
    if($(p[0])&&siOn(p[0]))f.push(p[1]);
  });
  if(zonaVal()==='S/I')f.push('zona');
  return f;
}

/* ===================== HISTORIAL ===================== */
function getHist(){return load('hist',[]);}
function setHist(h){save('hist',h);updateBadge();}
function saveCapture(md,estatus,falt){
  var h=getHist();
  var id=state.editId&&false?null:'CAP-'+Date.now();
  var rec={
    id:id,fecha:new Date().toISOString(),resp:$('f_resp').value,
    nombre:nombreBase(),direccion:$('f_direccion').value.trim(),zona:zonaVal(),
    tipo:state.tipo,oper:state.oper,estatus:estatus,fuente:fuenteVal().nombre,
    people:state.people.map(function(p){return (p.nombre||'?')+' ('+p.rol+')';}),
    anuncio:state.anuncioUrl||'',maps:$('f_maps').value,drive:$('f_drive').value,
    md:md,estado:falt.length?'Con faltantes':'Markdown generado',
    faltantes:falt,copiado:false,enviado:false,edit:new Date().toISOString()
  };
  h.unshift(rec);setHist(h);
  zonaTouch(zonaVal());
  if(CFG.endpoint)syncOne(rec);
  return id;
}
function renderHist(){
  var h=getHist();var wrap=$('histList');
  // filtros
  var filt=$('histFilters');
  if(!filt.dataset.built){
    ['Todos','Pendientes','Enviados','Con faltantes'].forEach(function(f,i){
      var b=document.createElement('button');b.type='button';b.className='chip chip-sm'+(i===0?' sel':'');b.textContent=f;b.dataset.f=f;
      b.addEventListener('click',function(){filt.querySelectorAll('.chip').forEach(function(x){x.classList.remove('sel');});b.classList.add('sel');renderHist();});
      filt.appendChild(b);
    });
    filt.dataset.built='1';
  }
  var active=(filt.querySelector('.chip.sel')||{}).dataset?filt.querySelector('.chip.sel').dataset.f:'Todos';
  var list=h.filter(function(r){
    if(active==='Pendientes')return !r.enviado;
    if(active==='Enviados')return r.enviado;
    if(active==='Con faltantes')return r.faltantes&&r.faltantes.length;
    return true;
  });
  wrap.innerHTML='';
  if(!list.length){wrap.innerHTML='<div class="empty">Sin capturas todavía.</div>';return;}
  list.forEach(function(r){
    var stCls=r.enviado?'sent':(r.faltantes&&r.faltantes.length?'miss':'gen');
    var stTxt=r.enviado?'Enviada a Notion':(r.faltantes&&r.faltantes.length?'Con faltantes':'Generada');
    var item=document.createElement('div');item.className='hist-item';
    item.innerHTML='<div class="hi-top"><div><div class="hi-name">'+r.nombre+'</div>'+
      '<div class="hi-meta">'+(r.tipo||'?')+' · '+r.oper+' · '+r.zona+' · '+r.resp+'<br>'+new Date(r.fecha).toLocaleString('es-MX')+'</div></div>'+
      '<span class="hi-state '+stCls+'">'+stTxt+'</span></div>'+
      '<div class="hi-actions">'+
        '<button type="button" class="btn" data-copy="'+r.id+'">Copiar MD</button>'+
        '<button type="button" class="btn" data-view2="'+r.id+'">Ver MD</button>'+
        (r.maps?'<button type="button" class="btn" data-maps="'+r.id+'">Maps</button>':'')+
        (r.enviado?'<button type="button" class="btn" data-pend="'+r.id+'">Marcar pendiente</button>':'<button type="button" class="btn" data-sent="'+r.id+'">Marcar enviada</button>')+
        '<button type="button" class="btn btn-danger" data-del2="'+r.id+'">Borrar</button>'+
      '</div><pre style="display:none" id="md_'+r.id+'">'+esc(r.md)+'</pre>';
    wrap.appendChild(item);
  });
}
$('histList').addEventListener('click',function(e){
  var t=e.target;var h=getHist();
  function find(id){return h.filter(function(r){return r.id===id;})[0];}
  if(t.dataset.copy){var r=find(t.dataset.copy);copyText(r.md);r.copiado=true;setHist(h);t.textContent='Copiado ✓';}
  if(t.dataset.view2){var pre=$('md_'+t.dataset.view2);pre.style.display=pre.style.display==='none'?'block':'none';}
  if(t.dataset.maps){var r2=find(t.dataset.maps);if(r2.maps)window.open(r2.maps,'_blank');}
  if(t.dataset.sent){find(t.dataset.sent).enviado=true;setHist(h);renderHist();}
  if(t.dataset.pend){find(t.dataset.pend).enviado=false;setHist(h);renderHist();}
  if(t.dataset.del2){if(confirm('¿Borrar esta captura del historial?')){h=h.filter(function(r){return r.id!==t.dataset.del2;});setHist(h);renderHist();}}
});
function updateBadge(){
  var pend=getHist().filter(function(r){return !r.enviado;}).length;
  var b=$('navBadge');b.textContent=pend;b.style.display=pend?'block':'none';
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

/* ===================== GUARDAR sin generar ===================== */
$('btnSave').addEventListener('click',function(){
  var h=getHist();
  h.unshift({id:'CAP-'+Date.now(),fecha:new Date().toISOString(),resp:$('f_resp').value,
    nombre:nombreBase(),direccion:$('f_direccion').value.trim(),zona:zonaVal(),tipo:state.tipo,oper:state.oper,
    estatus:$('f_estatus').value,fuente:fuenteVal().nombre,people:[],anuncio:state.anuncioUrl||'',
    maps:$('f_maps').value,drive:$('f_drive').value,md:'(borrador sin markdown)',estado:'Borrador',
    faltantes:[],copiado:false,enviado:false,edit:new Date().toISOString()});
  setHist(h);
  this.textContent='Guardada ✓';var self=this;setTimeout(function(){self.textContent='💾 Guardar captura (sin generar)';},1800);
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

/* ===================== BACKEND (opcional) ===================== */
function api(action,payload){
  if(!CFG.endpoint)return Promise.reject(new Error('sin endpoint'));
  return fetch(CFG.endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({action:action,payload:payload})}).then(function(r){return r.json();});
}
function syncOne(rec){api('saveCapture',rec).catch(function(){});}
$('cfg_resp').addEventListener('change',function(){CFG.resp=this.value;save('cfg',CFG);$('f_resp').value=this.value;});
$('cfg_drive').addEventListener('input',function(){CFG.drive=this.value;save('cfg',CFG);refreshDrive();});
$('cfg_endpoint').addEventListener('input',function(){CFG.endpoint=this.value.trim();save('cfg',CFG);});
$('cfg_test').addEventListener('click',function(){
  if(!CFG.endpoint){$('cfgStatus').textContent='Pega primero el endpoint.';return;}
  $('cfgStatus').className='status';$('cfgStatus').textContent='Probando…';
  api('ping',{}).then(function(res){$('cfgStatus').className='status ok';$('cfgStatus').textContent='✓ Conectado: '+(res&&res.msg?res.msg:'ok');})
  .catch(function(){$('cfgStatus').className='status err';$('cfgStatus').textContent='No respondió. Revisa la URL y que esté publicado "cualquiera con el enlace".';});
});
$('cfg_sync').addEventListener('click',function(){
  if(!CFG.endpoint){$('cfgStatus').textContent='Configura primero el endpoint.';return;}
  var pend=getHist();$('cfgStatus').textContent='Sincronizando '+pend.length+' capturas…';
  api('bulkSync',{items:pend}).then(function(){$('cfgStatus').className='status ok';$('cfgStatus').textContent='✓ Historial sincronizado.';})
  .catch(function(){$('cfgStatus').className='status err';$('cfgStatus').textContent='No se pudo sincronizar.';});
});
$('cfg_export').addEventListener('click',function(){
  var blob=new Blob([JSON.stringify(getHist(),null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='historial_capturas.json';a.click();
});
$('cfg_clear').addEventListener('click',function(){
  if(confirm('¿Borrar TODO el historial local? No se puede deshacer.')){setHist([]);renderHist();renderCfgCount();}
});
function renderCfgCount(){$('cfgCount').textContent=getHist().length+' captura(s) guardada(s) en este dispositivo.';}

/* ===================== RESET ===================== */
$('btnReset').addEventListener('click',function(){
  if(!confirm('¿Limpiar todos los campos? (El historial NO se borra)'))return;
  document.querySelectorAll('#viewCapture input,#viewCapture textarea').forEach(function(i){if(i.type!=='date')i.value='';i.disabled=false;i.removeAttribute('data-manual');});
  document.querySelectorAll('.si-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('#viewCapture .chip').forEach(function(c){c.classList.remove('sel');});
  state={tipo:'',oper:'Venta',ofrece:'',crm:'No',topo:'',modo:'A · Reventa de lote',madre:'No, solo individuales',driveShare:'Sí, carpeta común',serv:[],caract:[],caractTerr:[],lat:null,lng:null,zonaNueva:false,people:[],editId:null};
  setChip('operChips','oper','Venta',onOper);setChip('modoChips','modo','A · Reventa de lote');
  setChip('madreChips','madre','No, solo individuales');setChip('driveShareChips','driveShare','Sí, carpeta común');
  setChip('crmChips','crm','No');
  buildCaract();renderCaractTerr();renderCRM();
  $('f_unidades').value=1;$('f_comision').value='4%';$('f_resp').value=CFG.resp;
  $('f_fecha').value=hoy;$('f_seguimiento').value=hoy;$('f_estatus').value='Captada';
  $('f_zona').value='';$('zonaHint').textContent='';$('f_fuente').value='Recorrido/Scouteo';$('boxFuenteOtra').style.display='none';
  ['unitsBox','terrenoExtra','dirSuggest','zonaSuggest'].forEach(function(id){$(id).style.display='none';});
  document.querySelectorAll('[data-construccion]').forEach(function(el){el.style.display='';});
  ['n_precio','n_precio_renta','n_m2t','n_m2c','geoStatus','anuncioStatus','aiStatus','driveStatus','estatusHint'].forEach(function(id){$(id).textContent='';});
  delete $('f_drive').dataset.manual;refreshDrive();
  $('outputArea').style.display='none';$('btnFotos').disabled=true;
  updateProgress();window.scrollTo({top:0,behavior:'smooth'});
});

/* ===================== SERVICE WORKER ===================== */
if('serviceWorker' in navigator){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){});});
}
})();
