// Metaphor/analogy engine - the #1 viral sharing factor

export interface Metaphor {
  zh: string;
  en: string;
}

export type MetaphorCategory = 'meme' | 'flex' | 'shock' | 'selfMock' | 'scifi' | 'worker';

interface MetaphorRange {
  min: number;
  max: number; // Infinity for the top tier
  metaphors: Record<MetaphorCategory, Metaphor[]>;
}

const METAPHOR_RANGES: MetaphorRange[] = [
  {
    min: 0,
    max: 1_000_000,
    metaphors: {
      meme: [
        { zh: 'AI 刚热完身，你就下线了', en: 'AI just finished warming up' },
        { zh: '这点 token 只够 AI 打个哈欠', en: 'Just enough tokens for AI to yawn' },
      ],
      flex: [
        { zh: '入门局，已经有点未来人味了', en: 'Starter tier, already future-coded' },
        { zh: '刚起步，但已经不是路人了', en: 'Just started, already not a bystander' },
      ],
      shock: [
        { zh: '够 AI 看完一本薄书', en: 'Enough for AI to read a short book' },
        { zh: '相当于喂了 AI 一个小型脑暴会', en: 'Like feeding AI a mini brainstorm' },
      ],
      selfMock: [
        { zh: '嘴上说浅尝，实际上没停过', en: 'Said casual, used it nonstop' },
        { zh: '我还没卷，AI 先陪练了', en: 'I barely started, AI already sparred' },
      ],
      scifi: [
        { zh: '像给小型机甲点了一次火', en: 'Like powering up a tiny mech' },
        { zh: '像在云端开了一扇舱门', en: 'Like opening one hatch in the cloud' },
      ],
      worker: [
        { zh: '够你把日报写得像周报', en: 'Enough to turn daily reports into weekly ones' },
        { zh: '摸鱼量不多，但已经很会借力了', en: 'Not huge usage, already efficient at delegating' },
      ],
    },
  },
  {
    min: 1_000_000,
    max: 10_000_000,
    metaphors: {
      meme: [
        { zh: 'AI 已经开始记住你的语气了', en: 'AI already remembers your tone' },
        { zh: '这波属于把 AI 用出熟人感了', en: 'You already use AI like an old friend' },
      ],
      flex: [
        { zh: '正式进入 AI 重度用户候选名单', en: 'Officially entering heavy AI user territory' },
        { zh: '这不是试用，这是开始上头', en: 'This is beyond trial, this is obsession' },
      ],
      shock: [
        { zh: '够 AI 看完 3 本长篇小说', en: 'Enough for AI to read 3 novels' },
        { zh: '相当于让 AI review 一整个副项目', en: 'Like having AI review a full side project' },
      ],
      selfMock: [
        { zh: '不是我努力，是我太会使唤 AI', en: 'Not hardworking, just very good at delegating to AI' },
        { zh: '同事还在写代码，我先写 prompt 了', en: 'While others code, I prompt' },
      ],
      scifi: [
        { zh: '像把一台副脑挂在工位旁边', en: 'Like docking a second brain beside your desk' },
        { zh: '像给宇宙飞船装上了辅助驾驶', en: 'Like adding autopilot to a starship' },
      ],
      worker: [
        { zh: '够你把月报写得像融资材料', en: 'Enough to make a monthly report feel like a pitch deck' },
        { zh: '把加班感，转成了提效感', en: 'Turned overtime into output leverage' },
      ],
    },
  },
  {
    min: 10_000_000,
    max: 100_000_000,
    metaphors: {
      meme: [
        { zh: '这不是在用 AI，这是在包年驯化', en: 'This is not using AI, this is year-round taming' },
        { zh: 'AI 看见你账号都会先坐直', en: 'AI sits up straight when it sees your account' },
      ],
      flex: [
        { zh: '你已经有点 AI 甲方的气质了', en: 'You already have main-character AI client energy' },
        { zh: '这量级，发朋友圈都带点压迫感', en: 'At this level, even your posts feel intimidating' },
      ],
      shock: [
        { zh: '够 AI review 几万行代码', en: 'Enough for AI to review tens of thousands of lines' },
        { zh: '相当于把《三体》读了十几遍', en: 'Like reading The Three-Body trilogy over and over' },
      ],
      selfMock: [
        { zh: '代码不一定更少，聊天记录一定更多', en: 'Maybe not less code, definitely more chats' },
        { zh: '我没进化成超人，只进化成会提需求的人', en: 'Not a superhero, just better at asking' },
      ],
      scifi: [
        { zh: '像给工作台装上了星舰中控', en: 'Like turning your desk into a starship console' },
        { zh: '像在办公室养了一颗低配奇点', en: 'Like keeping a budget singularity in the office' },
      ],
      worker: [
        { zh: '够把需求会的废话压缩一半', en: 'Enough to cut half the nonsense from planning meetings' },
        { zh: '这 token 全烧在把活干漂亮上了', en: 'These tokens were burned making the work look easy' },
      ],
    },
  },
  {
    min: 100_000_000,
    max: 1_000_000_000,
    metaphors: {
      meme: [
        { zh: 'AI 可能把你当直属领导了', en: 'AI probably thinks you are its manager' },
        { zh: '这个月你和 AI 的对话量，能养活一个梗号', en: 'Your AI chats this month could feed a meme account' },
      ],
      flex: [
        { zh: '这不是高频使用，这是把 AI 编进日常了', en: 'This is not high frequency, this is AI-native life' },
        { zh: '你一个人，已经像半个 AI 团队', en: 'You alone already feel like half an AI team' },
      ],
      shock: [
        { zh: '够 AI review 近 50 万行代码', en: 'Enough for AI to review nearly 500K lines of code' },
        { zh: '相当于读完维基百科的一大块', en: 'Like reading a huge chunk of Wikipedia' },
      ],
      selfMock: [
        { zh: '我没有更聪明，只是更会外包给模型', en: 'Not smarter, just better at outsourcing to models' },
        { zh: '人类负责拍板，AI 负责苦力', en: 'Humans decide, AI does the grind' },
      ],
      scifi: [
        { zh: '像在地球上开了一间轨道指挥室', en: 'Like opening an orbital command room on Earth' },
        { zh: '像让一支数字舰队全天候待命', en: 'Like keeping a digital fleet on standby' },
      ],
      worker: [
        { zh: '够把全年方案会，开成精简版', en: 'Enough to compress a year of planning meetings' },
        { zh: '这个月 KPI 看着像开了挂', en: 'This month’s KPI looks suspiciously enhanced' },
      ],
    },
  },
  {
    min: 1_000_000_000,
    max: 10_000_000_000,
    metaphors: {
      meme: [
        { zh: 'AI 供应商看到你都想发月饼', en: 'AI vendors want to send you holiday gifts' },
        { zh: '这已经不是用户，是榜单选手', en: 'This is not a user, this is a leaderboard contender' },
      ],
      flex: [
        { zh: '一人打出一个 50 人团队的热闹', en: 'One person making enough noise for a 50-person team' },
        { zh: '这份 token，用出了创业公司合伙人的劲', en: 'These tokens carry founder-level intensity' },
      ],
      shock: [
        { zh: '够 AI review 数百万行代码', en: 'Enough for AI to review millions of lines of code' },
        { zh: '相当于把全网热帖都精读了一轮', en: 'Like deeply reading the internet’s hottest posts' },
      ],
      selfMock: [
        { zh: '不是我卷，是 AI 替我把卷补齐了', en: 'Not me grinding, AI is covering the grind' },
        { zh: '我没有团队，只是聊天框比较多', en: 'No big team, just many chat windows' },
      ],
      scifi: [
        { zh: '像租下了一艘星舰的整个算力层', en: 'Like renting the compute deck of a starship' },
        { zh: '像把副脑升级成了作战系统', en: 'Like upgrading your second brain into battle mode' },
      ],
      worker: [
        { zh: '够把一个季度的脏活累活都自动化', en: 'Enough to automate a quarter of messy work' },
        { zh: '这不是效率工具，这是打工外挂', en: 'This is not a tool, this is a workday power-up' },
      ],
    },
  },
  {
    min: 10_000_000_000,
    max: 100_000_000_000,
    metaphors: {
      meme: [
        { zh: '再用下去，AI 要给你单开客服了', en: 'Keep going and AI will assign you dedicated support' },
        { zh: '这个级别，服务器都记得你脚步声', en: 'At this level, servers recognize your footsteps' },
      ],
      flex: [
        { zh: '一个人的 token，打出一家公司排面', en: 'One person spending tokens with company-level presence' },
        { zh: '这已经不是炫耀，是行业气氛组', en: 'This is beyond flexing, this sets the mood for the industry' },
      ],
      shock: [
        { zh: '相当于把全球畅销书库扫了一遍', en: 'Like scanning a global bestseller library' },
        { zh: '够 AI 跑完一场中型产品战争', en: 'Enough for AI to survive a mid-size product war' },
      ],
      selfMock: [
        { zh: '别人请同事喝咖啡，我请模型加班', en: 'Others buy coworkers coffee, I buy tokens for overtime' },
        { zh: '我不是老板，但账单像老板', en: 'Not the boss, but the bill says otherwise' },
      ],
      scifi: [
        { zh: '像私有了一条通往未来的算力走廊', en: 'Like owning a private compute corridor to the future' },
        { zh: '像给个人工作流装上了舰队引擎', en: 'Like fitting your workflow with fleet engines' },
      ],
      worker: [
        { zh: '这已经不是提效，是把班味压成二维码了', en: 'This is beyond efficiency, this compresses work life into a QR code' },
        { zh: '够把全年返工成本砍到怀疑人生', en: 'Enough to cut rework costs to absurd levels' },
      ],
    },
  },
  {
    min: 100_000_000_000,
    max: Infinity,
    metaphors: {
      meme: [
        { zh: '你不是在用 AI，你像在给 AGI 众筹', en: 'You are not using AI, you are crowdfunding AGI' },
        { zh: '再往上冲，AI 史会给你单开一章', en: 'Go higher and AI history gives you your own chapter' },
      ],
      flex: [
        { zh: '这个量级，已经不是用户画像，是行业传说', en: 'At this level, you are not a persona, you are a legend' },
        { zh: '你一个人，像把未来提前试营业了', en: 'You alone are running a soft launch for the future' },
      ],
      shock: [
        { zh: '相当于把人类公开知识再读一轮', en: 'Like rereading the public knowledge of humanity' },
        { zh: '够 AI 从零陪你打完一场文明升级战', en: 'Enough for AI to help you fight a civilization upgrade' },
      ],
      selfMock: [
        { zh: '我可能没升职，但模型一定跟着成长了', en: 'Maybe I did not level up, but the models certainly did' },
        { zh: '别人焦虑失业，我先焦虑 token 打折没', en: 'Others fear layoffs, I fear token prices not dropping' },
      ],
      scifi: [
        { zh: '像在个人电脑前展开了小型银河', en: 'Like unfolding a small galaxy in front of your laptop' },
        { zh: '像把奇点放进了你的工作流收藏夹', en: 'Like bookmarking the singularity in your workflow' },
      ],
      worker: [
        { zh: '这不是打工，这是把生产力炼成个人武器', en: 'This is not work, this is forging productivity into a personal weapon' },
        { zh: '你的班味，已经进化成未来工业风了', en: 'Your office grind has evolved into future industry aesthetics' },
      ],
    },
  },
];

export function getMetaphor(tokens: number, category: MetaphorCategory, locale: 'zh' | 'en' = 'zh'): string {
  const range = METAPHOR_RANGES.find((r) => tokens >= r.min && tokens < r.max) || METAPHOR_RANGES[0];
  const metaphors = range.metaphors[category];
  const selected = metaphors[Math.floor(Math.random() * metaphors.length)];
  return locale === 'zh' ? selected.zh : selected.en;
}

export function getAllMetaphorsForTokens(tokens: number, locale: 'zh' | 'en' = 'zh'): Record<MetaphorCategory, string> {
  return {
    meme: getMetaphor(tokens, 'meme', locale),
    flex: getMetaphor(tokens, 'flex', locale),
    shock: getMetaphor(tokens, 'shock', locale),
    selfMock: getMetaphor(tokens, 'selfMock', locale),
    scifi: getMetaphor(tokens, 'scifi', locale),
    worker: getMetaphor(tokens, 'worker', locale),
  };
}

export const METAPHOR_CATEGORY_LABELS: Record<MetaphorCategory, { zh: string; en: string }> = {
  meme: { zh: '爆梗版', en: 'Meme' },
  flex: { zh: '炫耀版', en: 'Flex' },
  shock: { zh: '震撼版', en: 'Shock' },
  selfMock: { zh: '自黑版', en: 'Self Roast' },
  scifi: { zh: '科幻版', en: 'Sci-Fi' },
  worker: { zh: '打工人版', en: 'Worker' },
};
