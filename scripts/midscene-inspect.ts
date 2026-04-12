import { PlaywrightAgent } from '@midscene/web/playwright';
import { chromium } from 'playwright';

const REQUIRED_ENV_KEYS = [
  'MIDSCENE_MODEL_BASE_URL',
  'MIDSCENE_MODEL_API_KEY',
  'MIDSCENE_MODEL_NAME',
  'MIDSCENE_MODEL_FAMILY',
] as const;

const PAGE_SPECS = [
  {
    path: '/',
    name: 'home',
    focus: '首屏价值表达、CTA 清晰度、视觉节奏、向 create 的转化意图。',
  },
  {
    path: '/create',
    name: 'create',
    focus: '表单负担、信息分组、主按钮优先级、移动端编辑路径。',
  },
  {
    path: '/rank',
    name: 'rank',
    focus: '列表可读性、加载反馈、筛选/刷新体验、空状态与错误态。',
  },
] as const;

function getBaseUrl() {
  const baseUrl = process.argv[2] || 'http://127.0.0.1:4321';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function getMissingEnvKeys() {
  return REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());
}

const REVIEW_PROMPT = (focus: string) => `你是资深前端设计与交互体验评审。请审查当前页面，并用中文输出严格 markdown：
## Summary
一句话总结
## Strengths
- 3 条
## UX Issues
- 按优先级列 5 条，每条写清“问题 + 影响”
## Quick Wins
- 3 条低成本改进建议
重点关注：${focus}`;

async function main() {
  const missingEnvKeys = getMissingEnvKeys();
  if (missingEnvKeys.length > 0) {
    console.error(`Missing Midscene env: ${missingEnvKeys.join(', ')}`);
    console.error('Set the required env vars, then run: npm run ux:midscene -- http://127.0.0.1:4321');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  const agent = new PlaywrightAgent(page);
  const baseUrl = getBaseUrl();

  try {
    for (const spec of PAGE_SPECS) {
      const url = new URL(spec.path.replace(/^\//, ''), baseUrl).toString();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      await agent.waitForNetworkIdle();

      const report = await agent.aiQuery<string>(REVIEW_PROMPT(spec.focus));
      console.log(`\n# Page: ${spec.name}`);
      console.log(`URL: ${url}`);
      console.log(report.trim());
      console.log('\n---');
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
