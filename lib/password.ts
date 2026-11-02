import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')}
export function checkPassword(password:string,hash:string){const [salt,key]=hash.split(':');if(!salt||!key||!/^[a-f0-9]{128}$/.test(key))return false;return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'))}
