import {ShopError} from "./proxy-rules";
import {encryptCredentials,decryptCredentials} from "./proxy-crypto";
import {bankIsActive} from "./payment-links";
type Config={enabled:boolean;bankId:string;accountNumber:string;holder:string;bank:string;token:string};
type Topup={id:string;customer_id:string;code:string;amount:number;status:string;created:number;expires:number;checked:number;bank_id:string;account_number:string};
type Transaction={id:string;bank_account_id:string;account_number:string;transfer_type:string;amount_in:number;amount_out:number;transaction_date:string;transaction_content:string;code?:string|null};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const BASE="https://userapi.sepay.vn/v2";
function sql(db:D1Database,query:string,...args:unknown[]){return db.prepare(query).bind(...args);}
async function config(db:D1Database,key:string):Promise<Config>{const row=await sql(db,"SELECT value FROM shop_settings WHERE key='sepay_config'").first<{value:string}>();if(!row)return {enabled:false,bankId:"",accountNumber:"",holder:"",bank:"",token:""};const stored=JSON.parse(row.value);return {...stored,token:stored.token?(await decryptCredentials(stored.token,key)).password:""};}
export async function walletBalance(db:D1Database,userId:string){return (await sql(db,"SELECT COALESCE(SUM(amount),0) balance FROM wallet_entries WHERE customer_id=?",userId).first<{balance:number}>())?.balance??0;}
export async function walletSnapshot(db:D1Database,userId:string,isAdmin:boolean){
 const row=await sql(db,"SELECT value FROM shop_settings WHERE key='sepay_config'").first<{value:string}>();const c=row?JSON.parse(row.value):{};
 const ledger=(await sql(db,"SELECT id,amount,kind,reference,created FROM wallet_entries WHERE customer_id=? ORDER BY created DESC LIMIT 100",userId).all()).results;
 const topupRows=(await sql(db,"SELECT id,code,amount,status,created,expires,checked,credited,note,bank_id,account_number FROM topups WHERE customer_id=? ORDER BY created DESC LIMIT 50",userId).all()).results;
 const topups=topupRows.map(({bank_id,account_number,...t})=>({...t,payment:t.status==="PENDING"&&Number(t.expires)>Date.now()&&c.enabled&&bank_id===c.bankId&&account_number===c.accountNumber?{bank:c.bank,number:account_number,holder:c.holder}:null}));
 const review=isAdmin?(await sql(db,"SELECT t.id,t.code,t.amount,t.status,t.note,t.created,c.email FROM topups t JOIN customers c ON c.id=t.customer_id WHERE t.status='REVIEW' ORDER BY t.created DESC LIMIT 100").all()).results:[];
 const sums="SELECT COALESCE(SUM(CASE WHEN kind='TOPUP' AND amount>0 THEN amount ELSE 0 END),0) deposited,COALESCE(SUM(CASE WHEN kind='PURCHASE' AND amount<0 THEN -amount ELSE 0 END),0) spent,COALESCE(SUM(amount),0) balance FROM wallet_entries";
 const totals=await sql(db,sums+" WHERE customer_id=?",userId).first<{deposited:number;spent:number;balance:number}>();const adminTotals=isAdmin?await sql(db,sums).first<{deposited:number;spent:number;balance:number}>():null;const adminDeposits=isAdmin?(await sql(db,"SELECT l.id,l.amount,l.created,c.email FROM wallet_entries l JOIN customers c ON c.id=l.customer_id WHERE l.kind='TOPUP' AND l.amount>0 ORDER BY l.created DESC LIMIT 100").all()).results:[];
 return {wallet:{balance:await walletBalance(db,userId),totals,adminTotals,adminDeposits,ledger,topups,review,sepay:{enabled:!!c.enabled,bank:c.bank??"",holder:c.holder??"",accountNumber:c.accountNumber??"",...isAdmin?{bankId:c.bankId??"",hasToken:!!c.token}:{}}}};
}
async function sepay<T>(path:string,token:string):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 let response:Response;try{response=await fetch(BASE+path,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json","Cache-Control":"no-store"},signal:controller.signal,redirect:"manual"});}catch(error){
  // Report only fixed classifications; upstream exception text may contain sensitive data.
  const detail=error instanceof Error?error.message:"",code=controller.signal.aborted?"TIMEOUT":/certificate|TLS|SSL/i.test(detail)?"TLS":/DNS|resolve|ENOTFOUND/i.test(detail)?"DNS":/cache mode/i.test(detail)?"RUNTIME_CACHE":/network|connect|fetch failed/i.test(detail)?"NETWORK":"RUNTIME";
  console.error("sepay_connection_failure",{code});
  throw new ShopError(`Không kết nối được SePay (${code}). Chưa thay đổi số dư.`,503);
 }finally{clearTimeout(timer);}
 if(response.status>=300&&response.status<400)throw new ShopError("SePay chuyển hướng kết nối (REDIRECT). Chưa thay đổi số dư.",503);
 if(!response.ok)throw new ShopError(response.status===401||response.status===403?"SePay từ chối API Token. Kiểm tra cấu hình.":response.status===429?"SePay đang giới hạn lượt gọi. Thử lại sau.":"SePay chưa trả kết quả hợp lệ. Thử lại sau.",503);
 let body:{status:string;data:T};try{body=await response.json();}catch{throw new ShopError("Phản hồi SePay không hợp lệ.",503);}if(body.status!=="success"||!body.data)throw new ShopError("Phản hồi SePay không hợp lệ.",503);return body.data;
}
async function paymentLock<T>(db:D1Database,work:()=>Promise<T>){const owner=crypto.randomUUID();await sql(db,"INSERT INTO locks(id,owner,expires) VALUES('payments',?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,expires=excluded.expires WHERE locks.expires<?",owner,Date.now()+60000,Date.now()).run();if((await sql(db,"SELECT owner FROM locks WHERE id='payments'").first<{owner:string}>())?.owner!==owner)throw new ShopError("Đang đối soát tiền. Thử lại sau vài giây.",409);try{return await work();}finally{await sql(db,"DELETE FROM locks WHERE id='payments' AND owner=?",owner).run();}}
export async function walletAction(db:D1Database,key:string,userId:string,payload:Record<string,unknown>){
 if(payload.action==="sepay-banks")return paymentLock(db,async()=>{const c=await config(db,key),token=typeof payload.token==="string"&&payload.token.trim()?payload.token.trim():c.token;if(!token||token.length>4096)throw new ShopError("Nhập API Token trước.");const rows=await sepay<{id:string;account_number:string;account_holder_name:string;bank_short_name:string}[]>("/bank-accounts?active=1&per_page=100",token);if(!Array.isArray(rows))throw new ShopError("Danh sách ngân hàng không hợp lệ.",503);return {banks:rows.map(b=>({id:b.id,number:b.account_number,holder:b.account_holder_name,bank:b.bank_short_name})),message:"Đã tải ngân hàng, chọn tài khoản nhận tiền rồi bật SePay."};});
 if(payload.action==="sepay-settings")return paymentLock(db,async()=>{
  if(typeof payload.enabled!=="boolean")throw new ShopError("Trạng thái SePay không hợp lệ.");
  const previous=await config(db,key);
  if(!payload.enabled){await sql(db,"INSERT INTO shop_settings(key,value) VALUES('sepay_config',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({...previous,enabled:false,token:previous.token?await encryptCredentials({user:"",password:previous.token},key):""})).run();return {message:"Đã tắt nạp tiền SePay. Số dư và lịch sử được giữ lại."};}
  const bankId=String(payload.bankId),token=typeof payload.token==="string"&&payload.token.trim()?payload.token.trim():previous.token;
  if(!UUID.test(bankId)||!token||token.length>4096)throw new ShopError("Nhập API Token và UUID tài khoản ngân hàng SePay.");
  if(previous.bankId&&previous.bankId!==bankId&&(await sql(db,"SELECT COUNT(*) n FROM topups WHERE status='PENDING'").first<{n:number}>())?.n)throw new ShopError("Còn yêu cầu nạp tiền chờ. Hãy đối soát trước khi đổi ngân hàng.");
  const bank=await sepay<{id:string;account_number:string;account_holder_name:string;bank_short_name:string;active:unknown}>("/bank-accounts/"+encodeURIComponent(bankId),token);
  if(bank.id!==bankId||!bank.account_number||!bank.account_holder_name||!bank.bank_short_name||!bankIsActive(bank.active))throw new ShopError("Tài khoản ngân hàng SePay chưa hoạt động hoặc không hợp lệ.");
  await sql(db,"INSERT INTO shop_settings(key,value) VALUES('sepay_config',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify({enabled:true,bankId,accountNumber:bank.account_number,holder:bank.account_holder_name,bank:bank.bank_short_name,token:await encryptCredentials({user:"",password:token},key)})).run();return {message:"Đã xác nhận ngân hàng và bật nạp tiền SePay."};
 });
 if(payload.action==="create-topup")return paymentLock(db,async()=>{
  const c=await config(db,key),amount=Number(payload.amount);if(!c.enabled||!c.token)throw new ShopError("Nạp tiền SePay chưa được bật.");if(!Number.isSafeInteger(amount)||amount<1000||amount>100000000||!UUID.test(String(payload.requestId)))throw new ShopError("Số tiền nạp từ 1.000 đến 100.000.000đ, mã yêu cầu hợp lệ.");
  const existing=await sql(db,"SELECT id FROM topups WHERE customer_id=? AND request_id=?",userId,payload.requestId).first<{id:string}>();if(existing)return {message:"Yêu cầu nạp tiền đã được tạo.",id:existing.id};
  const pending=await sql(db,"SELECT COUNT(*) n FROM topups WHERE customer_id=? AND status='PENDING'",userId).first<{n:number}>();if((pending?.n??0)>=3)throw new ShopError("Bạn đang có 3 yêu cầu nạp chờ. Hãy đối soát trước.");
  const id=crypto.randomUUID(),code="PHN"+crypto.randomUUID().replaceAll("-","").slice(0,20).toUpperCase();
  await sql(db,"INSERT INTO topups(id,customer_id,code,amount,bank_id,account_number,created,expires,request_id) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(customer_id,request_id) DO NOTHING",id,userId,code,amount,c.bankId,c.accountNumber,Date.now(),Date.now()+86400000,payload.requestId).run();return {message:"Đã tạo mã nạp. Chuyển đúng số tiền và nội dung hiển thị.",id};
 });
 if(payload.action==="check-topup")return paymentLock(db,async()=>{
  const topup=await sql(db,"SELECT * FROM topups WHERE id=? AND customer_id=?",String(payload.id),userId).first<Topup>();if(!topup)throw new ShopError("Không tìm thấy yêu cầu nạp.",404);
  return checkTopup(db,key,topup);
 });
 throw new ShopError("Thao tác ví không được hỗ trợ.");
}
export function matchingTransaction(t:Transaction,p:Topup){
 const codes=[...new Set([...(String(t.transaction_content??"")+" "+String(t.code??"")).toUpperCase().matchAll(/(?:^|[^A-Z0-9])(PHN[A-F0-9]{20})(?![A-Z0-9])/g)].map(m=>m[1]))];
 if(!codes.includes(p.code))return "IGNORE";
 const rawDate=String(t.transaction_date),time=Date.parse(/Z$|[+-]\d\d:\d\d$/.test(rawDate)?rawDate:rawDate.replace(" ","T")+"+07:00");
 if(!UUID.test(String(t.id))||t.bank_account_id!==p.bank_id||t.account_number!==p.account_number||t.transfer_type!=="in"||t.amount_out!==0||!Number.isSafeInteger(t.amount_in)||t.amount_in<=0)return "IGNORE";
 if(codes.length!==1||t.amount_in!==p.amount||!Number.isFinite(time)||time<p.created-5000||time>p.expires)return "REVIEW";
 return "MATCH";
}
async function checkTopup(db:D1Database,key:string,p:Topup){
 if(p.status!=="PENDING")return {message:p.status==="CREDITED"?"Tiền đã được cộng vào ví.":"Yêu cầu này cần quản trị viên đối soát.",credited:0};
 if(Date.now()-p.checked<15000)return {message:"Chưa đến lượt kiểm tra tiếp theo. Thử lại sau vài giây.",credited:0};
 const c=await config(db,key);if(!c.enabled)return {message:"SePay đang tắt, chưa đối soát.",credited:0};
 if(c.bankId!==p.bank_id||c.accountNumber!==p.account_number)throw new ShopError("Ngân hàng đã thay đổi. Cần quản trị viên đối soát.",409);
 await sql(db,"UPDATE topups SET checked=? WHERE id=?",Date.now(),p.id).run();
 const params=new URLSearchParams({q:p.code,bank_account_id:p.bank_id,transfer_type:"in",per_page:"100",timestamp_format:"iso8601"});
 const transactions=await sepay<Transaction[]>("/transactions?"+params,c.token);if(!Array.isArray(transactions))throw new ShopError("Danh sách giao dịch SePay không hợp lệ.",503);
 const matches=transactions.filter(t=>matchingTransaction(t,p)==="MATCH"),review=transactions.some(t=>matchingTransaction(t,p)==="REVIEW");
 if(matches.length>1||review){await sql(db,"UPDATE topups SET status='REVIEW',note=? WHERE id=? AND status='PENDING'","Giao dịch có mã nạp nhưng số tiền/thời gian không khớp, hoặc có nhiều giao dịch. Chưa cộng tiền.",p.id).run();return {message:"Cần quản trị viên kiểm tra giao dịch; chưa cộng tiền.",credited:0};}
 if(!matches.length){if(p.expires<Date.now())await sql(db,"UPDATE topups SET status='REVIEW',note=? WHERE id=? AND status='PENDING'","Mã nạp đã quá 24 giờ. Chuyển khoản muộn cần đối soát.",p.id).run();return {message:"Chưa tìm thấy giao dịch đúng mã và số tiền.",credited:0};}
 const tx=matches[0],guard=crypto.randomUUID(),reference="sepay:"+tx.id;
 if(await sql(db,"SELECT id FROM wallet_entries WHERE reference=?",reference).first())return {message:"Giao dịch đã được xử lý, không cộng lại.",credited:0};
 await db.batch([sql(db,"INSERT INTO transaction_guards(id,valid) SELECT ?,CASE WHEN (SELECT status FROM topups WHERE id=?)='PENDING' AND NOT EXISTS(SELECT 1 FROM wallet_entries WHERE reference=?) THEN 1 ELSE 0 END",guard,p.id,reference),sql(db,"INSERT INTO wallet_entries(id,customer_id,amount,kind,reference,created) VALUES(?,?,?,'TOPUP',?,?)",crypto.randomUUID(),p.customer_id,p.amount,reference,Date.now()),sql(db,"UPDATE topups SET status='CREDITED',transaction_id=?,credited=?,note='' WHERE id=?",tx.id,Date.now(),p.id),sql(db,"INSERT INTO notifications(id,customer_id,message,created,dedupe) VALUES(?,?,?,?,?)",crypto.randomUUID(),p.customer_id,`Đã cộng ${p.amount.toLocaleString("vi-VN")}đ vào ví từ mã ${p.code}.`,Date.now(),reference),sql(db,"DELETE FROM transaction_guards WHERE id=?",guard)]);
 return {message:"Đã xác nhận SePay và cộng tiền vào ví.",credited:1};
}
export async function syncSePay(db:D1Database,key:string){
 const c=await config(db,key);if(!c.enabled)return {credited:0,reviewed:0};
 return paymentLock(db,async()=>{const rows=(await sql(db,"SELECT * FROM topups WHERE status='PENDING' AND checked<? ORDER BY checked,created LIMIT 5",Date.now()-15000).all<Topup>()).results;let credited=0;for(const p of rows){credited+=(await checkTopup(db,key,p)).credited;await new Promise(resolve=>setTimeout(resolve,400));}return {credited,reviewed:rows.length};});
}
export function walletDebit(db:D1Database,order:{id:string;customer_id:string;total:number}){
 const guard=crypto.randomUUID();return [sql(db,"INSERT INTO transaction_guards(id,valid) SELECT ?,CASE WHEN (SELECT COALESCE(SUM(amount),0) FROM wallet_entries WHERE customer_id=?)>=? AND NOT EXISTS(SELECT 1 FROM wallet_entries WHERE reference=?) THEN 1 ELSE 0 END",guard,order.customer_id,order.total,"order:"+order.id),sql(db,"INSERT INTO wallet_entries(id,customer_id,amount,kind,reference,created) VALUES(?,?,?,'PURCHASE',?,?)",crypto.randomUUID(),order.customer_id,-order.total,"order:"+order.id,Date.now()),sql(db,"DELETE FROM transaction_guards WHERE id=?",guard)];
}

