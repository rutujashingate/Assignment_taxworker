import { readFile,writeFile } from 'node:fs/promises';
import { COVERAGE } from '../src/lib/records/coverage';
import { renderRequirementsAudit } from '../src/lib/delivery/requirements';
const path='docs/REQUIREMENTS_AUDIT.md',content=renderRequirementsAudit(COVERAGE);
if(process.argv.includes('--check')){if(await readFile(path,'utf8')!==content)throw new Error('Requirements audit is stale. Run npm run audit:generate.');}else await writeFile(path,content);
console.log(`Requirements audit ${process.argv.includes('--check')?'verified':'generated'}: ${COVERAGE.length} mapped requirements.`);
