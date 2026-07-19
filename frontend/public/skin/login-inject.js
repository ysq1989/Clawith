/**
 * Future Staff — Login Page v2: 3D Globe + White Theme
 *
 * Pure Canvas 3D globe (no dependencies).
 * Injects new DOM after React renders.
 */
(function () {
  'use strict';

  var LANG = document.documentElement.lang === 'zh-CN' ? 'zh' : 'en';
  var COPY = {
    zh: {
      brand: 'Future Staff',
      tagline: 'AI 驱动的数字员工平台，让每个小企业都雇得起数字员工。',
      loginTitle: '登录',
      loginDesc: '欢迎回来，请登录你的账户',
      registerTitle: '注册',
      registerDesc: '创建你的 Future Staff 账户',
    },
    en: {
      brand: 'Future Staff',
      tagline: 'AI-powered digital employee platform. AI employees for every small business.',
      loginTitle: 'Sign in',
      loginDesc: 'Welcome back! Sign in to your account.',
      registerTitle: 'Create account',
      registerDesc: 'Set up your Future Staff account.',
    }
  };
  var t = COPY[LANG] || COPY.en;

  // ── 3D Globe Renderer (pure Canvas) ──────────────
  var globeAnim = null;

  function createGlobe(canvas) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width = canvas.offsetWidth * 2;
    var H = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(1, 1);

    var cx = W / 2, cy = H / 2;
    var R = Math.min(W, H) * 0.35;
    var rotationY = 0;
    var rotationX = -0.3;

    // Generate sphere points (latitude/longitude grid)
    var points = [];
    var rings = 24;
    var segs = 48;
    for (var i = 0; i <= rings; i++) {
      var lat = (Math.PI * i / rings) - Math.PI / 2;
      for (var j = 0; j < segs; j++) {
        var lon = (2 * Math.PI * j / segs);
        points.push({
          x: Math.cos(lat) * Math.cos(lon),
          y: Math.sin(lat),
          z: Math.cos(lat) * Math.sin(lon),
        });
      }
    }

    // Connection lines (random arcs)
    var arcs = [];
    for (var k = 0; k < 18; k++) {
      var i1 = Math.floor(Math.random() * points.length);
      var i2 = Math.floor(Math.random() * points.length);
      arcs.push([i1, i2]);
    }

    function rotate(p, ry, rx) {
      // Y rotation
      var x1 = p.x * Math.cos(ry) - p.z * Math.sin(ry);
      var z1 = p.x * Math.sin(ry) + p.z * Math.cos(ry);
      // X rotation
      var y2 = p.y * Math.cos(rx) - z1 * Math.sin(rx);
      var z2 = p.y * Math.sin(rx) + z1 * Math.cos(rx);
      return { x: x1, y: y2, z: z2 };
    }

    function project(p) {
      var scale = 1 / (1 + p.z * 0.3);
      return {
        x: cx + p.x * R * scale,
        y: cy + p.y * R * scale,
        z: p.z,
        scale: scale,
      };
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      rotationY += 0.003;

      // Draw globe outline (subtle circle)
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw meridian / parallel lines
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.06)';
      ctx.lineWidth = 0.8;
      for (var i = 0; i <= 8; i++) {
        ctx.beginPath();
        for (var j = 0; j <= 60; j++) {
          var lat = (Math.PI * i / 8) - Math.PI / 2;
          var lon = (2 * Math.PI * j / 60);
          var raw = { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
          var r = rotate(raw, rotationY, rotationX);
          var s = project(r);
          if (r.z < -0.1) continue;
          if (j === 0 || (r.z < -0.1)) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
      }
      for (var i = 0; i <= 12; i++) {
        ctx.beginPath();
        for (var j = 0; j <= 60; j++) {
          var lon = (2 * Math.PI * i / 12);
          var lat = (Math.PI * j / 60) - Math.PI / 2;
          var raw = { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
          var r = rotate(raw, rotationY, rotationX);
          var s = project(r);
          if (r.z < -0.1) continue;
          if (j === 0 || (r.z < -0.1)) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
      }

      // Draw dots
      var drawn = [];
      for (var i = 0; i < points.length; i++) {
        var r = rotate(points[i], rotationY, rotationX);
        var s = project(r);
        drawn.push({ sx: s.x, sy: s.y, sz: r.z, ss: s.scale });
        if (r.z < -0.05) continue;
        var alpha = (r.z + 1) / 2;
        var size = 1.5 * s.scale;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(37, 99, 235, ' + (alpha * 0.5) + ')';
        ctx.fill();
      }

      // Draw connection arcs
      for (var k = 0; k < arcs.length; k++) {
        var a = drawn[arcs[k][0]];
        var b = drawn[arcs[k][1]];
        if (!a || !b) continue;
        if (a.sz < -0.1 || b.sz < -0.1) continue;
        var alpha = Math.min(a.sz, b.sz);
        alpha = (alpha + 1) / 2 * 0.25;
        ctx.beginPath();
        // Curved line via quadratic bezier
        var mx = (a.sx + b.sx) / 2;
        var my = (a.sy + b.sy) / 2 - 30;
        ctx.moveTo(a.sx, a.sy);
        ctx.quadraticCurveTo(mx, my, b.sx, b.sy);
        ctx.strokeStyle = 'rgba(37, 99, 235, ' + alpha + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw glowing dots at arc endpoints
      for (var k = 0; k < arcs.length; k++) {
        var a = drawn[arcs[k][0]];
        var b = drawn[arcs[k][1]];
        if (!a || !b) continue;
        [a, b].forEach(function (p) {
          if (p.sz < 0.2) return;
          var alpha = (p.sz + 1) / 2;
          var grd = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, 6 * p.ss);
          grd.addColorStop(0, 'rgba(59, 130, 246, ' + (alpha * 0.8) + ')');
          grd.addColorStop(1, 'rgba(59, 130, 246, 0)');
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, 6 * p.ss, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        });
      }

      globeAnim = requestAnimationFrame(draw);
    }

    draw();
  }

  // ── DOM Injection ─────────────────────────────────
  function inject() {
    if (document.getElementById('fs-login-root')) return true;
    var heroEl = document.querySelector('.atlas-login-hero');
    if (!heroEl) return false;

    var root = document.createElement('div');
    root.id = 'fs-login-root';

    // Left: Globe panel (globe only, no brand)
    var globePanel = document.createElement('div');
    globePanel.id = 'fs-globe-panel';
    globePanel.innerHTML =
      '<div class="fs-particle"></div>' +
      '<div class="fs-particle"></div>' +
      '<div class="fs-particle"></div>' +
      '<div class="fs-particle"></div>' +
      '<div class="fs-particle"></div>' +
      '<canvas id="globe-canvas"></canvas>';

    // Right: Form panel with brand above form
    var formPanel = document.createElement('div');
    formPanel.id = 'fs-form-panel';
    formPanel.innerHTML =
      '<div id="fs-form-inner">' +
        '<div id="fs-form-brand">' +
          '<div class="fs-logo-row">' +
            '<div class="fs-logo-icon">FS</div>' +
            '<div class="fs-brand-name">' + t.brand + '</div>' +
          '</div>' +
          '<p class="fs-brand-tagline">' + t.tagline + '</p>' +
        '</div>' +
        '<h2 id="fs-form-title">' + t.loginTitle + '</h2>' +
        '<p class="fs-form-desc">' + t.loginDesc + '</p>' +
      '</div>';

    root.appendChild(globePanel);
    root.appendChild(formPanel);

    var atlasPage = document.querySelector('.atlas-page');
    if (atlasPage) atlasPage.insertBefore(root, atlasPage.firstChild);

    // Move React form elements into our form panel
    var formWrapper = document.querySelector('.atlas-login-form-wrapper');
    var formInner = document.getElementById('fs-form-inner');
    if (formWrapper && formInner) {
      // Hide injected title (React has its own)
      var fsTitle = document.getElementById('fs-form-title');
      if (fsTitle) fsTitle.style.display = 'none';
      var fsDesc = formInner.querySelector('.fs-form-desc');
      if (fsDesc) fsDesc.style.display = 'none';

      // Move all React children into our container
      var children = Array.from(formWrapper.children);
      children.forEach(function (child) {
        if (!child.contains(root)) formInner.appendChild(child);
      });
    }

    // Start globe animation
    setTimeout(function () {
      var canvas = document.getElementById('globe-canvas');
      if (canvas) createGlobe(canvas);
    }, 100);

    return true;
  }

  // ── Init ──────────────────────────────────────────
  if (!inject()) {
    var obs = new MutationObserver(function () {
      if (inject()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 10000);
  }

  // Cleanup on page leave
  window.addEventListener('beforeunload', function () {
    if (globeAnim) cancelAnimationFrame(globeAnim);
  });
})();
