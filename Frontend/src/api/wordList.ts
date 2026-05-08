/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           WORD LIST SERVICE — API SWAP POINT         ║
 * ║  Development: uses hardcoded 5-letter word list      ║
 * ║  Production : replace fetch fns below with real API  ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Backend endpoints (when ready):
 *   GET /api/words/random  → { word: string }
 *   GET /api/words/list    → { words: string[] }
 *   POST /api/words/valid  → { valid: boolean }
 */

// ─── Development Word List ───────────────────────────────────────────────────
export const DEV_WORD_LIST: string[] = [
  "about","above","abuse","actor","acute","admit","adopt","adult","after","again",
  "agent","agree","ahead","alarm","album","alert","alike","align","alive","alley",
  "allow","alone","along","alter","angel","anger","angle","angry","ankle","anvil",
  "apple","apply","arena","argue","arise","armor","arrow","aside","asset","atlas",
  "audio","audit","avail","avoid","awake","aware","awful","azure","badge","badly",
  "baker","basic","basil","basis","batch","beach","began","begin","being","below",
  "bench","berry","birth","black","blade","bland","blast","blaze","bleak","blend",
  "bless","blind","block","blood","blown","board","boost","bound","brain","brand",
  "brave","break","brick","brief","bring","broad","broke","brown","build","burst",
  "buyer","candy","cargo","carry","cause","cease","chain","chair","chaos","charm",
  "chase","cheap","check","cheek","chess","chest","chief","child","chill","civic",
  "civil","claim","class","clean","clear","clerk","click","cliff","climb","cling",
  "clock","close","cloud","coach","coast","color","comic","cover","craft","crane",
  "crash","crazy","cream","creek","crime","crisp","cross","crowd","crown","crush",
  "curve","cycle","daily","dairy","dance","datum","debut","decay","decor","delta",
  "demon","dense","depot","depth","devil","digit","dirty","disco","ditch","dizzy",
  "dodge","doubt","dough","draft","drain","drama","drank","drawn","dream","dress",
  "drift","drink","drive","drove","drown","drums","dwarf","eagle","early","earth",
  "eight","elite","empty","ended","enemy","enjoy","enter","entry","equal","error",
  "essay","event","every","exact","exist","extra","fable","faith","false","fancy",
  "fatal","fault","feast","fence","fetch","fever","field","fifth","fifty","fight",
  "final","first","fixed","flame","flare","flash","fleet","flesh","float","flood",
  "floor","flora","flour","focal","focus","force","forge","forth","forum","found",
  "frame","frank","fresh","front","frost","froze","fruit","fully","funny","giant",
  "given","gland","glass","glaze","glide","globe","gloom","gloss","glove","going",
  "grace","grade","grain","grand","grant","grape","grasp","grass","grave","great",
  "greed","green","greet","grief","grill","grind","groan","group","grove","grown",
  "guard","guest","guide","guild","guilt","gusto","habit","happy","harsh","heart",
  "heavy","hedge","hence","hobby","holly","honor","horse","hotel","house","human",
  "humid","hurry","hyper","ideal","image","imply","inbox","infer","inner","input",
  "intro","issue","ivory","jewel","joint","joker","jolly","judge","juice","juicy",
  "jumbo","kayak","kiosk","knife","knock","known","label","lance","large","laser",
  "later","laugh","layer","learn","lease","least","leave","legal","lemon","level",
  "light","limit","liner","liver","local","lodge","logic","loose","lover","lower",
  "lucky","lunar","lunch","lyric","magic","major","maker","manga","manor","maple",
  "march","match","maven","mayor","media","merge","mercy","merit","metal","might",
  "minor","minus","mirth","model","money","month","moral","motor","motto","mount",
  "mouse","mouth","moved","music","naval","nerve","never","night","noble","noise",
  "north","noted","novel","nurse","nymph","oasis","ocean","offer","often","onion",
  "opera","order","other","overt","owner","oxide","ozone","paint","panic","paper",
  "party","pause","peace","pearl","penny","phase","phone","photo","piano","pilot",
  "pitch","pixel","pizza","place","plain","plane","plant","plate","plaza","plead",
  "pluck","plumb","plume","point","poker","polar","poppy","power","press","price",
  "pride","prime","print","prior","prize","probe","proof","prose","proud","prove",
  "proxy","pulse","punch","pupil","purse","query","quest","queue","quick","quiet",
  "quota","quote","radar","radio","raise","rally","ranch","range","rapid","ratio",
  "reach","ready","realm","rebel","refer","reign","relax","remix","repay","reset",
  "rider","rifle","right","risky","rival","river","robot","rocky","roomy","roots",
  "rough","round","route","royal","rugby","ruins","ruler","rural","rusty","sadly",
  "saint","salad","sauce","scale","scene","scent","scope","score","scout","seize",
  "serve","setup","seven","shade","shake","shall","shame","shape","share","shark",
  "sharp","shelf","shell","shift","shine","shirt","shock","shook","shore","short",
  "shout","sigma","silly","since","skill","slash","slate","slave","sleep","slice",
  "slide","slope","sloth","smart","smell","smile","smoke","snake","solar","solid",
  "solve","sonic","sorry","sound","south","space","speak","speed","spell","spend",
  "spice","spine","spire","spite","split","spoke","spore","sport","spray","squad",
  "stack","staff","stage","stain","stake","stale","stamp","stand","stare","stark",
  "start","state","steam","steep","steer","stern","stick","stiff","still","stock",
  "stone","stood","store","storm","story","stove","strap","straw","stray","study",
  "style","sugar","suite","sunny","super","surge","swamp","swear","sweep","sweet",
  "swept","swift","swing","sword","swore","sworn","syrup","table","taste","tense",
  "terms","theme","there","thick","thing","think","third","thorn","those","three",
  "threw","throw","tiger","tight","timer","tired","title","today","token","touch",
  "tough","tower","toxic","trace","track","trade","trail","train","trait","tread",
  "treat","trend","trial","tribe","trick","troop","trove","truck","truly","trunk",
  "trust","truth","twice","twist","ultra","uncle","under","unify","union","unite",
  "unity","until","upper","upset","urban","usher","usual","utter","valid","value",
  "valve","vapor","vault","verse","video","viral","virus","visit","vista","vital",
  "vivid","vocal","voice","voter","wager","wagon","waste","watch","water","weary",
  "weave","wedge","weigh","weird","wheat","where","which","while","white","whole",
  "whose","wider","width","witch","woman","women","world","worry","worse","worst",
  "worth","would","wrath","write","wrong","yacht","yield","young","youth","zebra",
  "zesty","abbey","adorn","aglow","algae","aloft","amaze","amble","amiss","ample",
  "annoy","antic","anvil","aptly","ardor","artsy","ascot","ashen","askew","attic",
  "augur","auger","axiom","azure","baize","baler","baton","bawdy","bayou","blurt",
  "bogus","booze","borax","botch","boxer","brash","brine","brisk","brunt","burly",
  "butch","buyer","cacao","cadet","cairn","calyx","cameo","canny","caper","caste",
  "cedar","chafe","champ","chant","cheap","cheer","chide","chirp","chore","chump",
  "cinch","clamp","clang","clank","claps","clash","clasp","cleft","clerk","cloak",
  "clout","clown","cluck","clump","coils","comet","conga","corny","couch","couth",
  "crave","creak","creed","crept","crimp","croak","crook","croon","crumb","crust",
  "crypt","cubic","curly","daunt","dowdy","dowry","drape","drawl","dread","drool",
  "droop","drumk","duchy","dusky","dusty","dwelt","eerie","egret","eject","elbow",
  "ethos","evoke","exert","expel","extol","exult","facet","faint","faker","famed",
  "feral","fetid","feud ","fiend","fiery","finch","fishy","flair","flank","flap",
  "flaunt","flaw","flock","flout","fluff","flunk","flute","foamy","folio","folly",
  "foray","frail","frond","froth","froze","frugal","fudge","fugue","fungi","funky",
  "gaudy","gauze","gavel","gawky","geyser","ghoul","gimp","gleam","glean","gloat",
  "gloomy","gnash","gnome","golly","gourd","graft","gruff","grunge","guile","gummy",
  "gusty","gruel","growl","gripe","grime","grift","greet",
].filter((w, i, arr) => w.length === 5 && arr.indexOf(w) === i);

// ─── Production API swap ─────────────────────────────────────────────────────
// Uncomment and implement when backend is ready:
//
// async function fetchRandomWordFromAPI(): Promise<string> {
//   const res = await fetch(`${import.meta.env.VITE_API_URL}/api/words/random`);
//   const data = await res.json();
//   return data.word;
// }
//
// async function fetchWordListFromAPI(): Promise<string[]> {
//   const res = await fetch(`${import.meta.env.VITE_API_URL}/api/words/list`);
//   const data = await res.json();
//   return data.words;
// }
//
// async function validateWordFromAPI(word: string): Promise<boolean> {
//   const res = await fetch(`${import.meta.env.VITE_API_URL}/api/words/valid`, {
//     method: 'POST',
//     body: JSON.stringify({ word }),
//     headers: { 'Content-Type': 'application/json' },
//   });
//   const data = await res.json();
//   return data.valid;
// }

export async function fetchRandomWord(): Promise<string> {
  // TODO: swap → fetchRandomWordFromAPI()
  const list = DEV_WORD_LIST;
  return list[Math.floor(Math.random() * list.length)];
}

export async function fetchWordList(): Promise<string[]> {
  // TODO: swap → fetchWordListFromAPI()
  return DEV_WORD_LIST;
}

export async function validateWord(word: string): Promise<boolean> {
  // TODO: swap → validateWordFromAPI(word)
  return DEV_WORD_LIST.includes(word.toLowerCase());
}
