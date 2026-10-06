import {getChatGPTUser} from "@/app/chatgpt-auth";
import {scheduledMaintenance,shopFailure} from "@/lib/shop-service";
import {env} from "cloudflare:workers";
export const dynamic="force-dynamic";
// This route is for Sites service access on the confirmed owner-private Site.
// Never expose the Site publicly without replacing this boundary with dedicated service auth.
export async function POST(){try{if(await getChatGPTUser())return Response.json({error:"Dùng thao tác kiểm tra trong trang quản trị."},{status:403});return Response.json(await scheduledMaintenance(),{headers:{"Cache-Control":"no-store"}});}catch(e){return shopFailure(e);}}
export async function GET(){try{if(await getChatGPTUser())return Response.json({error:"Dùng trang quản trị để xem checker."},{status:403});const db=(env as unknown as {DB?:D1Database}).DB;if(!db)return Response.json({error:"Kho dữ liệu chưa sẵn sàng."},{status:503});const latest=await db.prepare("SELECT created,checked,replaced,message FROM runs ORDER BY created DESC LIMIT 1").first();return Response.json({latest},{headers:{"Cache-Control":"no-store"}});}catch(e){return shopFailure(e);}}
