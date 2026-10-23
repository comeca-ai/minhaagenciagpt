import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {d1Store,workspaceResponse} from '../server/d1-workspace.mjs';

function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0000_curvy_mariko_yashida.sql','utf8'));
 const db={
  prepare(query){
   const statement=sql.prepare(query);
   return {bind(...args){
    assert.ok(args.every(v=>typeof v!=='string'||Buffer.byteLength(v)<2000000));
    return {all:async()=>({results:statement.all(...args)}),run:()=>({results:statement.all(...args)})};
   }};
  },
  async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>s.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}
 };
 const state={schema:1,areas:[],agents:[],steps:[],adjustments:[],history:[],studio:{version:1,people:[],projects:[],meetings:[],tasks:[],challenges:[{id:'challenge-stable',brief:'Uma matéria sobre IA',source:'voice'}]}};
 return {db,sql,state};
}
test('D1 keeps a draft ID across reads, isolates users and rejects stale writers atomically',async()=>{
 const {db,sql,state}=fixture(),a=d1Store(db,'owner'),b=d1Store(db,'other');
 assert.deepEqual(await a.read(),{revision:0,state:null});assert.equal(await a.write(state,0),1);
 assert.deepEqual(await b.read(),{revision:0,state:null});assert.equal((await a.read()).state.studio.challenges[0].id,'challenge-stable');
 const revised=structuredClone(state);revised.studio.challenges[0].brief='Versão atual';assert.equal(await a.write(revised,1),2);
 assert.equal(await a.write(state,1),null);assert.deepEqual(await a.read(),{revision:2,state:revised});
 assert.equal(await b.write(state,4),null);assert.equal(await b.write(state,0),1);assert.equal((await a.read()).revision,2);
 assert.equal(sql.prepare('SELECT COUNT(DISTINCT snapshot) AS n FROM workspace_chunks WHERE user_id=?').get('owner').n,1);sql.close();
});
test('D1 stores large portrait workspaces in bounded chunks without splitting Unicode',async()=>{
 const {db,sql,state}=fixture();state.studio.people=[{photo:'a'.repeat(1900000)}];state.studio.challenges[0].brief='coração ✳ 🧠 '.repeat(1800);
 state.unicode='x'.repeat(199998)+'🧠'.repeat(200000);
 const store=d1Store(db,'owner');assert.equal(await store.write(state,0),1);assert.deepEqual((await store.read()).state,state);
 assert.ok(sql.prepare('SELECT COUNT(*) AS n FROM workspace_chunks').get().n>10);sql.close();
});
test('D1 API requires identity, same origin, valid payload and a matching revision',async()=>{
 const {db,sql,state}=fixture();
 const request=(method='PUT',body={state,expectedRevision:0},origin='https://agency.test')=>new Request('https://agency.test/api/workspace',{method,headers:{origin,'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 assert.equal((await workspaceResponse(request(),{db})).status,401);
 assert.equal((await workspaceResponse(request('PUT',undefined,'https://evil.test'),{db,userId:'owner'})).status,403);
 assert.equal((await workspaceResponse(request('PUT',{state:{},expectedRevision:0}),{db,userId:'owner'})).status,400);
 assert.equal((await workspaceResponse(request(),{db,userId:'owner'})).status,200);
 assert.equal((await workspaceResponse(request(),{db,userId:'owner'})).status,409);
 const response=await workspaceResponse(request('GET'),{db,userId:'owner'});assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{state,revision:1});
 const duplicate=structuredClone(state);duplicate.studio.challenges.push(duplicate.studio.challenges[0]);assert.equal((await workspaceResponse(request('PUT',{state:duplicate,expectedRevision:1}),{db,userId:'owner'})).status,400);sql.close();
});
