// Adaptador DOM de lectura para fixtures. No abre navegador ni tiene acceso a red.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const input=JSON.parse(readFileSync(0,'utf8'));
class Nodo{
  constructor(data,parent=null){this.tagName=data.tag.toUpperCase();this.attrs=data.attrs;this.parentElement=parent;this.nodes=data.nodes.map(n=>typeof n==='string'?n:new Nodo(n,this))}
  get children(){return this.nodes.filter(n=>typeof n!=='string')}
  get textContent(){return this.nodes.map(n=>typeof n==='string'?n:n.textContent).join('')}
  get id(){return this.attrs.id||''}get name(){return this.attrs.name||''}
  get value(){return this.tagName==='SELECT'?(this.options.find(o=>'selected'in o.attrs)||this.options[0])?.value||'':this.attrs.value||''}
  get options(){return this.querySelectorAll('option')}
  get rows(){return this.querySelectorAll('tr').filter(r=>r.closest('table')===(this.tagName==='TABLE'?this:this.closest('table')))}
  get cells(){return this.children.filter(n=>['TD','TH'].includes(n.tagName))}
  get caption(){return this.querySelector('caption')}
  get previousElementSibling(){const c=this.parentElement?.children||[];return c[c.indexOf(this)-1]||null}
  get body(){return this.querySelector('body')}
  get disabled(){return 'disabled'in this.attrs}
  matches(s){
    const tag=s.match(/^[\w-]+/)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;
    if(s.startsWith('#')&&this.id!==s.slice(1))return false;
    for(const m of s.matchAll(/\[([\w-]+)(?:(\$=|\*=|=)"([^"]*)")?\]/g)){
      const v=this.attrs[m[1]];if(v===undefined)return false;
      if(m[2]&&!(m[2]==='$='?v.endsWith(m[3]):m[2]==='*='?v.includes(m[3]):v===m[3]))return false;
    }
    if(s.includes(':checked')&&!('checked'in this.attrs||this.tagName==='OPTION'&&this.parentElement.value===this.value))return false;
    return true;
  }
  closest(s){for(let n=this;n;n=n.parentElement)if(n.matches(s))return n;return null}
  querySelectorAll(s){
    // Separar descendientes sin romper los espacios dentro de atributos entre comillas.
    const parts=s.split(',').map(x=>x.trim().match(/(?:\[[^\]]*\]|[^\s])+/g));
    const out=[];
    function visit(n){for(const c of n.children){if(parts.some(p=>{
      if(!c.matches(p.at(-1)))return false;let a=c.parentElement;
      for(let i=p.length-2;i>=0;i--){while(a&&!a.matches(p[i]))a=a.parentElement;if(!a)return false;a=a.parentElement}return true;
    }))out.push(c);visit(c)}}visit(this);return out;
  }
  querySelector(s){return this.querySelectorAll(s)[0]||null}
}
const docs=Object.fromEntries(Object.entries(input.documentos).map(([k,v])=>[k,new Nodo(v)]));
const common=readFileSync('tools/cupos_saes.js','utf8').split('/*__CUPOS_PANEL__*/')[0];
const ctx=vm.createContext({console,URL,URLSearchParams});vm.runInContext(common,ctx);
const paginas={};
for(const entry of input.indice){
  const d=docs[entry.archivo],p={};
  p.selectores=d.querySelectorAll('select').map(s=>({nombre:s.name,valor:s.value,opciones:s.options.map(o=>({valor:o.value,texto:o.textContent.trim()}))}));
  if(entry.archivo.startsWith('ocupabilidad'))try{p.ocupabilidad=ctx.IPNCupos.parsear(d)}catch(e){p.error=e.message}
  paginas[entry.archivo]=p;
}
// Misma negociación de postbacks que el marcador, con respuestas capturadas y sin red.
const consultas={};
for(const entry of input.indice.filter(e=>e.archivo.startsWith('ocupabilidad_carrera_'))){
  const carrera=entry.campos['ctl00$mainCopy$dpdcarrera'],plan=entry.campos['ctl00$mainCopy$dpdplan'];
  const pasos=[];
  try{
    consultas[carrera+'/'+plan]=await ctx.IPNCupos.consultar({url:'http://simulado.invalid/Academica/Ocupabilidad_grupos.aspx',carrera,plan,opciones(){},parser:n=>docs[n],
      fetch:async(url,op)=>{
        const b=new URLSearchParams(op.body),target=b.get('__EVENTTARGET');pasos.push(target||'GET');
        let nombre='ocupabilidad_get.html';
        if(target?.endsWith('rblEsquema$0'))nombre='ocupabilidad_periodo_actual.html';
        else if(target?.endsWith('dpdcarrera')){const c=b.get('ctl00$mainCopy$dpdcarrera');nombre=input.indice.find(e=>e.archivo.startsWith('ocupabilidad_carrera_'+c+'_'))?.archivo}
        else if(target?.endsWith('dpdplan'))nombre=entry.archivo;
        if(!docs[nombre])throw Error('Respuesta no capturada');return {ok:true,status:200,url,text:async()=>nombre};
      }});
  }catch(e){consultas[carrera+'/'+plan]={error:e.message}}
  consultas[carrera+'/'+plan].postbacks=pasos;
}
let alumno;
const lector=vm.createContext({console,location:{hostname:'saes.upiita.ipn.mx'},
  window:{IPNTSateResultado:d=>{if(d!==undefined)alumno=d}},
  fetch:async path=>{const nombre=input.rutas[path.toLowerCase()];if(!docs[nombre])throw Error('Fixture ausente: '+path);return {text:async()=>nombre}},
  DOMParser:class{parseFromString(nombre){return docs[nombre]}}});
await vm.runInContext(input.lector,lector);
if(!alumno)throw Error('El Lector no produjo un perfil');
delete alumno.leido;delete alumno.lector;
const captura=readFileSync('tools/captura_saes.js','utf8');
vm.runInContext(captura.slice(captura.indexOf('  var cellsOf'),captura.indexOf('  var now =')),ctx);
paginas['horarios_oferta.html'].oferta=ctx.parsearOferta(docs['horarios_oferta.html'],{carrera:'B',plan:'09',turno:'M',nivel:1});
paginas['mapa_curricular.html'].mapa=ctx.parsearMapa(docs['mapa_curricular.html'],'B','09','1');
// Las páginas sin parser de marcador conservan sus tablas de texto como estructura diagnóstica.
for(const [nombre,d] of Object.entries(docs))if(!nombre.startsWith('ocupabilidad'))paginas[nombre].tablas=d.querySelectorAll('table').map(t=>t.rows.map(r=>r.cells.map(c=>c.textContent.replace(/\s+/g,' ').trim())));
process.stdout.write(JSON.stringify({lector:alumno,paginas,consultas}));
