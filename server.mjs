import { createServer } from "http";
import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import * as handler from "./dist/server/server.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLIENT_DIR = join(__dirname, "dist", "client");
const port = process.env.PORT || 3000;

const MIME = {".css":"text/css",".js":"application/javascript",".mjs":"application/javascript",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".gif":"image/gif",".svg":"image/svg+xml",".ico":"image/x-icon",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".webp":"image/webp"};

function collectBody(req){return new Promise(r=>{const c=[];req.on("data",d=>c.push(d));req.on("end",()=>r(Buffer.concat(c)))})}

async function serveStatic(path,res){try{const d=await readFile(join(CLIENT_DIR,path));const e=extname(path);res.writeHead(200,{"Content-Type":MIME[e]||"application/octet-stream","Cache-Control":(e===".css"||e===".js")?"public,max-age=31536000,immutable":"public,max-age=3600"});res.end(d);return true}catch{return false}}

const server=createServer(async(req,res)=>{try{const url=new URL(req.url,"http://"+req.headers.host);const ext=extname(url.pathname);if(url.pathname.startsWith("/assets/")||MIME[ext]){if(await serveStatic(url.pathname,res))return}const h={};for(const[k,v]of Object.entries(req.headers)){if(v)h[k]=Array.isArray(v)?v.join(", "):v}const body=["GET","HEAD"].includes(req.method)?undefined:await collectBody(req);const request=new Request(url.toString(),{method:req.method,headers:h,body});const sh=handler.default??handler;const fn=sh.fetch??sh.default?.fetch;const response=await fn.call(sh,request,process.env,{});res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body){const reader=response.body.getReader();while(true){const{done,value}=await reader.read();if(done)break;res.write(value)}}res.end()}catch(err){console.error("Server error:",err);res.writeHead(500);res.end("Internal Server Error")}});

server.listen(port,"0.0.0.0",()=>{console.log("Daddy AI listening on http://localhost:"+port+"/")});
