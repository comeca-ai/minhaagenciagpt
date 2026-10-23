// Separate, server-owned accounting. Workspace imports cannot reset this ledger.
export const AI_SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_control (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ai_runs_owner ON ai_runs(owner);`;

export function aiStore(sql) {
  return {
    async control() {
      const row = await sql.one('SELECT revision,payload FROM ai_control WHERE id=?', ['pilot']);
      return row ? {revision:row.revision, value:JSON.parse(row.payload)} : {revision:0,value:null};
    },
    async commit(value, revision) {
      const payload=JSON.stringify(value);
      const row=revision===0
        ?await sql.one('INSERT INTO ai_control(id,revision,payload) VALUES(?,1,?) ON CONFLICT(id) DO NOTHING RETURNING revision',['pilot',payload])
        :await sql.one('UPDATE ai_control SET revision=revision+1,payload=? WHERE id=? AND revision=? RETURNING revision',[payload,'pilot',revision]);
      return !!row;
    },
    async saveRun(run) {
      const payload=JSON.stringify(run);
      if(new TextEncoder().encode(payload).length>900000)throw new Error('Run record too large');
      await sql.exec('INSERT INTO ai_runs(id,owner,payload) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE ai_runs.owner=excluded.owner',[run.id,run.owner,payload]);
    },
    async run(id,owner) {
      const row=await sql.one('SELECT payload FROM ai_runs WHERE id=? AND owner=?',[id,owner]);
      return row?JSON.parse(row.payload):null;
    },
    async runs(owner) {
      const rows=await sql.all('SELECT payload FROM ai_runs WHERE owner=?',[owner]);
      return rows.map(r=>JSON.parse(r.payload)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    }
  };
}

export function d1AIStore(db) {
  return aiStore({
    one:(q,p)=>db.prepare(q).bind(...p).first(),
    exec:(q,p)=>db.prepare(q).bind(...p).run(),
    all:async(q,p)=>(await db.prepare(q).bind(...p).all()).results
  });
}

export function sqliteAIStore(db) {
  db.exec(AI_SCHEMA);
  return aiStore({one:(q,p)=>db.prepare(q).get(...p),exec:(q,p)=>db.prepare(q).run(...p),all:(q,p)=>db.prepare(q).all(...p)});
}
