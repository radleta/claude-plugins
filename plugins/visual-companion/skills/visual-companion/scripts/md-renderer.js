(function() {
  'use strict';

  // ========== Plugin Configuration ==========

  var PLUGINS = {
    // Always-loaded (lightweight)
    taskLists: true, sourceMap: true, callouts: true, footnote: true,
    collapsible: true, multimdTable: true, anchor: true, toc: true, container: true,
    mark: true, ins: true, sub: true, sup: true, deflist: true, emoji: true, attrs: true,
    highlightJs: true,
    // Lazy-loaded (heavy, only fetched when fenced block detected)
    mermaid: true, katex: true, markmap: true, diff2html: true,
    graphviz: true, revealJs: true, quizdown: true,
  };

  // Parse ?disable=mermaid,katex query param
  var params = new URLSearchParams(window.location.search);
  var disableParam = params.get('disable');
  if (disableParam) {
    disableParam.split(',').forEach(function(name) {
      var trimmed = name.trim();
      if (trimmed in PLUGINS) {
        PLUGINS[trimmed] = false;
      }
    });
  }

  // ========== Utility ==========

  function decodeHtmlEntities(text) {
    var el = document.createElement('textarea');
    el.innerHTML = text;
    return el.value;
  }

  // ========== CDN Loader ==========

  var CDN_BASE = 'https://cdn.jsdelivr.net/npm';

  function loadScript(url) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = resolve;
      s.onerror = function() { reject(new Error('Failed to load: ' + url)); };
      document.head.appendChild(s);
    });
  }

  function loadCSS(url) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }

  // ========== Theme-Aware CSS ==========

  var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var hljsTheme = isDark ? 'github-dark' : 'github';
  loadCSS(CDN_BASE + '/@highlightjs/cdn-assets@11.11.1/styles/' + hljsTheme + '.min.css');

  // ========== Highlight.js Integration ==========

  function highlightCode(str, lang) {
    if (!PLUGINS.highlightJs || typeof hljs === 'undefined') return '';
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(str, { language: lang }).value; } catch (e) { /* fall through */ }
    }
    return '';
  }

  // ========== markdown-it Initialization ==========

  function waitForDeps(maxWait) {
    return new Promise(function(resolve, reject) {
      function esmReady() {
        return typeof window.markdownitObsidianCallouts !== 'undefined' ||
               typeof window.markdownitCollapsible !== 'undefined';
      }
      if (typeof markdownit !== 'undefined' && esmReady()) { resolve(); return; }
      var elapsed = 0;
      var interval = setInterval(function() {
        elapsed += 50;
        var mdReady = typeof markdownit !== 'undefined';
        if (mdReady && esmReady()) { clearInterval(interval); resolve(); return; }
        // After 2s, proceed even if ESM plugins haven't loaded (graceful degradation)
        if (mdReady && elapsed >= 2000) { clearInterval(interval); resolve(); return; }
        if (elapsed >= maxWait) { clearInterval(interval); reject(new Error('markdown-it failed to load from CDN')); }
      }, 50);
    });
  }

  function createMarkdownIt() {
    var md = markdownit({
      html: true,
      linkify: true,
      typographer: true,
      highlight: highlightCode
    });

    // Register always-loaded plugins (each checks global availability)
    if (PLUGINS.sourceMap && typeof markdownitSourceMap !== 'undefined') {
      md.use(markdownitSourceMap);
    }
    if (PLUGINS.taskLists && typeof markdownitTaskLists !== 'undefined') {
      md.use(markdownitTaskLists, { enabled: true, lineNumber: true });
    }
    if (PLUGINS.footnote && typeof markdownitFootnote !== 'undefined') {
      md.use(markdownitFootnote);
    }
    if (PLUGINS.callouts && typeof markdownitObsidianCallouts !== 'undefined') {
      md.use(markdownitObsidianCallouts);
    }
    if (PLUGINS.collapsible && typeof markdownitCollapsible !== 'undefined') {
      md.use(markdownitCollapsible);
    }
    if (PLUGINS.mark && typeof markdownitMark !== 'undefined') {
      md.use(markdownitMark);
    }
    if (PLUGINS.ins && typeof markdownitIns !== 'undefined') {
      md.use(markdownitIns);
    }
    if (PLUGINS.sub && typeof markdownitSub !== 'undefined') {
      md.use(markdownitSub);
    }
    if (PLUGINS.sup && typeof markdownitSup !== 'undefined') {
      md.use(markdownitSup);
    }
    if (PLUGINS.deflist && typeof markdownitDeflist !== 'undefined') {
      md.use(markdownitDeflist);
    }
    if (PLUGINS.emoji && typeof markdownitEmoji !== 'undefined') {
      md.use(markdownitEmoji);
    }
    if (PLUGINS.attrs && typeof markdownItAttrs !== 'undefined') {
      md.use(markdownItAttrs);
    }
    if (PLUGINS.anchor && typeof markdownItAnchor !== 'undefined') {
      md.use(markdownItAnchor);
    }
    if (PLUGINS.toc && typeof markdownItTocDoneRight !== 'undefined') {
      md.use(markdownItTocDoneRight);
    }
    if (PLUGINS.multimdTable && typeof markdownitMultimdTable !== 'undefined') {
      md.use(markdownitMultimdTable, { multiline: true, rowspan: true, headerless: true });
    }
    if (PLUGINS.container && typeof markdownitContainer !== 'undefined') {
      md.use(markdownitContainer, 'warning');
      md.use(markdownitContainer, 'info');
      md.use(markdownitContainer, 'tip');
    }

    return md;
  }

  // ========== Lazy-Load Detection and Rendering ==========

  function lazyLoadPlugins(container, rawMd) {
    // Phase 1: KaTeX (re-renders entire container, must complete before other plugins)
    var katexPromise = Promise.resolve();
    if (PLUGINS.katex && (/\$\$[\s\S]+?\$\$/.test(rawMd) || /\$[^\s$][^$]*?\$/.test(rawMd))) {
      katexPromise = Promise.all([
        loadScript(CDN_BASE + '/katex@0.16/dist/katex.min.js'),
        loadScript(CDN_BASE + '/markdown-it-texmath@1/texmath.min.js'),
      ]).then(function() {
        loadCSS(CDN_BASE + '/katex@0.16/dist/katex.min.css');
        var md2 = createMarkdownIt();
        if (typeof texmath !== 'undefined') {
          md2.use(texmath, { engine: katex, delimiters: 'dollars' });
        }
        container.innerHTML = md2.render(rawMd);
        addLineNumbers(container, rawMd);
        attachCheckboxHandlers(container);
      }).catch(function(err) {
        console.warn('KaTeX lazy-load failed:', err.message);
      });
    }

    // Phase 2: All other lazy plugins (run after KaTeX so DOM is stable)
    return katexPromise.then(function() {
      var promises = [];

      // Mermaid
      if (PLUGINS.mermaid) {
        var mermaidBlocks = container.querySelectorAll('pre > code.language-mermaid');
        if (mermaidBlocks.length > 0) {
          promises.push(
            loadScript(CDN_BASE + '/mermaid@11/dist/mermaid.min.js')
              .then(function() {
                var mermaidTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
                mermaid.initialize({ startOnLoad: false, theme: mermaidTheme });
                var blocks = container.querySelectorAll('pre > code.language-mermaid');
                blocks.forEach(function(block) {
                  var pre = block.parentElement;
                  var div = document.createElement('div');
                  div.className = 'mermaid';
                  div.textContent = decodeHtmlEntities(block.innerHTML);
                  pre.replaceWith(div);
                });
                return mermaid.run({ nodes: container.querySelectorAll('.mermaid') });
              })
              .catch(function(err) {
                console.warn('Mermaid lazy-load failed:', err.message);
              })
          );
        }
      }

      // Markmap
      if (PLUGINS.markmap) {
        var markmapBlocks = container.querySelectorAll('pre > code.language-markmap');
        if (markmapBlocks.length > 0) {
          promises.push(
            Promise.all([
              loadScript(CDN_BASE + '/markmap-lib@0.18/dist/browser/index.js'),
              loadScript(CDN_BASE + '/markmap-view@0.18/dist/browser/index.js'),
              loadScript(CDN_BASE + '/d3@7/dist/d3.min.js'),
            ]).then(function() {
              markmapBlocks.forEach(function(block) {
                var pre = block.parentElement;
                var svg = document.createElement('svg');
                svg.style.width = '100%';
                svg.style.minHeight = '300px';
                pre.replaceWith(svg);
                try {
                  var transformer = new markmap.Transformer();
                  var root = transformer.transform(block.textContent).root;
                  markmap.Markmap.create(svg, null, root);
                } catch (e) {
                  svg.outerHTML = '<pre><code>' + block.textContent + '</code></pre>';
                  console.warn('Markmap rendering failed:', e.message);
                }
              });
            }).catch(function(err) {
              console.warn('Markmap lazy-load failed:', err.message);
            })
          );
        }
      }

      // diff2html
      if (PLUGINS.diff2html) {
        var diffBlocks = container.querySelectorAll('pre > code.language-diff');
        if (diffBlocks.length > 0) {
          promises.push(
            Promise.all([
              loadScript(CDN_BASE + '/diff2html@3/bundles/js/diff2html.min.js'),
            ]).then(function() {
              loadCSS(CDN_BASE + '/diff2html@3/bundles/css/diff2html.min.css');
              diffBlocks.forEach(function(block) {
                var pre = block.parentElement;
                try {
                  var html = Diff2Html.html(block.textContent, {
                    drawFileList: false,
                    outputFormat: 'side-by-side',
                    matching: 'lines'
                  });
                  var div = document.createElement('div');
                  div.innerHTML = html;
                  pre.replaceWith(div);
                } catch (e) {
                  console.warn('diff2html rendering failed:', e.message);
                }
              });
            }).catch(function(err) {
              console.warn('diff2html lazy-load failed:', err.message);
            })
          );
        }
      }

      // Graphviz
      if (PLUGINS.graphviz) {
        var graphvizBlocks = container.querySelectorAll('pre > code.language-graphviz');
        if (graphvizBlocks.length > 0) {
          promises.push(
            loadScript(CDN_BASE + '/@viz-js/viz@3/lib/viz-standalone.js')
              .then(function() {
                return Viz.instance();
              })
              .then(function(viz) {
                graphvizBlocks.forEach(function(block) {
                  var pre = block.parentElement;
                  try {
                    var svg = viz.renderSVGElement(block.textContent);
                    pre.replaceWith(svg);
                  } catch (e) {
                    console.warn('Graphviz rendering failed:', e.message);
                  }
                });
              })
              .catch(function(err) {
                console.warn('Graphviz lazy-load failed:', err.message);
              })
          );
        }
      }

      // reveal.js (slides)
      if (PLUGINS.revealJs) {
        var slidesBlocks = container.querySelectorAll('pre > code.language-slides');
        if (slidesBlocks.length > 0) {
          promises.push(
            Promise.all([
              loadScript(CDN_BASE + '/reveal.js@5/dist/reveal.esm.js'),
            ]).then(function() {
              loadCSS(CDN_BASE + '/reveal.js@5/dist/reveal.css');
              var revealTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'white';
              loadCSS(CDN_BASE + '/reveal.js@5/dist/theme/' + revealTheme + '.css');
              slidesBlocks.forEach(function(block) {
                var pre = block.parentElement;
                var slides = block.textContent.split(/\n---\n/);
                var sectionsHtml = slides.map(function(s) { return '<section>' + markdownit().render(s) + '</section>'; }).join('');
                var div = document.createElement('div');
                div.className = 'reveal';
                div.style.height = '500px';
                div.innerHTML = '<div class="slides">' + sectionsHtml + '</div>';
                pre.replaceWith(div);
                try {
                  new Reveal(div, { embedded: true }).initialize();
                } catch (e) {
                  console.warn('reveal.js init failed:', e.message);
                }
              });
            }).catch(function(err) {
              console.warn('reveal.js lazy-load failed:', err.message);
            })
          );
        }
      }

      // quizdown
      if (PLUGINS.quizdown) {
        var quizBlocks = container.querySelectorAll('pre > code.language-quizdown');
        if (quizBlocks.length > 0) {
          promises.push(
            loadScript(CDN_BASE + '/quizdown@0.6/public/build/quizdown.js')
              .then(function() {
                loadCSS(CDN_BASE + '/quizdown@0.6/public/build/quizdown.css');
                quizBlocks.forEach(function(block) {
                  var pre = block.parentElement;
                  var div = document.createElement('div');
                  div.className = 'quizdown';
                  div.textContent = block.textContent;
                  pre.replaceWith(div);
                });
                if (typeof quizdown !== 'undefined' && quizdown.init) {
                  quizdown.init();
                }
              })
              .catch(function(err) {
                console.warn('quizdown lazy-load failed:', err.message);
              })
          );
        }
      }

      return Promise.all(promises);
    });
  }

  // ========== Checkbox Toggle Handlers ==========

  function addLineNumbers(container, rawMd) {
    var lines = rawMd.split('\n');
    var checkboxes = container.querySelectorAll('input[type="checkbox"]');
    var checkboxIndex = 0;
    for (var i = 0; i < lines.length && checkboxIndex < checkboxes.length; i++) {
      if (/^\s*-\s+\[[ xX]\]/.test(lines[i])) {
        checkboxes[checkboxIndex].setAttribute('data-line', String(i));
        checkboxIndex++;
      }
    }
  }

  function attachCheckboxHandlers(container) {
    var filenameMeta = document.querySelector('meta[name="vc-filename"]');
    if (!filenameMeta) return;
    var filename = filenameMeta.content;

    // Track file mtime for optimistic concurrency
    var mtimeMeta = document.querySelector('meta[name="vc-mtime"]');
    var currentMtime = mtimeMeta ? parseInt(mtimeMeta.content, 10) : null;

    var checkboxes = container.querySelectorAll('input[type="checkbox"][data-line]');
    checkboxes.forEach(function(cb) {
      cb.addEventListener('change', function(e) {
        var line = parseInt(e.target.getAttribute('data-line'), 10);
        var checked = e.target.checked;

        var payload = { file: filename, line: line, checked: checked };
        if (currentMtime) payload.mtime = currentMtime;

        fetch('/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(function(res) {
          if (res.status === 409) {
            e.target.checked = !checked; // revert
            if (typeof showReloadBanner === 'function') showReloadBanner();
            return;
          }
          if (!res.ok) {
            e.target.checked = !checked; // revert
            return res.json().then(function(data) {
              console.warn('Checkbox toggle failed:', data.error);
            });
          }
          return res.json().then(function(data) {
            if (data.mtime) {
              currentMtime = data.mtime;
              if (mtimeMeta) mtimeMeta.content = String(data.mtime);
            }
          });
        }).catch(function(err) {
          e.target.checked = !checked; // revert
          console.warn('Checkbox toggle error:', err.message);
        });
      });
    });
  }

  // ========== Main Render ==========

  function init() {
    waitForDeps(10000)
      .then(function() {
        var sourceEl = document.getElementById('md-source');
        var targetEl = document.getElementById('md-rendered');
        if (!sourceEl || !targetEl) {
          console.error('md-renderer: missing #md-source or #md-rendered');
          return;
        }

        var rawMd = sourceEl.textContent;
        var md = createMarkdownIt();
        targetEl.innerHTML = md.render(rawMd);

        addLineNumbers(targetEl, rawMd);
        attachCheckboxHandlers(targetEl);
        return lazyLoadPlugins(targetEl, rawMd);
      })
      .then(function() {
        // Rendering complete
      })
      .catch(function(err) {
        console.error('md-renderer init failed:', err.message);
        // Fallback: show raw MD text
        var sourceEl = document.getElementById('md-source');
        var targetEl = document.getElementById('md-rendered');
        if (sourceEl && targetEl) {
          targetEl.textContent = sourceEl.textContent;
        }
      });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for external use
  window.__vcSkipNextReload = false;
})();
