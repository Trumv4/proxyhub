import {ShopError} from "./proxy-rules";
export async function validateProductSku(db:D1Database,code:string,input:unknown,previous:string|null=null){
 if(input===undefined)return previous;
 if(typeof input!=="string")throw new ShopError("Mã sản phẩm không hợp lệ.");
 const sku=input.trim().toUpperCase();if(!sku)return null;
 if(!/^[A-Z0-9_-]{1,32}$/.test(sku))throw new ShopError("Mã sản phẩm gồm 1–32 ký tự chữ, số, _ hoặc -.");
 if(await db.prepare("SELECT code FROM products WHERE sku=? AND code<>?").bind(sku,code).first())throw new ShopError("Mã này đã thuộc sản phẩm khác.",409);
 return sku;
}
