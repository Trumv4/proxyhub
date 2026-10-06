export const dynamic="force-dynamic";
// Public visitors cannot invoke background maintenance or read internal run data.
// Admin checks remain available through the authenticated shop actions.
export async function POST(){return Response.json({error:"Dùng thao tác kiểm tra trong trang quản trị."},{status:403,headers:{"Cache-Control":"no-store"}});}
export async function GET(){return Response.json({error:"Dùng trang quản trị để xem checker."},{status:403,headers:{"Cache-Control":"no-store"}});}

