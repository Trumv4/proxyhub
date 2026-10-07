import type {ShopData} from "../components/shop-dashboard";

export function customerView(data:ShopData|null):ShopData|null{
 if(!data?.user)return data;
 const email=data.user.email.toLowerCase();
 return {...data,coupons:[],announcements:data.announcements?.filter(n=>n.active),seller:undefined,user:{...data.user,isAdmin:false,isSeller:false},wallet:data.wallet?{...data.wallet,adminTotals:null,adminDeposits:[],approvals:[],review:[],sepay:{...data.wallet.sepay,bankId:undefined,hasToken:undefined}}:undefined,inventory:[],digitalInventory:[],runs:[],orders:data.orders?.filter(o=>o.customer_email.toLowerCase()===email),history:data.history?.filter(w=>w.customer_email.toLowerCase()===email)};
}
