/* 文档站点：导航、页内目录、上一页/下一页、Mermaid 渲染 */
(function () {
  const NAV = [
    { href: 'index.html',        num: '',  title: '目录' },
    { href: '01-intro.html',     num: '1', title: '整体介绍' },
    { href: '02-language.html',  num: '2', title: '统一语言' },
    { href: '03-overview.html',  num: '3', title: '模型总览' },
    { href: '04-perception.html',num: '4', title: '感知模块' },
    { href: '05-action.html',    num: '5', title: '行动模块' },
    { href: '06-planning.html',  num: '6', title: '规划模块' },
    { href: '07-memory.html',    num: '7', title: '记忆模块' },
    { href: '08-application.html', num: '8', title: '应用层' },
    { href: '09-infrastructure.html', num: '9', title: '基础设施层' }
  ];

  const here = (location.pathname.split('/').pop() || 'index.html');

  /* ---------- 侧边导航 ---------- */
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.innerHTML = 'Jellyfish Agent 领域模型<small>面向第一次接触 AI Agent 的开发者</small>';
    sidebar.appendChild(brand);

    const nav = document.createElement('nav');
    NAV.forEach(item => {
      const a = document.createElement('a');
      a.href = item.href;
      a.innerHTML = '<span class="num">' + item.num + '</span><span>' + item.title + '</span>';
      if (item.href === here) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    sidebar.appendChild(nav);

    /* ---------- 页内目录 ---------- */
    const main = document.querySelector('main.content');
    const heads = main ? Array.prototype.slice.call(main.querySelectorAll('h2, h3')) : [];
    if (heads.length) {
      const toc = document.createElement('div');
      toc.id = 'toc';
      const t = document.createElement('div');
      t.className = 'toc-title';
      t.textContent = '本页目录';
      toc.appendChild(t);

      heads.forEach(h => {
        if (!h.id) {
          h.id = 'sec-' + Math.random().toString(36).slice(2, 8);
        }
        const a = document.createElement('a');
        a.href = '#' + h.id;
        a.textContent = h.textContent.replace(/\s+/g, ' ').trim();
        if (h.tagName === 'H3') a.className = 'lvl-3';
        toc.appendChild(a);
      });
      sidebar.appendChild(toc);
    }
  }

  /* ---------- 上一页 / 下一页 ---------- */
  const foot = document.getElementById('pagenav');
  if (foot) {
    const idx = NAV.findIndex(x => x.href === here);
    const prev = idx > 0 ? NAV[idx - 1] : null;
    const next = idx >= 0 && idx < NAV.length - 1 ? NAV[idx + 1] : null;
    if (prev) {
      const a = document.createElement('a');
      a.href = prev.href;
      a.innerHTML = '<div class="dir">← 上一页</div>' + (prev.num ? prev.num + '. ' : '') + prev.title;
      foot.appendChild(a);
    } else {
      foot.appendChild(document.createElement('span'));
    }
    if (next) {
      const a = document.createElement('a');
      a.href = next.href;
      a.style.textAlign = 'right';
      a.innerHTML = '<div class="dir">下一页 →</div>' + (next.num ? next.num + '. ' : '') + next.title;
      foot.appendChild(a);
    }
  }

  /* ---------- Mermaid ---------- */
  function renderMermaid() {
    if (typeof mermaid === 'undefined') return;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
      flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true },
      sequence: { useMaxWidth: true, wrap: true, mirrorActors: false },
      classDiagram: { useMaxWidth: true }
    });
    const blocks = document.querySelectorAll('pre.mermaid');
    if (!blocks.length) return;
    Promise.resolve(mermaid.run({ nodes: blocks })).catch(err => {
      console.error('Mermaid 渲染失败：', err);
    });
  }

  if (document.readyState === 'complete') {
    renderMermaid();
  } else {
    window.addEventListener('load', renderMermaid);
  }
})();
