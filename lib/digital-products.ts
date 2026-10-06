import {ShopError} from "./proxy-rules";
import {encryptCredentials,decryptCredentials,fingerprint} from "./proxy-crypto";

export const deliveryKinds=["ACCOUNT","KEY","TEXT","LINK","FILE_LINK"];
type DigitalItem={id:string;content:string};
export async function digitalSnapshot(db:D1Database,userId:string,isAdmin:boolean){
 const purchases=(await db.prepare("SELECT d.id,d.order_id,d.position,d.created,p.name,p.kind FROM deliveries d JOIN orders o ON o.id=d.order_id JOIN products p ON p.code=o.product WHERE o.customer_id=? ORDER BY d.created DESC,d.position LIMIT 1000").bind(userId).all()).results;
 const digitalInventory=isAdmin?(await db.prepare("SELECT p.code,p.name,p.kind,COUNT(s.id) total,SUM(CASE WHEN s.state='AVAILABLE' THEN 1 ELSE 0 END) available FROM products p LEFT JOIN digital_stock s ON s.product=p.code WHERE p.kind<>'PROXY' GROUP BY p.code ORDER BY p.name").all()).results:[];
 return {purchases,digitalInventory};
}
export async function digitalAction(db:D1Database,key:string,userId:string,payload:Record<string,unknown>){
 const sql=(query:string,...args:unknown[])=>db.prepare(query).bind(...args);
 if(payload.action==="save-product"){
  const name=typeof payload.name==="string"?payload.name.trim():"",description=typeof payload.description==="string"?payload.description.trim():"",kind=String(payload.kind),price=Number(payload.price);
  if(!name||name.length>100||description.length>2000||!deliveryKinds.includes(kind)||!Number.isSafeInteger(price)||price<0||price>10000000||typeof payload.enabled!=="boolean"||(payload.enabled&&price===0))throw new ShopError("Kiểm tra tên, loại, giá và mô tả sản phẩm. Giá mở bán phải lớn hơn 0.");
  const instructions=await sql("SELECT value FROM shop_settings WHERE key='payment_instructions'").first<{value:string}>();
  if(payload.enabled&&(instructions?.value.trim().length??0)<10)throw new ShopError("Lưu hướng dẫn thanh toán trước khi mở bán.");
  const code=typeof payload.code==="string"&&payload.code?payload.code:"item-"+crypto.randomUUID();
  const current=await sql("SELECT kind FROM products WHERE code=?",code).first<{kind:string}>();
  if(current&&(current.kind==="PROXY"||current.kind!==kind))throw new ShopError("Không đổi loại sản phẩm đã tạo. Hãy tạo sản phẩm mới.");
  const total=await sql("SELECT COUNT(*) n FROM products WHERE kind<>'PROXY'").first<{n:number}>();
  if(!current&&(total?.n??0)>=100)throw new ShopError("Tối đa 100 sản phẩm khác.");
  await sql("INSERT INTO products(code,name,protocol,price,enabled,kind,description) VALUES(?,?,'DIGITAL',?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,price=excluded.price,enabled=excluded.enabled,description=excluded.description",code,name,price,payload.enabled?1:0,kind,description).run();
  return {message:"Đã lưu sản phẩm."};
 }
 if(payload.action==="import-items"){
  const product=await sql("SELECT kind FROM products WHERE code=? AND kind<>'PROXY'",String(payload.product)).first<{kind:string}>();if(!product)throw new ShopError("Chọn sản phẩm trước khi nhập kho.");
  if(typeof payload.text!=="string"||payload.text.length>200000)throw new ShopError("Danh sách tối đa 200 KB.");
  const rows=payload.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!rows.length||rows.length>500||rows.some(s=>s.length>4000))throw new ShopError("Nhập 1–500 dòng, mỗi dòng là một sản phẩm (tối đa 4.000 ký tự).");
  if(product.kind==="LINK"||product.kind==="FILE_LINK")for(const row of rows){try{const url=new URL(row);if(!["https:","http:"].includes(url.protocol)||url.username||url.password)throw new Error();}catch{throw new ShopError("Mỗi dòng phải là một link HTTP hoặc HTTPS hợp lệ.");}}
  const statements=[];for(const row of rows)statements.push(sql("INSERT INTO digital_stock(id,product,fingerprint,content,created) VALUES(?,?,?,?,?) ON CONFLICT(product,fingerprint) DO NOTHING",crypto.randomUUID(),payload.product,await fingerprint(row,0,"DIGITAL",""),await encryptCredentials({user:"",password:row},key),Date.now()));
  let added=0;for(let i=0;i<statements.length;i+=50){const result=await db.batch(statements.slice(i,i+50));added+=result.reduce((n,r)=>n+r.meta.changes,0);}
  return {message:`Đã nhập ${added} sản phẩm; bỏ qua ${rows.length-added} dòng trùng.`};
 }
 if(payload.action==="export-items"){
  if(!Array.isArray(payload.ids)||!payload.ids.length||payload.ids.length>1000||payload.ids.some(x=>typeof x!=="string"))throw new ShopError("Chọn sản phẩm cần copy.");
  const records=(await sql("SELECT d.id,s.content FROM deliveries d JOIN digital_stock s ON s.id=d.stock_id JOIN orders o ON o.id=d.order_id WHERE o.customer_id=? ORDER BY d.created,d.position",userId).all<DigitalItem>()).results.filter(p=>(payload.ids as string[]).includes(p.id));
  if(!records.length)throw new ShopError("Không có sản phẩm đã mua để xuất.");
  const lines=[];for(const row of records)lines.push((await decryptCredentials(row.content,key)).password);
  return {text:lines.join("\n"),message:`Đã lấy ${lines.length} sản phẩm.`};
 }
 throw new ShopError("Thao tác sản phẩm không được hỗ trợ.");
}
export async function approveDigital(db:D1Database,order:{id:string;customer_id:string;product:string;quantity:number},assert:()=>Promise<void>,extra:D1PreparedStatement[]=[]){
 const sql=(query:string,...args:unknown[])=>db.prepare(query).bind(...args);
 const items=(await sql("SELECT id FROM digital_stock WHERE product=? AND state='AVAILABLE' ORDER BY created,id LIMIT ?",order.product,order.quantity).all<{id:string}>()).results;
 if(items.length<order.quantity)throw new ShopError(`Kho còn ${items.length} sản phẩm, chưa đủ ${order.quantity}. Đơn vẫn chờ.`,409);
 await assert();const guard=crypto.randomUUID();
 const statements=[...extra,sql("INSERT INTO transaction_guards(id,valid) SELECT ?,CASE WHEN (SELECT status FROM orders WHERE id=?)='PENDING' AND (SELECT COUNT(*) FROM digital_stock WHERE id IN ("+items.map(()=>"?").join(",")+") AND state='AVAILABLE' AND product=?)=? THEN 1 ELSE 0 END",guard,order.id,...items.map(i=>i.id),order.product,order.quantity)];
 items.forEach((item,i)=>{statements.push(sql("INSERT INTO deliveries(id,order_id,stock_id,position,created) VALUES(?,?,?,?,?)",crypto.randomUUID(),order.id,item.id,i+1,Date.now()),sql("UPDATE digital_stock SET state='ASSIGNED' WHERE id=?",item.id));});
 statements.push(sql("UPDATE orders SET status='APPROVED',approved=? WHERE id=?",Date.now(),order.id),sql("INSERT INTO notifications(id,customer_id,message,created,dedupe) VALUES(?,?,?,?,?)",crypto.randomUUID(),order.customer_id,`Đơn ${order.id.slice(0,8)} đã được giao ${order.quantity} sản phẩm. Xem trong Sản phẩm đã mua.`,Date.now(),`approved:${order.id}`),sql("DELETE FROM transaction_guards WHERE id=?",guard));
 await db.batch(statements);return {message:`Đã giao ${order.quantity} sản phẩm từ kho.`};
}
