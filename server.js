// iTV WEB - trang web khán giả riêng (relay). Chạy: node server.js   (đặt biến RELAY_KEY=mật_khẩu_bí_mật)
const http=require('http'),fs=require('fs'),path=require('path');
process.on('uncaughtException',e=>console.log('[lỗi]',e&&e.message));process.on('unhandledRejection',e=>console.log('[lỗi]',e&&e.message));
const PORT=+process.env.PORT||8080, KEY=String(process.env.RELAY_KEY||'').trim().replace(/^["']+|["']+$/g,'').trim();
const VOTE_CD=+process.env.VOTE_COOLDOWN||5000, ICON_CD=+process.env.ICON_COOLDOWN||8000, COMMENT_CD=+process.env.COMMENT_COOLDOWN||10000;
if(!KEY)console.log('!! Chưa đặt RELAY_KEY - máy chạy OBS sẽ không kết nối được. Ví dụ: RELAY_KEY=abc123 node server.js');
else console.log('RELAY_KEY đã đặt: '+KEY.length+' ký tự (relayKey ở máy OBS phải giống hệt, cùng số ký tự)');
const EPOCH=Date.now().toString(36);
let songs=[],now=null,comments=[],stickers=[];const stk=new Map();
const events=[];let eid=0;const enqueue=ev=>{ev.id=++eid;events.push(ev);if(events.length>1000)events.shift();
 const ss=events.filter(e=>e.type==='stickerSubmit'&&e.data);while(ss.length>20)delete ss.shift().data};
const clients=new Set();
const send=ev=>{const m=`data: ${JSON.stringify(ev)}\n\n`;for(const r of clients)r.write(m)};
const state=()=>({type:'state',songs,comments:comments.slice(-50),now,stickers});
let pend=false;const bcSongs=()=>{if(pend)return;pend=true;setTimeout(()=>{pend=false;send({type:'songs',songs})},300)};
setInterval(()=>{for(const r of clients)r.write(':hb\n\n')},25000);
let lastSync=0;
const last=new Map();
const limited=(k,ip,ms)=>{const key=k+ip,n=Date.now(),l=last.get(key)||0;if(n-l<ms)return Math.ceil((ms-(n-l))/1000);last.set(key,n);return 0};
setInterval(()=>{const n=Date.now();for(const[k,v]of last)if(n-v>60000)last.delete(k)},600000);
const json=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
const body=(req,max=20000)=>new Promise(r=>{let b='';req.on('data',c=>{b+=c;if(b.length>max)req.destroy()});req.on('end',()=>{try{r(JSON.parse(b||'{}'))}catch(e){r({})}});req.on('error',()=>r({}));req.on('close',()=>r({}))});
const MIMES={png:'image/png',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
function isImg(b,t){if(t==='png')return b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47;if(t==='jpeg')return b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF;if(t==='gif')return b.toString('latin1',0,4)==='GIF8';return b.toString('latin1',0,4)==='RIFF'&&b.toString('latin1',8,12)==='WEBP'}
const clean=(x,n)=>String(x||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,n);
const okKey=req=>KEY&&req.headers['x-key']===KEY;

const handler=async(req,res)=>{
 const u=new URL(req.url,'http://x'),url=u.pathname;
 const xf=String(req.headers['x-forwarded-for']||'').split(',').map(x=>x.trim()).filter(Boolean),ip=xf[xf.length-1]||req.socket.remoteAddress||'';
 if(req.method==='GET'&&(url==='/'||url==='/vote'))return fs.readFile(path.join(__dirname,'public','vote.html'),(e,d)=>{res.writeHead(e?404:200,{'Content-Type':'text/html; charset=utf-8'});res.end(d)});
 if(url==='/api/state')return json(res,200,state());
 if(url==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache',Connection:'keep-alive','X-Accel-Buffering':'no'});
  res.write(`data: ${JSON.stringify(state())}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return}
 if(url==='/sync/pull'){if(!okKey(req))return json(res,401,{error:'sai key'});lastSync=Date.now();
  const since=+u.searchParams.get('since')||0;return json(res,200,{epoch:EPOCH,last:eid,events:events.filter(e=>e.id>since)})}
 if(url.startsWith('/sticker/')){const id=url.slice(9),s=stickers.find(x=>x.id===id),f=stk.get(id);if(!s||!f){res.writeHead(404);return res.end()}
  res.writeHead(200,{'Content-Type':f.mime,'Cache-Control':'public, max-age=86400'});return res.end(f.buf)}
 if(url==='/health')return json(res,200,{ok:true,keySet:!!KEY,synced:Date.now()-lastSync<15000});
 if(req.method!=='POST')return json(res,404,{error:'not found'});
 const b=await body(req,url==='/sync/push'?300000:(url==='/sync/sticker'||url==='/api/sticker/submit')?400000:20000);
 if(url==='/sync/push'){if(!okKey(req))return json(res,401,{error:'sai key'});lastSync=Date.now();
  if(Array.isArray(b.songs))songs=b.songs.filter(s=>s&&typeof s==='object').slice(0,300).map(s=>({code:String(s.code),name:String(s.name),artist:String(s.artist||''),votes:+s.votes||0}));
  if(Array.isArray(b.comments))comments=b.comments.slice(-100);
  now=b.now||null;
  if(Array.isArray(b.stickers)){stickers=b.stickers.slice(0,150).map(s=>({id:String(s.id).replace(/[^a-z0-9]/gi,''),name:String(s.name||'').slice(0,20)}));const ids=new Set(stickers.map(s=>s.id));for(const k of [...stk.keys()])if(!ids.has(k))stk.delete(k)}
  send(state());return json(res,200,{ok:true,have:[...stk.keys()]})}
 if(url==='/sync/sticker'){if(!okKey(req))return json(res,401,{error:'sai key'});const id=String(b.id||'').replace(/[^a-z0-9]/gi,'');
  const mime=Object.values(MIMES).includes(b.mime)?b.mime:null,buf=Buffer.from(String(b.data||''),'base64');
  if(!id||!mime||!buf.length||buf.length>300000)return json(res,400,{error:'sticker không hợp lệ'});stk.set(id,{mime,buf});return json(res,200,{ok:true})}
 if(!lastSync||Date.now()-lastSync>60000){if(url.startsWith('/api/'))return json(res,503,{error:'Hệ thống đang offline, thử lại sau'})}
 if(url==='/api/vote'){
  const s=songs.find(x=>x.code===String(b.code||'').trim());if(!s)return json(res,404,{error:'Không có mã bài hát này'});
  const w=limited('v',ip,VOTE_CD);if(w)return json(res,429,{error:`Đợi ${w}s rồi bình chọn tiếp`});
  s.votes++;enqueue({type:'vote',code:s.code,name:clean(b.name,14)||'Khách'});bcSongs();return json(res,200,{ok:true,name:s.name});
 }
 if(url==='/api/sticker/submit'){
  const m=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+\/=]+)$/.exec(String(b.data||''));if(!m)return json(res,400,{error:'Ảnh không hợp lệ (png/jpg/webp/gif)'});
  const buf=Buffer.from(m[2],'base64');if(buf.length>250000||buf.length<30||!isImg(buf,m[1]))return json(res,400,{error:'Ảnh không hợp lệ hoặc quá lớn (tối đa 250KB)'});
  const w=limited('s',ip,30000);if(w)return json(res,429,{error:`Đợi ${w}s rồi gửi sticker tiếp`});
  enqueue({type:'stickerSubmit',name:clean(b.name,20)||'sticker',by:clean(b.by,14)||'Khách',data:b.data});return json(res,200,{ok:true})
 }
 if(url==='/api/icon'){
  const w=limited('i',ip,ICON_CD);if(w)return json(res,429,{error:`Đợi ${w}s rồi gửi icon tiếp`});
  if(b.kind==='sticker'&&stickers.some(x=>x.id===b.sticker)){enqueue({type:'icon',name:clean(b.name,14)||'Khách',kind:'sticker',sticker:b.sticker});return json(res,200,{ok:true})}
  const kind=['mouse','like','love','care','haha','wow','sad','angry'].includes(b.kind)?b.kind:'mouse';
  enqueue({type:'icon',name:clean(b.name,14)||'Khách',kind});return json(res,200,{ok:true});
 }
 if(url==='/api/comment'){
  const text=clean(b.text,120);if(!text)return json(res,400,{error:'Chưa nhập nội dung'});
  const w=limited('c',ip,COMMENT_CD);if(w)return json(res,429,{error:`Đợi ${w}s rồi bình luận tiếp`});
  const c={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:clean(b.name,14)||'Khách',text,t:Date.now()};
  comments.push(c);if(comments.length>100)comments.shift();enqueue({type:'comment',c});send({type:'comment',c});return json(res,200,{ok:true});
 }
 json(res,404,{error:'not found'});
};
http.createServer((req,res)=>{handler(req,res).catch(e=>{console.log('[lỗi]',e&&e.message);try{if(!res.headersSent)res.writeHead(500);res.end()}catch(x){}})}).on('error',e=>{console.log(e.code==='EADDRINUSE'?'LỖI: cổng '+PORT+' đang được chương trình khác dùng (có thể bạn đã mở server này rồi). Hãy đóng cửa sổ cũ rồi chạy lại.':'LỖI: '+e.message);process.exit(1)}).listen(PORT,'0.0.0.0',()=>console.log(`iTV WEB (trang khán giả) chạy cổng ${PORT}`));
