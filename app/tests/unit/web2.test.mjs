import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';
import { visibleMessage, momentTimeline } from '../../src/product/chatModel.ts';
import { brandedEmojiCatalog, brandedEmojiInfoFromMessageBody } from '../../src/product/brandedEmojiCatalog.ts';
const message = (extra={}) => ({id:'m1',message_type:'text',body:'Привет',created_at:'2026-10-01T00:00:00Z',expires_at:null,deleted_for_everyone_at:null,...extra});
test('Moments use chronological real history; expired/deleted photos cannot reach timeline', () => {
  const rows=[message({id:'photo',message_type:'image',created_at:'2026-10-02'}),message({id:'voice',message_type:'voice'}),message({id:'expired',message_type:'moment',expires_at:'2026-09-01'}),message({id:'deleted',message_type:'image',deleted_for_everyone_at:'2026-10-01'})];
  assert.deepEqual(momentTimeline(rows,[{message_id:'photo',reaction_count:1}],Date.parse('2026-10-16')).map(e=>e.title),['Первый голос','Первая фотография','Первый отклик']);
  assert.equal(visibleMessage(rows[2],Date.parse('2026-10-16')),false);
  assert.equal(visibleMessage(rows[3]),false);
});
test('all nine canonical emoji resolve to their original assets and unknown keys never become images', () => {
  assert.equal(brandedEmojiCatalog.length,9);
  for(const emoji of brandedEmojiCatalog) {assert.equal(brandedEmojiInfoFromMessageBody(`emoji:${emoji.key}`)?.label,emoji.label);assert.ok(readFileSync(`public/brand/emojis/${emoji.key.slice(6)}.png`).length>0);}
  assert.equal(brandedEmojiInfoFromMessageBody('emoji:../../private'),null);
});
function chatFixture({consume={allowed:true,media_path:'opaque/issued'},insertError=null}={}) {
  const calls=[];
  const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:[consume],error:null};},storage:{from:bucket=>({upload:async(path,file,options)=>{calls.push(['upload',{bucket,path,options}]);return {error:null};},createSignedUrl:async(path,ttl)=>{calls.push(['sign',{bucket,path,ttl}]);return {data:{signedUrl:'https://private.test/signed'},error:null};}})},from:table=>({insert:async row=>{calls.push(['insert',{table,...row}]);return {error:insertError};}})};
  const source=ts.transpileModule(readFileSync('src/product/chat.ts','utf8').replace(/^import .*\r?\n/gm,'').replace(/^export \{.*\};?\r?\n/gm,''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(source,{exports,require:()=>({visibleMessage,momentTimeline}),requireSupabase:()=>client,visibleMessage,crypto,Date,Blob});
  return {api:exports,calls};
}
test('view-once consumes before signing and signs the server-returned path only',async()=>{
  const {api,calls}=chatFixture();await api.openPhoto(message({media_path:'untrusted/path',image_access_mode:'view_once'}),false);
  assert.deepEqual(calls.map(c=>c[0]),['consume_image_message','sign']);assert.equal(calls[1][1].path,'opaque/issued');assert.equal(calls[1][1].ttl,300);
});
test('denied, deleted and expired photos are never signed',async()=>{
  for(const row of [message({media_path:'p',image_access_mode:'view_once'}),message({media_path:'p',deleted_for_everyone_at:'2026-10-01'}),message({media_path:'p',expires_at:'2020-01-01'})]) {
    const {api,calls}=chatFixture({consume:{allowed:false,media_path:'p'}});await assert.rejects(api.openPhoto(row,false));assert.equal(calls.some(c=>c[0]==='sign'),false);
  }
});
test('photo retry reuses both immutable upload and idempotency key after ambiguous network failure',async()=>{
  const f=chatFixture({insertError:{code:'NETWORK'}});const pending=await f.api.uploadPhoto('conversation','owner',new Blob(['fixture'],{type:'image/png'}),'view_once');
  await assert.rejects(f.api.sendPhoto('conversation','owner',pending));await assert.rejects(f.api.sendPhoto('conversation','owner',pending));
  const uploads=f.calls.filter(c=>c[0]==='upload');const inserts=f.calls.filter(c=>c[0]==='insert');assert.equal(uploads.length,1);assert.equal(uploads[0][1].options.upsert,false);assert.equal(inserts[0][1].media_path,inserts[1][1].media_path);assert.equal(inserts[0][1].client_message_id,inserts[1][1].client_message_id);
});
test('unsupported and oversized photos fail before any Storage request',async()=>{
  const {api,calls}=chatFixture();await assert.rejects(api.uploadPhoto('c','u',new Blob(['x'],{type:'text/html'}),'persistent'));await assert.rejects(api.uploadPhoto('c','u',new Blob([new Uint8Array(5*1024*1024+1)],{type:'image/jpeg'}),'persistent'));assert.deepEqual(calls,[]);
});
test('product route source cannot restore old reveal or a chat recorder; legal source is intact separately',()=>{
  const routes=readFileSync('src/App.tsx','utf8');assert.match(routes,/path="audio-letters"/);assert.doesNotMatch(routes,/AudioLettersGate|VoicesPage|ResonancesPage/);
  const api=readFileSync('src/product/api.ts','utf8');assert.doesNotMatch(api,/respond_to_photo_resonance|get_voice_candidates_v4/);
  const chat=readFileSync('src/pages/product/ChatPage.tsx','utf8');assert.doesNotMatch(chat,/MediaRecorder|getUserMedia|sendCloudVoice|sendCloudVideo/);
});
