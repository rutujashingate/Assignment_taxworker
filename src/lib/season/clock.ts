import 'server-only';
import { pool } from '../db/client';
import { DEFAULT_AS_OF } from '../packet/schema';

// One supplied engagement; this shared clock is source availability, never the
// actual timestamp of a human action. No source rows are changed by replay.
export async function readClock(clientId='CL-20417',taxYear=2025) {
  const {rows}=await pool.query('SELECT as_of, revision FROM season_clock WHERE client_id=$1 AND tax_year=$2',[clientId,taxYear]);
  return {asOf:rows[0]?.as_of.toISOString().replace(".000Z","Z")??DEFAULT_AS_OF,revision:Number(rows[0]?.revision??0)};
}
