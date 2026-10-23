import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash, randomBytes} from 'node:crypto';

import {validWorkspace} from './workspace-validation.mjs';
import {sqliteAIStore} from './ai-store.mjs';
export {validWorkspace} from './workspace-validation.mjs';
export function openStore(path,authFingerprint=''){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
  const db=new DatabaseSync(path);
  if(path!==':memory:')chmodSync(path,0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT, revision INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO workspace(id,payload,revision) VALUES(1,NULL,0);
    CREATE TABLE IF NOT EXISTS sessions (digest TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  if(authFingerprint){
    const old=db.prepare('SELECT value FROM metadata WHERE key=?').get('auth');
    if(old?.value!==authFingerprint){db.exec('DELETE FROM sessions');db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)').run('auth',authFingerprint)}
  }
  const digest=token=>createHash('sha256').update(token||'').digest('hex');
  return {
    ai:sqliteAIStore(db),
    exportAI(){return {control:db.prepare('SELECT revision,payload FROM ai_control WHERE id=?').get('pilot')||null,runs:db.prepare('SELECT id,owner,payload FROM ai_runs').all()}},
    restoreAI(snapshot){
      if(!snapshot||!Array.isArray(snapshot.runs)||snapshot.runs.length>10)throw Error('Invalid AI backup');
      const c=snapshot.control,v=c?JSON.parse(c.payload):null;
      if(c&&(!Number.isInteger(c.revision)||c.revision<1||!Number.isInteger(v.limitMicros)||v.limitMicros<0||v.limitMicros>1000000||!Number.isInteger(v.initialMicros)||v.initialMicros<0||v.initialMicros>1000000||!Array.isArray(v.runs)||v.runs.length>10||!v.calls||typeof v.calls!=='object'||Array.isArray(v.calls)))throw Error('Invalid AI ledger');
      if(snapshot.runs.some(r=>typeof r.id!=='string'||typeof r.owner!=='string'||typeof r.payload!=='string'||r.payload.length>900000||JSON.parse(r.payload).id!==r.id))throw Error('Invalid AI runs');
      // Restoring an older workspace can never refund money or overwrite newer executions.
      if(db.prepare('SELECT 1 FROM ai_control LIMIT 1').get()||db.prepare('SELECT 1 FROM ai_runs LIMIT 1').get())return false;
      db.exec('BEGIN IMMEDIATE');
      try{if(c)db.prepare('INSERT INTO ai_control(id,revision,payload) VALUES(?,?,?)').run('pilot',c.revision,c.payload);for(const r of snapshot.runs)db.prepare('INSERT INTO ai_runs(id,owner,payload) VALUES(?,?,?)').run(r.id,r.owner,r.payload);db.exec('COMMIT');return true}catch(e){db.exec('ROLLBACK');throw e}
    },
    read(){const row=db.prepare('SELECT payload,revision FROM workspace WHERE id=1').get();return {state:row.payload?JSON.parse(row.payload):null,revision:row.revision}},
    write(state,revision){if(!validWorkspace(state)||!Number.isInteger(revision)||revision<0)throw new Error('invalid workspace');return db.prepare('UPDATE workspace SET payload=?,revision=revision+1 WHERE id=1 AND revision=? RETURNING revision').get(JSON.stringify(state),revision)?.revision??null},
    createSession(){const token=randomBytes(32).toString('base64url'),expires=Date.now()+8*60*60*1000;db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO sessions(digest,expires) VALUES(?,?)').run(digest(token),expires);return token},
    hasSession(token){if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;return !!db.prepare('SELECT 1 FROM sessions WHERE digest=? AND expires>?').get(digest(token),Date.now())},
    deleteSession(token){db.prepare('DELETE FROM sessions WHERE digest=?').run(digest(token))},
    close(){db.close()}
  };
}
