import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../js/demo.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const config=JSON.parse(html.match(/<script id="demo-config" type="application\/json">(.*?)<\/script>/s)[1]);
class Element {
  constructor(id=''){this.id=id;this.hidden=false;this.disabled=false;this.textContent='';this.dataset={};this.children=[];this.events={};const set=new Set();this.classList={add:c=>set.add(c),remove:c=>set.delete(c),contains:c=>set.has(c)};}
  addEventListener(name,fn){(this.events[name]??=[]).push(fn)}
  click(){if(!this.disabled)for(const fn of this.events.click??[])fn({target:this})}
  append(...children){this.children.push(...children)}
  replaceChildren(){this.children=[]}
  focus(){this.focused=true}
  setAttribute(key,value){this[key]=value}
}
function harness({speech = true} = {}){
  const ids=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
  const settings=JSON.parse(JSON.stringify(config));
  if(!speech) for(const animal of settings.animals) animal.speech=null;
  ids['demo-config'].textContent=JSON.stringify(settings);
  for(const id of ['quiz','quiz-game','quiz-finish','quiz-next'])ids[id].hidden=true;
  const cards=config.animals.map(a=>{const e=new Element();e.dataset.animal=a.slug;e.disabled=true;return e});
  const fallback=config.animals.map(()=>new Element());
  const document=new Element();document.getElementById=id=>ids[id];document.querySelectorAll=s=>s==='[data-animal]'?cards:fallback;document.createElement=()=>new Element();
  const window=new Element();let observer;window.IntersectionObserver=true;
  class Audio extends Element {constructor(){super();this.paused=true;this.history=[];Audio.instance=this} pause(){this.paused=true} play(){this.paused=false;this.history.push(this.src);return this.fail?Promise.reject(new Error('failed')):this.pending??Promise.resolve()}}
  vm.runInNewContext(source,{document,window,Audio,Intl,Math,IntersectionObserver:class{constructor(fn){observer=fn}observe(){}}});
  return {ids,cards,fallback,document,window,audio:Audio.instance,leave:()=>observer([{isIntersecting:false}])};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('six cards play only on interaction, reuse one audio, and stop on leaving/hiding',()=>{
  const h=harness();assert.equal(h.audio.history.length,0);assert.ok(h.fallback.every(a=>a.hidden));
  for(const [i,card] of h.cards.entries()){card.click();assert.equal(h.audio.src,config.animals[i].speech);assert.equal(h.cards.filter(c=>c.classList.contains('playing')).length,1)}
  h.cards[5].click();assert.ok(h.audio.paused);assert.equal(h.cards[5]['aria-pressed'],'false');
  h.cards[0].click();h.leave();assert.ok(h.audio.paused);
  h.cards[0].click();h.document.hidden=true;h.document.events.visibilitychange[0]();assert.ok(h.audio.paused);
  h.cards[0].click();h.window.events.pagehide[0]();assert.ok(h.audio.paused);
});
test('three distinct rounds, retry, replay, explicit next, finish and restart',()=>{
  const h=harness();h.ids['quiz-start'].click();const targets=[];
  for(let r=0;r<3;r++){
    assert.equal(h.ids['quiz-progress'].textContent,`Round ${r+1} of 3`);
    const target=h.audio.src.split('/').pop().replace('.mp3','');targets.push(target);
    const choices=h.ids['quiz-choices'].children;assert.equal(choices.length,3);assert.equal(new Set(choices.map(c=>c.dataset.choice)).size,3);
    choices.find(c=>c.dataset.choice!==target).click();assert.equal(h.ids['quiz-feedback'].textContent,config.strings.retry);assert.ok(h.ids['quiz-next'].hidden);
    const count=h.audio.history.length;h.ids['quiz-replay'].click();assert.equal(h.audio.history.length,count+1);
    choices.find(c=>c.dataset.choice===target).click();assert.equal(h.ids['quiz-feedback'].textContent,config.strings.correct);assert.ok(choices.every(c=>c.disabled));assert.ok(!h.ids['quiz-next'].hidden);
    assert.ok(h.audio.paused);h.ids['quiz-next'].click();
  }
  assert.equal(new Set(targets).size,3);assert.ok(h.ids['quiz-game'].hidden);assert.ok(!h.ids['quiz-finish'].hidden);
  h.ids['quiz-restart'].click();assert.equal(h.ids['quiz-progress'].textContent,'Round 1 of 3');assert.ok(h.ids['quiz-finish'].hidden);
});
test('audio failure is recoverable and stale aborted requests do not report errors',async()=>{
  const h=harness({speech:false});h.audio.fail=true;h.cards[0].click();await tick();assert.equal(h.ids['audio-status'].textContent,config.strings.audioError);
  h.audio.fail=false;h.cards[0].click();await tick();assert.equal(h.ids['audio-status'].textContent,'');
  h.cards[0].click();
  let reject;h.audio.pending=new Promise((_,r)=>reject=r);h.cards[0].click();h.audio.pending=null;h.cards[1].click();reject(new Error('interrupted'));await tick();
  assert.equal(h.ids['audio-status'].textContent,'');assert.ok(h.cards[1].classList.contains('playing'));
});

test('name precedes sound; a second tap stops either phase and resets the toggle',async()=>{
  const h=harness();const card=h.cards[0];
  card.click();assert.equal(h.audio.src,config.animals[0].speech);assert.equal(card['aria-pressed'],'true');
  h.audio.events.ended[0]();assert.equal(h.audio.src,config.animals[0].sound);assert.ok(card.classList.contains('playing'));
  card.click();assert.ok(h.audio.paused);assert.equal(card['aria-pressed'],'false');
  card.click();card.click();const count=h.audio.history.length;
  h.audio.events.ended[0]();assert.equal(h.audio.history.length,count);assert.ok(h.audio.paused);
  card.click();h.audio.events.ended[0]();h.audio.events.ended[0]();assert.equal(card['aria-pressed'],'false');
});
test('locales without speech play sound directly and unavailable speech falls back',async()=>{
  const plain=harness({speech:false});plain.cards[0].click();assert.equal(plain.audio.src,config.animals[0].sound);
  const h=harness();let reject;h.audio.pending=new Promise((_,r)=>reject=r);
  h.cards[0].click();h.audio.pending=null;reject(new Error('name missing'));await tick();
  assert.equal(h.audio.src,config.animals[0].sound);assert.equal(h.ids['audio-status'].textContent,'');
});
test('switching cards cancels the previous spoken-name sequence',()=>{
  const h=harness();h.cards[0].click();h.cards[1].click();h.audio.events.ended[0]();
  assert.equal(h.audio.src,config.animals[1].sound);assert.equal(h.cards[0]['aria-pressed'],'false');
});
