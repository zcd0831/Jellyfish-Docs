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

  /* ---------- 图表缩放 / 平移 / 全屏 ---------- */
  const ZOOM_MIN = 0.2;
  const ZOOM_MAX = 4;
  const diagramStates = [];

  function btn(label, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = title;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function enhanceDiagrams() {
    const pres = Array.prototype.slice.call(document.querySelectorAll('pre.mermaid'));
    pres.forEach(function (pre) {
      const svg = pre.querySelector('svg');
      if (!svg) return;

      const vb = svg.viewBox && svg.viewBox.baseVal;
      const rect = svg.getBoundingClientRect();
      const baseW = (vb && vb.width) || rect.width || 800;
      const baseH = (vb && vb.height) || rect.height || 400;
      if (!baseW || !baseH) return;

      const wrap = document.createElement('div');
      wrap.className = 'diagram';
      const bar = document.createElement('div');
      bar.className = 'diagram-toolbar';
      const viewport = document.createElement('div');
      viewport.className = 'diagram-viewport';
      const canvas = document.createElement('div');
      canvas.className = 'diagram-canvas';

      const label = document.createElement('span');
      label.className = 'diagram-zoomlabel';

      let scale = 1;
      let mode = 'fit';

      function apply() {
        svg.style.width = Math.round(baseW * scale) + 'px';
        svg.style.height = Math.round(baseH * scale) + 'px';
        label.textContent = Math.round(scale * 100) + '%';
      }

      function setScale(next) {
        mode = 'manual';
        scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
        apply();
      }

      function fitWidth() {
        const avail = viewport.clientWidth - 34;
        if (avail > 40) {
          scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, avail / baseW));
        }
        mode = 'fit';
        apply();
      }

      function toggleFullscreen() {
        const on = !wrap.classList.contains('fullscreen');
        wrap.classList.toggle('fullscreen', on);
        document.body.classList.toggle('diagram-lock', on);
        document.querySelectorAll('.diagram.fullscreen').forEach(function (el) {
          if (el !== wrap) {
            el.classList.remove('fullscreen');
            document.body.classList.remove('diagram-lock');
          }
        });
        window.requestAnimationFrame(fitWidth);
      }

      const spacer = document.createElement('span');
      spacer.className = 'spacer';
      const hint = document.createElement('span');
      hint.className = 'diagram-hint';
      hint.textContent = 'Ctrl/⌘ + 滚轮缩放 · 拖动平移 · 双击适应宽度';

      bar.appendChild(btn('−', '缩小', function () { setScale(scale / 1.2); }));
      bar.appendChild(label);
      bar.appendChild(btn('+', '放大', function () { setScale(scale * 1.2); }));
      bar.appendChild(btn('适应宽度', '缩放到容器宽度', fitWidth));
      bar.appendChild(btn('100%', '原始比例', function () { setScale(1); }));
      bar.appendChild(btn('⛶', '全屏查看（Esc 退出）', toggleFullscreen));
      bar.appendChild(spacer);
      bar.appendChild(hint);

      svg.style.maxWidth = 'none';
      svg.style.display = 'block';
      canvas.appendChild(svg);
      viewport.appendChild(canvas);
      wrap.appendChild(bar);
      wrap.appendChild(viewport);
      pre.replaceWith(wrap);

      /* Ctrl/⌘ + 滚轮缩放（不劫持普通滚动） */
      viewport.addEventListener('wheel', function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        setScale(scale * (e.deltaY > 0 ? 0.9 : 1.1));
      }, { passive: false });

      /* 拖动平移 */
      let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
      viewport.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button')) return;
        if (viewport.scrollWidth <= viewport.clientWidth &&
            viewport.scrollHeight <= viewport.clientHeight) return;
        dragging = true;
        viewport.classList.add('dragging');
        startX = e.clientX;
        startY = e.clientY;
        startLeft = viewport.scrollLeft;
        startTop = viewport.scrollTop;
        if (viewport.setPointerCapture) {
          try { viewport.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        }
      });
      viewport.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        viewport.scrollLeft = startLeft - (e.clientX - startX);
        viewport.scrollTop = startTop - (e.clientY - startY);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
        viewport.addEventListener(evt, function () {
          dragging = false;
          viewport.classList.remove('dragging');
        });
      });

      viewport.addEventListener('dblclick', fitWidth);

      diagramStates.push({ fitWidth: fitWidth, isFit: function () { return mode === 'fit'; } });
      window.requestAnimationFrame(fitWidth);
    });

    /* Esc 退出全屏 */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      const fs = document.querySelector('.diagram.fullscreen');
      if (fs) {
        fs.classList.remove('fullscreen');
        document.body.classList.remove('diagram-lock');
      }
    });

    /* 窗口变化时，处于"适应宽度"的图重新适配 */
    let resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        diagramStates.forEach(function (st) { if (st.isFit()) st.fitWidth(); });
      }, 150);
    });
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
    Promise.resolve(mermaid.run({ nodes: blocks }))
      .then(function () { enhanceDiagrams(); })
      .catch(function (err) { console.error('Mermaid 渲染失败：', err); });
  }

  if (document.readyState === 'complete') {
    renderMermaid();
  } else {
    window.addEventListener('load', renderMermaid);
  }
})();
