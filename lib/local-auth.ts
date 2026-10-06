import {ShopError} from "./proxy-rules";
const COOKIE="__Host-proxyhub_session",TTL=7*86400000;
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const bytes=(s:string)=>Uint8Array.from(s.match(/.{2}/g)??[],v=>parseInt(v,16));
export async function hashToken(value:string){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));}
async function passwordHash(password:string,salt:string,pepper:string){
 const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const derived=await crypto.subtle.deriveBits({name:"PBKDF2",salt:bytes(salt),iterations:100000,hash:"SHA-256"},base,256);
 const key=await crypto.subtle.importKey("raw",bytes(pepper),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(new Uint8Array(await crypto.subtle.sign("HMAC",key,derived)));
}
function equal(a:string,b:string){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
function cookieToken(request?:Request){const value=request?.headers.get("cookie")?.split(";").map(s=>s.trim()).find(s=>s.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);return value&&/^[a-f0-9]{64}$/.test(value)?value:null;}
export async function localIdentity(db:D1Database,request?:Request){const token=cookieToken(request);if(!token)return null;const user=await db.prepare("SELECT c.id userId,c.email,c.name displayName,a.role FROM auth_sessions s JOIN auth_accounts a ON a.customer_id=s.customer_id JOIN customers c ON c.id=a.customer_id WHERE s.token_hash=? AND s.expires>?").bind(await hashToken(token),Date.now()).first<{userId:string;email:string;displayName:string;role:string}>();return user?{userId:user.userId,email:user.email,displayName:user.displayName,isAdmin:user.role==="ADMIN"}:null;}
async function rate(db:D1Database,id:string,max:number){const now=Date.now();await db.prepare("INSERT INTO auth_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN auth_limits.expires<? THEN 1 ELSE auth_limits.count+1 END,expires=CASE WHEN auth_limits.expires<? THEN excluded.expires ELSE auth_limits.expires END").bind(id,now+15*60000,now,now).run();if((await db.prepare("SELECT count FROM auth_limits WHERE id=?").bind(id).first<{count:number}>())!.count>max)throw new ShopError("Bạn thử quá nhiều lần. Vui lòng chờ 15 phút.",429);}
async function session(db:D1Database,id:string){const token=hex(crypto.getRandomValues(new Uint8Array(32)));await db.batch([db.prepare("DELETE FROM auth_sessions WHERE expires<?").bind(Date.now()),db.prepare("INSERT INTO auth_sessions(token_hash,customer_id,expires) VALUES(?,?,?)").bind(await hashToken(token),id,Date.now()+TTL)]);return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL/1000}`;}
export async function authAction(db:D1Database,pepper:string,adminEmail:string,request:Request,payload:Record<string,unknown>,owner?:{userId:string;email:string}|null,setup?:{email?:string;salt?:string;hash?:string}){
 if(request.headers.get("origin")!==new URL(request.url).origin)throw new ShopError("Yêu cầu đăng nhập khác nguồn bị từ chối.",403);
 if(payload.action==="logout"){const token=cookieToken(request);if(token)await db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await hashToken(token)).run();return {cookie:`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,message:"Đã đăng xuất."};}
 if(!["login","register"].includes(String(payload.action)))throw new ShopError("Thao tác đăng nhập không hợp lệ.");
 const email=typeof payload.email==="string"?payload.email.trim().toLowerCase():"",password=typeof payload.password==="string"?payload.password:"";
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length>128||password.length<1)throw new ShopError("Kiểm tra email và mật khẩu.");
 const ip=request.headers.get("cf-connecting-ip")??"unknown";await rate(db,"ip:"+await hashToken(ip),30);await rate(db,"email:"+await hashToken(email),10);
 const setupEmail=setup?.email?.toLowerCase();
 if(email===setupEmail&&setup?.salt&&setup.hash&&/^[a-f0-9]{64}$/.test(setup.salt)&&/^[a-f0-9]{64}$/.test(setup.hash)){
  if(payload.action!=="login")throw new ShopError("Tài khoản quản trị đã được cấu hình. Hãy đăng nhập.",409);
  const existing=await db.prepare("SELECT customer_id,role FROM auth_accounts WHERE email=?").bind(email).first<{customer_id:string;role:string}>();
  if(existing?.role!=="ADMIN"){
   const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
   const candidate=hex(new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt:bytes(setup.salt),iterations:100000,hash:"SHA-256"},key,256)));
   if(!equal(candidate,setup.hash))throw new ShopError("Email hoặc mật khẩu không đúng.",401);
   const id=existing?.customer_id??"local-"+crypto.randomUUID(),salt=hex(crypto.getRandomValues(new Uint8Array(32))),hash=await passwordHash(password,salt,pepper);
   await db.batch([db.prepare("INSERT INTO customers(id,email,name,created) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,email,"Trumv",Date.now()),db.prepare("INSERT INTO auth_accounts(customer_id,email,salt,password_hash,role) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,role='ADMIN'").bind(id,email,salt,hash,"ADMIN"),db.prepare("DELETE FROM auth_sessions WHERE customer_id=?").bind(id)]);
  }
 }
 if(payload.action==="register"){
  const name=typeof payload.name==="string"?payload.name.trim():"";if(name.length<2||name.length>80||password.length<8)throw new ShopError("Tên từ 2–80 ký tự; mật khẩu từ 8–128 ký tự.");
  const isOwner=email===adminEmail.toLowerCase()&&owner?.email.toLowerCase()===email;
  if(email===adminEmail.toLowerCase()&&!isOwner||await db.prepare("SELECT customer_id FROM auth_accounts WHERE email=?").bind(email).first())throw new ShopError("Email này không thể đăng ký. Hãy đăng nhập hoặc dùng email khác.",409);
  const id=isOwner?owner!.userId:"local-"+crypto.randomUUID(),salt=hex(crypto.getRandomValues(new Uint8Array(32))),hash=await passwordHash(password,salt,pepper);
  await db.batch([db.prepare("INSERT INTO customers(id,email,name,created) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,email,name,Date.now()),db.prepare("INSERT INTO auth_accounts(customer_id,email,salt,password_hash,role) VALUES(?,?,?,?,?)").bind(id,email,salt,hash,isOwner?"ADMIN":"CUSTOMER")]);
  return {cookie:await session(db,id),message:"Đã tạo tài khoản và đăng nhập."};
 }
 const account=await db.prepare("SELECT customer_id,salt,password_hash FROM auth_accounts WHERE email=?").bind(email).first<{customer_id:string;salt:string;password_hash:string}>();
 const hash=await passwordHash(password,account?.salt??"00".repeat(32),pepper);if(!account||!equal(hash,account.password_hash))throw new ShopError("Email hoặc mật khẩu không đúng.",401);
 await db.prepare("DELETE FROM auth_limits WHERE id=?").bind("email:"+await hashToken(email)).run();return {cookie:await session(db,account.customer_id),message:"Đã đăng nhập."};
}

