/**
 * wordList.ts — Word API
 *
 * Fetches words from the Go backend REST endpoints.
 * Falls back to local list if the backend is unreachable.
 *
 *   GET  /api/words/random   → { word: string }
 *   GET  /api/words/list     → { words: string[] }
 *   POST /api/words/validate → { valid: boolean }
 */

const API = import.meta.env.VITE_API_URL ?? '';

// ─── Small emergency fallback (used only if backend is unreachable) ───────────
const FALLBACK_WORDS = [
  'about','above','abuse','actor','acute','admit','adopt','adult','after','again',
  'agent','agree','ahead','alarm','album','alert','alike','align','alive','alley',
  'allow','alone','along','alter','angel','anger','angle','angry','ankle','apple',
  'apply','arena','argue','arise','armor','arrow','aside','asset','audio','avoid',
  'awake','aware','awful','azure','badge','badly','baker','basic','basis','batch',
  'beach','begin','being','below','bench','berry','birth','black','blade','bland',
  'blast','blaze','bleak','blend','bless','blind','block','blood','board','boost',
  'bound','brain','brand','brave','break','brick','brief','bring','broad','broke',
  'brown','build','burst','candy','carry','cause','chain','chair','chaos','charm',
  'chase','check','chess','chest','chief','child','chill','claim','class','clean',
  'clear','click','cliff','climb','clock','close','cloud','coach','coast','color',
  'cover','craft','crane','crash','crazy','cream','crime','crisp','cross','crowd',
  'crown','crush','curve','cycle','daily','dance','debut','decay','delta','demon',
  'dense','depth','devil','digit','dirty','dodge','doubt','draft','drain','drama',
  'dream','dress','drift','drink','drive','drown','eagle','early','earth','eight',
  'elite','empty','enemy','enjoy','enter','equal','error','essay','event','every',
  'exact','exist','extra','faith','false','fancy','fatal','fault','feast','fence',
  'fever','field','fifth','fifty','fight','final','first','fixed','flame','flash',
  'fleet','flesh','float','flood','floor','flour','focus','force','forge','forth',
  'forum','found','frame','frank','fresh','front','frost','fruit','fully','funny',
  'giant','given','glass','globe','going','grace','grade','grain','grand','grant',
  'grape','grasp','grass','grave','great','greed','green','grief','grind','group',
  'guard','guest','guide','guilt','habit','happy','harsh','heart','heavy','honor',
  'horse','hotel','house','human','hurry','ideal','image','inner','input','issue',
  'jewel','joint','judge','juice','jumbo','knife','knock','known','label','large',
  'later','laugh','layer','learn','lease','leave','legal','lemon','level','light',
  'limit','liver','local','logic','loose','lover','lower','lucky','lunch','magic',
  'major','maker','manor','maple','march','match','mayor','media','merge','mercy',
  'merit','metal','might','minor','minus','model','money','month','moral','motor',
  'mount','mouse','mouth','music','nerve','never','night','noble','noise','north',
  'noted','novel','nurse','ocean','offer','often','order','other','owner','paint',
  'panic','paper','party','pause','peace','pearl','penny','phase','phone','photo',
  'pilot','pitch','pixel','pizza','place','plain','plane','plant','plate','plaza',
  'point','poker','polar','power','press','price','pride','prime','print','prize',
  'probe','proof','prose','proud','prove','pulse','punch','pupil','purse','quest',
  'quick','quiet','quota','quote','radar','radio','raise','rally','ranch','range',
  'rapid','ratio','reach','ready','realm','rebel','refer','relax','reset','rider',
  'rifle','right','risky','rival','river','robot','rocky','rough','round','route',
  'royal','ruler','rural','rusty','saint','salad','sauce','scale','scene','scope',
  'score','scout','serve','setup','seven','shade','shake','shall','shame','shape',
  'share','shark','sharp','shelf','shell','shift','shine','shirt','shock','shore',
  'short','shout','skill','slate','sleep','slice','slide','slope','smart','smell',
  'smile','smoke','snake','solar','solid','solve','sorry','sound','south','space',
  'speak','speed','spell','spend','spice','spine','spite','split','sport','spray',
  'squad','stack','staff','stage','stamp','stand','stare','stark','start','state',
  'steam','steep','steer','stern','stick','still','stock','stone','store','storm',
  'story','strap','straw','study','style','sugar','sunny','super','surge','swamp',
  'swear','sweep','sweet','swift','sword','table','taste','tense','theme','thick',
  'thing','think','third','those','three','tiger','tight','timer','tired','title',
  'today','token','touch','tough','tower','toxic','trace','track','trade','trail',
  'train','trait','treat','trend','trial','tribe','trick','troop','truck','truly',
  'trust','truth','twice','twist','ultra','uncle','under','union','unite','unity',
  'until','upper','upset','urban','usual','utter','valid','value','valve','vapor',
  'vault','verse','video','viral','virus','visit','vista','vital','vivid','vocal',
  'voice','voter','waste','watch','water','weary','weave','weird','wheat','where',
  'which','while','white','whole','whose','wider','witch','woman','women','world',
  'worry','worse','worst','worth','would','wrath','write','wrong','yield','young',
  'youth','zebra','zesty',
];

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchRandomWord(): Promise<string> {
  try {
    const res = await fetch(`${API}/api/words/random`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { word: string };
    return data.word;
  } catch (err) {
    console.warn('[wordList] fetchRandomWord failed, using fallback:', err);
    return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
  }
}

export async function fetchWordList(): Promise<string[]> {
  try {
    const res = await fetch(`${API}/api/words/list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { words: string[] };
    return data.words.filter(w => w.length === 5);
  } catch (err) {
    console.warn('[wordList] fetchWordList failed, using fallback:', err);
    return FALLBACK_WORDS;
  }
}

export async function validateWord(word: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/words/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: word.toLowerCase() }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { valid: boolean };
    return data.valid;
  } catch (err) {
    console.warn('[wordList] validateWord failed, using fallback:', err);
    return FALLBACK_WORDS.includes(word.toLowerCase());
  }
}
