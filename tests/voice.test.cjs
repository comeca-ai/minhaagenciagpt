const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const tick=()=>new Promise(r=>setImmediate(r));
function harness({name='brief',initial='Texto anterior',server=true,permissionError=false}={}){
 const listeners=new Map(),events=[],counts={stops:0,uploads:0,permissions:0};
 const element=()=>({hidden:false,value:'',textContent:'',disabled:false,addEventListener(type,fn){if(!this.events)this.events={};this.events[type]=fn},focus(){}});
 const start=element(),cancel=element(),status=element(),review=element(),draft=element(),apply=element(),discard=element();review.hidden=true;review.querySelector=()=>draft;
 const selectors={'.voice-start':start,'.voice-cancel':cancel,'.voice-status':status,'.voice-review':review,'.voice-apply':apply,'.voice-discard':discard};const box={querySelector:s=>selectors[s]};
 const dialog={addEventListener:(type,fn)=>listeners.set(type,fn)};
 const field={name,value:initial,maxLength:5000,dataset:{},isConnected:true,closest:()=>({insertAdjacentElement(){}}),dispatchEvent:e=>events.push(e.type),focus(){}};
 const form={querySelectorAll:()=>[field],closest:()=>dialog,addEventListener(){}};
 class Recorder{static isTypeSupported(t){return t.startsWith('audio/webm')}constructor(){this.events={};this.state='inactive'}addEventListener(t,f){this.events[t]=f}start(){this.state='recording'}stop(){this.state='inactive';this.events.dataavailable({data:new Blob(['audio'])});this.events.stop()}}
 const context={window:{JHONEME_SERVER:server,isSecureContext:true,MediaRecorder:Recorder,addEventListener(){}},MediaRecorder:Recorder,navigator:{mediaDevices:{getUserMedia:async()=>{counts.permissions++;if(permissionError)throw Object.assign(Error('denied'),{name:'NotAllowedError'});return {getTracks:()=>[{stop(){counts.stops++}}]}}}},document:{createElement:()=>box},fetch:async path=>{if(path==='/api/voice-config')return {ok:true,json:async()=>({available:true})};counts.uploads++;return {ok:true,json:async()=>({transcript:'Nova orientação.'})}},Blob,Event,CustomEvent,AbortController,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/voice.js','utf8'),context);context.window.JhonemeVoice.mount(form);return {context,start,cancel,status,review,draft,apply,field,events,counts,close:()=>listeners.get('close')()};
}
test('recording stops microphone and appends approved text without overwriting',async()=>{const h=harness();h.start.events.click();await tick();assert.equal(h.counts.permissions,1);assert.equal(h.counts.uploads,0);h.start.events.click();await tick();assert.equal(h.counts.uploads,1);assert.ok(h.counts.stops>0);assert.equal(h.field.value,'Texto anterior');assert.equal(h.review.hidden,false);h.apply.events.click();assert.equal(h.field.value,'Texto anterior\n\nNova orientação.');assert.ok(h.events.includes('input'))});
test('closing the dialog cancels recording without uploading audio',async()=>{const h=harness();h.start.events.click();await tick();h.close();await tick();assert.equal(h.counts.uploads,0);assert.ok(h.counts.stops>0)});
test('reception audio moves to request review without an extra transcript confirmation',async()=>{const h=harness({name:'intake',initial:''});h.start.events.click();await tick();h.start.events.click();await tick();assert.equal(h.field.value,'Nova orientação.');assert.ok(h.events.includes('voice:ready'));assert.equal(h.review.hidden,true)});
test('preview and denied microphone explain the limitation without uploads',async()=>{const preview=harness({server:false});preview.start.events.click();await tick();assert.equal(preview.counts.permissions,0);assert.match(preview.status.textContent,/VPS/);const denied=harness({permissionError:true});denied.start.events.click();await tick();assert.equal(denied.counts.uploads,0);assert.match(denied.status.textContent,/Permita o microfone/)});
