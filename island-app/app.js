// 島アプリ — ボード「島アプリ ボード.dc.html」ターン3（3a〜3e）の実装。
// 3D は island.js をそのまま使い、スナップショットではなくライブでマウントする。
// 設計の出どころ: 地の色・字組み・パネル/キーは 3a、画面の座標は 3b〜3e。

(function () {
  'use strict';

  // ---------- 内容 ----------

  // 3b/3a の島に浮かぶ3枚。ボードのスクリプトの CARDS と同じ。
  var CARDS = [
    { kind: 'INSTAGRAM', title: 'Obsidianでsecond brainを作ってみる', color: '#e05a47' },
    { kind: 'ARTICLE', title: 'PARAでメモを整理してみる', color: '#427c89' },
    { kind: 'SCREENSHOT', title: 'グラフビューを使ってみる', color: '#f5b738' }
  ];

  // ステッカーは island.js に描かせる（写真の代わりのプレースホルダ）。
  var STICKERS = {
    cut: { shape: 'cutout', color: '#e05a47', label: '切り抜き写真' },
    rect: { shape: 'rect', color: '#427c89', label: '記事サムネ' },
    cut2: { shape: 'cutout', color: '#f5b738', label: '切り抜き写真2' }
  };

  // S3 の候補3つ。title はボード 3c のまま。
  // step / built はボードが候補1ぶんだけ（PARAの4つのフォルダを作る／書斎）示しているので、
  // 2・3 は S4・S6 を同じ文法で動かすために補ったもの。
  var CHOICES = [
    {
      title: 'Obsidianでsecond brainを作ってみる',
      say: '今日は、Obsidianでsecond brainを作ってみない？',
      step: 'PARAの4つの\nフォルダを作る', min: 15, built: '書斎'
    },
    {
      title: 'デスクまわりを整える',
      say: '今日は、デスクまわりを整えてみない？',
      step: '机の上のものを\n3つ減らす', min: 10, built: '作業台'
    },
    {
      title: 'ノートの取り方の参考にする',
      say: '今日は、ノートの取り方をまねしてみない？',
      step: '今日のメモを\n1枚書き写す', min: 10, built: '書き机'
    }
  ];

  // マウントする島の設定。3a/3b/3d/3e が使っていた puffy の指定をそのまま引き継ぐ。
  // mount は opts.rot を見ない（snapshot 専用）ので、初期角はライブ側の既定にまかせる。
  var ISLANDS = {
    hero: function (s) { return { style: 'puffy', cards: s.deck, building: 1 }; },
    home: function (s) { return { style: 'puffy', cards: s.deck, onCardTap: onCardTap, onCharTap: onCharTap }; },
    small: function () { return { style: 'puffy', bundle: true, phase: 'morning' }; },
    build: function () { return { style: 'puffy', building: 1, charAt: 'build' }; }
  };

  var AVATAR_PARTS = { poko: 8, tomori: 9, fumi: 9 };

  var SCREENS = ['sheet', 's2', 's3', 's4', 's6'];

  // ---------- 状態 ----------

  var state = {
    deck: CARDS,      // 島に浮かぶカード。ステッカーが焼けたら差し替わる
    stickers: null,   // { cut, rect, cut2 } の data URL
    choice: 0         // S3 で選んだ候補
  };

  var screen = null;
  var island = null;  // いま生きている Island インスタンス（画面に1つだけ）
  var islandEl = null;

  // ---------- キャラクター（Avatar.dc.html の移植） ----------

  function paintAvatars() {
    document.querySelectorAll('[data-avatar]').forEach(function (el) {
      var kind = el.getAttribute('data-avatar');
      var size = Number(el.getAttribute('data-size')) || 44;
      el.classList.add('avatar--' + kind);
      // ぼかし半径を em で書いているので、font-size をサイズと同値にして倍率を合わせる
      el.style.width = el.style.height = el.style.fontSize = size + 'px';
      el.innerHTML = new Array(AVATAR_PARTS[kind] + 1).join('<i></i>');
    });
  }

  // ---------- ステッカー ----------

  function paintStickers() {
    if (!state.stickers) return;
    document.querySelectorAll('[data-sticker]').forEach(function (img) {
      img.src = state.stickers[img.getAttribute('data-sticker')];
    });
  }

  async function bakeStickers() {
    var keys = Object.keys(STICKERS);
    var made = await Promise.all(keys.map(function (k) {
      return window.Island.makeSticker(null, STICKERS[k]);
    }));

    state.stickers = {};
    state.deck = made.map(function (s, i) {
      state.stickers[keys[i]] = s.url;
      return { kind: CARDS[i].kind, title: CARDS[i].title, sticker: s.url, aspect: s.aspect };
    });

    paintStickers();
    if (islandEl) mountIsland(islandEl); // 素のカードで建てた島をステッカー版に差し替える
  }

  // ---------- 島 ----------

  function mountIsland(el) {
    unmountIsland();
    islandEl = el;
    island = window.Island.mount(el, ISLANDS[el.getAttribute('data-island')](state));
  }

  function unmountIsland() {
    if (island) island.destroy();
    island = null;
    islandEl = null;
  }

  function onCardTap(i) {
    var card = state.deck[i];
    if (card) say('s2-say', '「' + card.title + '」、まだ島にあるよ。');
  }

  function onCharTap() {
    say('s2-say', 'たくさん集めたね。夜になったら、まとめておくね。');
  }

  function say(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ---------- S3 候補 ----------

  function renderChoices() {
    var box = document.getElementById('s3-choices');
    box.innerHTML = '';

    CHOICES.forEach(function (c, i) {
      var b = document.createElement('button');
      b.className = 'key choice' + (i === state.choice ? ' key--dark' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === state.choice));
      b.innerHTML = '<span class="choice__no"></span><span class="choice__text"></span>';
      b.querySelector('.choice__no').textContent = String(i + 1);
      b.querySelector('.choice__text').textContent = c.title;
      b.addEventListener('click', function () { pickChoice(i); });
      box.appendChild(b);
    });
  }

  // 候補を選ぶと S4 の提案と一歩、S6 の建物名まで決まる
  function pickChoice(i) {
    state.choice = i;
    renderChoices();
    go('s4');
  }

  function applyChoice() {
    var c = CHOICES[state.choice];
    say('s4-step', c.step);
    say('s4-min', String(c.min));
    say('s4-say', c.say);
    say('s6-lede', '島に、' + c.built + 'が建ちました');
  }

  function startRename() {
    var box = document.getElementById('s3-choices');
    var input = document.createElement('input');
    input.className = 'rename';
    input.type = 'text';
    input.placeholder = 'じぶんのことばで';
    input.value = CHOICES[state.choice].title;
    box.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && input.value.trim()) {
        var c = CHOICES[state.choice];
        c.title = input.value.trim();
        c.say = '今日は、' + c.title + '。どう？';
        pickChoice(state.choice);
      } else if (e.key === 'Escape') {
        renderChoices();
      }
    });
  }

  // ---------- 画面遷移 ----------

  function go(name) {
    if (SCREENS.indexOf(name) < 0) name = 's2';
    if (name === screen) return;
    screen = name;

    unmountIsland();

    SCREENS.forEach(function (s) {
      document.getElementById('view-' + s).hidden = s !== name;
    });
    document.querySelectorAll('.nav__tab').forEach(function (t) {
      t.setAttribute('aria-current', String(t.getAttribute('data-goto') === name));
    });

    if (name === 's4' || name === 's6') applyChoice();

    // 島は見えている画面のぶんだけ建てる。WebGL のコンテキストを1つに抑える
    var el = document.querySelector('#view-' + name + ' [data-island]');
    if (el) mountIsland(el);

    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  }

  // ---------- 起動 ----------

  function boot() {
    paintAvatars();
    renderChoices();
    applyChoice();

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-goto]');
      if (t) go(t.getAttribute('data-goto'));
    });
    document.getElementById('s3-rename').addEventListener('click', startRename);
    window.addEventListener('hashchange', function () { go(location.hash.slice(1)); });

    go(location.hash.slice(1) || 's2');
    bakeStickers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
