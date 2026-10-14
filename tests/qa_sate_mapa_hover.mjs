// Resaltado del mapa al pasar el cursor: alterna clases sobre lo ya dibujado y no llama a renderMap.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=f=>readFileSync(f,'utf8');
const mapa=leer('web/sate/mapa.js'), nucleo=leer('web/sate/nucleo.js'), componentes=leer('web/sate/componentes.js');

// --- DOM mínimo con classList y atributos ---
const nodo=(clase,data={},attrs={})=>{
  const n={dataset:data,attrs:{...attrs},cls:new Set(clase.split(' ').filter(Boolean)),
    classList:{remove:(...x)=>x.forEach(y=>n.cls.delete(y)),add:(...x)=>x.forEach(y=>n.cls.add(y)),contains:x=>n.cls.has(x)},
    setAttribute(k,v){n.attrs[k]=v}};
  return n;
};
const cajas=[nodo('box pend',{box:'A'}),nodo('box pend',{box:'B'}),nodo('box pend',{box:'C'}),nodo('box pend',{box:'D'}),nodo('box slot')];
const aristas=[nodo('edge',{a:'A',b:'B'},{'marker-end':'url(#ah)'}),nodo('edge',{a:'B',b:'C'},{'marker-end':'url(#ah)'}),
  nodo('edge',{a:'A',b:'D'},{'marker-end':'url(#ah)'}),nodo('edge lejana',{a:'A',b:'C'},{'marker-end':'url(#ah)'}),nodo('edge past',{a:'D',b:'D'},{'marker-end':'url(#ah)'})];
aristas[4].dataset.past='1';
const mapEl={childElementCount:5,querySelectorAll:s=>s==='.box'?cajas:s==='.edge'?aristas:[]};
let llamadas={renderMap:0,renderInsp:0,renderList:0},rafs=[];
const S={mapHover:null,reqHover:null};
const c=vm.createContext({S,SATE:{pestana(){}},document:{addEventListener(){}},addEventListener(){},$:()=>mapEl,requestAnimationFrame:f=>{rafs.push(f);return rafs.length},
  prereqs:()=>({B:['A'],C:['B'],D:['A']}),conSim:(on,f)=>f(),conPlan:f=>f(),usaSim:()=>false,mview:()=>'mapa',
  renderMap:()=>{llamadas.renderMap++},renderInsp:()=>{llamadas.renderInsp++},renderList:()=>{llamadas.renderList++},console});
vm.createContext(c);
vm.runInContext('window=globalThis',c);
vm.runInContext(componentes,c);
vm.runInContext(mapa,c);c.renderMap=()=>{llamadas.renderMap++};c.renderInsp=()=>{llamadas.renderInsp++};c.renderList=()=>{llamadas.renderList++};

// 1. Cálculo del resaltado
const hot=vm.runInContext("calcHot('B',null,prereqs())",c);
assert.deepEqual([...hot].sort(),['A','B','C']);
assert.deepEqual([...hot.pre],['A']);assert.deepEqual([...hot.post],['C']);
assert.equal(vm.runInContext("calcHot(null,null,prereqs())",c),null);
const hr=vm.runInContext("calcHot('B',['C','D'],prereqs())",c);
assert.deepEqual([...hr].sort(),['B','C','D']);

// 2. Pasar el cursor: clases aplicadas y retiradas, sin renderMap
c.S.mapHover='B';
vm.runInContext('pedirResalte();pedirResalte()',c);
assert.equal(rafs.length,1,'los eventos se agrupan en un solo cuadro');
rafs.shift()();
assert.equal(llamadas.renderMap,0,'pasar el cursor no redibuja el mapa');
assert.equal(llamadas.renderInsp,1);
const cl=n=>[...n.cls].sort().join(' ');
assert.equal(cl(cajas[0]),'box hpre pend'.split(' ').sort().join(' '));
assert.equal(cl(cajas[1]),'box hot pend'.split(' ').sort().join(' '));
assert.equal(cl(cajas[2]),'box hpost pend'.split(' ').sort().join(' '));
assert.equal(cl(cajas[3]),'box dim pend'.split(' ').sort().join(' '));
assert.ok(cajas[4].cls.has('dim'),'las casillas de optativa también se atenúan');
assert.equal(cl(aristas[0]),'edge hot pre');assert.equal(aristas[0].attrs['marker-end'],'url(#ahpre)');
assert.equal(cl(aristas[1]),'edge hot post');assert.equal(aristas[1].attrs['marker-end'],'url(#ahpost)');
assert.equal(cl(aristas[2]),'dim edge'.split(' ').sort().join(' '));assert.equal(aristas[2].attrs['marker-end'],'url(#ah)');
assert.ok(!aristas[4].cls.has('past'),'«past» solo cuando no hay resaltado');

// 3. Idéntico al dibujo: las clases de cajas y flechas salen de las mismas funciones que usa el dibujo
const UI=c.SateUI;
for(const k of ['A','B','C','D'])assert.equal(UI.resalteCaja(hot,k,'B',null).trim().split(' ').filter(Boolean).every(x=>cajas[['A','B','C','D'].indexOf(k)].cls.has(x)),true);
assert.equal(UI.resalteCaja(null,'A',null,null),'');
assert.equal(UI.resalteCaja(hr,'B','B',['C','D']),' hpre');
assert.equal(vm.runInContext("resalteArista(null,'A','B',null).cls",c),'');

// 4. Retirar el cursor: vuelve al estado base (con «past» restituida)
c.S.mapHover=null;vm.runInContext('pedirResalte()',c);rafs.shift()();
assert.equal(llamadas.renderMap,0);
for(const n of cajas)assert.ok(![...n.cls].some(x=>['hot','hpre','hpost','dim'].includes(x)),'caja limpia');
for(const n of aristas)assert.ok(![...n.cls].some(x=>['hot','pre','post','dim'].includes(x)),'flecha limpia');
assert.ok(aristas[4].cls.has('past'));
assert.ok(aristas.every(n=>n.attrs['marker-end']==='url(#ah)'));
assert.ok(aristas[3].cls.has('lejana'),'la flecha lejana conserva su clase (CSS la oculta sin resaltado)');

// 5. Resaltado desde la lista de requisitos (reqHover)
c.S.mapHover='B';c.S.reqHover=['C','D'];vm.runInContext('resaltarMapa()',c);
assert.ok(cajas[1].cls.has('hpre')&&cajas[2].cls.has('hpost')&&cajas[3].cls.has('hpost')&&cajas[0].cls.has('dim'));
assert.equal(llamadas.renderMap,0);

// 6. Mapa sin dibujar: dibujo completo
mapEl.childElementCount=0;vm.runInContext('resaltarMapa()',c);
assert.equal(llamadas.renderMap,1);

// 7. Los manejadores de cursor y teclado ya no llaman a renderMap
const manejadores=nucleo.split('\n').filter(l=>/pointerover|pointerleave|focusin|focusout|salirRequisitos/.test(l)&&/mapHover|reqHover/.test(l));
assert.ok(manejadores.length>=6,'manejadores encontrados');
for(const l of manejadores)assert.ok(!/renderMap\(\)/.test(l),'sin renderMap: '+l.slice(0,90));
assert.ok(mapa.includes('.edge.lejana')||leer('web/horarios.template.html').includes('.edge.lejana{display:none}'));
console.log('qa_sate_mapa_hover: ok');
