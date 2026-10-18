/* V3 Wikimedia Commons automatic photo search. No API key, no bulk scraping. */
(()=>{'use strict';
const B=()=>window.atlasPhotoBridge;
const $=id=>document.getElementById(id);
const AUTO_CACHE_KEY='shanghai-atlas-v3-auto-cache';
const TTL=14*86400000;
let cache={};try{cache=JSON.parse(localStorage.getItem(AUTO_CACHE_KEY)||'{}')}catch{}
const inFlight=new Map();
const htmlEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cleanText(v){const e=document.createElement('div');e.innerHTML=String(v||'');return(e.textContent||'').trim().slice(0,180)}
function safeURL(s){try{const u=new URL(s);return u.protocol==='https:'&&(/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/i).test(u.hostname)?u.href:null}catch{return null}}
function status(s){$('autoPhotoStatus').textContent=s}
function setBusy(b){$('autoPhotoButton').disabled=b}
function searchTerm(p){let name=p.name.replace(/[’']/g,"'").replace(/\s*\([^)]*\)/g,'').trim();return name+' Shanghai'}
async function queryCommons(p){const url=new URL('https://commons.wikimedia.org/w/api.php');url.search=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:'filetype:bitmap '+searchTerm(p),gsrnamespace:'6',gsrlimit:'18',prop:'imageinfo',iiprop:'url|extmetadata|size',iiurlwidth:'900'}).toString();
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),13000);
 try{const response=await fetch(url,{signal:ctrl.signal});if(!response.ok)throw Error('Wikimedia ตอบกลับ '+response.status);const data=await response.json();const pages=Object.values(data.query?.pages||{});
 const out=[];for(const page of pages){const i=page.imageinfo?.[0];if(!i||i.width<450||i.height<300)continue;const thumb=safeURL(i.thumburl||i.url),pageUrl=safeURL(i.descriptionurl);if(!thumb||!pageUrl)continue;
 const ex=i.extmetadata||{};const license=cleanText(ex.LicenseShortName?.value||'ไม่ระบุ');const artist=cleanText(ex.Artist?.value||'ไม่ระบุ');const title=String(page.title||'').replace(/^File:/,'');
 if(/\.(svg|pdf|tif|tiff|gif)$/i.test(title))continue;
 const titleText=title.toLowerCase();const terms=[p.name,p.cn].filter(Boolean).map(x=>x.toLowerCase());const relevant=terms.some(term=>term.length>2&&titleText.includes(term))||titleText.includes('shanghai');
 if(!relevant)continue;
 out.push({type:'url',url:thumb,source:'wikimedia',sourcePage:pageUrl,artist,license,title});}
 return out.slice(0,5);
 }finally{clearTimeout(timer)}
}
async function fetchFor(id,force=false){const b=B(),p=b.findPlace(id);if(!p)return;if(inFlight.has(id))return inFlight.get(id);
 const task=(async()=>{setBusy(true);status('กำลังค้นหารูป '+p.name+' ...');try{
 const cached=cache[id];let found;if(!force&&cached&&Date.now()-cached.time<TTL){found=cached.photos}else{found=await queryCommons(p);cache[id]={time:Date.now(),photos:found};try{localStorage.setItem(AUTO_CACHE_KEY,JSON.stringify(cache))}catch{}}
 const arr=b.photos(id);const existing=new Set(arr.map(x=>x.url));let n=0;for(const item of found){if(arr.length>=5)break;if(!existing.has(item.url)){arr.push(item);existing.add(item.url);n++}}
 if(n)b.persist();await b.renderCovers();if(b.getPlaceId()===id)await b.renderGallery();status(found.length?`พบ ${found.length} รูป · เพิ่ม ${n} รูป (ตรวจสอบความตรงก่อนใช้)`:'ไม่พบภาพที่เหมาะสม ลองเพิ่ม URL หรืออัปโหลดเอง');
 }catch(err){status('ค้นหารูปไม่สำเร็จ: '+(err.name==='AbortError'?'หมดเวลารอ':err.message)+' · ลองใหม่ได้')}finally{setBusy(false);inFlight.delete(id)}})();inFlight.set(id,task);return task}
window.fetchPlacePhotos=(force=false)=>{const id=B().getPlaceId();if(id!==null)return fetchFor(id,force)};
window.clearAutoPhotos=async()=>{const b=B(),id=b.getPlaceId();if(id===null)return;const arr=b.photos(id),n=arr.length;const remaining=arr.filter(x=>x.source!=='wikimedia');if(n===remaining.length)return status('ไม่มีรูปอัตโนมัติให้ลบ');arr.splice(0,arr.length,...remaining);b.persist();await b.renderGallery();await b.renderCovers();status('ลบรูปอัตโนมัติ '+(n-remaining.length)+' รูปแล้ว')};
window.renderPhotoCredits=(x)=>{const el=$('photoCredits');if(!el)return;if(!x||x.source!=='wikimedia'){el.textContent=x?.type==='local'?'ภาพที่อัปโหลดจากเครื่อง':x?.type==='url'?'รูปจากลิงก์ที่เพิ่มเอง':'';return}const link=safeURL(x.sourcePage);el.innerHTML=`ภาพจาก Wikimedia Commons · ${htmlEscape(x.license)} · ผู้สร้าง: ${htmlEscape(x.artist)} ${link?`· <a href="${htmlEscape(link)}" target="_blank" rel="noopener noreferrer">ดูต้นฉบับ / เงื่อนไขการใช้</a>`:''}`};
const oldOpen=window.openGallery;
window.openGallery=async id=>{await oldOpen(id);const arr=B().photos(id);if(arr.length<2)fetchFor(Number(id),false)};
})();
