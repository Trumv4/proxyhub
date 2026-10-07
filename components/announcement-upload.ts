export async function prepareAnnouncementImage(file:File):Promise<string>{
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>10*1024*1024)throw new Error("Chọn ảnh JPG, PNG hoặc WebP tối đa 10 MB.");
 const url=URL.createObjectURL(file);try{
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("Không đọc được ảnh."));image.src=url;});
  if(!img.naturalWidth||!img.naturalHeight)throw new Error("Ảnh không hợp lệ.");
  const canvas=document.createElement("canvas"),scale=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Trình duyệt chưa hỗ trợ xử lý ảnh.");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  for(const quality of [.85,.7,.55,.4]){const result=canvas.toDataURL("image/jpeg",quality);if(result.length<=250000)return result;}
  throw new Error("Ảnh còn quá lớn sau khi thu nhỏ. Chọn ảnh đơn giản hơn hoặc cắt bớt ảnh.");
 }finally{URL.revokeObjectURL(url);}
}
