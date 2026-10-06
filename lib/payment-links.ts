import {bankApps} from "./bank-apps";
export type PaymentAccount={bank:string;number:string;holder:string};
export function bankIsActive(value:unknown){return value===true||value===1||value==="1"||value==="true";}
function validPayment(account:PaymentAccount,amount:number,code:string){return /^[a-zA-Z0-9]{1,19}$/.test(account.number)&&/^[a-zA-Z0-9]{2,30}$/.test(account.bank)&&Number.isSafeInteger(amount)&&amount>=1000&&amount<=100000000&&/^PHN[A-F0-9]{20}$/.test(code);}
export function paymentQr(account:PaymentAccount,amount:number,code:string,download=false){
 if(!validPayment(account,amount,code))return null;
 const params=new URLSearchParams({acc:account.number,bank:account.bank,amount:String(amount),des:code,template:"compact",holder:account.holder,showinfo:"true",fullacc:"true",store:"ProxyHub"});
 if(download)params.set("download","true");return "https://vietqr.app/img?"+params;
}
export function bankAppLink(appId:string,account:PaymentAccount,amount:number,code:string){
 if(!bankApps.some(app=>app.id===appId)||!validPayment(account,amount,code))return null;
 return "https://dl.vietqr.io/pay?"+new URLSearchParams({app:appId,ba:account.number+"@"+account.bank,am:String(amount),tn:code,bn:account.holder});
}
