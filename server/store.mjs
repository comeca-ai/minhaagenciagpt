import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash, randomBytes} from 'node:crypto';

import {validWorkspace} from './workspace-validation.mjs';
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
    read(){const row=db.prepare('SELECT payload,revision FROM workspace WHERE id=1').get();return {state:row.payload?JSON.parse(row.payload):null,revision:row.revision}},
    write(state,revision){if(!validWorkspace(state)||!Number.isInteger(revision)||revision<0)throw new Error('invalid workspace');return db.prepare('UPDATE workspace SET payload=?,revision=revision+1 WHERE id=1 AND revision=? RETURNING revision').get(JSON.stringify(state),revision)?.revision??null},
    createSession(){const token=randomBytes(32).toString('base64url'),expires=Date.now()+8*60*60*1000;db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO sessions(digest,expires) VALUES(?,?)').run(digest(token),expires);return token},
    hasSession(token){if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;return !!db.prepare('SELECT 1 FROM sessions WHERE digest=? AND expires>?').get(digest(token),Date.now())},
    deleteSession(token){db.prepare('DELETE FROM sessions WHERE digest=?').run(digest(token))},
    close(){db.close()}
  };
}
