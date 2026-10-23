import test from 'node:test';
import assert from 'node:assert/strict';
import {transcribe,voiceConfig,MAX_AUDIO_BYTES} from '../server/transcribe.mjs';
const request=(body=new Uint8Array([1,2,3]),headers={})=>new Request('https://agency.example/api/transcribe',{method:'POST',headers:{Origin:'https://agency.example','Content-Type':'audio/webm;codecs=opus',...headers},body});
const opts={key:'test-only',authorized:true,rateLimit:false};
test('requires authentication, origin, configured key and audio',async()=>{
 let calls=0;const fetcher=()=>{calls++;throw Error('must not call')};
 for(const [r,overrides,status]of [[request(),{authorized:false},401],[request(new Uint8Array([1]),{Origin:'https://other.example'}),{},403],[request(),{key:''},503],[request('{}',{'Content-Type':'application/json'}),{},415],[request(new Uint8Array()),{},400],[request(new Uint8Array(MAX_AUDIO_BYTES+1)),{},413]])assert.equal((await transcribe(r,{...opts,fetcher,...overrides})).status,status);
 assert.equal(calls,0);
});
test('Portuguese transcript only; server key sent only to Deepgram',async()=>{
 const response=await transcribe(request(),{...opts,fetcher:async(url,config)=>{assert.match(url,/^https:\/\/api.deepgram.com\/v1\/listen\?/);assert.match(url,/language=pt-BR/);assert.match(url,/model=nova-3/);assert.equal(config.headers.Authorization,'Token test-only');return Response.json({results:{channels:[{alternatives:[{transcript:'Quero uma matéria sobre inteligência artificial.'}]}]},secret:'never return provider body'})}});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{transcript:'Quero uma matéria sobre inteligência artificial.',language:'pt-BR'});assert.equal(response.headers.get('cache-control'),'no-store');
});
test('provider errors and empty speech do not leak details',async()=>{
 for(const code of [401,403,402,429,500]){const r=await transcribe(request(),{...opts,fetcher:async()=>new Response('private provider detail',{status:code})});assert.notEqual(r.status,200);assert.doesNotMatch(await r.text(),/private provider detail|test-only/)}
 assert.equal((await transcribe(request(),{...opts,fetcher:async()=>Response.json({results:{channels:[{alternatives:[{transcript:''}]}]}})})).status,422);
 assert.equal((await transcribe(request(),{...opts,fetcher:async()=>{throw Error('test-only')}})).status,502);
});
test('repeated requests are limited per identity',async()=>{
 const options={...opts,rateLimit:true,identity:'test-rate',fetcher:async()=>Response.json({results:{channels:[{alternatives:[{transcript:'pedido'}]}]}})};
 for(let i=0;i<5;i++)assert.equal((await transcribe(request(),options)).status,200);
 assert.equal((await transcribe(request(),options)).status,429);
});

test('hosted configuration is authenticated and reveals availability only',async()=>{assert.equal(voiceConfig({authorized:false,key:'private-key'}).status,401);const r=voiceConfig({authorized:true,key:'private-key'});assert.deepEqual(await r.json(),{available:true,maxSeconds:600,maxBytes:25000000});assert.equal((await voiceConfig({authorized:true,key:''}).json()).available,false)});
