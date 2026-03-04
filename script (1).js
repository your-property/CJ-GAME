/* ============================================================
   Property Inspection — script.js  (Ultra Premium Edition)
   Crystalline loader · Performance-optimised · Clean cursor
   ============================================================ */

var EJ_KEY = '_yAz4PMpNoZOAzlbu';
var EJ_SVC = 'service_9ouz7yj';
var EJ_TPL = 'template_n1sh6jm';

/* ══════════════════════════════════════════
   LOADING SCREEN — Minimum 2.4s, premium exit
══════════════════════════════════════════ */
var loaderStart = Date.now();
var loaderMinTime = 2400;

function hideLoader() {
  var elapsed = Date.now() - loaderStart;
  var remaining = Math.max(0, loaderMinTime - elapsed);
  setTimeout(function() {
    var loader = document.getElementById('page-loader');
    if (!loader) return;
    loader.classList.add('hidden');
    setTimeout(function() {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 950);
  }, remaining);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hideLoader);
} else {
  hideLoader();
}

/* ══════════════════════════════════════════
   CUSTOM CURSOR — lightweight, no trail
══════════════════════════════════════════ */
var cur = document.getElementById('cursor');
var fol = document.getElementById('cursorFollower');

if (cur && fol && window.matchMedia('(hover: hover)').matches) {
  var mx = 0, my = 0, fx = 0, fy = 0;
  var raf = null;

  document.addEventListener('mousemove', function(e) {
    mx = e.clientX; my = e.clientY;
    cur.style.transform = 'translate(' + (mx - 4) + 'px,' + (my - 4) + 'px)';
    if (!raf) raf = requestAnimationFrame(followerTick);
  }, { passive: true });

  function followerTick() {
    fx += (mx - fx) * 0.11;
    fy += (my - fy) * 0.11;
    fol.style.transform = 'translate(' + (fx - 17) + 'px,' + (fy - 17) + 'px)';
    if (Math.abs(mx - fx) > 0.4 || Math.abs(my - fy) > 0.4) {
      raf = requestAnimationFrame(followerTick);
    } else {
      raf = null;
    }
  }
}

/* ══════════════════════════════════════════
   HEADER SCROLL — throttled rAF
══════════════════════════════════════════ */
var hdr = document.getElementById('header');
var scrollTicking = false;

window.addEventListener('scroll', function() {
  if (!scrollTicking) {
    requestAnimationFrame(function() {
      if (hdr) hdr.classList.toggle('scrolled', window.scrollY > 60);
      var sy = window.scrollY * 0.055;
      var orbs = document.querySelectorAll('.lq-orb');
      if (orbs[0]) orbs[0].style.transform = 'translateY(' + sy + 'px)';
      if (orbs[1]) orbs[1].style.transform = 'translateY(' + (-sy * 0.75) + 'px)';
      scrollTicking = false;
    });
    scrollTicking = true;
  }
}, { passive: true });

/* ══════════════════════════════════════════
   MOBILE NAV
══════════════════════════════════════════ */
var burger = document.getElementById('hamburger');
var mnav   = document.getElementById('mobileNav');

if (burger && mnav) {
  burger.addEventListener('click', function() {
    var isOpen = burger.classList.toggle('open');
    mnav.classList.toggle('open', isOpen);
    burger.setAttribute('aria-expanded', isOpen);
  });
}

/* ══════════════════════════════════════════
   SMOOTH SCROLL
══════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(function(a) {
  a.addEventListener('click', function(e) {
    var h = this.getAttribute('href');
    if (h && h.length > 1) {
      e.preventDefault();
      if (burger) burger.classList.remove('open');
      if (mnav)   mnav.classList.remove('open');
      var t = document.querySelector(h);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ══════════════════════════════════════════
   REVEAL ANIMATIONS
══════════════════════════════════════════ */
var cardObserver = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) {
      var delay = parseInt(e.target.dataset.delay || 0);
      setTimeout(function() { e.target.classList.add('visible'); }, delay);
      cardObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.10 });

document.querySelectorAll('.service-card').forEach(function(c) {
  cardObserver.observe(c);
});

function setupReveal(sel) {
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e, i) {
      if (e.isIntersecting) {
        setTimeout(function() {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
        }, i * 70);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll(sel).forEach(function(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(26px)';
    el.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
    obs.observe(el);
  });
}
setupReveal('.price-card');
setupReveal('.contact-card');
setupReveal('.bi-item');
setupReveal('.about-stat-card');
setupReveal('.about-feature');

/* ══════════════════════════════════════════
   GLASS CURSOR SPOTLIGHT
══════════════════════════════════════════ */
document.querySelectorAll('.liquid-glass').forEach(function(el) {
  el.addEventListener('mousemove', function(e) {
    var rect = el.getBoundingClientRect();
    var x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    var y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
    el.style.setProperty('--lx', x + '%');
    el.style.setProperty('--ly', y + '%');
    var spot = el.querySelector('.lq-spot');
    if (spot) {
      spot.style.background = 'radial-gradient(circle at ' + x + '% ' + y + '%, rgba(200,148,15,0.08) 0%, transparent 58%)';
    }
  }, { passive: true });
});

/* ══════════════════════════════════════════
   BUTTON RIPPLE
══════════════════════════════════════════ */
document.querySelectorAll('.btn-primary, .btn-ghost, .btn-whatsapp, .btn-header, .btn-book, .btn-bundle, .service-cta').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    var r    = document.createElement('span');
    r.className = 'btn-ripple';
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 1.6;
    r.style.width  = size + 'px';
    r.style.height = size + 'px';
    r.style.left   = (e.clientX - rect.left  - size / 2) + 'px';
    r.style.top    = (e.clientY - rect.top   - size / 2) + 'px';
    btn.appendChild(r);
    setTimeout(function() { if (r.parentNode) r.parentNode.removeChild(r); }, 700);
  });
});

/* ══════════════════════════════════════════
   MIN BOOKING DATE
══════════════════════════════════════════ */
var di = document.getElementById('fdate');
if (di) {
  var tm = new Date(); tm.setDate(tm.getDate() + 1);
  di.min = tm.toISOString().split('T')[0];
}

/* ══════════════════════════════════════════
   TOAST NOTIFICATION
══════════════════════════════════════════ */
function toast(msg, type) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = [
      'position:fixed', 'bottom:96px', 'right:22px', 'z-index:9999',
      'padding:14px 24px', 'border-radius:14px', 'font-size:0.88rem',
      "font-family:'Outfit',sans-serif", 'font-weight:600',
      'max-width:344px', 'line-height:1.55',
      'transition:all 0.32s ease', 'opacity:0', 'transform:translateY(12px)',
      'box-shadow:0 12px 36px rgba(60,40,10,0.14)',
      'backdrop-filter:blur(20px)', '-webkit-backdrop-filter:blur(20px)'
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  if (type === 'error') {
    t.style.background = 'rgba(255,232,232,0.95)';
    t.style.border = '1px solid rgba(200,50,50,0.16)';
    t.style.color = '#8B2020';
  } else if (type === 'info') {
    t.style.background = 'rgba(255,255,255,0.95)';
    t.style.border = '1px solid rgba(200,148,15,0.20)';
    t.style.color = '#5C5448';
  } else {
    t.style.background = 'rgba(232,248,239,0.96)';
    t.style.border = '1px solid rgba(26,158,82,0.20)';
    t.style.color = '#1A4A32';
  }
  requestAnimationFrame(function() {
    t.style.opacity = '1';
    t.style.transform = 'translateY(0)';
  });
  clearTimeout(t._timeout);
  t._timeout = setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateY(12px)';
  }, 4400);
}

/* ══════════════════════════════════════════
   SUCCESS MODAL
══════════════════════════════════════════ */
function showSuccess() {
  var ov = document.createElement('div');
  ov.id = 'ezSuccess';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(249,247,242,0.88);backdrop-filter:blur(32px);-webkit-backdrop-filter:blur(32px);display:flex;align-items:center;justify-content:center;padding:20px;animation:ezFadeIn 0.28s ease;';

  var card = document.createElement('div');
  card.style.cssText = [
    'background:rgba(255,255,255,0.93)', 'border:1px solid rgba(255,255,255,0.98)',
    'border-radius:32px', 'padding:56px 48px 48px', 'max-width:490px', 'width:100%',
    'text-align:center', 'position:relative',
    'box-shadow:0 0 0 1px rgba(200,148,15,0.07),0 36px 90px rgba(60,40,10,0.14),inset 0 2px 0 rgba(255,255,255,1)',
    'animation:ezSlideUp 0.50s cubic-bezier(0.34,1.56,0.64,1)',
    'backdrop-filter:blur(24px)'
  ].join(';');

  var xBtn = document.createElement('button');
  xBtn.innerHTML = '&times;';
  xBtn.style.cssText = "position:absolute;top:20px;right:24px;background:none;border:none;cursor:pointer;color:#C4BAA8;font-size:2.2rem;line-height:1;transition:color 0.2s;padding:0;";
  xBtn.onmouseover = function() { xBtn.style.color = '#C8940F'; };
  xBtn.onmouseout  = function() { xBtn.style.color = '#C4BAA8'; };

  var ic = document.createElement('div');
  ic.style.cssText = 'width:88px;height:88px;margin:0 auto 30px;background:rgba(200,148,15,0.08);border:1px solid rgba(200,148,15,0.18);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 36px rgba(200,148,15,0.14);';
  ic.innerHTML = '<svg width="36" height="54" viewBox="0 0 40 60" fill="none"><polygon points="22,0 6,34 18,34 14,60 36,22 24,22" fill="url(%23sg2)"/><defs><linearGradient id="sg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F5C518"/><stop offset="100%" stop-color="#C8940F"/></linearGradient></defs></svg>';

  var h2 = document.createElement('h2');
  h2.textContent = 'Booking Sent!';
  h2.style.cssText = "font-family:'Bebas Neue',sans-serif;font-size:2.7rem;letter-spacing:0.06em;background:linear-gradient(135deg,#F5C518,#C8940F);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:14px;";

  var msg = document.createElement('p');
  msg.innerHTML = 'Your booking request has been received.<br>We will contact you shortly to confirm.';
  msg.style.cssText = 'color:#5C5448;font-size:0.95rem;line-height:1.78;margin-bottom:32px;';

  var divEl = document.createElement('div');
  divEl.style.cssText = 'height:1px;background:rgba(200,148,15,0.09);margin-bottom:28px;';

  var ql = document.createElement('p');
  ql.textContent = 'Need to reach us sooner?';
  ql.style.cssText = 'color:#C4BAA8;font-size:0.80rem;margin-bottom:16px;';

  var cr = document.createElement('div');
  cr.style.cssText = 'display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:32px;';

  var callA = document.createElement('a');
  callA.href = 'tel:0754320577'; callA.textContent = 'Call Us';
  callA.style.cssText = "display:inline-flex;align-items:center;gap:6px;padding:12px 24px;background:rgba(200,148,15,0.07);border:1px solid rgba(200,148,15,0.20);border-radius:10px;color:#C8940F;font-family:'Outfit',sans-serif;font-weight:700;font-size:0.85rem;text-decoration:none;transition:all 0.2s;";
  callA.onmouseover = function() { callA.style.background = 'rgba(200,148,15,0.14)'; };
  callA.onmouseout  = function() { callA.style.background = 'rgba(200,148,15,0.07)'; };

  var waA = document.createElement('a');
  waA.href = 'https://wa.me/27754320577'; waA.target = '_blank'; waA.rel = 'noopener noreferrer';
  waA.textContent = 'WhatsApp';
  waA.style.cssText = "display:inline-flex;align-items:center;gap:6px;padding:12px 24px;background:rgba(26,158,82,0.07);border:1px solid rgba(26,158,82,0.20);border-radius:10px;color:#1A9E52;font-family:'Outfit',sans-serif;font-weight:700;font-size:0.85rem;text-decoration:none;transition:all 0.2s;";
  waA.onmouseover = function() { waA.style.background = 'rgba(26,158,82,0.14)'; };
  waA.onmouseout  = function() { waA.style.background = 'rgba(26,158,82,0.07)'; };
  cr.appendChild(callA); cr.appendChild(waA);

  var closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = "width:100%;padding:18px;background:linear-gradient(135deg,#F5C518,#C8940F);color:#000;font-family:'Outfit',sans-serif;font-weight:800;font-size:0.95rem;border:none;border-radius:14px;cursor:pointer;letter-spacing:0.04em;transition:all 0.24s;box-shadow:0 4px 20px rgba(200,148,15,0.28);";
  closeBtn.onmouseover = function() { closeBtn.style.transform = 'translateY(-2px)'; closeBtn.style.boxShadow = '0 12px 34px rgba(200,148,15,0.40)'; };
  closeBtn.onmouseout  = function() { closeBtn.style.transform = 'translateY(0)'; closeBtn.style.boxShadow = '0 4px 20px rgba(200,148,15,0.28)'; };

  card.appendChild(xBtn); card.appendChild(ic); card.appendChild(h2);
  card.appendChild(msg); card.appendChild(divEl); card.appendChild(ql);
  card.appendChild(cr); card.appendChild(closeBtn);
  ov.appendChild(card);
  document.body.appendChild(ov);
  document.getElementById('bookingForm').reset();

  function closeModal() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
  xBtn.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  ov.addEventListener('click', function(e) { if (e.target === ov) closeModal(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', esc); }
  });
}

/* ══════════════════════════════════════════
   INJECT KEYFRAMES
══════════════════════════════════════════ */
var ks = document.createElement('style');
ks.textContent = '@keyframes spin{to{transform:rotate(360deg);}}@keyframes ezFadeIn{from{opacity:0}to{opacity:1}}@keyframes ezSlideUp{from{opacity:0;transform:translateY(42px) scale(0.94)}to{opacity:1;transform:translateY(0) scale(1)}}';
document.head.appendChild(ks);

/* ══════════════════════════════════════════
   FORM SUBMIT
══════════════════════════════════════════ */
var submitBtn = document.getElementById('submitBtn');
if (submitBtn) {
  submitBtn.addEventListener('click', function() {
    var name     = document.getElementById('fname').value.trim();
    var phone    = document.getElementById('fphone').value.trim();
    var email    = document.getElementById('femail').value.trim();
    var address  = document.getElementById('faddress').value.trim();
    var date     = document.getElementById('fdate').value;
    var time     = document.getElementById('ftime').value;
    var notes    = document.getElementById('fnotes').value.trim();
    var services = Array.from(document.querySelectorAll('.svc-check:checked')).map(function(c) { return c.value; }).join(', ');

    if (!name || !phone || !email || !address || !date || !services) {
      toast('Please fill in all required fields and select at least one service.', 'error'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('Please enter a valid email address.', 'error'); return;
    }

    var btn   = document.getElementById('submitBtn');
    var lbl   = document.getElementById('btnLabel');
    var iSend = document.getElementById('iconSend');
    var iSpin = document.getElementById('iconSpin');
    btn.disabled = true; lbl.textContent = 'Sending…';
    iSend.style.display = 'none'; iSpin.style.display = 'inline-block'; btn.style.opacity = '0.75';

    fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EJ_SVC, template_id: EJ_TPL, user_id: EJ_KEY,
        template_params: {
          from_name: name, from_email: email, phone: phone,
          address: address, services: services, date: date,
          time: time || 'Flexible', notes: notes || 'None', reply_to: email
        }
      })
    }).then(function(res) {
      btn.disabled = false; lbl.textContent = 'Send Booking Request';
      iSend.style.display = 'inline-block'; iSpin.style.display = 'none'; btn.style.opacity = '1';
      if (res.ok) { showSuccess(); }
      else { return res.text().then(function(t) { throw new Error(t); }); }
    }).catch(function(err) {
      btn.disabled = false; lbl.textContent = 'Send Booking Request';
      iSend.style.display = 'inline-block'; iSpin.style.display = 'none'; btn.style.opacity = '1';
      console.error('Send error:', err);
      toast('Could not send email. Opening WhatsApp instead…', 'info');
      var waMsg = encodeURIComponent(
        '*BOOKING REQUEST - Property Inspection*\n\n' +
        '*Name:* ' + name + '\n*Phone:* ' + phone + '\n*Email:* ' + email +
        '\n*Address:* ' + address + '\n\n*Services:* ' + services +
        '\n*Date:* ' + date + '\n*Time:* ' + (time || 'Flexible') +
        '\n\n*Notes:* ' + (notes || 'None')
      );
      setTimeout(function() { window.open('https://wa.me/27754320577?text=' + waMsg, '_blank'); }, 1300);
    });
  });
}

/* ── WHATSAPP FORM BUTTON ── */
var waFormBtn = document.getElementById('waFormBtn');
if (waFormBtn) {
  waFormBtn.addEventListener('click', function(e) {
    var name     = document.getElementById('fname').value.trim();
    var phone    = document.getElementById('fphone').value.trim();
    var address  = document.getElementById('faddress').value.trim();
    var date     = document.getElementById('fdate').value;
    var time     = document.getElementById('ftime').value;
    var services = Array.from(document.querySelectorAll('.svc-check:checked')).map(function(c) { return c.value; }).join(', ');
    var notes    = document.getElementById('fnotes').value.trim();
    if (name || address || services) {
      e.preventDefault();
      var waText = encodeURIComponent(
        '*BOOKING REQUEST - Property Inspection*\n\n' +
        '*Name:* ' + (name || '--') + '\n*Phone:* ' + (phone || '--') +
        '\n*Address:* ' + (address || '--') + '\n\n*Services:* ' + (services || '--') +
        '\n*Date:* ' + (date || '--') + '\n*Time:* ' + (time || 'Flexible') +
        '\n\n*Notes:* ' + (notes || 'None')
      );
      window.open('https://wa.me/27754320577?text=' + waText, '_blank');
    }
  });
}

/* ══════════════════════════════════════════
   PREMIUM ENHANCEMENTS — Liquid Luxury
══════════════════════════════════════════ */

/* Magnetic effect on CTA buttons */
document.querySelectorAll('.btn-primary, .btn-ghost, .btn-header').forEach(function(btn) {
  btn.addEventListener('mousemove', function(e) {
    var r = btn.getBoundingClientRect();
    var dx = (e.clientX - r.left - r.width / 2) * 0.22;
    var dy = (e.clientY - r.top - r.height / 2) * 0.22;
    btn.style.transform = 'translate(' + dx + 'px,' + dy + 'px) translateY(-4px)';
  }, {passive:true});
  btn.addEventListener('mouseleave', function() {
    btn.style.transform = '';
  });
});

/* Parallax hero orbs on scroll */
var heroOrbs = document.querySelectorAll('.orb');
var heroSection = document.querySelector('.hero');
var parallaxRaf = null;

window.addEventListener('scroll', function() {
  if (!parallaxRaf) {
    parallaxRaf = requestAnimationFrame(function() {
      var sy = window.scrollY;
      if (heroOrbs[0]) heroOrbs[0].style.transform = 'translate(0,' + (sy * 0.12) + 'px)';
      if (heroOrbs[1]) heroOrbs[1].style.transform = 'translate(0,' + (sy * -0.08) + 'px)';
      if (heroOrbs[2]) heroOrbs[2].style.transform = 'translate(0,' + (sy * 0.06) + 'px)';
      // Fade hero on scroll
      if (heroSection) {
        var heroH = heroSection.offsetHeight;
        var ratio = Math.min(sy / (heroH * 0.6), 1);
        var heroContent = heroSection.querySelector('.hero-content');
        if (heroContent) {
          heroContent.style.opacity = 1 - ratio * 0.4;
          heroContent.style.transform = 'translateY(' + (sy * 0.04) + 'px)';
        }
      }
      parallaxRaf = null;
    });
  }
}, {passive:true});

/* Stagger number counter animation */
function animateNumber(el, target, duration) {
  var start = 0;
  var startTime = null;
  var isPlus = target.toString().includes('+');
  var num = parseInt(target);
  function step(ts) {
    if (!startTime) startTime = ts;
    var progress = Math.min((ts - startTime) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.round(eased * num);
    el.textContent = current + (isPlus ? '+' : '') + (target.toString().includes('%') ? '%' : '');
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

var numObs = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) {
      var el = e.target;
      var raw = el.getAttribute('data-count');
      if (raw) { animateNumber(el, raw, 1600); numObs.unobserve(el); }
    }
  });
}, {threshold: 0.5});

/* Tag stat numbers */
document.querySelectorAll('.stat-num, .asc-num').forEach(function(el) {
  var txt = el.textContent.trim();
  if (/^\d+/.test(txt)) {
    el.setAttribute('data-count', txt);
    el.textContent = '0';
    numObs.observe(el);
  }
});

/* Section head section lines reveal */
setupReveal('.section-head');
setupReveal('.bundle-banner');

/* Enhanced card glass tilt */
document.querySelectorAll('.service-card, .price-card, .about-stat-card').forEach(function(card) {
  card.addEventListener('mousemove', function(e) {
    var r = card.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - 0.5;
    var y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = 'translateY(-12px) rotateX(' + (-y * 5) + 'deg) rotateY(' + (x * 5) + 'deg) scale(1.01)';
  }, {passive:true});
  card.addEventListener('mouseleave', function() {
    card.style.transform = '';
    card.style.transition = 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1)';
  });
});
