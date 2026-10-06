export function moneyDraft(text:string){if(!/^[\d.]*$/.test(text))return null;return text.replaceAll(".","").replace(/^0+(?=\d)/,"");}
export function moneyValue(text:string){const digits=moneyDraft(text);return digits===null||digits===""?null:Number(digits);}
export function moneyDisplay(text:string){const value=moneyValue(text);return value===null?"":value.toLocaleString("vi-VN");}
