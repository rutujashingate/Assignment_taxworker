import { importPacket } from "../src/lib/packet/import";
import { pool } from "../src/lib/db/client";

try { console.log(JSON.stringify(await importPacket())); }
finally { await pool.end(); }
