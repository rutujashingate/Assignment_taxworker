import { execFileSync,spawn } from 'node:child_process';
import { mkdtemp,mkdir,readFile,writeFile,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { createHash } from 'node:crypto';
import { PACKET_SHA256 } from '../src/lib/packet/schema';

// Explicit alternate verification: preserve an unrelated working-copy edit;
// never relax the importer or silently normalize delivered source bytes.
const root=process.cwd(),temporary=await mkdtemp(join(tmpdir(),'miraflores-verification-'));
try {
  const bytes=execFileSync('git',['show','HEAD:data/okafor_lindqvist_2025_packet.json'],{maxBuffer:5*1024*1024});
  if(createHash('sha256').update(bytes).digest('hex')!==PACKET_SHA256)throw new Error('Committed source does not match the delivered SHA-256.');
  await mkdir(join(temporary,'data'));await writeFile(join(temporary,'data/okafor_lindqvist_2025_packet.json'),bytes);
  for(const entry of ['src','tests','scripts','db','docs','AI_USAGE.md','README.md','package.json','package-lock.json'])await symlink(join(root,entry),join(temporary,entry));
  const validateOnly=process.argv.includes('--validate-only');
  console.log(`${validateOnly?'Validating':'Testing current source with'} separately verified original bytes; working JSON is untouched.`);
  if(validateOnly){await mkdir(join(temporary,'validation'));await writeFile(join(temporary,'validation/validate_packet.py'),await readFile(resolve(root,'scripts/validate_packet.py')));}
  const child=spawn(validateOnly?'python3':resolve(root,'node_modules/.bin/vitest'),validateOnly?[join(temporary,'validation/validate_packet.py')]:['run','--config',resolve(root,'vitest.config.ts'),...process.argv.slice(2)],{cwd:temporary,stdio:'inherit',env:process.env});
  const code=await new Promise<number>((accept,reject)=>{child.once('error',reject);child.once('exit',value=>accept(value??1));});process.exitCode=code;
}finally{await rm(temporary,{recursive:true,force:true});}
