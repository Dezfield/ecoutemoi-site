import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';
const source=ts.transpileModule(readFileSync('src/auth/broker.ts','utf8').replace(/^import .*\r?\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture({owner='same-mobile-user',enabled=true,url='https://accounts.google.com/o/oauth2/v2/auth'}={}) {
 const storage=new Map(),calls=[],navigation=[];let current=owner;
 const client={functions:{invoke:async(name,{body})=>{calls.push([name,body]);return {data:body.action==='capabilities'?{web:{apple:enabled,google:enabled,vk:enabled}}:body.action==='start'?{authorizationUrl:url}:body.action==='finalize_link'?{linked:true}:{tokenHash:'one-time-hash'},error:null};}},auth:{getUser:async()=>({data:{user:{id:current}}}),verifyOtp:async body=>{calls.push(['verifyOtp',body]);return {data:{session:{user:{id:current}}},error:null};}}};
 const exports={};vm.runInNewContext(source,{exports,requireSupabase:()=>client,config:{oauthProviders:['apple','google','vk']},rememberNextPath:path=>calls.push(['next',path]),crypto,TextEncoder,Date,URL,sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{location:{origin:'https://app.ecoutemoi.ru',assign:u=>navigation.push(u)}}});
 return {api:exports,calls,storage,navigation,setOwner:id=>{current=id;}};
}
test('browser OAuth uses a broker challenge and the exact callback, never standard Supabase OAuth',async()=>{
 const f=fixture();await f.api.startBroker('google','/chats');const start=f.calls.find(c=>c[1]?.action==='start')[1];assert.equal(start.returnUri,'https://app.ecoutemoi.ru/auth/broker/callback');assert.match(start.clientChallenge,/^[a-f0-9]{64}$/);assert.equal(f.navigation.length,1);
 await f.api.finishBroker('https://app.ecoutemoi.ru/auth/broker/callback?ticket='+'t'.repeat(43));const final=f.calls.find(c=>c[1]?.action==='finalize');assert.equal(final[0],'oauth-broker');assert.match(final[1].verifier,/^[a-f0-9]{64}$/);assert.equal(f.calls.filter(c=>c[0]==='verifyOtp').length,1);await assert.rejects(f.api.finishBroker('https://app.ecoutemoi.ru/auth/broker/callback?ticket='+'t'.repeat(43)));
});
test('unready provider never stores an attempt or navigates',async()=>{
 const f=fixture({enabled:false});await assert.rejects(f.api.startBroker('google','/profile'));assert.equal(f.storage.size,0);assert.equal(f.navigation.length,0);
});
test('foreign authorization origin is refused before navigating',async()=>{
 const f=fixture({url:'https://accounts.google.com.evil.test/auth'});await assert.rejects(f.api.startBroker('google','/profile'));assert.equal(f.navigation.length,0);assert.equal(f.storage.size,0);
});
test('linking cannot switch the signed-in account and never redeems a new session',async()=>{
 const f=fixture();await f.api.startBroker('google','/account/settings',true);f.setOwner('other-user');await assert.rejects(f.api.finishBroker('https://app.ecoutemoi.ru/auth/broker/callback?link_ticket='+'l'.repeat(43)));assert.equal(f.calls.filter(c=>c[1]?.action==='finalize_link').length,0);assert.equal(f.calls.filter(c=>c[0]==='verifyOtp').length,0);
});
test('successful link is finalized with the current JWT and issues no sign-in session',async()=>{
 const f=fixture();await f.api.startBroker('google','/account/settings',true);await f.api.finishBroker('https://app.ecoutemoi.ru/auth/broker/callback?link_ticket='+'l'.repeat(43));assert.equal(f.calls.filter(c=>c[1]?.action==='finalize_link').length,1);assert.equal(f.calls.filter(c=>c[0]==='verifyOtp').length,0);
});
test('expired and cancelled attempts consume their per-tab context without token exchange',async()=>{
 const f=fixture();await f.api.startBroker('google','/profile');const [key,value]=[...f.storage][0];f.storage.set(key,JSON.stringify({...JSON.parse(value),expires:1}));await assert.rejects(f.api.finishBroker('https://app.ecoutemoi.ru/auth/broker/callback?ticket='+'t'.repeat(43)));assert.equal(f.calls.filter(c=>c[1]?.action==='finalize').length,0);
});
