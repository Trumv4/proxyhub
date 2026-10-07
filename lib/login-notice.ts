export function markLoginNotice(storage:Pick<Storage,"getItem"|"setItem">,email:string,session:string){const key="proxyvip-notice-session:"+email;if(storage.getItem(key)===session)return false;storage.setItem(key,session);return true;}

