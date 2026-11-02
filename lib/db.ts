import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
type DB = {query<T = Record<string, unknown>>(sql:string, params?:unknown[]):Promise<{rows:T[]}>};
const shared=globalThis as unknown as {eventSignalDatabase?:Promise<DB>};
export function database():Promise<DB> {
  return shared.eventSignalDatabase ??= (async()=>{
    if(process.env.DATABASE_URL) return new Pool({connectionString:process.env.DATABASE_URL,max:1}) as unknown as DB;
    if(process.env.NODE_ENV==='production') throw new Error('DATABASE_URL required in production');
    const dir = path.resolve(process.env.EVENT_SIGNAL_DATA_DIR || '.private-data');
    await mkdir(dir,{recursive:true,mode:0o700});
    return new PGlite(path.join(dir,'postgres')) as unknown as DB;
  })();
}
export async function session(){
 const db=await database();
 if(db instanceof Pool){const client=await db.connect();return {db:client as unknown as DB,release:()=>client.release()};}
 return {db,release:()=>{}};
}
