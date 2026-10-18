/* ---------- exportar horario: imagen PNG en alta resolución o PDF (pdf-lib, carga bajo demanda) ---------- */
const DL=window.claude?.use?window.claude.use('downloads'):Promise.resolve(null);
async function saveFile(name,blob){
  const dl=window.claude?.use?await DL:null;
  if(dl){try{await dl.save({filename:name,data:blob});return 'Listo: '+name}catch(e){return e?.code==='declined'?txH('descarga_cancelada'):txH('descarga_error')}}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return 'Listo: '+name;
}
function scheduleData(){
  const sel=selected(),own=ownVis();
  return {sel,own,cr:sel.reduce((s,c)=>s+c[7],0),hrs:sel.reduce((s,c)=>s+c[6].reduce((t,b)=>t+b[2]-b[1],0),0)/60};
}
// nombres del SAES (mayúsculas) en formato oración, conservando numerales romanos: "INGLES II" -> "Ingles II"

function wrapText(ctx,text,max){const w=String(text).split(/\s+/),out=[];let ln='';w.forEach(x=>{const t=ln?ln+' '+x:x;if(ctx.measureText(t).width>max&&ln){out.push(ln);ln=x}else ln=t});if(ln)out.push(ln);return out}
// a qué periodo corresponde el horario: con datos del SAES, el periodo y el número de periodo escolar
const perLabel=()=>{if(isPersonal()){const t=perMeta(),n=semNow(),out=[];if(t!=null)out.push('Periodo '+perName(t));if(n)out.push(n+'.º periodo escolar');if(out.length)return out.join(' · ')}
  return S.per==='proximo'?'Próximo periodo':'Periodo actual'};
/* dibuja en coordenadas lógicas (W ancho) y escala k; part: 'week' | 'list' | 'all' */
async function drawSchedule(part,k=3){
  await document.fonts?.ready;
  // paleta clara u oscura (opción «Tema de la imagen y el PDF»)
  const DK=EXP.dark, D=scheduleData(),W=1400,PAD=48,F='"Noto Sans",system-ui,sans-serif',ACC=SATE_CONFIG.unidades[UNIDAD]?.realce?.[DK?'oscuro':'claro']||getComputedStyle(document.documentElement).getPropertyValue('--sate-acento-base').trim(),INK=DK?'#ece6e9':'#231f20',MUT=DK?'#a9a0a5':'#5c575a',LINE=DK?'#3a3237':'#e3dade',
    BG=DK?'#17141a':'#ffffff', BAND=DK?'#211c22':'#f6f4f5', blkBg=h=>DK?`hsl(${h} 28% 24%)`:`hsl(${h} 45% 90%)`, blkBar=h=>DK?`hsl(${h} 55% 62%)`:`hsl(${h} 45% 38%)`;
  const ownFill=(x,y,w,h)=>{g.fillStyle=EXP.own;if(DK)g.globalAlpha=.32;g.fillRect(x,y,w,h);g.globalAlpha=1};
  const allSlots=[...D.sel.flatMap(c=>c[6]),...D.own.flatMap(o=>o.d.map(d=>[d,o.a,o.b]))];
  const days=Math.max(5,...allSlots.map(b=>b[0]+1));
  // solo de la primera clase a la última de la semana
  const lo=allSlots.length?Math.min(...allSlots.map(b=>b[1])):START, hi=allSlots.length?Math.max(...allSlots.map(b=>b[2])):START+BLOCK;
  const HEAD=110, gridTop=HEAD+44, LEFT=PAD+56, colW=(W-LEFT-PAD)/days;
  // Nada se corta: el alto de la hora y de cada renglón de la lista se mide con el texto completo.
  const mg=document.createElement('canvas').getContext('2d');
  const envolver=(fuente,t,w)=>{mg.font=`${fuente} ${F}`;return wrapText(mg,t,w)};
  const blocks=[...D.sel.flatMap(c=>c[6].map(([d,a,b],i)=>({c,d,a,b,r:(c[10]||[])[i]||''}))),...D.own.flatMap(o=>o.d.map(d=>({o,d,a:o.a,b:o.b})))];
  const textoBloque=B=>{const w=colW-6-16;
    const titulo=envolver('600 13px',B.c?pretty(name(B.c)):B.o.n,w);
    const extra=[[[B.c&&EXP.show.g?B.c[3]:'',`${hm(B.a)}–${hm(B.b)}`].filter(Boolean).join(' · ')],
      B.c&&EXP.show.p?envolver('400 12px',proper(profs(B.c)),w):[],
      B.r?envolver('400 12px',`${txH('salon')} ${shortRoom(B.r)}`,w):[]].flat();
    return {titulo,extra}};
  const altoBloque=B=>{const t=textoBloque(B);return 18+(t.titulo.length-1)*16+t.extra.length*15+6};
  const hourPx=Math.max(46,...blocks.map(B=>(altoBloque(B)+4)*60/(B.b-B.a))), gridH=(hi-lo)/60*hourPx;
  const rowsList=[...D.sel,...D.own.map(o=>({own:o}))];
  const columnasLista=c=>c.own?[[c.own.n],['Actividad extracurricular'],[`${c.own.d.map(d=>DAYS[d]).join(' ')} ${hm(c.own.a)}–${hm(c.own.b)}`]]:
    [envolver('400 14px',`${c[8]} ${pretty(name(c))}`,380),envolver('400 14px',profs(c),320),
     envolver('400 14px',pattern(c).join('; ')+((s=>s?` · ${txH('salon')} ${s}`:'')([...new Set((c[10]||[]).filter(Boolean).map(shortRoom))].join(', '))),400)];
  const ROWH=part==='week'?46:Math.max(46,...rowsList.map(c=>28+(Math.max(...columnasLista(c).map(x=>x.length))-1)*18+18)), listTop=part==='list'?HEAD:gridTop+gridH+48;
  const H=part==='week'?gridTop+gridH+70:listTop+40+rowsList.length*ROWH+70;
  const cv=document.createElement('canvas');cv.width=W*k;cv.height=H*k;const g=cv.getContext('2d');g.scale(k,k);
  g.fillStyle=BG;g.fillRect(0,0,W,H);
  g.fillStyle=ACC;g.fillRect(0,0,W,8);
  const carN=DATA.carreras[S.car]||'', perN=perLabel();
  g.fillStyle=INK;g.font=`700 30px ${F}`;g.fillText(`Horario ${ws().plan} · ${carN.charAt(0)+carN.slice(1).toLowerCase()}`,PAD,PAD+18);
  g.fillStyle=MUT;g.font=`400 16px ${F}`;
  g.fillText(`${perN} · ${fmtCr(D.cr)} créditos · ${D.sel.length} materias · ${D.hrs.toFixed(1)} h de clase a la semana`,PAD,PAD+48);
  if(part!=='list'){
    for(let d=0;d<days;d++){const x=LEFT+d*colW;g.fillStyle=BAND;g.fillRect(x,HEAD,colW,36);g.fillStyle=INK;g.font=`600 16px ${F}`;g.textAlign='center';g.fillText(DAYS[d],x+colW/2,HEAD+24);g.textAlign='left'}
    g.strokeStyle=LINE;g.lineWidth=1;
    for(let m=lo,i=0;m<hi;m+=BLOCK,i++){const y=gridTop+(m-lo)/60*hourPx;
      if(i%2){g.fillStyle=BAND;g.fillRect(LEFT,y,W-PAD-LEFT,Math.min(BLOCK,hi-m)/60*hourPx)}
      g.strokeStyle=LINE;g.beginPath();g.moveTo(LEFT,y);g.lineTo(W-PAD,y);g.stroke();
      g.fillStyle=MUT;g.font=`400 13px ${F}`;g.textAlign='right';g.fillText(hm(m),LEFT-10,y+15);g.textAlign='left'}
    g.beginPath();g.moveTo(LEFT,gridTop+gridH);g.lineTo(W-PAD,gridTop+gridH);g.stroke();
    for(let d=0;d<=days;d++){const x=LEFT+d*colW;g.beginPath();g.moveTo(x,gridTop);g.lineTo(x,gridTop+gridH);g.stroke()}
    blocks.forEach(B=>{
      const x=LEFT+B.d*colW+3,y=gridTop+(B.a-lo)/60*hourPx+2,w=colW-6,h=(B.b-B.a)/60*hourPx-4,hu=B.c?hue(B.c):0;
      g.save();g.beginPath();g.roundRect?g.roundRect(x,y,w,h,6):g.rect(x,y,w,h);g.clip();
      if(B.c){g.fillStyle=blkBg(hu);g.fillRect(x,y,w,h);g.fillStyle=blkBar(hu);g.fillRect(x,y,5,h)}
      else ownFill(x,y,w,h)
      const T=textoBloque(B);let ty=y+18;
      g.fillStyle=INK;g.font=`600 13px ${F}`;T.titulo.forEach(l=>{g.fillText(l,x+11,ty);ty+=16});
      g.fillStyle=MUT;g.font=`400 12px ${F}`;T.extra.forEach(l=>{g.fillText(l,x+11,ty);ty+=15});
      g.restore();
    });
  }
  if(part!=='week'){
    g.fillStyle=INK;g.font=`700 18px ${F}`;g.fillText('Materias',PAD,listTop+8);
    const cols=[[PAD,'Grupo'],[PAD+80,'Materia'],[PAD+470,'Profesor'],[PAD+800,'Horario'],[W-PAD-60,'Créditos']];
    g.font=`600 13px ${F}`;g.fillStyle=MUT;cols.forEach(([x,t])=>g.fillText(t,x,listTop+36));
    rowsList.forEach((c,i)=>{const y=listTop+40+i*ROWH;g.strokeStyle=LINE;g.beginPath();g.moveTo(PAD,y);g.lineTo(W-PAD,y);g.stroke();
      g.fillStyle=INK;g.font=`400 14px ${F}`;
      const [mat,prof,hor]=columnasLista(c),lineasEn=(ls,x0)=>ls.forEach((l,j)=>g.fillText(l,x0,y+28+j*18));
      if(c.own){g.fillText('—',PAD,y+28);lineasEn(mat,PAD+80);g.fillStyle=MUT;lineasEn(prof,PAD+470);lineasEn(hor,PAD+800);return}
      g.fillStyle=blkBar(hue(c));g.fillRect(PAD-12,y+12,5,22);g.fillStyle=INK;
      g.fillText(c[3],PAD,y+28);lineasEn(mat,PAD+80);
      g.fillStyle=MUT;lineasEn(prof,PAD+470);lineasEn(hor,PAD+800);
      g.fillStyle=INK;g.textAlign='right';g.fillText(fmtCr(c[7]),W-PAD,y+28);g.textAlign='left'});
  }
  const cap=new Date(DATA.capturado).toLocaleDateString('es-MX',{dateStyle:'long'});
  g.fillStyle=MUT;g.font=`400 12px ${F}`;g.fillText(`${txH('exportacion_pie',{unidad:DATA.siglas||UNIDAD.toUpperCase(),captura:cap})}`,PAD,H-24);
  return cv;
}

/* ---------- estilo minimalista: tabla con celdas unidas (huecos y clases contiguas por día) + lista de profesores ---------- */
// nombres propios del SAES (mayúsculas) a formato nombre: "CANUL GOMEZ GIMCIAN" -> "Canul Gomez Gimcian"
const proper=t=>String(t).toLowerCase().replace(/(^|[\s,/(-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
// texto de una clase en la exportación según las casillas "Incluir: grupo, profesor"
const classLabel=c=>[pretty(name(c)),EXP.show.g?c[3]:'',EXP.show.p?proper(profs(c)):''].filter(Boolean).join('\n');
function weekGrid(){
  const D=scheduleData();
  const items=[...D.sel.flatMap(c=>c[6].map(([d,a,b],i)=>{const r=(c[10]||[])[i];return {d,a,b,t:classLabel(c)+(r?'\n'+txH('salon')+' '+shortRoom(r):''),own:false}})),...D.own.flatMap(o=>o.d.map(d=>({d,a:o.a,b:o.b,t:o.n,own:true})))];
  const days=Math.max(5,...items.map(x=>x.d+1));
  const bounds=[...new Set(items.flatMap(x=>[x.a,x.b]))].sort((a,b)=>a-b);
  const rows=bounds.slice(0,-1).map((t,i)=>[t,bounds[i+1]]);
  const keyOfIt=it=>it?(it.own?'o:':'c:')+it.t+'|'+it.a+'|'+it.b:'';
  // celda (renglón, día): la actividad que la cubre
  const at=(r,d)=>items.find(x=>x.d===d&&x.a<=rows[r][0]&&x.b>=rows[r][1])||null;
  // segmentos verticales por día: la misma actividad (o el vacío) en renglones seguidos se une
  const segs=[];
  for(let d=0;d<days;d++){let r=0;while(r<rows.length){const it=at(r,d),key=keyOfIt(it);let e=r+1;
    while(e<rows.length&&keyOfIt(at(e,d))===key)e++;
    segs.push({d,r0:r,r1:e,it,span:1});r=e}}
  // unión horizontal solo para actividades propias iguales en días seguidos (p. ej. un idioma de lunes a viernes);
  // las materias se dejan una por día, como en el formato en tabla
  segs.sort((x,y)=>x.r0-y.r0||x.d-y.d);
  const out=[];
  segs.forEach(sg=>{const prev=out.filter(o=>o.r0===sg.r0&&o.r1===sg.r1&&o.d+o.span===sg.d).pop();
    if(prev&&sg.it?.own&&prev.it?.own&&prev.it.t===sg.it.t)prev.span++;else out.push(sg)});
  return {rows,days,cells:out,D};
}
async function drawTable(part,k=3){
  await document.fonts?.ready;
  // proporciones del formato en tabla: lienzo angosto (letra grande en carta), líneas delgadas dentro y gruesas en
  // el contorno, debajo del título, debajo de los días y a la derecha de la columna de horas
  const DK=EXP.dark, {rows,days,cells,D}=weekGrid(), W=1000, PAD=40, F='Arial,"Noto Sans",system-ui,sans-serif', INK=DK?'#efeaec':'#000', GRAY=DK?'#2b272b':'#e7e7e7', OWN=EXP.own,
    BG=DK?'#141214':'#fff', SUB=DK?'#cfc7cb':'#333', FOOT=DK?'#a59ca1':'#555';
  // HR: renglones de título y encabezado, delgados como en el formato del equipo
  const THIN=1.4, THICK=3.4, HOURW=118, colW=(W-2*PAD-HOURW)/days, HR=24, TOP=PAD+58, C=[['Grupo',70],['Materia',262],['Profesor',314],['Créd',58],['Salón',216]], LH=17;
  // Nada se corta: cada renglón mide lo que necesita su recuadro más largo (texto envuelto a su ancho real).
  const mg=document.createElement('canvas').getContext('2d');mg.font=`400 14px ${F}`;
  const lineas=(t,w)=>String(t).split('\n').reduce((n,seg)=>n+wrapText(mg,seg,w-10).length,0);
  const ROWH=Math.max(46,...cells.filter(c=>c.it).map(c=>Math.ceil((lineas(c.it.t,colW*c.span)*LH+12)/(c.r1-c.r0))));
  const filaLista=c=>[c[3],pretty(name(c)),proper(profs(c)),fmtCr(c[7]),c[10]?[...new Set(c[10].filter(Boolean).map(shortRoom))].join(', '):''];
  const LROW=Math.max(40,...D.sel.map(c=>Math.max(...filaLista(c).map((t,j)=>lineas(t,C[j][1])))*LH+12));
  const tableH=part==='list'?0:2*HR+rows.length*ROWH;
  const listTop=part==='list'?TOP:TOP+tableH+34;
  const H=part==='week'?TOP+tableH+46:listTop+2*HR+D.sel.length*LROW+70;
  const cv=document.createElement('canvas');cv.width=W*k;cv.height=H*k;const g=cv.getContext('2d');g.scale(k,k);
  g.fillStyle=BG;g.fillRect(0,0,W,H);
  const carN=DATA.carreras[S.car]||'';
  g.fillStyle=INK;g.font=`700 19px ${F}`;g.fillText(`Horario ${ws().plan} · ${pretty(carN)}`,PAD,PAD+8);
  g.font=`400 13px ${F}`;g.fillStyle=SUB;g.fillText(`${perLabel()} · ${fmtCr(D.cr)} créditos · ${D.sel.length} materias`,PAD,PAD+30);
  const cellText=(t,x,y,w,h,bold,italic)=>{g.fillStyle=INK;g.font=`${italic?'italic ':''}${bold?700:400} 14px ${F}`;g.textAlign='center';
    const ls=String(t).split('\n').flatMap(seg=>wrapText(g,seg,w-10));const y0=y+h/2-(ls.length-1)*8.5+5;ls.forEach((l,i)=>g.fillText(l,x+w/2,y0+i*17));g.textAlign='left'};
  const fill=(x,y,w,h,c)=>{g.fillStyle=c;if(DK&&c===OWN)g.globalAlpha=.32;g.fillRect(x,y,w,h);g.globalAlpha=1};
  const line=(x1,y1,x2,y2,lw)=>{g.strokeStyle=INK;g.lineWidth=lw;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()};
  const rect=(x,y,w,h,lw)=>{g.strokeStyle=INK;g.lineWidth=lw;g.strokeRect(x,y,w,h)};
  if(part!=='list'){
    const X0=PAD, Y0=TOP, TW=HOURW+colW*days, TH=2*HR+rows.length*ROWH, BY=Y0+2*HR;
    const NAMES=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    cellText('Horario',X0,Y0,TW,HR,true);
    cellText('Hora',X0,Y0+HR,HOURW,HR);
    for(let d=0;d<days;d++)cellText(NAMES[d],X0+HOURW+d*colW,Y0+HR,colW,HR);
    rows.forEach(([a,b],r)=>cellText(`${hm(a)}-${hm(b)}`,X0,BY+r*ROWH,HOURW,ROWH));
    // celdas (con su color) y líneas delgadas
    cells.forEach(c=>{const x=X0+HOURW+c.d*colW,y=BY+c.r0*ROWH,w=colW*c.span,h=(c.r1-c.r0)*ROWH;
      fill(x,y,w,h,c.it?(c.it.own?OWN:BG):GRAY);rect(x,y,w,h,THIN);if(c.it)cellText(c.it.t,x,y,w,h)});
    for(let d=1;d<days;d++)line(X0+HOURW+d*colW,Y0+HR,X0+HOURW+d*colW,BY,THIN);
    rows.forEach((_,r)=>line(X0,BY+(r+1)*ROWH,X0+HOURW,BY+(r+1)*ROWH,THIN));
    // líneas gruesas
    rect(X0,Y0,TW,TH,THICK);line(X0,Y0+HR,X0+TW,Y0+HR,THICK);line(X0,BY,X0+TW,BY,THICK);line(X0+HOURW,Y0+HR,X0+HOURW,Y0+TH,THICK);
  }
  if(part!=='week'){
    const X0=PAD, TW=C.reduce((t,c)=>t+c[1],0), TH=2*HR+D.sel.length*LROW;
    cellText('Lista de profesores por materia',X0,listTop,TW,HR,true);
    let x=X0;C.forEach(([t,w])=>{cellText(t,x,listTop+HR,w,HR,false,true);x+=w});
    D.sel.forEach((c,i)=>{x=X0;const y=listTop+2*HR+i*LROW;filaLista(c).forEach((t,j)=>{cellText(t,x,y,C[j][1],LROW);x+=C[j][1]});
      line(X0,y,X0+TW,y,THIN)});
    x=X0;C.slice(0,-1).forEach(([,w])=>{x+=w;line(x,listTop+HR,x,listTop+TH,THIN)});
    rect(X0,listTop,TW,TH,THICK);line(X0,listTop+HR,X0+TW,listTop+HR,THICK);line(X0,listTop+2*HR,X0+TW,listTop+2*HR,THICK);
    line(X0+C[0][1],listTop+HR,X0+C[0][1],listTop+TH,THICK);
    g.font=`400 14px ${F}`;g.fillStyle=INK;g.textAlign='center';g.fillText(fmtCr(D.cr),X0+C[0][1]+C[1][1]+C[2][1]+C[3][1]/2,listTop+TH+22);g.textAlign='left';
  }
  const cap=new Date(DATA.capturado).toLocaleDateString('es-MX',{dateStyle:'long'});
  g.fillStyle=FOOT;g.font=`400 10.5px ${F}`;g.fillText(`${txH('exportacion_pie',{unidad:DATA.siglas||UNIDAD.toUpperCase(),captura:cap})}`,PAD,H-16);
  return cv;
}
const EXP={get perPage(){return store.get('expPer',2)},get dark(){return store.get('expDark',false)},get style(){return store.get('expStyle','color')},get own(){return store.get('expOwn','#dbe7f5')},get show(){return Object.assign({g:false,p:false},store.get('expShow',{}))}};
const drawFor=(part,k)=>EXP.style==='min'?drawTable(part,k):drawSchedule(part,k);

/* ---------- Excel (.xlsx, también se abre en Google Sheets): mismo formato que la tabla minimalista ---------- */
async function loadExcelJS(){if(window.ExcelJS)return window.ExcelJS;await new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';s.integrity='sha512-dlPw+ytv/6JyepmelABrgeYgHI0O+frEwgfnPdXDTOIZz+eDgfW07QXG02/O8COfivBdGNINy+Vex+lYmJ5rxw==';s.crossOrigin='anonymous';s.onload=ok;s.onerror=()=>ko(new Error('No se pudo cargar el generador de Excel.'));document.head.appendChild(s)});return window.ExcelJS}
async function exportXlsx(){
  if(!selected().length&&!ownVis().length)return txH('exportacion_vacia');
  const ExcelJS=await loadExcelJS(), wb=new ExcelJS.Workbook(), {rows,days,cells,D}=weekGrid();
  wb.title=`Horario ${ws().plan} ${DATA.siglas||UNIDAD.toUpperCase()}`;
  const NAMES=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'], argb=h=>'FF'+String(h).replace('#','').toUpperCase();
  const FONT={name:'Arial',size:10}, CENTER={horizontal:'center',vertical:'middle',wrapText:true};
  const T='thin', K='medium';
  // aplica bordes: delgados en todo el rango y gruesos en los bordes indicados
  const frame=(sh,r1,c1,r2,c2)=>{for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const b={top:{style:r===r1?K:T},bottom:{style:r===r2?K:T},left:{style:c===c1?K:T},right:{style:c===c2?K:T}};sh.getCell(r,c).border=b}};
  // borde grueso en un lado; también en el lado opuesto de la celda vecina (Excel y Sheets muestran cualquiera de los dos)
  const OPP={bottom:['top',1,0],right:['left',0,1]};
  const thick=(sh,r1,c1,r2,c2,side)=>{for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const cell=sh.getCell(r,c);cell.border={...cell.border,[side]:{style:K}};
    const [o,dr,dc]=OPP[side],nb=sh.getCell(r+dr,c+dc);nb.border={...nb.border,[o]:{style:K}}}};
  const put=(sh,r,c,v,opt={})=>{const cell=sh.getCell(r,c);cell.value=v;cell.font={...FONT,...(opt.font||{})};cell.alignment=CENTER;if(opt.fill)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:argb(opt.fill)}};return cell};
  const nl=1+(EXP.show.g?1:0)+(EXP.show.p?1:0);
  // hoja 1: horario
  const sh=wb.addWorksheet('Horario',{pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  sh.columns=[{width:13},...Array.from({length:days},()=>({width:22}))];
  const last=1+days, R0=3, Rn=R0+rows.length-1;
  sh.mergeCells(1,1,1,last);put(sh,1,1,'Horario',{font:{bold:true}});
  put(sh,2,1,'Hora');for(let d=0;d<days;d++)put(sh,2,2+d,NAMES[d]);
  sh.getRow(1).height=15;sh.getRow(2).height=15;
  rows.forEach(([a,b],i)=>{put(sh,R0+i,1,`${hm(a)}-${hm(b)}`);sh.getRow(R0+i).height=16+13*nl});
  frame(sh,1,1,Rn,last);
  cells.forEach(c=>{const r1=R0+c.r0,r2=R0+c.r1-1,c1=2+c.d,c2=c1+c.span-1;
    if(r2>r1||c2>c1)sh.mergeCells(r1,c1,r2,c2);
    put(sh,r1,c1,c.it?c.it.t:'',{fill:c.it?(c.it.own?EXP.own:null):'#E7E7E7'});
    for(let r=r1;r<=r2;r++)for(let k=c1;k<=c2;k++)if(!c.it||c.it.own){const cell=sh.getCell(r,k);cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:argb(c.it?EXP.own:'#E7E7E7')}}}});
  frame(sh,1,1,Rn,last);   // los bordes se vuelven a aplicar sobre las celdas unidas
  thick(sh,1,1,1,last,'bottom');thick(sh,2,1,2,last,'bottom');thick(sh,2,1,Rn,1,'right');
  // hoja 2: profesores
  const sp=wb.addWorksheet('Profesores',{pageSetup:{orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  sp.columns=[{width:9},{width:38},{width:42},{width:8},{width:12}];
  sp.mergeCells(1,1,1,5);put(sp,1,1,'Lista de profesores por materia',{font:{bold:true}});
  ['Grupo','Materia','Profesor','Créd','Salón'].forEach((t,i)=>put(sp,2,1+i,t,{font:{italic:true}}));
  sp.getRow(1).height=15;sp.getRow(2).height=15;
  D.sel.forEach((c,i)=>{const r=3+i;[c[3],pretty(name(c)),proper(profs(c)),+c[7],''].forEach((v,j)=>put(sp,r,1+j,v));sp.getRow(r).height=24});
  const L=2+D.sel.length;frame(sp,1,1,L,5);thick(sp,1,1,1,5,'bottom');thick(sp,2,1,2,5,'bottom');thick(sp,2,1,L,1,'right');
  put(sp,L+1,4,{formula:`SUM(D3:D${L})`,result:D.cr});
  put(sp,L+3,1,`Horario ${ws().plan} · ${pretty(DATA.carreras[S.car]||'')} · ${perLabel()}`,{}).alignment={horizontal:'left'};sp.mergeCells(L+3,1,L+3,5);
  const buf=await wb.xlsx.writeBuffer();
  return saveFile(`horario-${ws().plan}-${UNIDAD}.xlsx`,new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
}
const toBlob=cv=>new Promise(r=>cv.toBlob(r,'image/png'));
async function exportPng(){
  if(!selected().length&&!ownVis().length)return txH('exportacion_vacia');
  const cv=await drawFor('all',3);return saveFile(`horario-${ws().plan}-${UNIDAD}.png`,await toBlob(cv));
}
async function loadPdfLib(){if(window.PDFLib)return window.PDFLib;await new Promise((ok,ko)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';s.integrity='sha512-z8IYLHO8bTgFqj+yrPyIJnzBDf7DDhWwiEsk4sY+Oe6J2M+WQequeGS7qioI5vT6rXgVRb4K1UVQC5ER7MKzKQ==';s.crossOrigin='anonymous';s.onload=ok;s.onerror=()=>ko(new Error('No se pudo cargar el generador de PDF.'));document.head.appendChild(s)});return window.PDFLib}
// agrega una hoja carta al PDF con el horario dibujado (horizontal en colorido, vertical en minimalista)
async function pdfPage(doc,rgb){
  const cv=await drawFor('all',3), png=await doc.embedPng(new Uint8Array(await (await toBlob(cv)).arrayBuffer()));
  const [PW,PH]=EXP.style==='min'?[612,792]:[792,612];
  const pg=doc.addPage([PW,PH]), m=24, sc=Math.min((PW-2*m)/png.width,(PH-2*m)/png.height);
  if(EXP.dark)pg.drawRectangle({x:0,y:0,width:PW,height:PH,color:EXP.style==='min'?rgb(.078,.071,.078):rgb(.09,.078,.102)});   // hoja oscura completa
  pg.drawImage(png,{x:(PW-png.width*sc)/2,y:PH-m-png.height*sc,width:png.width*sc,height:png.height*sc});
}
async function exportPdf(){
  if(!selected().length&&!ownVis().length)return txH('exportacion_vacia');
  const {PDFDocument,rgb}=await loadPdfLib(), doc=await PDFDocument.create();
  await pdfPage(doc,rgb);   // una sola hoja con el horario y la lista
  doc.setTitle(`Horario ${ws().plan} ${DATA.siglas||UNIDAD.toUpperCase()}`);
  return saveFile(`horario-${ws().plan}-${UNIDAD}.pdf`,new Blob([await doc.save()],{type:'application/pdf'}));
}
// todos los horarios con contenido en un solo PDF (una hoja por horario, en orden A, B, C…)
const plansConContenido=()=>planIds().filter(id=>{const p=ws().plans[id];return p.sel.length||(p.own||[]).filter(o=>!o.oculto).length});
async function exportPdfAll(){
  const ids=plansConContenido();
  if(!ids.length)return txH('exportacion_todos_vacia');
  const {PDFDocument,rgb}=await loadPdfLib(), doc=await PDFDocument.create(), prev=ws().plan;
  // dos por hoja: carta horizontal con dos columnas (como «2 páginas por hoja» al imprimir); uno por hoja: tamaño completo
  const two=EXP.perPage===2, [PW,PH]=two||EXP.style!=='min'?[792,612]:[612,792], m=24, GAP=20, colW=two?(PW-2*m-GAP)/2:PW-2*m;
  let pg=null, col=0;
  const nueva=()=>{pg=doc.addPage([PW,PH]);if(EXP.dark)pg.drawRectangle({x:0,y:0,width:PW,height:PH,color:EXP.style==='min'?rgb(.078,.071,.078):rgb(.09,.078,.102)});col=0};
  try{for(const id of ids){ws().plan=id;
    const cv=await drawFor('all',3), png=await doc.embedPng(new Uint8Array(await (await toBlob(cv)).arrayBuffer()));
    const sc=Math.min(colW/png.width,(PH-2*m)/png.height), w=png.width*sc, h=png.height*sc;
    if(!pg||col>=(two?2:1))nueva();
    const x0=m+col*(colW+GAP);
    pg.drawImage(png,{x:x0+(colW-w)/2,y:PH-m-h,width:w,height:h});col++}}finally{ws().plan=prev}
  doc.setTitle(txH('exportacion_titulo',{unidad:DATA.siglas||UNIDAD.toUpperCase()}));
  const r=await saveFile(`horarios-${UNIDAD}.pdf`,new Blob([await doc.save()],{type:'application/pdf'}));
  const n=doc.getPageCount();
  return r.startsWith('Listo')?`${r} (${ids.length} ${ids.length>1?'horarios':'horario'} en ${n} ${n>1?'hojas':'hoja'})`:r;
}
// módulo de exportación (ventana)
function abrirExportacion(){const dl=$('#exp-dlg'),n=plansConContenido().length;$('#b-pdfall').hidden=n<2;$('#b-pdfall').textContent=`PDF con todos los horarios (${n})`;$('#exp-dmsg').textContent=selected().length||ownVis().length?'':txH('exportacion_vacia');dl.showModal?dl.showModal():dl.setAttribute('open','')}
$('#exp-x').addEventListener('click',()=>$('#exp-dlg').close());
$('#exp-dlg').addEventListener('click',e=>{if(e.target.id==='exp-dlg')e.target.close()});
const renderExpStyle=()=>{document.querySelectorAll('[data-exps]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.exps===EXP.style)));
  document.querySelectorAll('[data-ext]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.ext==='dark')===EXP.dark)));
  document.querySelectorAll('[data-exper]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.exper===EXP.perPage)))};
$('#exp-per').addEventListener('click',e=>{const b=e.target.closest('[data-exper]');if(!b)return;store.set('expPer',+b.dataset.exper);renderExpStyle()});
$('#exp-theme').addEventListener('click',e=>{const b=e.target.closest('[data-ext]');if(!b)return;store.set('expDark',b.dataset.ext==='dark');renderExpStyle()});
$('#exp-style').addEventListener('click',e=>{const b=e.target.closest('[data-exps]');if(!b)return;store.set('expStyle',b.dataset.exps);renderExpStyle()});
renderExpStyle();
$('#exp-own').value=EXP.own;
document.querySelectorAll('[data-exshow]').forEach(i=>{i.checked=!!EXP.show[i.dataset.exshow];i.addEventListener('change',()=>{const v=EXP.show;v[i.dataset.exshow]=i.checked;store.set('expShow',v)})});
$('#exp-own').addEventListener('input',e=>store.set('expOwn',e.target.value));
for(const [id,fn] of [['#b-png',exportPng],['#b-pdf',exportPdf],['#b-pdfall',exportPdfAll],['#b-xlsx',exportXlsx]]){
  $(id).addEventListener('click',async e=>{const b=e.currentTarget,t=b.textContent;b.disabled=true;b.textContent=txH('exportacion_generando');
    let m,ok=false;try{m=await fn();ok=true}catch(err){m='No se pudo exportar: '+err.message}$('#exp-msg').textContent=m;$('#exp-dmsg').textContent=m;if(ok)window.ENCUESTA?.marcar('exp');
    b.disabled=false;b.textContent=t});
}

$('#b-copy').addEventListener('click',async()=>{
  const sel=selected();if(!sel.length&&!ownVis().length)return;
  const cr=sel.reduce((s,c)=>s+c[7],0);
  const txt=`Horario ${ws().plan} ${DATA.siglas||UNIDAD.toUpperCase()} (${S.per==='proximo'?'próximo periodo':'periodo actual'}) · ${fmtCr(cr)} créditos\n`+
    sel.map(c=>`${c[3]}  ${c[8]} ${name(c)} (${fmtCr(c[7])} cr)\n   ${profs(c)}\n   ${pattern(c).join('; ')}`).join('\n')+
    ownVis().map(o=>`\n—  ${o.n}\n   ${o.d.map(d=>DAYS[d]).join(' ')}  ${hm(o.a)}–${hm(o.b)}`).join('');
  const box=$('#copybox');box.value=txt;
  try{await navigator.clipboard.writeText(txt);$('#b-copy').textContent=txH('copiado');setTimeout(()=>$('#b-copy').textContent=txH('copiar'),1500)}
  catch(err){box.hidden=false;box.select()}
});
