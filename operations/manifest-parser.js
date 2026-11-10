(function(root){
function parseManifestPages(pages){
 const rows=[],warnings=[];let bl='',consignee='',active=null,block=[],voyage='',incomplete=false;
 const flush=()=>{for(const r of block)if(!r.name)r.name=consignee;block=[];};
 pages.forEach((items,pageIndex)=>{
 const content=items.filter(i=>i.str&&i.str.trim());
 const rotated=content.filter(i=>Math.abs(i.transform[1])>Math.abs(i.transform[0])).length>content.length/2;
 const a=content.map(i=>({s:i.str.trim(),x:rotated?i.transform[5]:i.transform[4],y:rotated?i.transform[4]:-i.transform[5]}));
 const header=a.find(i=>i.s.includes('Number and Kind of Packages'));
 const blhead=a.find(i=>i.s==='B/L Nr.');
 if(!header||!blhead)throw Error('Unsupported manifest layout on page '+(pageIndex+1)+'. Use a Tropical Shipping cargo declaration PDF with selectable text.');
 incomplete ||=a.some(i=>i.s==='INCOMPLETE');voyage ||=a.find(i=>/^TE\d+$/.test(i.s))?.s||'';
 const top=Math.max(header.y,blhead.y)+5;
 let lines=[];for(const i of a.filter(i=>i.y>top).sort((p,q)=>p.y-q.y||p.x-q.x)){let l=lines.at(-1);if(!l||Math.abs(l.y-i.y)>2){l={y:i.y,items:[]};lines.push(l)}l.items.push(i)}
 for(const l of lines){const t=l.items;
  if(t.some(i=>i.s.startsWith('(SH)'))){flush();active=null;consignee='';bl='';}
  const bn=t.find(i=>/^\d{7,12}$/.test(i.s)&&i.x>blhead.x-10&&i.x<blhead.x+35);
  if(bn){bl=(t.find(i=>/^[A-Z]{4}$/.test(i.s)&&i.x>blhead.x-30&&i.x<bn.x)?.s||'')+' '+bn.s;if(!/^[A-Z]{4} /.test(bl))bl='';}
  const co=t.find(i=>i.s.startsWith('(CO)'));if(co){consignee=co.s.replace(/^\(CO\)/,'').trim();for(const r of block)r.name=consignee;}
  const sn=t.find(i=>/SHIPMENT\s+NO\s*\d+/i.test(i.s));
  if(sn){const id=sn.s.match(/SHIPMENT\s+NO\s*(\d+)/i)[1];active={bl,id,name:consignee,container:'',expected:0,received:0,page:pageIndex+1};rows.push(active);block.push(active);}
  const cn=t.find(i=>/\(CN\)\s*[A-Z]{4}\d{7}/.test(i.s));if(cn&&active)active.container=cn.s.match(/[A-Z]{4}\d{7}/)[0];
  const qty=t.find(i=>/^\d+$/.test(i.s)&&i.x>=header.x-12&&i.x<=header.x+2);
  if(qty&&active)active.expected+=Number(qty.s);
 }
 });flush();
 if(!rows.length)throw Error('No shipments found. Scanned/image-only PDFs require OCR and are not supported in this draft.');
 const seen=new Set();for(const r of rows){if(!r.bl||!r.name||!r.container||!r.expected)warnings.push('Verify shipment '+r.id+': missing B/L, consignee, container, or piece count.');if(seen.has(r.id))warnings.push('Duplicate shipment '+r.id+' — review before importing.');seen.add(r.id)}
 return {rows,warnings,voyage,incomplete};
}
root.parseManifestPages=parseManifestPages;
})(typeof module==='object'?module.exports:globalThis);
