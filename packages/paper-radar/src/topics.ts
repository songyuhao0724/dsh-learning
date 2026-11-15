import type { Topic } from './types.js';

/**
 * 主题词表。刻意只放「能一句话说清、且检索得准」的主题；
 * 每条 pattern 同时匹配英文原文与中文标题。
 */
export const TOPICS: Topic[] = [
  {
    id: 'medical-ai',
    label: '医学影像与临床 AI',
    patterns: [/medical imag/i, /radiomic/i, /deep learning/i, /large language model/i, /foundation model/i, /医学影像/, /深度学习/, /大模型/],
  },
  {
    id: 'genomics',
    label: '基因组与组学',
    patterns: [/genom/i, /sequencing/i, /single[- ]cell/i, /transcriptom/i, /proteom/i, /基因组/, /测序/, /单细胞/, /转录组/],
  },
  {
    id: 'bioinfo-method',
    label: '生物信息算法与工具',
    patterns: [/algorithm/i, /benchmark/i, /pipeline/i, /variant calling/i, /assembly/i, /算法/, /流程/, /变异检测/, /组装/],
  },
  {
    id: 'precision-medicine',
    label: '精准医疗与药物',
    patterns: [/precision medicine/i, /drug (discovery|repurpos)/i, /pharmacogenom/i, /targeted therap/i, /精准医疗/, /药物/, /靶向/],
  },
  {
    id: 'neuro',
    label: '神经科学与脑机接口',
    patterns: [/neurosci/i, /brain[- ]computer/i, /eeg/i, /fmri/i, /neural decoding/i, /神经/, /脑机/, /脑电/],
  },
  {
    id: 'public-health',
    label: '公共卫生与流行病',
    patterns: [/epidemi/i, /public health/i, /cohort/i, /surveillance/i, /流行病/, /公共卫生/, /队列/],
  },
  {
    id: 'clinical-trial',
    label: '临床试验与真实世界研究',
    patterns: [/clinical trial/i, /real[- ]world/i, /randomi[sz]ed/i, /临床试验/, /真实世界/, /随机对照/],
  },
  {
    id: 'rehab',
    label: '康复与辅助技术',
    patterns: [/rehabilitat/i, /assistive/i, /prosthe/i, /exoskeleton/i, /康复/, /辅助技术/, /假肢/, /外骨骼/],
  },
];

/** 找出文本命中的主题 id。 */
export function detectTopics(text: string, topics: Topic[] = TOPICS): string[] {
  const hits: string[] = [];
  for (const topic of topics) {
    if (topic.patterns.some((pattern) => pattern.test(text))) hits.push(topic.id);
  }
  return hits;
}

export function topicLabel(id: string, topics: Topic[] = TOPICS): string {
  return topics.find((topic) => topic.id === id)?.label ?? id;
}

/** 把用户给的主题（id 或中文标签）解析成 id 列表；不认识的会原样保留，方便报错。 */
export function resolveTopics(input: string[] | undefined, topics: Topic[] = TOPICS): string[] | undefined {
  if (input === undefined || input.length === 0) return undefined;
  return input.map((value) => {
    const trimmed = value.trim();
    const byId = topics.find((topic) => topic.id === trimmed);
    if (byId !== undefined) return byId.id;
    const byLabel = topics.find((topic) => topic.label.includes(trimmed));
    return byLabel?.id ?? trimmed;
  });
}