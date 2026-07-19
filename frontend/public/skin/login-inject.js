/**
 * Future Staff — Login Page Injection Script
 *
 * Runs after React renders the Clawith login page.
 * Replaces the DOM with a completely new design.
 * Zero modifications to source code.
 */
(function () {
  'use strict';

  const FS_LANG = document.documentElement.lang === 'zh-CN' ? 'zh' : 'en';

  const COPY = {
    zh: {
      brand: 'Future Staff',
      tagline: '让每个小企业都雇得起数字员工',
      desc: 'AI 驱动的数字员工平台，整合 ERP、电商、协作工具，为你的团队注入智能动力。',
      feat1Title: '智能 ERP',
      feat1Desc: '订单、库存、财务，一句话搞定',
      feat2Title: '数字员工',
      feat2Desc: '7×24 小时在线的 AI 团队成员',
      feat3Title: '全渠道协作',
      feat3Desc: '飞书、钉钉、企微无缝连接',
      loginTitle: '登录',
      registerTitle: '注册',
    },
    en: {
      brand: 'Future Staff',
      tagline: 'AI employees for every small business',
      desc: 'An AI-powered digital employee platform integrating ERP, e-commerce, and collaboration tools to supercharge your team.',
      feat1Title: 'Smart ERP',
      feat1Desc: 'Orders, inventory, finance — one command away',
      feat2Title: 'Digital Employees',
      feat2Desc: 'AI team members working 24/7 for you',
      feat3Title: 'Omni-channel',
      feat3Desc: 'Seamless Feishu, DingTalk, WeCom integration',
      loginTitle: 'Sign in',
      registerTitle: 'Create account',
    },
  };

  const t = COPY[FS_LANG] || COPY.en;

  function buildHeroHTML() {
    return `
      <div id="fs-login-brand">
        <div id="fs-login-logo">FS</div>
        <h1>${t.brand}</h1>
        <p>${t.desc}</p>
        <div id="fs-login-features">
          <div class="fs-feature-item">
            <div class="fs-feature-icon">📊</div>
            <div class="fs-feature-text">
              <strong>${t.feat1Title}</strong>
              ${t.feat1Desc}
            </div>
          </div>
          <div class="fs-feature-item">
            <div class="fs-feature-icon">🤖</div>
            <div class="fs-feature-text">
              <strong>${t.feat2Title}</strong>
              ${t.feat2Desc}
            </div>
          </div>
          <div class="fs-feature-item">
            <div class="fs-feature-icon">💬</div>
            <div class="fs-feature-text">
              <strong>${t.feat3Title}</strong>
              ${t.feat3Desc}
            </div>
          </div>
        </div>
      </div>`;
  }

  function buildFormHTML() {
    return `
      <div id="fs-login-form">
        <div id="fs-login-form-inner">
          <h2 id="fs-form-title">${t.loginTitle}</h2>
          <p class="fs-subtitle">${t.tagline}</p>
          <!-- React form will be positioned here by CSS -->
        </div>
      </div>`;
  }

  function inject() {
    // Don't re-inject
    if (document.getElementById('fs-login-root')) return;

    // Wait for React to render the login page
    const heroEl = document.querySelector('.atlas-login-hero');
    if (!heroEl) return false; // Not on login page

    // Create our root
    const root = document.createElement('div');
    root.id = 'fs-login-root';
    root.innerHTML = buildHeroHTML() + buildFormHTML();

    // Insert into the atlas-page, before the frame body
    const atlasPage = document.querySelector('.atlas-page');
    if (atlasPage) {
      atlasPage.insertBefore(root, atlasPage.firstChild);
    }

    // Position the React form inside our form panel
    const formWrapper = document.querySelector('.atlas-login-form-wrapper');
    const formInner = document.getElementById('fs-login-form-inner');
    if (formWrapper && formInner) {
      // Move the form elements into our container
      const loginFormHeader = formWrapper.querySelector('.login-form-header');
      const form = formWrapper.querySelector('form') || formWrapper.querySelector('.atlas-form');
      const socialBtns = formWrapper.querySelectorAll('.atlas-social-btn, .atlas-divider, .atlas-btn-ghost');
      const footer = formWrapper.querySelector('.atlas-login-footer');

      // Hide the title we injected (React has its own)
      const fsTitle = document.getElementById('fs-form-title');
      if (fsTitle) fsTitle.style.display = 'none';
      const fsSub = formInner.querySelector('.fs-subtitle');
      if (fsSub) fsSub.style.display = 'none';

      // Append React form elements
      Array.from(formWrapper.children).forEach(child => {
        if (child.id !== 'fs-login-root' && !child.contains(root)) {
          formInner.appendChild(child);
        }
      });
    }

    return true;
  }

  // Try to inject immediately, then retry with MutationObserver
  if (!inject()) {
    const observer = new MutationObserver(function () {
      if (inject()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Safety: stop observing after 10s
    setTimeout(function () { observer.disconnect(); }, 10000);
  }
})();
