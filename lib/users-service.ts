import {ShopError} from "./proxy-rules";
import {walletSnapshot} from "./wallet";
export async function usersAction(db:D1Database,user:{userId:string;isAdmin:boolean},p:Record<string,unknown>,ownerEmail:string){
 if(!user.isAdmin)throw new ShopError("Chỉ quản trị viên được xem người dùng.",403);
 if(p.action==="users-list"){
  const search=String(p.search??"").trim().slice(0,254),page=Math.max(1,Math.min(100000,Math.floor(Number(p.page))||1)),filter="WHERE (?='' OR instr(lower(c.email),lower(?))>0 OR instr(lower(c.name),lower(?))>0)";
  const total=await db.prepare("SELECT COUNT(*) total FROM customers c "+filter).bind(search,search,search).first<{total:number}>();
  const stats=await db.prepare("SELECT COUNT(*) total,COALESCE(SUM(banned),0) banned FROM customers").first();
  const rows=(await db.prepare("SELECT c.id,c.email,c.name,c.created,c.last_login,c.banned,c.ban_reason,CASE WHEN a.role='ADMIN' OR lower(c.email)=lower(?) THEN 'ADMIN' WHEN s.active=1 THEN 'CTV' ELSE 'CUSTOMER' END role,COALESCE((SELECT SUM(amount) FROM wallet_entries WHERE customer_id=c.id),0) balance,(SELECT COUNT(*) FROM orders WHERE customer_id=c.id) orders FROM customers c LEFT JOIN auth_accounts a ON a.customer_id=c.id LEFT JOIN sellers s ON s.customer_id=c.id "+filter+" ORDER BY c.created DESC,c.id LIMIT 25 OFFSET ?").bind(ownerEmail,search,search,search,(page-1)*25).all()).results;
  return {users:{rows,total:total?.total??0,page,stats},message:"Đã tải người dùng."};
 }
 const target=await db.prepare("SELECT c.id,c.email,c.name,c.created,c.banned,c.ban_reason,a.role FROM customers c LEFT JOIN auth_accounts a ON a.customer_id=c.id WHERE c.id=?").bind(String(p.id)).first<{id:string;email:string;name:string;role:string|null}>();
 if(!target)throw new ShopError("Không tìm thấy người dùng.",404);
 if(target.email.toLowerCase()===ownerEmail.toLowerCase())target.role="ADMIN";
 if(p.action==="users-detail")return {detail:{user:target,...await walletSnapshot(db,target.id,false),orders:(await db.prepare("SELECT o.id,o.created,o.total,o.status,p.name product FROM orders o JOIN products p ON p.code=o.product WHERE o.customer_id=? ORDER BY o.created DESC LIMIT 50").bind(target.id).all()).results,moderation:(await db.prepare("SELECT m.action,m.reason,m.created,c.email actor FROM user_moderation m JOIN customers c ON c.id=m.actor_id WHERE m.customer_id=? ORDER BY m.created DESC LIMIT 30").bind(target.id).all()).results}};
 if(p.action==="users-ban"){
  if(typeof p.banned!=="boolean")throw new ShopError("Trạng thái khóa không hợp lệ.");
  if(target.id===user.userId||target.role==="ADMIN"||target.email.toLowerCase()===ownerEmail.toLowerCase())throw new ShopError("Không thể khóa tài khoản quản trị.",403);
  const reason=String(p.reason??"").trim();if(p.banned&&(reason.length<3||reason.length>500))throw new ShopError("Nhập lý do khóa từ 3–500 ký tự.");
  await db.batch([db.prepare("UPDATE customers SET banned=?,ban_reason=? WHERE id=?").bind(p.banned?1:0,p.banned?reason:"",target.id),db.prepare("DELETE FROM auth_sessions WHERE customer_id=?").bind(target.id),db.prepare("INSERT INTO user_moderation(id,customer_id,actor_id,action,reason,created) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),target.id,user.userId,p.banned?"BAN":"UNBAN",p.banned?reason:"Mở khóa",Date.now())]);
  return {message:p.banned?"Đã khóa tài khoản và đăng xuất các phiên hiện tại.":"Đã mở khóa tài khoản."};
 }
 throw new ShopError("Thao tác người dùng không hợp lệ.");
}
