/* ============================================================
   Калькулятор печати на шарах — vanilla-порт компонента DCLogic.
   Разметка — в index.html (БЭМ), стили — в styles.css.
   Здесь только данные, состояние и точечное обновление DOM.
   Инлайн-стили не используются, кроме data-driven значений:
   background свотчей/точек и CSS-переменные шара.
   ============================================================ */
(function () {
  'use strict';

  // ============================================================
  //  ЦЕНЫ — редактируйте здесь. Цена за 1 шар (руб) по тиражу.
  //  Столбцы: [1+0, 1+1, 2+0, 2+1, 2+2]
  //  (тиражи 2000+ по правилу «свыше 1000 — как за 1000»)
  // ============================================================
  var PRICES = {
    25: [60, 65, 75, 95, 105],
    50: [50, 55, 60, 80, 85],
    100: [29, 35, 50, 60, 70],
    200: [20, 25, 40, 45, 50],
    300: [18, 24, 40, 45, 50],
    400: [17, 22, 40, 45, 50],
    500: [14, 19, 30, 35, 40],
    1000: [12, 16, 23, 26, 31],
    2000: [12, 16, 23, 26, 31],
    3000: [12, 16, 23, 26, 31],
    5000: [12, 16, 23, 26, 31],
    10000: [12, 16, 23, 26, 31],
  };
  var METALLIC_PER_BALL = 1.5;   // надбавка за шар металлик (золото/серебро)
  var DIFF_SIDES_FEE = 1000;     // разные логотипы с 2-х сторон (доп. рамка)

  var TIERS = [25, 50, 100, 200, 300, 400, 500, 1000, 2000, 3000, 5000, 10000];

  var SHARS = [
    { n: 'Прозрачный', bg: 'linear-gradient(135deg,#fdfdfb,#e9e8df)', light: true },
    { n: 'Белый', bg: '#ffffff', light: true },
    { n: 'Чёрный', bg: '#20201f' },
    { n: 'Синий', bg: '#1f52c4' },
    { n: 'Сиреневый', bg: '#9a86d6' },
    { n: 'Фиолетовый', bg: '#6a2fb5' },
    { n: 'Розовый', bg: '#f2a0c4' },
    { n: 'Фуксия', bg: '#d81b8c' },
    { n: 'Красный', bg: '#e01b22' },
    { n: 'Жёлтый', bg: '#f7d40a' },
    { n: 'Оранжевый', bg: '#f28a1a' },
    { n: 'Салатовый', bg: '#7ac70c' },
    { n: 'Зелёный', bg: '#1f9e3c' },
    { n: 'Бирюза', bg: '#16b3ad' },
    { n: 'Золото', bg: 'linear-gradient(135deg,#f6e27a,#c9a227 45%,#9a7b12 70%,#e8cf6b)', metallic: true },
    { n: 'Серебро', bg: 'linear-gradient(135deg,#f4f5f7,#b8bcc0 45%,#8a8f95 70%,#e6e8ea)', metallic: true },
  ];

  var PAINTS = [
    { n: 'Белый', bg: '#ffffff', light: true },
    { n: 'Розовый', bg: '#f2a0c4' },
    { n: 'Фуксия', bg: '#d81b8c' },
    { n: 'Золото', bg: 'linear-gradient(135deg,#f6e27a,#c9a227 55%,#9a7b12)', solid: '#c9a227' },
    { n: 'Красный', bg: '#e01b22' },
    { n: 'Коричневый', bg: '#7a4a12' },
    { n: 'Жёлтый', bg: '#f7d40a' },
    { n: 'Оранжевый', bg: '#f28a1a' },
    { n: 'Серебро', bg: 'linear-gradient(135deg,#f4f5f7,#b8bcc0 55%,#8a8f95)', solid: '#a9aeb3' },
    { n: 'Серый', bg: '#9aa0a6' },
    { n: 'Чёрный', bg: '#20201f' },
    { n: 'Зелёный', bg: '#1f9e3c' },
    { n: 'Голубой', bg: '#38b6ff' },
    { n: 'Сиреневый', bg: '#9a86d6' },
    { n: 'Фиолетовый', bg: '#6a2fb5' },
    { n: 'Синий', bg: '#1f52c4' },
  ];

  // варианты сторон/цветов 
  var OPTIONS = [
    { v: '1+0', label: '1+0 — 1 сторона, 1 цвет', a: 1, b: 0, col: 0, toggle: false },
    { v: '1+1', label: '1+1 — 2 стороны, 1 цвет', a: 1, b: 1, col: 1, toggle: true },
    { v: '2+0', label: '2+0 — 1 сторона, 2 цвета', a: 2, b: 0, col: 2, toggle: false },
    { v: '2+1', label: '2+1 — 2 стороны: 2 цвета и 1 цвет', a: 2, b: 1, col: 3, toggle: false },
    { v: '2+2', label: '2+2 — 2 стороны, по 2 цвета', a: 2, b: 2, col: 4, toggle: true },
  ];

  // ---------- Состояние ----------
  var state = {
    shar: 0,
    opt: '1+0',
    same: true,
    colorsA: [10],   // Чёрный
    colorsB: [10],
    qty: 50,
  };

  var submitting = false;

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    balloonBody: $('balloon-body'),
    balloonShadow: document.querySelector('.balloon__shadow'),
    logoFront: $('logo-front-el'),
    logoLeft: $('logo-left-el'),
    logoRight: $('logo-right-el'),
    sharName: $('shar-name'),
    sharSwatches: $('shar-swatches'),
    optSelect: $('opt-select'),
    sameToggle: $('same-toggle'),
    sameTrue: $('same-true'),
    sameFalse: $('same-false'),
    colorsA: $('colors-a'),
    colorsB: $('colors-b'),
    sideB: $('side-b'),
    qtySelect: $('qty-select'),
    totalValue: $('total-value'),
    totalPer: $('total-per'),
    orderBtn: $('order-btn'),
    formCard: $('order-form-card'),
    form: $('order-form'),
    thanks: $('thanks'),
    submitBtn: $('submit-btn'),
    summarySharDot: $('summary-shar-dot'),
    summarySharName: $('summary-shar-name'),
    summaryOpt: $('summary-opt'),
    summaryColors: $('summary-colors'),
    summaryQty: $('summary-qty'),
    summaryTotal: $('summary-total'),
  };

  // ============================================================
  //  ТОЧКА ДЛЯ БЭКЕНДА — реализуйте отправку заказа здесь.
  //  Вызывается при отправке формы. orderData содержит выбранную
  //  конфигурацию и контакты. Верните Promise (async уже подходит).
  //
  //  Пример:
  //    return fetch('/api/order', {
  //      method: 'POST',
  //      headers: { 'Content-Type': 'application/json' },
  //      body: JSON.stringify(orderData),
  //    });
  //
  //  Пока функция пустая — поведение как в оригинале: сразу «Спасибо».
  // ============================================================
  async function submitOrder(orderData) {
    // ← ваша реализация здесь
    console.log('Заказ (демо, без отправки):', orderData);
  }

  // ---------- Утилиты ----------
  function opt() { return OPTIONS.find(function (o) { return o.v === state.opt; }); }

  function resize(arr, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(arr[i] != null ? arr[i] : 10);
    return out;
  }

  function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }

  function paintCss(i) { var p = PAINTS[i] || PAINTS[10]; return p.solid || p.bg; }


  function partColor(colors, part) {
    if ((part === 0 || part === 2) && colors.length > 1) return paintCss(colors[1]);
    return paintCss(colors[0]);
  }

  function calcPricing() {
    var o = opt();
    var tier = PRICES[state.qty] || PRICES[1000];
    var perBall = tier[o.col];
    var diffFee = (o.toggle && !state.same) ? DIFF_SIDES_FEE : 0;
    var metalFee = SHARS[state.shar].metallic ? METALLIC_PER_BALL * state.qty : 0;
    return { perBall: perBall, total: perBall * state.qty + diffFee + metalFee };
  }

  function showSideB() {
    var o = opt();
    return o.b > 0 && !(o.toggle && state.same);
  }

  // ---------- Логотипы (инлайн-symbol в index.html) ----------
  // Перекраска частей — через CSS-переменные на конкретном svg
  function paintLogo(svg, colors) {
    svg.style.setProperty('--logo-c0', partColor(colors, 0));
    svg.style.setProperty('--logo-c1', partColor(colors, 1));
    svg.style.setProperty('--logo-c2', partColor(colors, 2));
  }

  // ---------- Построение элементов ----------
  function buildSwatch(colorObj, selected, round) {
    var b = document.createElement('button');
    b.type = 'button';
    b.title = colorObj.n;
    b.className = 'swatch ' + (round ? 'swatch--round' : 'swatch--sq')
      + (colorObj.light ? ' swatch--light' : '')
      + (selected ? ' swatch--selected' : '');
    b.style.background = colorObj.bg;  // data-driven: цвет из данных
    return b;
  }

  // ---------- Рендер: превью шара ----------
  function renderBalloon() {
    var shar = SHARS[state.shar];

    // CSS-переменные шара (data-driven)
    var base = (typeof shar.bg === 'string' && shar.bg[0] === '#')
      ? ('linear-gradient(' + shar.bg + ',' + shar.bg + ')') : shar.bg;
    var bg = 'radial-gradient(130% 120% at 32% 24%, rgba(255,255,255,' + (shar.light ? '.5' : '.28')
      + ') 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,0) 62%, rgba(0,0,0,' + (shar.light ? '.10' : '.22')
      + ') 100%), ' + base;
    var shadow = shar.light
      ? 'drop-shadow(0 0 1px #c9c9bd) drop-shadow(0 3px 6px rgba(30,30,60,.22)) drop-shadow(0 18px 24px rgba(30,30,60,.28))'
      : 'drop-shadow(0 3px 6px rgba(30,30,60,.18)) drop-shadow(0 18px 24px rgba(30,30,60,.30))';

    el.balloonBody.style.setProperty('--balloon-bg', bg);
    el.balloonShadow.style.setProperty('--balloon-shadow', shadow);
    el.sharName.textContent = shar.n;

    // логотипы: 1 при односторонней печати, 2 при двухсторонней
    var o = opt();
    var twoSided = o.b > 0;
    var bColors = (o.toggle && state.same) ? state.colorsA : state.colorsB;
    // у svg нет свойства .hidden — переключаем атрибут (ловится CSS-правилом [hidden])
    el.logoFront.toggleAttribute('hidden', twoSided);
    el.logoLeft.toggleAttribute('hidden', !twoSided);
    el.logoRight.toggleAttribute('hidden', !twoSided);
    if (twoSided) {
      paintLogo(el.logoLeft, state.colorsA);
      paintLogo(el.logoRight, bColors);
    } else {
      paintLogo(el.logoFront, state.colorsA);
    }
  }

  // ---------- Рендер: свотчи шара ----------
  function renderSharSwatches() {
    el.sharSwatches.replaceChildren();
    SHARS.forEach(function (c, i) {
      var b = buildSwatch(c, state.shar === i, true);
      b.addEventListener('click', function () {
        state.shar = i;
        renderSharSwatches();
        renderBalloon();
        renderTotal();
      });
      el.sharSwatches.appendChild(b);
    });
  }

  // ---------- Рендер: ряды цветов логотипа ----------
  function renderColorRows(container, colorsKey, nColors) {
    container.replaceChildren();
    state[colorsKey].forEach(function (sel, slot) {
      var row = document.createElement('div');
      row.className = 'calc__color-row';

      var label = document.createElement('div');
      label.className = 'calc__color-row-label';
      label.textContent = nColors > 1 ? ('Цвет ' + (slot + 1)) : 'Цвет 1';
      row.appendChild(label);

      var grid = document.createElement('div');
      grid.className = 'calc__color-row-swatches';
      PAINTS.forEach(function (c, i) {
        var b = buildSwatch(c, sel === i, false);
        b.addEventListener('click', function () {
          state[colorsKey][slot] = i;
          renderColors();
          renderBalloon();
        });
        grid.appendChild(b);
      });
      row.appendChild(grid);
      container.appendChild(row);
    });
  }

  function renderColors() {
    var o = opt();
    renderColorRows(el.colorsA, 'colorsA', o.a);
    var sb = showSideB();
    el.sideB.hidden = !sb;
    if (sb) renderColorRows(el.colorsB, 'colorsB', o.b);
  }

  // ---------- Рендер: тумблер ----------
  function renderToggle() {
    var o = opt();
    el.sameToggle.hidden = !o.toggle;
    el.sameTrue.classList.toggle('calc__toggle-btn--active', state.same);
    el.sameFalse.classList.toggle('calc__toggle-btn--active', !state.same);
  }

  // ---------- Рендер: итог ----------
  function renderTotal() {
    var p = calcPricing();
    el.totalValue.textContent = fmt(p.total);
    el.totalPer.textContent = fmt(p.perBall) + ' руб./шт.';
  }

  function renderAll() {
    renderSharSwatches();
    renderToggle();
    renderColors();
    renderBalloon();
    renderTotal();
  }

  // ---------- Селекты (наполняются один раз) ----------
  function initSelects() {
    OPTIONS.forEach(function (x) {
      var op = document.createElement('option');
      op.value = x.v;
      op.textContent = x.label;
      el.optSelect.appendChild(op);
    });
    el.optSelect.value = state.opt;

    TIERS.forEach(function (t) {
      var op = document.createElement('option');
      op.value = t;
      op.textContent = t.toLocaleString('ru-RU');
      el.qtySelect.appendChild(op);
    });
    el.qtySelect.value = state.qty;
  }

  // ---------- Сводка заказа ----------
  function renderSummary() {
    var shar = SHARS[state.shar];
    var p = calcPricing();

    el.summarySharDot.style.background = shar.bg;
    el.summarySharName.textContent = shar.n;
    el.summaryOpt.textContent = state.opt;
    el.summaryQty.textContent = state.qty + ' шт.';
    el.summaryTotal.textContent = fmt(p.total) + ' руб.';

    var used = [];
    state.colorsA.forEach(function (i) { if (used.indexOf(i) === -1) used.push(i); });
    if (showSideB()) state.colorsB.forEach(function (i) { if (used.indexOf(i) === -1) used.push(i); });

    el.summaryColors.replaceChildren();
    used.forEach(function (i) {
      var dot = document.createElement('span');
      dot.className = 'order-form__dot';
      dot.style.background = PAINTS[i].bg;
      el.summaryColors.appendChild(dot);
    });
  }

  // ---------- Сбор данных заказа ----------
  function buildOrderData() {
    var o = opt();
    var p = calcPricing();
    return {
      shar: SHARS[state.shar].n,
      option: state.opt,
      sameBothSides: o.toggle ? state.same : null,
      qty: state.qty,
      colorsA: state.colorsA.map(function (i) { return PAINTS[i].n; }),
      colorsB: showSideB() ? state.colorsB.map(function (i) { return PAINTS[i].n; }) : null,
      pricePerBall: p.perBall,
      total: p.total,
      name: $('f-name').value,
      phone: $('f-phone').value,
      email: $('f-email').value,
      msg: $('f-msg').value,
    };
  }

  // ---------- События ----------
  el.optSelect.addEventListener('change', function () {
    var o = OPTIONS.find(function (x) { return x.v === el.optSelect.value; });
    state.opt = o.v;
    state.colorsA = resize(state.colorsA, o.a);
    state.colorsB = resize(state.colorsB, o.b);
    renderToggle();
    renderColors();
    renderBalloon();
    renderTotal();
  });

  el.qtySelect.addEventListener('change', function () {
    state.qty = +el.qtySelect.value;
    renderTotal();
  });

  el.sameTrue.addEventListener('click', function () {
    state.same = true;
    renderToggle();
    renderColors();
    renderBalloon();
    renderTotal();
  });
  el.sameFalse.addEventListener('click', function () {
    state.same = false;
    renderToggle();
    renderColors();
    renderBalloon();
    renderTotal();
  });

  el.orderBtn.addEventListener('click', function () {
    renderSummary();
    el.formCard.hidden = false;
    el.form.hidden = false;
    el.thanks.hidden = true;
    el.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  el.form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    el.submitBtn.disabled = true;
    el.submitBtn.textContent = 'Отправка…';
    try {
      await submitOrder(buildOrderData());
      el.form.hidden = true;
      el.thanks.hidden = false;
    } catch (err) {
      console.error('Не удалось отправить заказ:', err);
      alert('Не удалось отправить заявку. Попробуйте ещё раз.');
    } finally {
      submitting = false;
      el.submitBtn.disabled = false;
      el.submitBtn.textContent = 'Отправить';
    }
  });

  // ---------- Старт ----------
  initSelects();
  renderAll();
})();
