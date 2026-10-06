import {ShopError,parseProxyLines} from "./proxy-rules";
import {encryptCredentials,fingerprint} from "./proxy-crypto";
import {digitalAction,deliveryKinds} from "./digital-products";
import {hashToken} from "./local-auth";
export const sellerFee=(price:number)=>Math.round(price*5/100);
type User={userId:string;email:string;isAdmin:boolean};
export async function sellerSnapshot(db:D1Database,user:User){
 const membership=await db.prepare("SELECT role,active FROM sellers WHERE customer_id=?").bind(user.userId).first<{role:string;active:number}>();
 const products=(user.isAdmin||membership?.active)?(await db.prepare("SELECT p.*,c.email seller_email,(SELECT COUNT(*) FROM digital_stock d WHERE d.product=p.code AND d.state='AVAILABLE')+(SELECT COUNT(*) FROM stock s WHERE s.product=p.code AND s.state='AVAILABLE') available FROM products p LEFT JOIN customers c ON c.id=p.seller_id WHERE p.seller_id IS NOT NULL"+(user.isAdmin?"":" AND p.seller_id=?")+" ORDER BY p.name").bind(...user.isAdmin?[]:[user.userId]).all()).results:[];
 const sales=(user.isAdmin||membership?.active)?(await db.prepare("SELECT s.*,p.name product_name FROM seller_sales s JOIN orders o ON o.id=s.order_id JOIN products p ON p.code=o.product"+(user.isAdmin?"":" WHERE s.seller_id=?")+" ORDER BY s.created DESC LIMIT 200").bind(...user.isAdmin?[]:[user.userId]).all()).results:[];
 const members=user.isAdmin?(await db.prepare("SELECT s.*,c.email,c.name FROM sellers s JOIN customers c ON c.id=s.customer_id ORDER BY s.created DESC").all()).results:[];
 const totals=(user.isAdmin||membership?.active)?await db.prepare("SELECT COALESCE(SUM(gross),0) gross,COALESCE(SUM(fee),0) fee,COALESCE(SUM(net),0) net,COUNT(*) orders FROM seller_sales"+(user.isAdmin?"":" WHERE seller_id=?")).bind(...user.isAdmin?[]:[user.userId]).first():{gross:0,fee:0,net:0,orders:0};
 return {seller:{membership,products,sales,members,totals,feePercent:5}};
}
export async function sellerAction(db:D1Database,key:string,user:User,payload:Record<string,unknown>){
 const sql=(query:string,...args:unknown[])=>db.prepare(query).bind(...args),action=String(payload.action);
 if(action==="seller-grant"){
  if(!user.isAdmin)throw new ShopError("Chỉ quản trị viên được cấp quyền CTV.",403);
  const email=String(payload.email??"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)throw new ShopError("Nhập email đăng ký hợp lệ.");
  const account=await sql("SELECT a.customer_id,a.role,c.name FROM auth_accounts a JOIN customers c ON c.id=a.customer_id WHERE a.email=?",email).first<{customer_id:string;role:string;name:string}>();
  if(!account)throw new ShopError("Email này chưa đăng ký tài khoản trên web. Yêu cầu CTV đăng ký trước.",404);
  if(account.role!=="CUSTOMER")throw new ShopError("Tài khoản quản trị không cần cấp quyền CTV.");
  await sql("INSERT INTO sellers(customer_id,role,active,created) VALUES(?,'SELLER',1,?) ON CONFLICT(customer_id) DO UPDATE SET active=1",account.customer_id,Date.now()).run();
  return {message:`Đã cấp quyền CTV cho ${account.name} (${email}). CTV tải lại trang để vào gian hàng.`};
 }
 if(action==="seller-invite"){
  if(!user.isAdmin)throw new ShopError("Chỉ quản trị viên được cấp quyền CTV.",403);
  const email=String(payload.email??"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ShopError("Nhập email CTV hợp lệ.");
  const token=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,"0")).join("");await sql("INSERT INTO seller_invites(token_hash,email,expires,created) VALUES(?,?,?,?)",await hashToken(token),email,Date.now()+7*86400000,Date.now()).run();return {invite:token,message:"Mã mời dùng một lần, hết hạn sau 7 ngày. Gửi riêng cho CTV đúng email."};
 }
 if(action==="seller-accept"){
  const token=String(payload.token??"");if(!/^[a-f0-9]{48}$/.test(token))throw new ShopError("Mã mời không hợp lệ.");const tokenHash=await hashToken(token),invite=await sql("SELECT email,expires,used_by FROM seller_invites WHERE token_hash=?",tokenHash).first<{email:string;expires:number;used_by:string|null}>();
  if(!invite||invite.email!==user.email.toLowerCase()||invite.expires<Date.now()||invite.used_by)throw new ShopError("Mã mời không còn hiệu lực hoặc không đúng tài khoản.",403);
  const guard=crypto.randomUUID();await db.batch([sql("INSERT INTO transaction_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM seller_invites WHERE token_hash=? AND used_by IS NULL AND expires>? AND email=?) THEN 1 ELSE 0 END",guard,tokenHash,Date.now(),user.email.toLowerCase()),sql("INSERT INTO sellers(customer_id,role,active,created) VALUES(?,'SELLER',1,?) ON CONFLICT(customer_id) DO UPDATE SET active=1",user.userId,Date.now()),sql("UPDATE seller_invites SET used_by=? WHERE token_hash=?",user.userId,tokenHash),sql("DELETE FROM transaction_guards WHERE id=?",guard)]);return {message:"Đã cấp quyền CTV. Bạn có thể gửi sản phẩm để duyệt."};
 }
 if(action==="seller-status"){
  if(!user.isAdmin||typeof payload.active!=="boolean")throw new ShopError("Chỉ quản trị viên được quản lý CTV.",403);
  await db.batch([sql("UPDATE sellers SET active=? WHERE customer_id=?",payload.active?1:0,String(payload.id)),...payload.active?[]:[sql("UPDATE products SET enabled=0 WHERE seller_id=?",String(payload.id)),sql("UPDATE seller_invites SET used_by='REVOKED' WHERE used_by IS NULL AND email=(SELECT LOWER(email) FROM customers WHERE id=?)",String(payload.id))]]);return {message:payload.active?"Đã mở lại quyền CTV. Duyệt sản phẩm để mở bán lại.":"Đã khóa quyền CTV và tắt sản phẩm."};
 }
 if(action==="seller-review"){
  if(!user.isAdmin)throw new ShopError("Chỉ quản trị viên được duyệt mở bán.",403);
  const product=await sql("SELECT p.*,s.active FROM products p JOIN sellers s ON s.customer_id=p.seller_id WHERE p.code=?",String(payload.code)).first<{price:number;active:number;review_state:string}>();if(!product)throw new ShopError("Không tìm thấy sản phẩm CTV.",404);
  const approve=payload.approve===true,note=String(payload.note??"").trim().slice(0,1000);if(approve&&(!product.active||product.price<=0))throw new ShopError("CTV bị khóa hoặc sản phẩm chưa có giá hợp lệ.");
  await sql("UPDATE products SET review_state=?,review_note=?,enabled=? WHERE code=?",approve?"APPROVED":"REJECTED",note,approve?1:0,String(payload.code)).run();return {message:approve?"Đã duyệt và mở bán sản phẩm CTV.":"Đã từ chối mở bán sản phẩm."};
 }
 const membership=await sql("SELECT active FROM sellers WHERE customer_id=?",user.userId).first<{active:number}>();if(!membership?.active)throw new ShopError("Bạn chưa được cấp quyền CTV hoặc quyền đã bị khóa.",403);
 if(action==="seller-save"){
  const code=String(payload.code??"")||"seller-"+crypto.randomUUID(),current=await sql("SELECT seller_id,kind,protocol FROM products WHERE code=?",code).first<{seller_id:string;kind:string;protocol:string}>();if(current&&current.seller_id!==user.userId)throw new ShopError("Không được sửa sản phẩm của người khác.",403);
  const name=String(payload.name??"").trim(),description=String(payload.description??"").trim(),kind=String(payload.kind),protocol=kind==="PROXY"?String(payload.protocol):"DIGITAL",price=Number(payload.price);
  if(!name||name.length>100||description.length>2000||!Number.isSafeInteger(price)||price<=0||price>10000000||![...deliveryKinds,"PROXY"].includes(kind)||kind==="PROXY"&&!["HTTP","SOCKS5"].includes(protocol))throw new ShopError("Kiểm tra tên, loại và giá sản phẩm (1–10.000.000đ).");
  if(current&&(current.kind!==kind||current.protocol!==protocol))throw new ShopError("Không đổi loại sản phẩm đã có kho.");
  if(!current&&(await sql("SELECT COUNT(*) n FROM products WHERE seller_id=?",user.userId).first<{n:number}>())!.n>=100)throw new ShopError("Tối đa 100 sản phẩm mỗi CTV.");
  await sql("INSERT INTO products(code,name,protocol,price,enabled,kind,description,seller_id,review_state) VALUES(?,?,?,?,0,?,?,?,'PENDING') ON CONFLICT(code) DO UPDATE SET name=excluded.name,price=excluded.price,description=excluded.description,enabled=0,review_state='PENDING',review_note=''",code,name,protocol,price,kind,description,user.userId).run();return {message:"Đã gửi sản phẩm. Chờ quản trị viên duyệt mở bán."};
 }
 if(action==="seller-import"){
  const product=await sql("SELECT kind,protocol FROM products WHERE code=? AND seller_id=?",String(payload.product),user.userId).first<{kind:string;protocol:string}>();if(!product)throw new ShopError("Chỉ nhập kho sản phẩm của bạn.",403);
  if(product.kind!=="PROXY")return digitalAction(db,key,user.userId,{...payload,action:"import-items"});
  const rows=parseProxyLines(payload.text),statements=[];for(const p of rows)statements.push(sql("INSERT INTO stock(id,fingerprint,host,port,protocol,region,credentials,created,product) VALUES(?,?,?,?,?,'Việt Nam',?,?,?) ON CONFLICT(fingerprint) DO NOTHING",crypto.randomUUID(),await fingerprint(p.host,p.port,product.protocol,p.user),p.host,p.port,product.protocol,await encryptCredentials(p,key),Date.now(),String(payload.product)));
  let count=0;for(let i=0;i<statements.length;i+=50)count+=(await db.batch(statements.slice(i,i+50))).reduce((n,r)=>n+r.meta.changes,0);return {message:`Đã nhập ${count} proxy vào kho riêng, chờ kiểm tra live.`};
 }
 throw new ShopError("Thao tác CTV không hợp lệ.");
}
export function saleStatements(db:D1Database,order:{id:string;seller_id?:string|null;unit_fee?:number;unit_price:number;quantity:number;total:number}){
 if(!order.seller_id)return [];
 const fee=order.quantity*(order.unit_fee??0);return [db.prepare("INSERT INTO seller_sales(order_id,seller_id,quantity,unit_price,gross,fee,net,created) VALUES(?,?,?,?,?,?,?,?)").bind(order.id,order.seller_id,order.quantity,order.unit_price,order.total,fee,order.total-fee,Date.now())];
}
