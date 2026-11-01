// Stick Studio + ElevenLabs voice. No dependencies, Node 18+.
// Run: node server.js   then open http://localhost:3000
const http=require("http"),fs=require("fs"),path=require("path");
function loadEnv(){try{fs.readFileSync(path.join(__dirname,".env"),"utf8").split(/\r?\n/).forEach(l=>{const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^["']|["']$/g,"")})}catch(e){}}
loadEnv();
const KEY=process.env.ELEVENLABS_API_KEY,PORT=process.env.PORT||3000,MOCK=process.env.MOCK==="1";
const MODEL=process.env.ELEVENLABS_MODEL||"eleven_multilingual_v2";
const send=(res,code,type,body)=>{res.writeHead(code,{"content-type":type,"cache-control":"no-store"});res.end(body)};
const json=(res,code,o)=>send(res,code,"application/json",JSON.stringify(o));
function wav(seconds){const sr=22050,n=Math.floor(seconds*sr),b=Buffer.alloc(44+n*2);b.write("RIFF",0);b.writeUInt32LE(36+n*2,4);b.write("WAVEfmt ",8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write("data",36);b.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++){const env=Math.abs(Math.sin(i/sr*Math.PI*5));b.writeInt16LE(Math.round(Math.sin(i/sr*2*Math.PI*180)*9000*env),44+i*2)}return b}
const readBody=req=>new Promise(r=>{let d="";req.on("data",c=>{d+=c;if(d.length>20000)req.destroy()});req.on("end",()=>r(d))});
const server=http.createServer(async(req,res)=>{
  try{
    if(req.url==="/health")return json(res,200,{ok:true,app:"Stick Studio"});
    if(req.url==="/api/voices"){
      if(MOCK)return json(res,200,{voices:[{id:"mock",name:"Mock voice"}]});
      if(!KEY)return json(res,503,{error:"ELEVENLABS_API_KEY missing"});
      const r=await fetch("https://api.elevenlabs.io/v1/voices",{headers:{"xi-api-key":KEY}});
      if(!r.ok)return json(res,r.status,{error:"elevenlabs "+r.status});
      const j=await r.json();return json(res,200,{voices:(j.voices||[]).map(v=>({id:v.voice_id,name:v.name+(v.labels&&v.labels.accent?" · "+v.labels.accent:"")}))});
    }
    if(req.url==="/api/tts"&&req.method==="POST"){
      const b=JSON.parse(await readBody(req)||"{}"),text=String(b.text||"").slice(0,1500),voice=String(b.voice||"").replace(/[^A-Za-z0-9_-]/g,"");
      if(!text||!voice)return json(res,400,{error:"text and voice required"});
      if(MOCK)return send(res,200,"audio/wav",wav(Math.max(1,text.split(/\s+/).length*.42)));
      if(!KEY)return json(res,503,{error:"ELEVENLABS_API_KEY missing"});
      const r=await fetch("https://api.elevenlabs.io/v1/text-to-speech/"+voice+"?output_format=mp3_44100_128",{method:"POST",headers:{"xi-api-key":KEY,"content-type":"application/json",accept:"audio/mpeg"},body:JSON.stringify({text,model_id:MODEL,voice_settings:{stability:.5,similarity_boost:.75}})});
      if(!r.ok){const t=await r.text();return json(res,r.status,{error:"elevenlabs "+r.status,detail:t.slice(0,300)})}
      return send(res,200,"audio/mpeg",Buffer.from(await r.arrayBuffer()));
    }
    if(req.url==="/"||req.url==="/index.html")return send(res,200,"text/html; charset=utf-8",fs.readFileSync(path.join(__dirname,"public","index.html")));
    json(res,404,{error:"not found"});
  }catch(e){json(res,500,{error:String(e.message||e)})}
});
server.listen(PORT,()=>console.log("Stick Studio on http://localhost:"+PORT+(MOCK?" (mock voice)":KEY?"":" (no ElevenLabs key)")));
