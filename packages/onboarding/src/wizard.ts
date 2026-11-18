/**
 * 生成「初始化向导」单页 HTML。
 *
 * 为什么是单文件 HTML 而不是一个网页服务：
 * - 用户的档案是私密的，页面必须能离线打开、不上传任何数据；
 * - 双击即开，不需要再装运行时；
 * - 页面里嵌的字段目录与插件读的字段目录是同一份（都来自 schema.ts），不会走样。
 */
import { GROUPS, fieldsOfGroup } from './schema.js';
import { asTextValue } from './profile.js';
import type { FieldSpec, FieldValue, ProfileFile, ProfileStatus, ResourceCheckItem } from './types.js';

export interface WizardOptions {
  profile: ProfileFile;
  status: ProfileStatus;
  /** 资源体检结果（有就在页面里显示红/黄/绿），没有就只显示提示。 */
  resources?: ResourceCheckItem[];
  generatedAt?: string;
}

const FIELD_KIND_LABEL: Record<FieldSpec['kind'], string> = {
  text: '填空',
  longtext: '长文本',
  select: '单选',
  number: '数字',
};

const STEP_HINT: Record<string, string> = {
  identity: '先让知航知道「你是谁」——它给建议的每一个字都建立在这一步上。',
  goal: '这一步决定路线怎么分叉：考研和就业的四年计划长得完全不同。',
  preference: '主动到什么程度由你定。选「每次会话都提醒」，知航才会真的每次开场就提。',
  resource: '这一步不填也能用，但文献、全文、检索式这三件事会打折扣。',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fieldMeta(): Array<{
  key: string;
  label: string;
  group: string;
  kind: FieldSpec['kind'];
  required: boolean;
  options: string[];
  placeholder: string;
  help: string;
  note: string;
  value: string;
}> {
  return [...GROUPS].flatMap((group) =>
    fieldsOfGroup(group.id).map((field) => ({
      key: field.key,
      label: field.label,
      group: group.id,
      kind: field.kind,
      required: field.required === true,
      options: field.options === undefined ? [] : [...field.options],
      placeholder: field.placeholder ?? '',
      help: field.help ?? '',
      note: field.mdNote ?? '',
      value: '',
    })),
  );
}

/** 内嵌到 <script type="application/json"> 里时，`<` 必须转义，否则用户填的 "</script>" 会截断脚本块。 */
function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function renderWizardHtml(options: WizardOptions): string {
  const { profile, status } = options;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(profile.values)) {
    const text = asTextValue(value as FieldValue | undefined);
    if (text !== undefined) values[key] = text;
  }

  const meta = fieldMeta().map((entry) => ({ ...entry, value: values[entry.key] ?? '' }));
  const groups = [...GROUPS].map((group) => ({
    id: group.id,
    label: group.label,
    hint: group.hint,
    stepHint: STEP_HINT[group.id] ?? '',
    fields: meta.filter((entry) => entry.group === group.id),
  }));

  const resources = options.resources ?? [];
  const data = {
    groups,
    requirements: status.missingRequired.map((field) => field.label),
    resources,
    generatedAt,
    completion: status.completion,
  };

  const stepChips = groups
    .map(
      (group, index) =>
        `<button type="button" class="chip" data-step="${index}"><b>${index + 1}</b>${escapeHtml(group.label)}</button>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>知航 · 初始化向导</title>
<style>
  :root{--navy:#1F4E79;--teal:#2CA6A4;--ink:#0F172A;--dim:#64748B;--line:#E2E8F0;--pink:#9D174D;--amber:#B45309;--red:#B91C1C;--green:#15803D}
  *{box-sizing:border-box}
  body{margin:0;background:#F6F9FC;color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",system-ui,sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}
  header{padding:26px 30px 18px;background:linear-gradient(135deg,#fff,#EDF4FA 60%,#E7F4F3);border-bottom:1px solid var(--line)}
  .hrow{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
  h1{margin:0;font-size:22px;color:var(--navy)}
  .sub{color:#475569;font-size:13.3px;margin-top:4px;max-width:720px}
  .ring{width:96px;height:96px;flex:0 0 96px;position:relative}
  .ring svg{transform:rotate(-90deg)}
  .ring .num{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-size:20px;font-weight:700;color:var(--navy)}
  .ring .num small{font-size:10.5px;color:var(--dim);font-weight:400}
  .missing{margin-left:auto;background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;max-width:340px;font-size:12.6px}
  .missing b{color:var(--pink);display:block;margin-bottom:4px;font-size:12px;letter-spacing:.4px}
  .missing span{display:inline-block;background:#FDF2F8;color:var(--pink);border-radius:999px;padding:1px 9px;margin:2px 4px 0 0}
  .chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
  .chip{font:inherit;font-size:12.8px;border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 13px;
    cursor:pointer;color:#334155;display:flex;align-items:center;gap:7px}
  .chip b{display:inline-flex;width:18px;height:18px;border-radius:50%;background:var(--navy);color:#fff;font-size:11px;
    align-items:center;justify-content:center;font-weight:600}
  .chip.done b{background:var(--green)}
  .chip:hover{border-color:var(--teal)}

  main{display:flex;align-items:flex-start;gap:0}
  #form{flex:1;min-width:0;padding:22px 24px 60px;max-height:calc(100vh - 205px);overflow:auto}
  .step{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin-bottom:16px;scroll-margin-top:12px}
  .step h2{margin:0 0 2px;font-size:16px;color:var(--navy)}
  .step .hint{font-size:12.6px;color:var(--dim);margin-bottom:14px}
  .field{margin:0 0 14px;padding-bottom:12px;border-bottom:1px dashed #EEF2F7}
  .field:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
  .field label{display:flex;align-items:center;gap:8px;font-size:13.4px;font-weight:600;margin-bottom:3px}
  .field .req{font-size:10.5px;color:#fff;background:var(--pink);border-radius:999px;padding:0 7px;font-weight:400}
  .field .kindtag{font-size:10.5px;color:#94A3B8;border:1px solid var(--line);border-radius:999px;padding:0 7px;font-weight:400}
  .field .help{font-size:12.2px;color:#64748B;margin:1px 0 6px}
  .field input[type=text],.field input[type=number],.field select,.field textarea{
    width:100%;font:inherit;font-size:13.4px;padding:7px 10px;border:1px solid #CBD5E1;border-radius:9px;background:#fff;color:var(--ink)}
  .field textarea{min-height:74px;resize:vertical}
  .field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px #2CA6A420}
  .field.filled input,.field.filled select,.field.filled textarea{border-color:#A7F3D0;background:#F0FDFA}

  aside{width:414px;flex:0 0 414px;position:sticky;top:0;align-self:flex-start;max-height:100vh;overflow:auto;
    background:#fff;border-left:1px solid var(--line);padding:20px 20px 40px}
  aside h3{margin:0 0 4px;font-size:14px;color:var(--navy)}
  aside .tip{font-size:12.2px;color:var(--dim);margin-bottom:12px}
  .tabs{display:flex;gap:6px;margin-bottom:10px}
  .tabs button{font:inherit;font-size:12.2px;border:1px solid var(--line);background:#F8FAFC;border-radius:8px;padding:4px 10px;cursor:pointer;color:#475569}
  .tabs button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
  pre{background:#0F172A;color:#E2E8F0;border-radius:10px;padding:12px 13px;font-size:11.8px;line-height:1.55;
    overflow:auto;max-height:330px;white-space:pre-wrap;word-break:break-word;font-family:Consolas,"Cascadia Mono",monospace}
  .reslist{list-style:none;padding:0;margin:10px 0 0;font-size:12.3px}
  .reslist li{display:flex;gap:8px;padding:6px 0;border-bottom:1px dashed #EEF2F7}
  .dot{width:8px;height:8px;border-radius:50%;margin-top:6px;flex:0 0 8px}
  .reslist .k{color:#334155}
  .reslist .d{color:var(--dim);font-size:11.6px}
  .actions{display:flex;flex-direction:column;gap:8px;margin-top:14px}
  .actions button{font:inherit;font-size:12.8px;padding:8px 12px;border-radius:9px;border:1px solid var(--line);background:#fff;cursor:pointer;color:#334155;text-align:left}
  .actions button.primary{background:var(--teal);border-color:var(--teal);color:#fff;font-weight:600}
  .actions button:hover{filter:brightness(.97)}
  .note{font-size:11.6px;color:var(--dim);margin-top:10px;line-height:1.5}
  footer{padding:2px 24px 40px;color:var(--dim);font-size:11.8px}
  @media (max-width:1180px){aside{display:none}#form{max-height:none}}
</style>
</head>
<body>

<header>
  <div class="hrow">
    <div>
      <h1>知航 · 初始化向导</h1>
      <div class="sub">填完这一步，知航不用再问你是谁、你的东西在哪。右上角的数字是<b>必填项完成度</b>——填到 100% 它才敢按你的真实情况给建议。
        内容只存在你自己的电脑里，不会上传。</div>
    </div>
    <div class="ring">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="42" fill="none" stroke="#E2E8F0" stroke-width="9"></circle>
        <circle id="ringbar" cx="48" cy="48" r="42" fill="none" stroke="#2CA6A4" stroke-width="9"
          stroke-linecap="round" stroke-dasharray="264" stroke-dashoffset="264"></circle>
      </svg>
      <div class="num"><span id="pct">0%</span><small>必填完成度</small></div>
    </div>
    <div class="missing"><b>还差这些必填项</b><div id="missingList">—</div></div>
  </div>
  <div class="chips">${stepChips}</div>
</header>

<main>
  <div id="form"></div>
  <aside>
    <h3>这张档案交出去会长这样</h3>
    <div class="tip">右边是你填完之后、知航实际读到的东西。两边同步刷新。</div>
    <div class="tabs">
      <button type="button" class="on" data-tab="md">Markdown</button>
      <button type="button" data-tab="json">JSON</button>
    </div>
    <pre id="preview"></pre>
    <div class="actions">
      <button type="button" class="primary" id="btn-json">下载 个人档案.json</button>
      <button type="button" id="btn-md">下载 个人档案.md</button>
      <button type="button" id="btn-copy">复制「发给知航」的一段话</button>
      <button type="button" id="btn-reset">清空重填</button>
    </div>
    <div class="note" id="where"></div>
    <ul class="reslist" id="reslist"></ul>
  </aside>
</main>

<footer>
  生成时间 <span id="gen">—</span> · 本页由 <code>@dsh-learning/onboarding</code> 生成，字段目录与插件读的是同一份，
  所以这里能填的，知航一定读得到。
</footer>

<script id="wizard-data" type="application/json">${embedJson(data)}</script>
<script>
(function(){
  var DATA = JSON.parse(document.getElementById('wizard-data').textContent);
  var STORAGE_KEY = 'zhihang-profile-draft-v1';
  var state = {};
  DATA.groups.forEach(function(g){ g.fields.forEach(function(f){ state[f.key] = f.value || ''; }); });

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
  if (saved && typeof saved === 'object') {
    Object.keys(saved).forEach(function(k){ if (k in state) state[k] = String(saved[k] == null ? '' : saved[k]); });
  }

  var form = document.getElementById('form');
  var preview = document.getElementById('preview');
  var pct = document.getElementById('pct');
  var ringbar = document.getElementById('ringbar');
  var missingList = document.getElementById('missingList');
  var tab = 'md';

  function el(tag, cls, text){
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildForm(){
    DATA.groups.forEach(function(group, index){
      var box = el('section', 'step');
      box.id = 'step-' + index;
      box.appendChild(el('h2', null, (index + 1) + '. ' + group.label));
      box.appendChild(el('div', 'hint', group.stepHint || group.hint));
      group.fields.forEach(function(field){
        var wrap = el('div', 'field');
        wrap.setAttribute('data-key', field.key);
        var label = el('label');
        label.appendChild(el('span', null, field.label));
        if (field.required) label.appendChild(el('span', 'req', '必填'));
        label.appendChild(el('span', 'kindtag', field.kind === 'select' ? '单选' : field.kind === 'number' ? '数字' : '填空'));
        wrap.appendChild(label);
        if (field.help) wrap.appendChild(el('div', 'help', field.help + (field.note ? '（' + field.note + '）' : '')));

        var input;
        if (field.kind === 'select'){
          input = el('select');
          var blank = el('option', null, '— 请选择 —');
          blank.value = '';
          input.appendChild(blank);
          field.options.forEach(function(opt){
            var o = el('option', null, opt);
            o.value = opt;
            input.appendChild(o);
          });
        } else {
          input = el('input');
          input.type = field.kind === 'number' ? 'number' : 'text';
          if (field.placeholder) input.placeholder = field.placeholder;
        }
        input.value = state[field.key] || '';
        input.addEventListener('input', function(){
          state[field.key] = input.value;
          wrap.classList.toggle('filled', String(input.value).trim() !== '');
          persist();
          refresh();
        });
        wrap.classList.toggle('filled', String(input.value).trim() !== '');
        wrap.appendChild(input);
        box.appendChild(wrap);
      });
      form.appendChild(box);
    });
  }

  function persist(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function requiredFields(){
    var list = [];
    DATA.groups.forEach(function(g){
      g.fields.forEach(function(f){ if (f.required) list.push(f); });
    });
    return list;
  }

  function filled(key){ return String(state[key] == null ? '' : state[key]).trim() !== ''; }

  function markdown(){
    var lines = [];
    var name = filled('name') ? state['name'] : '我';
    lines.push('# ' + name + ' · 个人档案（AI 伴学助手知识库）');
    lines.push('');
    lines.push('> 由「知航初始化向导」生成；同目录 个人档案.json 是机器可读版本。');
    lines.push('');
    DATA.groups.forEach(function(g, index){
      lines.push('## ' + (index + 1) + '、' + g.label);
      lines.push('');
      var rows = g.fields.filter(function(f){ return filled(f.key); });
      if (!rows.length){ lines.push('_（还没填）_'); lines.push(''); return; }
      lines.push('| 项目 | 内容 |');
      lines.push('|---|---|');
      rows.forEach(function(f){
        lines.push('| ' + f.label + (f.note ? '（' + f.note + '）' : '') + ' | ' + String(state[f.key]).replace(/\\|/g, '\\\\|') + ' |');
      });
      lines.push('');
    });
    return lines.join('\\n');
  }

  function json(){
    var values = {};
    Object.keys(state).forEach(function(k){ if (filled(k)) values[k] = state[k]; });
    return JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), values: values }, null, 2);
  }

  function refresh(){
    var req = requiredFields();
    var done = req.filter(function(f){ return filled(f.key); }).length;
    var percent = req.length ? Math.round(done / req.length * 100) : 100;
    pct.textContent = percent + '%';
    var circumference = 2 * Math.PI * 42;
    ringbar.setAttribute('stroke-dasharray', String(circumference));
    ringbar.setAttribute('stroke-dashoffset', String(circumference * (1 - percent / 100)));
    ringbar.setAttribute('stroke', percent === 100 ? '#15803D' : percent >= 60 ? '#2CA6A4' : '#B45309');

    var missing = req.filter(function(f){ return !filled(f.key); });
    missingList.innerHTML = '';
    if (!missing.length){
      missingList.appendChild(el('span', null, '全填完了 ✓'));
    } else {
      missing.forEach(function(f){ missingList.appendChild(el('span', null, f.label)); });
    }

    DATA.groups.forEach(function(g, index){
      var chip = document.querySelector('.chip[data-step="' + index + '"]');
      var allFilled = g.fields.filter(function(f){ return f.required; }).every(function(f){ return filled(f.key); });
      if (chip) chip.classList.toggle('done', allFilled);
    });

    preview.textContent = tab === 'md' ? markdown() : json();
  }

  function download(filename, text){
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1200);
  }

  document.querySelectorAll('.tabs button').forEach(function(btn){
    btn.addEventListener('click', function(){
      tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tabs button').forEach(function(b){ b.classList.toggle('on', b === btn); });
      refresh();
    });
  });

  document.querySelectorAll('.chip').forEach(function(chip){
    chip.addEventListener('click', function(){
      var target = document.getElementById('step-' + chip.getAttribute('data-step'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  document.getElementById('btn-json').addEventListener('click', function(){ download('个人档案.json', json()); });
  document.getElementById('btn-md').addEventListener('click', function(){ download('个人档案.md', markdown()); });

  document.getElementById('btn-copy').addEventListener('click', function(){
    var req = requiredFields();
    var done = req.filter(function(f){ return filled(f.key); }).length;
    var percent = req.length ? Math.round(done / req.length * 100) : 100;
    var text = '我把初始化向导填好了（必填完成度 ' + percent + '%），档案已下载到「学习档案」目录。'
      + '请先运行 study_profile_status 读一下我的档案，再运行 study_resource_check 体检资源，然后告诉我下一步该做什么。';
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){
        var btn = document.getElementById('btn-copy');
        var old = btn.textContent;
        btn.textContent = '已复制，去粘给知航 ✓';
        setTimeout(function(){ btn.textContent = old; }, 1800);
      }, function(){ window.prompt('复制下面这段：', text); });
    } else {
      window.prompt('复制下面这段：', text);
    }
  });

  document.getElementById('btn-reset').addEventListener('click', function(){
    if (!window.confirm('清空本页所有填写内容？已下载的文件不受影响。')) return;
    Object.keys(state).forEach(function(k){ state[k] = ''; });
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    document.querySelectorAll('.field').forEach(function(wrap){
      var input = wrap.querySelector('input,select');
      if (input) input.value = '';
      wrap.classList.remove('filled');
    });
    refresh();
  });

  document.getElementById('gen').textContent = DATA.generatedAt.replace('T', ' ').slice(0, 16);

  var where = document.getElementById('where');
  where.innerHTML = '<b>放哪：</b>把 个人档案.json 与 个人档案.md 放进工作区的 <code>学习档案/</code> 目录（与知航对话的那个目录）。<br>'
    + '<b>之后：</b>知航每次开场先读这份档案；说「更新我的档案：…」它就会用 study_profile_save 改。';

  var reslist = document.getElementById('reslist');
  if (DATA.resources && DATA.resources.length){
    var title = el('li');
    title.innerHTML = '<b style="font-size:12px;color:#334155">资源体检（生成本页时）</b>';
    reslist.appendChild(title);
    DATA.resources.forEach(function(item){
      var li = el('li');
      var dot = el('span', 'dot');
      dot.style.background = item.status === 'ok' ? '#15803D' : item.status === 'warn' ? '#B45309' : '#B91C1C';
      var box = el('div');
      box.appendChild(el('div', 'k', item.label + ' · ' + item.detail));
      if (item.fix) box.appendChild(el('div', 'd', '怎么补：' + item.fix));
      li.appendChild(dot);
      li.appendChild(box);
      reslist.appendChild(li);
    });
  }

  buildForm();
  refresh();
})();
</script>
</body>
</html>`;
}