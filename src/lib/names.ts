const FIRST = [
  "james","john","robert","michael","william","david","richard","joseph","thomas","charles",
  "mary","patricia","jennifer","linda","barbara","elizabeth","susan","jessica","sarah","karen",
  "emily","daniel","matthew","andrew","joshua","christopher","ethan","alexander","ryan","kevin",
  "emma","olivia","sophia","isabella","mia","charlotte","amelia","harper","evelyn","abigail",
  "benjamin","samuel","henry","owen","jack","liam","noah","lucas","mason","logan",
  "elijah","aiden","carter","jayden","julian","brayden","lincoln","hunter","connor","eli",
  "grace","chloe","zoey","lily","aurora","natalie","hannah","addison","ellie","stella",
  "violet","claire","aria","scarlett","luna","nora","hazel","eleanor","riley","layla",
  "nathan","isaac","caleb","miles","adam","ian","sean","eric","kyle","aaron",
  "derek","marcus","simon","victor","oscar","felix","leon","hugo","max","finn",
  "alice","anna","rose","ruth","diana","iris","june","kate","helen","laura",
  "maya","leah","jade","faith","hope","dawn","brook","paige","tara","nina",
  "gabriel","rafael","xavier","dominic","austin","blake","cole","dean","grant","reid",
  "joel","seth","troy","wade","beau","clay","drew","ross","glen","brett",
  "fiona","ivy","joan","kay","mae","nell","opal","vera","ada","bea",
  "pedro","marco","luca","mateo","diego","carlos","luis","jorge","pablo","juan",
  "elena","sofia","valentina","camila","lucia","daniela","fernanda","paula","ana","rosa",
  "tobias","fabian","bastian","florian","lukas","moritz","philipp","jonas","niklas","jan",
  "lena","julia","lisa","katharina","marie","lea","anja","petra","greta","mia",
  "oliver","harry","george","charlie","freddie","alfie","archie","stanley","arthur","albert",
  "edward","alfred","harold","walter","frank","ernest","claude","raymond","leonard","clifford",
  "dorothy","betty","shirley","peggy","virginia","doris","mildred","frances","martha","gloria",
  "antonio","francisco","manuel","alejandro","sergio","miguel","roberto","eduardo","andres","javier",
  "camille","cecile","margot","colette","brigitte","monique","genevieve","pascal","renee","sylvie",
  "hiroshi","kenji","takashi","yuki","haruto","sota","ren","sora","aoi","yuna",
  "wei","lei","fang","ying","jing","xin","ming","hong","yan","ping",
  "priya","ananya","divya","kavya","pooja","neha","sneha","riya","aisha","zara",
  "omar","ali","hassan","ahmed","khalid","yusuf","tariq","bilal","samir","nadia",
  "erik","bjorn","sven","lars","gunnar","ingrid","astrid","sigrid","freya","ragna",
  "patrick","brendan","declan","niall","ciaran","siobhan","aoife","grainne","aisling","orlaith",
]

const LAST = [
  "smith","johnson","williams","brown","jones","garcia","miller","davis","wilson","taylor",
  "anderson","thomas","jackson","white","harris","martin","thompson","robinson","clark","lewis",
  "walker","hall","allen","young","king","wright","scott","green","baker","adams",
  "nelson","carter","mitchell","perez","roberts","turner","phillips","campbell","parker","evans",
  "edwards","collins","stewart","sanchez","morris","rogers","reed","cook","morgan","bell",
  "murphy","bailey","rivera","cooper","richardson","cox","howard","ward","torres","peterson",
  "gray","ramirez","watson","brooks","kelly","sanders","price","bennett","wood","barnes",
  "ross","henderson","coleman","jenkins","perry","powell","long","patterson","hughes","flores",
  "washington","butler","simmons","foster","gonzales","bryant","alexander","russell","griffin","diaz",
  "hayes","myers","ford","hamilton","graham","sullivan","wallace","woods","cole","west",
  "jordan","owens","reynolds","fisher","ellis","harrison","gibson","mcdonald","cruz","marshall",
  "ortiz","gomez","murray","freeman","wells","webb","simpson","stevens","tucker","porter",
  "hicks","crawford","boyd","morales","kennedy","warren","dixon","ramos","reyes","burns",
  "gordon","shaw","holmes","rice","robertson","hunt","black","daniels","palmer","mills",
  "nichols","grant","knight","ferguson","rose","stone","hawkins","dunn","perkins","hudson",
  "spencer","gardner","stephens","payne","pierce","berry","matthews","arnold","willis","ray",
  "watkins","olson","carroll","duncan","snyder","hart","cunningham","bradley","lane","andrews",
  "ruiz","fox","riley","armstrong","meyer","becker","schulz","koch","bauer","richter",
  "klein","wolf","neumann","schwarz","zimmermann","braun","hoffman","lehmann","walter","weber",
  "fischer","mueller","schmidt","schneider","lange","krause","maier","franke","berger","simon",
  "rodriguez","hernandez","lopez","martinez","gonzalez","romero","navarro","fernandez","castillo","medina",
  "vargas","guerrero","delgado","mendoza","mora","aguilar","reyes","flores","torres","sanchez",
  "dubois","dupont","bernard","moreau","laurent","michel","lefevre","lefebvre","mercier","chevalier",
  "tanaka","suzuki","watanabe","ito","yamamoto","nakamura","kobayashi","kato","yoshida","yamada",
  "wang","li","zhang","liu","chen","yang","huang","zhao","wu","zhou",
  "patel","shah","kumar","sharma","verma","gupta","mehta","joshi","nair","iyer",
  "rahman","hussain","malik","sheikh","chaudhry","akhtar","mirza","khan","siddiqui","qureshi",
  "andersen","nielsen","hansen","pedersen","christensen","larsen","sorensen","rasmussen","jensen","mortensen",
  "obrien","oconnor","osullivan","oneal","mccormack","mccarthy","kennedy","fitzgerald","ryan","gallagher",
  "novak","dvorak","horak","blazek","cerny","prochazka","kolar","pokorny","vesely","havlicek",
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateUsername(): string {
  const first = pick(FIRST)
  const last  = pick(LAST)
  const fmt   = Math.floor(Math.random() * 3)

  let base: string
  if (fmt === 0)      base = `${first}${last}`
  else if (fmt === 1) base = `${first[0]}${last}`
  else                base = `${first}${last[0].toUpperCase()}${last.slice(1)}`

  if (Math.random() < 0.4) {
    const len = Math.random() < 0.5 ? 2 : Math.random() < 0.6 ? 3 : 4
    const min = Math.pow(10, len - 1)
    const max = Math.pow(10, len) - 1
    base += Math.floor(Math.random() * (max - min + 1)) + min
  }

  return base
}
