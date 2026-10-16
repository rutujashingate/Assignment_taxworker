import 'server-only';
import { access,readFile } from 'node:fs/promises';
import { basename,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { db } from '../db/client';
import { auditEvents,type Actor } from '../db/schema';
import { assertStaff,authorizeEngagement,HttpError } from '../auth/permissions';
import { DELIVERY_ARTIFACTS } from './catalog';

async function authorize(actor:Actor){assertStaff(actor);await authorizeEngagement(actor,'CL-20417',2025);}
export async function listArtifacts(actor:Actor) {
  await authorize(actor);
  return Promise.all(Object.entries(DELIVERY_ARTIFACTS).map(async([id,item])=>{
    let available=true;try{await access(resolve(item.path));}catch{available=false;}
    return {id,title:item.title,type:item.type,available};
  }));
}
export async function downloadArtifact(actor:Actor,id:string) {
  await authorize(actor);
  if(!Object.hasOwn(DELIVERY_ARTIFACTS,id))throw new HttpError(404,'Submission artifact not found.');
  const item=DELIVERY_ARTIFACTS[id];let bytes:Buffer;
  try{bytes=await readFile(resolve(item.path));}catch{throw new HttpError(503,'This artifact has not been generated yet.');}
  const sha256=createHash('sha256').update(bytes).digest('hex');
  await db.insert(auditEvents).values({actorId:actor.id,clientId:'CL-20417',taxYear:2025,action:'handoff_artifact_downloaded',target:id,beforeJson:null,afterJson:{sha256,bytes:bytes.length}});
  return {bytes,sha256,type:item.type,filename:basename(item.path)};
}
