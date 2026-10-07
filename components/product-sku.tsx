"use client";
import {useEffect,useState} from "react";
import type {Shop} from "./shop-dashboard";
import {Input} from "./ui/input";
import {Button} from "./ui/button";
export function ProductSku({shop,code,onNotice}:{shop:Shop;code:string;onNotice:(s:string)=>void}){
 const current=shop.data?.products.find(p=>p.code===code)?.sku??"",[sku,setSku]=useState(current),[error,setError]=useState("");useEffect(()=>setSku(current),[current]);
 return <div className="product-sku"><label>Mã sản phẩm<Input aria-label={`Mã sản phẩm ${code}`} maxLength={32} value={sku} onChange={e=>setSku(e.target.value.toUpperCase())} placeholder="Ví dụ: 01, 02, TK01"/></label><Button size="sm" variant="outline" disabled={shop.busy||shop.preview||!sku.trim()||sku===current} onClick={async()=>{setError("");try{const r=await shop.action({action:"product-sku",code,sku});onNotice(r.message??"Đã lưu mã.");}catch(e){setError((e as Error).message);}}}>Lưu mã</Button>{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
