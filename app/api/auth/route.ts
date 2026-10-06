import {getChatGPTUser} from "@/app/chatgpt-auth";
import {env} from "cloudflare:workers";
import {authAction} from "@/lib/local-auth";
import {shopFailure} from "@/lib/shop-service";
export const dynamic="force-dynamic";
export async function POST(request:Request){try{const raw=await request.text();if(raw.length>4000)return Response.json({error:"Yêu cầu quá lớn."},{status:413});const payload=JSON.parse(raw);if(!payload||typeof payload!=="object"||Array.isArray(payload))return Response.json({error:"Yêu cầu không hợp lệ."},{status:400});const runtime=env as unknown as {DB:D1Database;PROXY_ENCRYPTION_KEY:string;ADMIN_EMAIL:string;ADMIN_SETUP_EMAIL?:string;ADMIN_SETUP_SALT?:string;ADMIN_SETUP_HASH?:string};const {cookie,message}=await authAction(runtime.DB,runtime.PROXY_ENCRYPTION_KEY,runtime.ADMIN_EMAIL,request,payload,await getChatGPTUser(),{email:runtime.ADMIN_SETUP_EMAIL,salt:runtime.ADMIN_SETUP_SALT,hash:runtime.ADMIN_SETUP_HASH});return Response.json({message},{headers:{"Set-Cookie":cookie,"Cache-Control":"no-store"}});}catch(error){return shopFailure(error);}}

