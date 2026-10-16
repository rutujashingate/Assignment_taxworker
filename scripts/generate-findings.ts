import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packetSchema,assertPacketCounts,PACKET_SHA256 } from '../src/lib/packet/schema';
import { buildFindingsReport,renderFindingsMarkdown } from '../src/lib/delivery/findings';

export async function generateFindings(args:string[]) {
  const pathIndex=args.indexOf('--packet');
  if(args.includes('--canonical')&&pathIndex>=0)throw new Error('Choose --canonical or --packet, not both.');
  const bytes=args.includes('--canonical')?execFileSync('git',['show','HEAD:data/okafor_lindqvist_2025_packet.json'],{maxBuffer:5*1024*1024}):await readFile(pathIndex>=0?args[pathIndex+1]:'data/okafor_lindqvist_2025_packet.json');
  const hash=createHash('sha256').update(bytes).digest('hex');if(hash!==PACKET_SHA256)throw new Error('Original packet SHA-256 mismatch; report not generated.');
  const packet=packetSchema.parse(JSON.parse(bytes.toString('utf8')));assertPacketCounts(packet);
  const report=buildFindingsReport(packet,hash);await mkdir('docs',{recursive:true});
  for(const [path,content] of [['docs/FINDINGS_REPORT.json',JSON.stringify(report,null,2)+'\n'],['docs/FINDINGS_REPORT.md',renderFindingsMarkdown(report)]]) {
    if(args.includes('--check')){if(await readFile(path,'utf8')!==content)throw new Error(`Generated report is stale: ${path}`);}else await writeFile(path,content);
  }
  console.log(`${args.includes('--check')?'Verified':'Generated'} deterministic findings; packet ${hash}; ${report.summary.findings} findings, ${report.summary.passingControls} control.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await generateFindings(process.argv.slice(2));
