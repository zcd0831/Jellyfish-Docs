/* ==========================================================================
   Jellyfish 详细使用指南 — 页面脚本
   职责：导航高亮、侧栏搜索过滤、移动端折叠、代码一键复制、
         CDN 载入 highlight.js 与 mermaid 并初始化、打印前的展开。
   依赖：无（不依赖任何框架）。所有功能在缺网时都能降级。
   ========================================================================== */
(function () {
  'use strict';

  var HLJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
  var HLJS_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
  var MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';

  /* ------------------------------------------------------------------ 工具 */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /** 当前页面文件名（用于导航高亮）。 */
  function currentFile() {
    var path = window.location.pathname || '';
    var file = path.substring(path.lastIndexOf('/') + 1);
    return file || 'index.html';
  }

  /** 动态插入一个外部脚本；失败时回调 err。 */
  function loadScript(url, ok, err) {
    var s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = function () { if (ok) { ok(); } };
    s.onerror = function () { if (err) { err(); } };
    document.head.appendChild(s);
  }

  /** 复制文本：优先 clipboard API，退到 execCommand。 */
  function copyText(text, done) {
    var finish = function (ok) { done(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { finish(true); },
        function () {
          try { finish(document.execCommand('copy') && true); } catch (e) { finish(false); }
        });
      return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      finish(ok);
    } catch (e2) {
      finish(false);
    }
  }

  /* ------------------------------------------------------------ 导航高亮 */

  function highlightNav() {
    var file = currentFile();
    var found = false;
    $$('.nav-list a').forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('#')[0];
      if (href === file) {
        a.setAttribute('aria-current', 'page');
        found = true;
      } else if (a.getAttribute('aria-current') === 'page') {
        a.removeAttribute('aria-current');
      }
    });
    // 兜底：HTML 里没标（例如从本地 file:// 直接打开子页）时也不让侧栏没有当前项
    if (!found) {
      var first = $('.nav-list a[href="index.html"]');
      if (first && file === '') { first.setAttribute('aria-current', 'page'); }
    }
  }

  /* -------------------------------------------------- 侧栏搜索 + 移动端折叠 */

  /** 展开/收起侧栏（只有窄屏下 .sidebar.open 才有显示效果）并同步按钮状态。 */
  function setSidebarOpen(open) {
    var sidebar = $('#sidebar');
    if (!sidebar) { return; }
    if (open) { sidebar.classList.add('open'); } else { sidebar.classList.remove('open'); }
    var btn = $('#navToggle');
    if (btn) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  }

  function initNavSearch() {
    var input = $('#navSearch');
    if (!input) { return; }
    var groups = $$('.nav-group');
    function apply() {
      var q = input.value.trim().toLowerCase();
      var visible = 0;
      // 窄屏下侧栏是折叠的，过滤结果看不见、像是"搜索没反应"，有关键词就先展开
      if (q) { setSidebarOpen(true); }
      $$('.nav-list li').forEach(function (li) {
        var a = li.querySelector('a');
        var text = a ? (a.textContent || '').toLowerCase() : '';
        var hit = !q || text.indexOf(q) >= 0;
        li.classList.toggle('nav-hidden', !hit);
        if (hit) { visible++; }
      });
      // 整组都不命中时把组标题也藏掉
      groups.forEach(function (g) {
        var next = g.nextElementSibling;
        var any = false;
        while (next && next.classList.contains('nav-list')) {
          if (next.querySelector('li:not(.nav-hidden)')) { any = true; }
          next = next.nextElementSibling;
        }
        g.classList.toggle('nav-hidden', !any);
      });
      // 全部不命中时给一句提示，避免看起来"搜索坏了"
      var empty = $('#navEmpty');
      if (!empty) {
        empty = document.createElement('div');
        empty.id = 'navEmpty';
        empty.className = 'nav-empty';
        empty.textContent = '没有匹配的页面';
        var sidebar = $('#sidebar');
        if (sidebar) { sidebar.appendChild(empty); }
      }
      empty.style.display = visible === 0 && q ? 'block' : 'none';
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { input.value = ''; apply(); input.blur(); }
    });
  }

  function initNavToggle() {
    var btn = $('#navToggle');
    var sidebar = $('#sidebar');
    if (!btn || !sidebar) { return; }
    btn.addEventListener('click', function () {
      setSidebarOpen(!sidebar.classList.contains('open'));
    });

    // 移动端收起目录的两条触发：点侧栏里的链接、点右侧正文。
    // 两者是补集——链接跳转会整页重载，但正文点击不会，所以不能只留一条。
    function closeIfOpen() {
      if (sidebar.classList.contains('open')) { setSidebarOpen(false); }
    }
    sidebar.addEventListener('click', function (event) {
      if (event.target && event.target.tagName === 'A') { closeIfOpen(); }
    });
    var content = $('.content');
    if (content) { content.addEventListener('click', closeIfOpen); }
  }

  /* ------------------------------------------------------------ 代码复制 */

  /** 代码块的语言标签（有就用，没有就猜）。 */
  function languageOf(code) {
    var cls = code.className || '';
    var m = cls.match(/language-([a-z0-9+#-]+)/i);
    if (m) { return m[1].toLowerCase(); }
    return '';
  }

  function decorateCodeBlocks() {
    $$('pre > code').forEach(function (code) {
      var pre = code.parentNode;
      if (pre.parentNode && pre.parentNode.classList.contains('code-wrap')) { return; }

      var wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var lang = languageOf(code);
      if (lang && lang !== 'plaintext') {
        wrap.classList.add('has-lang');
        var badge = document.createElement('span');
        badge.className = 'code-lang';
        badge.textContent = lang;
        wrap.appendChild(badge);
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = '复制';
      btn.setAttribute('aria-label', '复制这段代码');
      btn.addEventListener('click', function () {
        copyText(code.textContent, function (ok) {
          btn.textContent = ok ? '已复制' : '复制失败';
          btn.classList.toggle('done', ok);
          window.setTimeout(function () {
            btn.textContent = '复制';
            btn.classList.remove('done');
          }, 1600);
        });
      });
      wrap.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------------- 高亮 */

  function initHighlight() {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = HLJS_CSS;
    document.head.appendChild(link);

    loadScript(HLJS_CDN, function () {
      if (!window.hljs) { return; }
      try {
        window.hljs.configure({ ignoreUnescapedHTML: true });
        $$('pre > code').forEach(function (code) {
          // 复制按钮在 DOM 里、不在 code 里，因此不会污染复制内容
          try { window.hljs.highlightElement(code); } catch (e) { /* 未知语言就跳过 */ }
        });
      } catch (e) { /* 高亮失败不影响阅读 */ }
    }, function () {
      // 断网：代码保持纯文本，不报错、不占位
    });
  }

  /* -------------------------------------------------------------- Mermaid */

  function mermaidConfig() {
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return {
      startOnLoad: false,
      securityLevel: 'loose',
      theme: dark ? 'dark' : 'default',
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
      flowchart: { htmlLabels: true, useMaxWidth: true },
      sequence: { useMaxWidth: true }
    };
  }

  /** 载不到渲染库时，把图源码原样摊开——至少让人看懂这张图在说什么。 */
  function fallbackMermaid(reason) {
    $$('.mermaid').forEach(function (node) {
      if (node.getAttribute('data-processed') === 'true') { return; }
      var src = node.textContent;
      node.classList.add('is-fallback');
      node.textContent = '';
      var pre = document.createElement('pre');
      pre.className = 'mermaid-fallback';
      pre.textContent = src;
      node.appendChild(pre);
      var cap = document.createElement('div');
      cap.className = 'figure-cap';
      cap.textContent = reason === 'missing'
        ? '（断网或 CDN 不可达，上图以 Mermaid 源码形式显示）'
        : '（图表渲染失败，上图以 Mermaid 源码形式显示）';
      node.appendChild(cap);
    });
  }

  function renderMermaid() {
    var nodes = $$('.mermaid');
    if (!nodes.length) { return; }
    if (!window.mermaid) { fallbackMermaid('missing'); return; }
    try { window.mermaid.initialize(mermaidConfig()); } catch (e) { /* 继续尝试 */ }
    try {
      var result = window.mermaid.run({ querySelector: '.mermaid' });
      if (result && result.catch) {
        result.catch(function () { fallbackMermaid('error'); });
      }
    } catch (e2) {
      try {
        window.mermaid.init(undefined, nodes);
      } catch (e3) {
        fallbackMermaid('error');
      }
    }
  }

  function initMermaid() {
    if (!$$('.mermaid').length) { return; }
    loadScript(MERMAID_CDN, function () { renderMermaid(); },
      function () { fallbackMermaid('missing'); });
  }

  /* ------------------------------------------------------------ 打印辅助 */

  function initPrint() {
    window.addEventListener('beforeprint', function () {
      // 打印时把折叠的细节都摊开，避免出现"纸面上是空的"
      $$('details').forEach(function (d) { d.setAttribute('open', ''); });
    });
  }

  /* ---------------------------------------------------------------- 启动 */

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    highlightNav();
    initNavSearch();
    initNavToggle();
    decorateCodeBlocks();
    initHighlight();
    initMermaid();
    initPrint();
  });
})();
