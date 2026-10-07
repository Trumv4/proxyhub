import {ShopError} from "./proxy-rules";
export function announcementImage(input:unknown){
 if(input==null||input==="")return "";
 if(typeof input!=="string"||input.length>250000)throw new ShopError("Ảnh quá lớn hoặc không hợp lệ.");
 const match=input.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw new ShopError("Chọn ảnh JPG, PNG hoặc WebP.");
 let raw:string;try{raw=atob(match[2]);}catch{throw new ShopError("Ảnh không hợp lệ.");}
 const valid=match[1]==="jpeg"?raw.startsWith("\xff\xd8\xff"):match[1]==="png"?raw.startsWith("\x89PNG\r\n\x1a\n"):raw.startsWith("RIFF")&&raw.slice(8,12)==="WEBP";
 if(!valid)throw new ShopError("Nội dung ảnh không đúng định dạng.");return input;
}
