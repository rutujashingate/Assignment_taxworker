import { expect,test } from 'vitest';
import { existsSync,readFileSync } from 'node:fs';
import { COVERAGE } from '../src/lib/records/coverage';
import { AREAS } from '../src/lib/records/types';
test('coverage maps every original brief category and named CPA record to honest routes/tests or limitations',()=>{
  expect(new Set(COVERAGE.map(r=>r.category))).toEqual(new Set(['Evidence','Calculation','Change','Judgment','People','Filing & after','Firm','CPA records','Delivery']));expect(new Set(COVERAGE.map(r=>r.id)).size).toBe(COVERAGE.length);
  for(const area of AREAS)expect(COVERAGE.find(r=>r.id===`record-${area.id}`)).toMatchObject({status:'implemented',route:expect.stringContaining(`/records/${area.id}`),test:'tests/records.test.ts'});
  for(const row of COVERAGE){if(row.status==='implemented'||row.status==='simulation'){expect(row.route.startsWith('/')).toBe(true);expect(existsSync(row.test)).toBe(true);}if(row.status==='limitation')expect(row.detail.length).toBeGreaterThan(20);}
  for(const id of ['adjustments','verification','signoffs','what-if','filing','amendment','video'])expect(COVERAGE.find(r=>r.id===id)?.status).toBe('limitation');
  expect(readFileSync('AI_USAGE.md','utf8')).toContain('Codex');expect(COVERAGE.find(r=>r.id==='source-trace')?.status).toBe('simulation');
});
