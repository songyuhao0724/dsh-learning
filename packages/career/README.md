# @dsh-learning/career

把「我以后能干什么」拆成四步可执行的事：

1. **兴趣画像** —— 24 条行为描述，按霍兰德 RIASEC 六维算分；
2. **岗位画像** —— 内置 12 个生物信息/医学信息方向的岗位，写清「一天在干什么、要什么技能到什么程度、学历门槛、怎么进去」；
3. **技能差距** —— 只认可验证的证据，差距 = 岗位要求 − 你现在会做；
4. **四年计划** —— 按毕业去向（考研/保研/就业/出国）分叉，每年给出技能时间线、优势、短板、目标和**可交付物**。

## 它刻意不做什么

写在最前面，因为这些比功能更重要：

- **不复制第三方职业规划项目**（例如 GitHub 上的 Career-Planning）的代码与岗位数据 —— 那个仓库没有开源许可（License: NONE），复制或分发其 8 万条岗位数据都属于侵权。
- **不使用带注册商标的心理测评名称**，只用公共领域的霍兰德 RIASEC 框架；测评条目是自编的行为描述，不是任何受版权保护问卷的副本。
- **不做实时岗位爬虫**（v1）。招聘网站的反爬与授权状态复杂，v1 改用「内置岗位画像 + 用户粘贴 JD 解析」。
- 不承诺测评结果「准」。它只是把「哪些岗位更吃你这套兴趣」排个序，供你验证和反驳。

## 用法

```ts
import {
  RIASEC_ITEMS,
  scoreRiasec,
  matchOccupations,
  parseJobDescription,
  findSkillGaps,
  summarizeGaps,
  buildFourYearPlan,
  findOccupation,
} from '@dsh-learning/career';

// 1) 兴趣测评：24 条，1（完全不像我）—5（非常像我）
const profile = scoreRiasec(Object.fromEntries(RIASEC_ITEMS.map((item) => [item.id, 4])));
profile.top; // ['I','C','R'] —— 前三码

// 2) 匹配岗位（没有命中就用更宽的画像）
matchOccupations(profile, undefined, { limit: 3 });

// 3) 把一个真实 JD 拆成要求清单
const jd = parseJobDescription(jdText);
jd.skills; // [{ skill: 'Python', priority: 'required' }, ...]
jd.education; // '硕士及以上'

// 4) 技能差距（只认证据）
const occupation = findOccupation('bioinfo-engineer')!;
const report = findSkillGaps(occupation, [
  { skill: 'Python 编程', level: 3, evidence: '课程项目 + 仓库链接' },
]);
console.log(summarizeGaps(report));

// 5) 四年计划
buildFourYearPlan({
  goal: { degree: '考研', direction: '医疗健康大数据', startYear: 2026 },
  occupation,
  currentSkills: [{ skill: 'Python 编程', level: 2, evidence: '做过课程作业' }],
}).years;
```

## 技能等级怎么定

| 等级 | 含义 | 证据形态 |
| --- | --- | --- |
| 0 | 没接触过 | —— |
| 1 | 学过课程 | 成绩单、课程项目 |
| 2 | 能独立做 | 完整项目、报告、代码仓库 |
| 3 | 能独立负责并讲清取舍 | 带过别人做、能回答「为什么这么选」 |

「熟练使用 XX」不算证据。一段 JD 上写「熟练」很便宜，面试官一问就知道。

## 数据来源与许可

- RIASEC 框架属公共领域；
- 岗位画像依据 [O*NET](https://www.onetcenter.org/) 公开职业条目（CC BY 4.0）与国内招聘 JD 的常见要求，**改写为中文表述**，非 O*NET 数据副本，也不声称数值与官方评分一致；
- 新增/修改岗位画像请附出处（O*NET 条目链接或 JD 截图），并在 PR 描述里说明改了什么。

## License

Apache-2.0。O*NET® 是美国劳工部的注册商标，本项目与其无隶属关系。