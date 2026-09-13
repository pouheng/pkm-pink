// @ts-check
/**
 * =============================================
 * CREATIVE PANEL - 創造模式控制台 UI
 * =============================================
 *
 * 純 DOM 實作（與本專案既有 UI 風格一致）。
 * 提供四個分頁：
 *  1. 種族值：覆蓋既有寶可夢的種族值 / 屬性 / 特性，或新增寶可夢
 *  2. 招式：覆蓋既有招式參數，或新增招式
 *  3. 暱稱：設定暱稱導向的種族值 / 特性覆蓋
 *  4. 資料：總開關、匯出 / 匯入 JSON、重置
 */

import CreativeMode, {
    STAT_KEYS,
    STAT_LABELS,
    POKEMON_TYPES,
    MOVE_CATEGORIES
} from '../systems/creative-mode.js';

console.log('[PKM Creative] panel module loaded');

const STYLE_ID = 'creative-panel-style';
let panelEl = null;
let launcherEl = null;
let activeTab = 'species';

// ============================================
// 小工具
// ============================================

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const key of Object.keys(attrs)) {
        const value = attrs[key];
        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else if (value !== undefined && value !== null) node.setAttribute(key, value);
    }
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
        if (child === null || child === undefined) continue;
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
}

function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = el('style', { id: STYLE_ID });
    style.textContent = `
    .cm-launcher{position:fixed;left:14px;bottom:14px;z-index:99998;background:#1b1e2b;color:#ffd166;
        border:1px solid #ffd166;border-radius:10px;padding:7px 8px 7px 14px;font-weight:700;cursor:pointer;
        font-family:inherit;letter-spacing:1px;box-shadow:0 4px 18px rgba(0,0,0,.45);display:flex;align-items:center;gap:6px}
    .cm-launcher.active{background:#ffd166;color:#1b1e2b}
    .cm-launcher .cm-launcher-fold{appearance:none;display:flex;align-items:center;justify-content:center;
        width:20px;height:20px;padding:0;border:1px solid rgba(255,255,255,.3);border-radius:7px;
        background:rgba(0,0,0,.18);color:inherit;cursor:pointer;transition:transform .2s ease,background .2s ease}
    .cm-launcher .cm-launcher-fold:hover{background:rgba(0,0,0,.35)}
    .cm-launcher .cm-launcher-fold svg{width:12px;height:12px}
    .cm-launcher.collapsed{left:0;padding:8px;border-radius:0 10px 10px 0;opacity:.82}
    .cm-launcher.collapsed .cm-launcher-label{display:none}
    .cm-launcher.collapsed .cm-launcher-fold{transform:rotate(180deg)}
    .cm-overlay{position:fixed;inset:0;z-index:99999;background:rgba(6,8,16,.72);display:flex;
        align-items:center;justify-content:center;font-family:'Rubik','M+PLUS Rounded 1c',sans-serif}
    .cm-window{width:min(920px,94vw);height:min(720px,92vh);background:#141827;color:#e8ecf5;
        border:1px solid #2c3450;border-radius:14px;display:flex;flex-direction:column;overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,.6)}
    .cm-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;
        background:#1b2136;border-bottom:1px solid #2c3450}
    .cm-title{font-weight:800;letter-spacing:2px;color:#ffd166}
    .cm-status{font-size:12px;padding:3px 10px;border-radius:20px;background:#3a2a2a;color:#ff9c9c}
    .cm-status.on{background:#1f3a2c;color:#8ef0b8}
    .cm-close{background:transparent;border:1px solid #3a4466;color:#e8ecf5;border-radius:8px;
        padding:6px 12px;cursor:pointer;font-family:inherit}
    .cm-tabs{display:flex;gap:4px;padding:10px 14px 0;background:#161b2c}
    .cm-tab{background:transparent;border:none;border-bottom:3px solid transparent;color:#9aa6c4;
        padding:10px 16px;cursor:pointer;font-family:inherit;font-weight:600;font-size:14px}
    .cm-tab.active{color:#ffd166;border-bottom-color:#ffd166}
    .cm-body{flex:1;overflow:auto;padding:18px}
    .cm-section{background:#1a2033;border:1px solid #262e47;border-radius:10px;padding:16px;margin-bottom:16px}
    .cm-section h3{margin:0 0 12px;font-size:15px;color:#ffd166;letter-spacing:1px}
    .cm-row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:12px}
    .cm-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#9aa6c4}
    .cm-field input,.cm-field select,.cm-field textarea{background:#0f1424;border:1px solid #303a5a;
        color:#e8ecf5;border-radius:8px;padding:7px 9px;font-family:inherit;font-size:13px;min-width:120px}
    .cm-field input[type=range]{min-width:150px;padding:0}
    .cm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px 18px}
    .cm-stat{display:grid;grid-template-columns:56px 1fr 64px;gap:8px;align-items:center}
    .cm-stat label{font-size:12px;color:#9aa6c4}
    .cm-stat input[type=number]{min-width:0;width:64px}
    .cm-bst{font-weight:700;color:#8ef0b8;margin-left:8px}
    .cm-btn{background:#2a3350;border:1px solid #3a4670;color:#e8ecf5;border-radius:8px;
        padding:8px 14px;cursor:pointer;font-family:inherit;font-weight:600;font-size:13px}
    .cm-btn.primary{background:#ffd166;border-color:#ffd166;color:#1b1e2b}
    .cm-btn.danger{background:#3a2230;border-color:#7a3550;color:#ff9cbc}
    .cm-btn:hover{filter:brightness(1.12)}
    .cm-list{margin-top:10px;display:flex;flex-direction:column;gap:8px}
    .cm-list-item{display:flex;justify-content:space-between;align-items:center;gap:10px;
        background:#0f1424;border:1px solid #262e47;border-radius:8px;padding:8px 12px;font-size:13px}
    .cm-hint{font-size:12px;color:#7f8aa8;line-height:1.5}
    .cm-picker{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px}
    .cm-picker select{min-width:260px;max-width:100%}
    .cm-tag{font-size:11px;color:#ffd166;border:1px solid #55492a;border-radius:6px;padding:1px 6px}
    .cm-sprite-box{width:96px;height:96px;display:flex;align-items:center;justify-content:center;
        background:#10152a;border:1px solid #2c3450;border-radius:10px;overflow:hidden;flex-shrink:0}
    .cm-sprite-box img{max-width:90%;max-height:90%;object-fit:contain;image-rendering:pixelated}
    .cm-sprite-box.sm{width:56px;height:56px}
    .cm-media-hint{font-size:11px;color:#7f8aa8;line-height:1.5}
    .cm-form-editor{display:flex;flex-direction:column;gap:10px;margin-top:8px}
    .cm-form-card{background:#0f1424;border:1px solid #262e47;border-radius:8px;padding:10px 12px}
    .cm-form-card .cm-row{margin-bottom:8px}
    .cm-remove{background:transparent;border:1px solid #7a3550;color:#ff9cbc;border-radius:6px;
        padding:4px 10px;cursor:pointer;font-family:inherit;font-size:12px}
    .cm-toast{position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:100000;
        background:#1f3a2c;color:#8ef0b8;border:1px solid #2f6b4b;border-radius:8px;
        padding:10px 18px;font-size:13px;opacity:0;transition:opacity .2s}
    .cm-toast.show{opacity:1}
    .cm-toast.error{background:#3a1f26;color:#ff9c9c;border-color:#6b2f3b}
    `;
    document.head.appendChild(style);
}

let toastTimer = null;
function toast(message, isError) {
    let node = document.querySelector('.cm-toast');
    if (!node) {
        node = el('div', { class: 'cm-toast' });
        document.body.appendChild(node);
    }
    node.textContent = message;
    node.className = 'cm-toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.className = 'cm-toast'; }, 2600);
}

function speciesItems() {
    return CreativeMode.listSpeciesIds().map((id) => {
        const data = CreativeMode.getSpecies(id);
        return { id, name: data ? data.name : id };
    });
}

function moveItems() {
    return CreativeMode.listMoveIds().map((id) => {
        const data = CreativeMode.getMove(id);
        return { id, name: data ? data.name : id };
    });
}

function defaultSpriteUrl(id) {
    const norm = String(id || 'pikachu').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'pikachu';
    return `https://play.pokemonshowdown.com/sprites/ani/${norm}.gif`;
}

function speciesPreviewUrl(id) {
    const media = CreativeMode.getSpeciesMedia(id);
    if (media && media.sprite) return media.sprite;
    return defaultSpriteUrl(id);
}

function spritePreviewBox(fallbackId) {
    const img = el('img', { alt: '' });
    const box = el('div', { class: 'cm-sprite-box' }, [img]);
    const setUrl = (url) => {
        const target = (url && String(url).trim())
            ? String(url).trim()
            : defaultSpriteUrl(fallbackId);
        img.setAttribute('src', target);
    };
    img.addEventListener('error', () => {
        const fallback = defaultSpriteUrl(fallbackId);
        if (img.getAttribute('src') !== fallback) img.setAttribute('src', fallback);
    });
    setUrl('');
    return { node: box, img, setUrl };
}

function formsEditor() {
    const list = [];
    const host = el('div', { class: 'cm-form-editor' });
    const addRow = (value) => {
        const id = el('input', { type: 'text', placeholder: 'mega', value: (value && value.id) || '' });
        const name = el('input', { type: 'text', placeholder: '超夢X', value: (value && value.name) || '' });
        const t1 = el('select');
        const t2 = el('select');
        for (const sel of [t1, t2]) {
            sel.appendChild(el('option', { value: '', text: '（沿用）' }));
            for (const t of POKEMON_TYPES) sel.appendChild(el('option', { value: t, text: t }));
        }
        t1.value = (value && value.types && value.types[0]) || '';
        t2.value = (value && value.types && value.types[1]) || '';
        const sprite = el('input', { type: 'text', placeholder: 'hi-res / 戰鬥 gif 網址', value: (value && value.sprite) || '' });
        const backSprite = el('input', { type: 'text', placeholder: '背面 gif（可選）', value: (value && value.backSprite) || '' });
        const cry = el('input', { type: 'text', placeholder: '叫聲 mp3 網址', value: (value && value.cry) || '' });
        const ability = el('input', { type: 'text', placeholder: '替換特性（0）', value: (value && value.abilities && value.abilities['0']) || '' });
        const row = { id, name, t1, t2, sprite, backSprite, cry, ability, dom: null };

        const card = el('div', { class: 'cm-form-card' }, [
            el('div', { class: 'cm-row' }, [
                el('label', { class: 'cm-field', text: '形態 ID' }, [id]),
                el('label', { class: 'cm-field', text: '形態名稱' }, [name]),
                el('label', { class: 'cm-field', text: '屬性 1' }, [t1]),
                el('label', { class: 'cm-field', text: '屬性 2' }, [t2]),
                el('label', { class: 'cm-field', text: '特性 0' }, [ability]),
                el('button', {
                    class: 'cm-remove',
                    text: '刪除此形態',
                    onclick: () => {
                        const i = list.indexOf(row);
                        if (i >= 0) list.splice(i, 1);
                        host.removeChild(card);
                    }
                })
            ]),
            el('div', { class: 'cm-row' }, [
                el('label', { class: 'cm-field', text: '戰鬥 gif' }, [sprite]),
                el('label', { class: 'cm-field', text: '背面 gif' }, [backSprite]),
                el('label', { class: 'cm-field', text: '叫聲' }, [cry])
            ])
        ]);
        row.dom = card;
        list.push(row);
        host.appendChild(card);
    };

    const addBtn = el('button', {
        class: 'cm-btn',
        text: '＋ 新增形態',
        onclick: () => addRow(null)
    });

    const node = el('div', { class: 'cm-section', id: 'cm-forms-section' }, [
        el('h3', { text: '形態（可選，各自獨立為一隻寶可夢）' }),
        el('p', { class: 'cm-media-hint', text: '每個形態可設定自己的戰鬥 gif、背面 gif 與叫聲；資料會以「寶可夢ID + 形態ID」註冊成獨立物種，例如 dracohero 與 dracoheromega。' }),
        host,
        el('div', { class: 'cm-row' }, [addBtn])
    ]);

    return {
        node,
        set(forms) {
            list.length = 0;
            host.innerHTML = '';
            if (Array.isArray(forms)) {
                for (const f of forms) addRow(f);
            }
        },
        get() {
            return list.map((row) => {
                const out = { id: row.id.value.trim(), name: row.name.value.trim() };
                if (row.id.value.trim() && !row.name.value.trim()) out.name = row.id.value.trim();
                const types = [row.t1.value];
                if (row.t2.value && row.t2.value !== row.t1.value) types.push(row.t2.value);
                if (types.some(Boolean)) out.types = types.filter(Boolean);
                if (row.sprite.value.trim()) out.sprite = row.sprite.value.trim();
                if (row.backSprite.value.trim()) out.backSprite = row.backSprite.value.trim();
                if (row.cry.value.trim()) out.cry = row.cry.value.trim();
                if (row.ability.value.trim()) out.abilities = { 0: row.ability.value.trim() };
                return out;
            }).filter((f) => f.id || f.name);
        }
    };
}

/**
 * 建立搜尋 + 下拉選單
 */
function buildPicker(items, onPick, placeholder) {
    const filter = el('input', { type: 'text', placeholder: placeholder || '搜尋…' });
    const select = el('select');
    const wrap = el('div', { class: 'cm-picker' }, [
        el('label', { class: 'cm-field', text: '搜尋' }, [filter]),
        el('label', { class: 'cm-field', text: '選擇' }, [select])
    ]);

    function rebuild() {
        const q = filter.value.trim().toLowerCase();
        const filtered = q
            ? items.filter((it) => it.id.includes(q) || String(it.name).toLowerCase().includes(q))
            : items;
        select.innerHTML = '';
        const limited = filtered.slice(0, 300);
        for (const it of limited) {
            select.appendChild(el('option', { value: it.id, text: `${it.id} — ${it.name}` }));
        }
        if (filtered.length > limited.length) {
            select.appendChild(el('option', { value: '', text: `…另有 ${filtered.length - limited.length} 項，請縮小搜尋` }));
        }
    }

    filter.addEventListener('input', rebuild);
    select.addEventListener('change', () => {
        if (select.value) onPick(select.value);
    });
    rebuild();
    wrap.setValue = (id) => {
        if (!id) {
            select.value = '';
            return;
        }
        if (!Array.from(select.options).some((opt) => opt.value === id)) {
            filter.value = '';
            rebuild();
        }
        select.value = id;
        onPick(id);
    };
    return wrap;
}

function statsEditor(initial) {
    const inputs = {};
    const ranges = {};
    const grid = el('div', { class: 'cm-stats' });
    const bst = el('span', { class: 'cm-bst', text: 'BST 0' });

    function updateBST() {
        const stats = {};
        for (const key of STAT_KEYS) stats[key] = Number(inputs[key].value) || 0;
        bst.textContent = 'BST ' + CreativeMode.calcBST(stats);
    }

    for (const key of STAT_KEYS) {
        const number = el('input', { type: 'number', min: '1', max: '255', value: String(initial[key] || 0) });
        const range = el('input', { type: 'range', min: '1', max: '255', value: String(initial[key] || 0) });
        range.addEventListener('input', () => { number.value = range.value; updateBST(); });
        number.addEventListener('input', () => { range.value = number.value; updateBST(); });
        inputs[key] = number;
        ranges[key] = range;
        grid.appendChild(el('div', { class: 'cm-stat' }, [
            el('label', { text: STAT_LABELS[key] }),
            range,
            number
        ]));
    }
    updateBST();

    return {
        node: grid,
        bstNode: bst,
        get() {
            const stats = {};
            for (const key of STAT_KEYS) stats[key] = Number(inputs[key].value) || 0;
            return stats;
        },
        set(values) {
            for (const key of STAT_KEYS) {
                const value = values && values[key] != null ? values[key] : 0;
                inputs[key].value = String(value);
                if (ranges[key]) ranges[key].value = String(value);
            }
            updateBST();
        }
    };
}

const MOVE_BOOST_KEYS = ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
const MOVE_BOOST_LABELS = { atk: '攻擊', def: '防禦', spa: '特攻', spd: '特防', spe: '速度', accuracy: '命中', evasion: '閃避' };

function moveEffectsEditor(initial) {
    const src = initial || {};
    const drain = el('input', { type: 'number', min: '0', max: '100', value: String(Array.isArray(src.drain) ? Math.round(src.drain[0] / src.drain[1] * 100) : 0) });
    const recoil = el('input', { type: 'number', min: '0', max: '100', value: String(Array.isArray(src.recoil) ? Math.round(src.recoil[0] / src.recoil[1] * 100) : 0) });
    const status = el('select');
    for (const pair of [['', '無'], ['par', '麻痺'], ['brn', '燒傷'], ['psn', '中毒'], ['tox', '劇毒'], ['slp', '睡眠'], ['frz', '冰凍']]) {
        status.appendChild(el('option', { value: pair[0], text: pair[1] }));
    }
    status.value = src.secondary && src.secondary.status ? src.secondary.status : '';
    const chance = el('input', { type: 'number', min: '0', max: '100', value: String(src.secondary && src.secondary.chance != null ? src.secondary.chance : 10) });

    const boostTarget = el('select');
    boostTarget.appendChild(el('option', { value: 'self', text: '自己（能力上升）' }));
    boostTarget.appendChild(el('option', { value: 'target', text: '對手（能力下降）' }));

    const boostInputs = {};
    const boostGrid = el('div', { class: 'cm-stats' });
    for (const key of MOVE_BOOST_KEYS) {
        const input = el('input', { type: 'number', min: '-6', max: '6', value: '0' });
        boostInputs[key] = input;
        boostGrid.appendChild(el('div', { class: 'cm-stat' }, [
            el('label', { text: MOVE_BOOST_LABELS[key] }),
            el('span'),
            input
        ]));
    }

    const note = el('input', { type: 'text', placeholder: '例：回復造成傷害的50%', value: src.description || '' });

    const node = el('div', {}, [
        el('div', { class: 'cm-row' }, [
            el('label', { class: 'cm-field', text: '吸血%（回復傷害）' }, [drain]),
            el('label', { class: 'cm-field', text: '反傷%' }, [recoil]),
            el('label', { class: 'cm-field', text: '附加狀態' }, [status]),
            el('label', { class: 'cm-field', text: '狀態機率%' }, [chance])
        ]),
        el('div', { class: 'cm-row' }, [
            el('span', { class: 'cm-field', text: '能力變化（-6 ~ +6，可同時升降多項）' }, []),
            el('label', { class: 'cm-field', text: '對象' }, [boostTarget])
        ]),
        boostGrid,
        el('div', { class: 'cm-row' }, [
            el('label', { class: 'cm-field', text: '效果說明' }, [note])
        ])
    ]);

    function applyBoostsFrom(values) {
        const v = values || {};
        let boosts = null;
        let target = 'self';
        if (v.self && v.self.boosts) { boosts = v.self.boosts; target = 'self'; }
        else if (v.boosts) { boosts = v.boosts; target = 'target'; }
        else if (v.secondary && v.secondary.boosts) { boosts = v.secondary.boosts; target = 'target'; }
        for (const key of MOVE_BOOST_KEYS) {
            boostInputs[key].value = String((boosts && boosts[key] != null) ? boosts[key] : 0);
        }
        boostTarget.value = target;
    }
    applyBoostsFrom(src);

    return {
        node,
        build(category) {
            const out = {};
            const drainPct = Number(drain.value) || 0;
            if (drainPct > 0) out.drain = [drainPct, 100];
            const recoilPct = Number(recoil.value) || 0;
            if (recoilPct > 0) out.recoil = [recoilPct, 100];

            const boosts = {};
            for (const key of MOVE_BOOST_KEYS) {
                const value = Number(boostInputs[key].value) || 0;
                if (value) boosts[key] = value;
            }
            if (Object.keys(boosts).length) {
                if (boostTarget.value === 'self') {
                    out.self = { boosts };
                } else if (category === 'Status') {
                    out.boosts = boosts;
                } else {
                    out.secondary = Object.assign({}, out.secondary, { boosts });
                }
            }
            if (status.value) {
                out.secondary = Object.assign({}, out.secondary, { chance: Number(chance.value) || 10, status: status.value });
            }
            if (note.value.trim()) out.description = note.value.trim();
            return out;
        },
        set(values) {
            const v = values || {};
            drain.value = String(Array.isArray(v.drain) ? Math.round(v.drain[0] / v.drain[1] * 100) : 0);
            recoil.value = String(Array.isArray(v.recoil) ? Math.round(v.recoil[0] / v.recoil[1] * 100) : 0);
            status.value = v.secondary && v.secondary.status ? v.secondary.status : '';
            chance.value = String(v.secondary && v.secondary.chance != null ? v.secondary.chance : 10);
            note.value = v.description || '';
            applyBoostsFrom(v);
        }
    };
}

function moveKindEditor(initial) {
    const src = initial || {};
    const kind = el('select');
    for (const pair of [['normal', '普通招式'], ['z', 'Z 招式'], ['max', '極巨化招式']]) {
        kind.appendChild(el('option', { value: pair[0], text: pair[1] }));
    }
    kind.value = src.isMax ? 'max' : (src.isZ ? 'z' : 'normal');
    const zItem = el('input', { type: 'text', placeholder: '對應 Z 結晶／道具（例：羈絆圍巾）', value: src.isZ || '' });
    const zBase = el('input', { type: 'text', placeholder: '基底招式 ID（例：lastresort）', value: src.zBaseMove || '' });
    const maxSpecies = el('input', { type: 'text', placeholder: 'G-Max 專屬物種 ID（可留空＝通用 Max）', value: (typeof src.isMax === 'string' ? src.isMax : '') });

    const node = el('div', { class: 'cm-row' }, [
        el('label', { class: 'cm-field', text: '招式類型' }, [kind]),
        el('label', { class: 'cm-field', text: '對應 Z 結晶（Z 招式用）' }, [zItem]),
        el('label', { class: 'cm-field', text: '基底招式（Z 招式用）' }, [zBase]),
        el('label', { class: 'cm-field', text: 'G-Max 物種（可選）' }, [maxSpecies])
    ]);

    return {
        node,
        build() {
            const out = {};
            if (kind.value === 'z') {
                const zi = zItem.value.trim();
                const zb = zBase.value.trim();
                if (zi) out.isZ = zi;
                if (zb) out.zBaseMove = zb;
            } else if (kind.value === 'max') {
                const ms = maxSpecies.value.trim();
                out.isMax = ms || true;
            }
            return out;
        },
        set(values) {
            const v = values || {};
            kind.value = v.isMax ? 'max' : (v.isZ ? 'z' : 'normal');
            zItem.value = v.isZ || '';
            zBase.value = v.zBaseMove || '';
            maxSpecies.value = (typeof v.isMax === 'string' ? v.isMax : '');
        }
    };
}

function typeSelectors(initial) {
    const first = el('select');
    const second = el('select');
    for (const sel of [first, second]) {
        sel.appendChild(el('option', { value: '', text: '（無）' }));
        for (const t of POKEMON_TYPES) sel.appendChild(el('option', { value: t, text: t }));
    }
    first.value = (initial && initial[0]) || 'Normal';
    second.value = (initial && initial[1]) || '';
    return {
        node: el('div', { class: 'cm-row' }, [
            el('label', { class: 'cm-field', text: '屬性 1' }, [first]),
            el('label', { class: 'cm-field', text: '屬性 2' }, [second])
        ]),
        get() {
            const list = [first.value];
            if (second.value) list.push(second.value);
            return list.filter(Boolean);
        },
        set(types) {
            const list = Array.isArray(types) ? types : [];
            first.value = list[0] || 'Normal';
            second.value = list[1] || '';
        }
    };
}

// ============================================
// 分頁：種族值
// ============================================

function renderSpeciesTab(container) {
    let selectedId = null;
    let stats = null;
    let types = null;

    const form = el('div', { class: 'cm-section' });
    const editorHost = el('div');
    form.appendChild(el('h3', { text: '種族值 / 屬性 / 特性編輯' }));
    form.appendChild(buildPicker(speciesItems(), (id) => { selectedId = id; renderEditor(); }, '輸入 ID 或名稱…'));
    form.appendChild(editorHost);

    function renderEditor() {
        editorHost.innerHTML = '';
        if (!selectedId) {
            editorHost.appendChild(el('p', { class: 'cm-hint', text: '請先選擇一隻寶可夢。' }));
            return;
        }
        const data = CreativeMode.getSpecies(selectedId);
        if (!data) {
            editorHost.appendChild(el('p', { class: 'cm-hint', text: '找不到資料。' }));
            return;
        }
        stats = statsEditor(data.baseStats || {});
        types = typeSelectors(data.types || ['Normal']);

        const nameInput = el('input', { type: 'text', value: data.name || selectedId });
        const ability0 = el('input', { type: 'text', value: (data.abilities && data.abilities['0']) || '' });
        const ability1 = el('input', { type: 'text', value: (data.abilities && data.abilities['1']) || '' });
        const abilityH = el('input', { type: 'text', value: (data.abilities && data.abilities['H']) || '' });

        const preview = spritePreviewBox(selectedId);
        preview.setUrl(speciesPreviewUrl(selectedId));
        editorHost.appendChild(el('div', { class: 'cm-row' }, [
            preview.node,
            el('button', {
                class: 'cm-btn',
                text: '播放叫聲',
                onclick: () => { if (typeof window.playPokemonCry === 'function') window.playPokemonCry(data.name || selectedId); }
            })
        ]));

        editorHost.appendChild(el('div', { class: 'cm-row' }, [
            el('label', { class: 'cm-field', text: '顯示名稱' }, [nameInput]),
            el('span', { class: 'cm-tag', text: CreativeMode.hasSpeciesOverride(selectedId) ? '已有覆蓋' : (CreativeMode.isCustomSpecies(selectedId) ? '自訂' : '原始') })
        ]));
        editorHost.appendChild(types.node);
        editorHost.appendChild(el('div', { class: 'cm-row' }, [
            el('span', { class: 'cm-field', text: '種族值' }, []),
            stats.bstNode
        ]));
        editorHost.appendChild(stats.node);
        editorHost.appendChild(el('div', { class: 'cm-row' }, [
            el('label', { class: 'cm-field', text: '特性 0' }, [ability0]),
            el('label', { class: 'cm-field', text: '特性 1' }, [ability1]),
            el('label', { class: 'cm-field', text: '隱藏特性' }, [abilityH])
        ]));
        editorHost.appendChild(el('div', { class: 'cm-row' }, [
            el('button', {
                class: 'cm-btn primary',
                text: '儲存覆蓋',
                onclick: () => {
                    const abilities = {};
                    if (ability0.value) abilities['0'] = ability0.value;
                    if (ability1.value) abilities['1'] = ability1.value;
                    if (abilityH.value) abilities['H'] = abilityH.value;
                    CreativeMode.setSpeciesOverride(selectedId, {
                        name: nameInput.value || undefined,
                        types: types.get(),
                        baseStats: stats.get(),
                        abilities
                    });
                    toast('已儲存種族值覆蓋：' + selectedId);
                }
            }),
            el('button', {
                class: 'cm-btn danger',
                text: '還原此項',
                onclick: () => {
                    CreativeMode.clearSpeciesOverride(selectedId);
                    toast('已還原：' + selectedId);
                    renderEditor();
                }
            })
        ]));
    }

    const addForm = el('div', { class: 'cm-section' });
    addForm.appendChild(el('h3', { text: '新增寶可夢' }));
    const addId = el('input', { type: 'text', placeholder: 'dracohero' });
    const addName = el('input', { type: 'text', placeholder: '龍之英雄' });
    const addStats = statsEditor({ hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 });
    const addTypes = typeSelectors(['Normal']);
    const addAbility = el('input', { type: 'text', placeholder: 'Overgrow' });
    const addSprite = el('input', { type: 'text', placeholder: 'https://…/battle.gif', value: '' });
    const addBackSprite = el('input', { type: 'text', placeholder: '背面 gif（可選）', value: '' });
    const addCry = el('input', { type: 'text', placeholder: 'https://…/cry.mp3', value: '' });
    const addMediaPreview = spritePreviewBox(null);
    let editingCustomId = null;

    const refreshPreview = () => {
        const idInput = addId.value.trim();
        const mediaUrl = addSprite.value.trim();
        addMediaPreview.setUrl(mediaUrl || (idInput ? speciesPreviewUrl(idInput) : ''));
    };
    addId.addEventListener('input', refreshPreview);
    addSprite.addEventListener('input', refreshPreview);

    const addForms = formsEditor();

    addForm.appendChild(el('div', { class: 'cm-row' }, [
        addMediaPreview.node,
        el('div', {}, [
            el('div', { class: 'cm-row' }, [
                el('label', { class: 'cm-field', text: 'ID' }, [addId]),
                el('label', { class: 'cm-field', text: '名稱' }, [addName]),
                el('label', { class: 'cm-field', text: '特性 0' }, [addAbility])
            ]),
            el('p', { class: 'cm-media-hint', text: '左側預覽會即時更新。玩家需自行準備素材（gif / mp3），可直接貼圖網、GIF 或任何直連網址。' })
        ])
    ]));
    addForm.appendChild(addTypes.node);
    addForm.appendChild(addStats.node);
    addForm.appendChild(el('div', { class: 'cm-section', id: 'cm-media-section' }, [
        el('h3', { text: '素材（玩家自備）' }),
        el('p', { class: 'cm-media-hint', text: '輸入直連網址即可，可用 GIPHY 直連、imgur 直連或自己的伺服器。留空則使用 Showdown 預設圖 / 叫聲。' }),
        el('div', { class: 'cm-row' }, [
            el('label', { class: 'cm-field', text: '戰鬥 gif（正面）' }, [addSprite]),
            el('label', { class: 'cm-field', text: '背面 gif（可選）' }, [addBackSprite]),
            el('label', { class: 'cm-field', text: '叫聲 mp3' }, [addCry])
        ])
    ]));
    addForm.appendChild(addForms.node);

    const submitSpeciesBtn = el('button', {
        class: 'cm-btn primary',
        text: '新增寶可夢',
        onclick: () => {
            if (!addName.value) { toast('請輸入名稱', true); return; }
            const ok = CreativeMode.addCustomSpecies({
                id: addId.value.trim() || addName.value,
                name: addName.value,
                types: addTypes.get(),
                baseStats: addStats.get(),
                abilities: addAbility.value ? { 0: addAbility.value } : { 0: 'Overgrow' },
                sprite: addSprite.value.trim() || undefined,
                backSprite: addBackSprite.value.trim() || undefined,
                cry: addCry.value.trim() || undefined,
                forms: addForms.get()
            });
            if (ok) {
                toast((editingCustomId ? '已更新寶可夢：' : '已新增寶可夢：') + addName.value);
                editingCustomId = null;
                addId.value = '';
                addName.value = '';
                addSprite.value = '';
                addBackSprite.value = '';
                addCry.value = '';
                addAbility.value = '';
                addTypes.set(['Normal']);
                addStats.set({ hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 });
                addForms.set([]);
                refreshPreview();
                submitSpeciesBtn.textContent = '新增寶可夢';
                renderCustomList();
            } else {
                toast('新增失敗', true);
            }
        }
    });
    addForm.appendChild(el('div', { class: 'cm-row' }, [submitSpeciesBtn]));

    const customList = el('div', { class: 'cm-list' });
    function renderCustomList() {
        customList.innerHTML = '';
        const state = CreativeMode._getState();
        const ids = Object.keys(state.customSpecies).filter((id) => !state.customSpecies[id]._formOf);
        if (!ids.length) {
            customList.appendChild(el('p', { class: 'cm-hint', text: '目前沒有自訂寶可夢。' }));
            return;
        }
        for (const id of ids) {
            const entry = state.customSpecies[id];
            const formCount = Object.keys(state.customSpecies).filter((k) => state.customSpecies[k]._formOf === id).length;
            const mediaText = (entry.sprite ? '· gif' : '') + (entry.cry ? '· 叫聲' : '');
            customList.appendChild(el('div', { class: 'cm-list-item' }, [
                el('div', { style: 'display:flex;align-items:center;gap:10px' }, [
                    spritePreviewBox(id).node,
                    el('span', {
                        text: `${entry.name} (${id}) · BST ${CreativeMode.calcBST(entry.baseStats)}${formCount ? ' · ' + formCount + ' 形態' : ''}${mediaText ? ' ' + mediaText : ''}`
                    })
                ]),
                el('div', { class: 'cm-row' }, [
                    el('button', {
                        class: 'cm-btn',
                        text: '編輯',
                        onclick: () => {
                            editCustomSpecies(id, entry);
                            renderCustomList();
                        }
                    }),
                    el('button', {
                        class: 'cm-btn danger',
                        text: '刪除',
                        onclick: () => { CreativeMode.removeCustomSpecies(id); renderCustomList(); toast('已刪除：' + id); }
                    })
                ])
            ]));
        }
    }

    function editCustomSpecies(id, entry) {
        editingCustomId = id;
        addId.value = id;
        addName.value = entry.name || '';
        addAbility.value = (entry.abilities && entry.abilities['0']) || '';
        addSprite.value = entry.sprite || '';
        addBackSprite.value = entry.backSprite || '';
        addCry.value = entry.cry || '';
        addTypes.set(entry.types || ['Normal']);
        addStats.set(entry.baseStats || { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 });
        const state = CreativeMode._getState();
        const formEntries = Object.keys(state.customSpecies)
            .filter((k) => state.customSpecies[k]._formOf === id)
            .map((k) => state.customSpecies[k]);
        addForms.set(formEntries);
        refreshPreview();
        submitSpeciesBtn.textContent = '更新寶可夢';
        try { addForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }

    renderCustomList();
    addForm.appendChild(customList);

    container.appendChild(form);
    container.appendChild(addForm);
    renderEditor();
}

// ============================================
// 分頁：招式
// ============================================

function renderMovesTab(container) {
    let selectedId = null;

    const form = el('div', { class: 'cm-section' });
    const editorHost = el('div');
    form.appendChild(el('h3', { text: '招式編輯' }));
    form.appendChild(buildPicker(moveItems(), (id) => { selectedId = id; renderEditor(); }, '輸入 ID 或名稱…'));
    form.appendChild(editorHost);

    function renderEditor() {
        editorHost.innerHTML = '';
        if (!selectedId) {
            editorHost.appendChild(el('p', { class: 'cm-hint', text: '請先選擇一個招式。' }));
            return;
        }
        const data = CreativeMode.getMove(selectedId);
        if (!data) {
            editorHost.appendChild(el('p', { class: 'cm-hint', text: '找不到資料。' }));
            return;
        }
        const type = el('select');
        for (const t of POKEMON_TYPES) type.appendChild(el('option', { value: t, text: t }));
        type.value = data.type || 'Normal';
        const category = el('select');
        for (const c of MOVE_CATEGORIES) category.appendChild(el('option', { value: c, text: c }));
        category.value = data.category || 'Physical';
        const power = el('input', { type: 'number', min: '0', max: '500', value: String(data.basePower || 0) });
        const accuracy = el('input', { type: 'number', min: '0', max: '100', value: String(data.accuracy === true ? 100 : (data.accuracy || 100)) });
        const pp = el('input', { type: 'number', min: '1', max: '99', value: String(data.pp || 10) });
        const priority = el('input', { type: 'number', min: '-7', max: '7', value: String(data.priority || 0) });
        const effects = moveEffectsEditor(data);
        const kindEditor = moveKindEditor(data);

        editorHost.appendChild(el('div', { class: 'cm-row' }, [
            el('span', { class: 'cm-tag', text: CreativeMode.hasMoveOverride(selectedId) ? '已有覆蓋' : (CreativeMode.isCustomMove(selectedId) ? '自訂' : '原始') }),
            el('span', { class: 'cm-hint', text: '名稱：' + (data.name || selectedId) })
        ]));
        editorHost.appendChild(el('div', { class: 'cm-row' }, [
            el('label', { class: 'cm-field', text: '屬性' }, [type]),
            el('label', { class: 'cm-field', text: '分類' }, [category]),
            el('label', { class: 'cm-field', text: '威力' }, [power]),
            el('label', { class: 'cm-field', text: '命中' }, [accuracy]),
            el('label', { class: 'cm-field', text: 'PP' }, [pp]),
            el('label', { class: 'cm-field', text: '優先度' }, [priority])
        ]));
        editorHost.appendChild(effects.node);
        editorHost.appendChild(kindEditor.node);
        editorHost.appendChild(el('div', { class: 'cm-row' }, [
            el('button', {
                class: 'cm-btn primary',
                text: '儲存覆蓋',
                onclick: () => {
                    CreativeMode.setMoveOverride(selectedId, Object.assign({
                        type: type.value,
                        category: category.value,
                        basePower: Number(power.value) || 0,
                        accuracy: Number(accuracy.value) || 0,
                        pp: Number(pp.value) || 1,
                        priority: Number(priority.value) || 0
                    }, effects.build(category.value), kindEditor.build()));
                    toast('已儲存招式覆蓋：' + selectedId);
                }
            }),
            el('button', {
                class: 'cm-btn danger',
                text: '還原此項',
                onclick: () => {
                    CreativeMode.clearMoveOverride(selectedId);
                    toast('已還原：' + selectedId);
                    renderEditor();
                }
            })
        ]));
    }

    const addForm = el('div', { class: 'cm-section' });
    addForm.appendChild(el('h3', { text: '新增招式' }));
    const addId = el('input', { type: 'text', placeholder: 'thunder-custom' });
    const addName = el('input', { type: 'text', placeholder: '自訂十萬伏特' });
    const addType = el('select');
    for (const t of POKEMON_TYPES) addType.appendChild(el('option', { value: t, text: t }));
    const addCat = el('select');
    for (const c of MOVE_CATEGORIES) addCat.appendChild(el('option', { value: c, text: c }));
    const addPower = el('input', { type: 'number', value: '90' });
    const addAcc = el('input', { type: 'number', value: '100' });
    const addPp = el('input', { type: 'number', value: '15' });
    const addEffects = moveEffectsEditor(null);
    const addKind = moveKindEditor(null);
    let editingMoveId = null;
    addForm.appendChild(el('div', { class: 'cm-row' }, [
        el('label', { class: 'cm-field', text: 'ID' }, [addId]),
        el('label', { class: 'cm-field', text: '名稱' }, [addName]),
        el('label', { class: 'cm-field', text: '屬性' }, [addType]),
        el('label', { class: 'cm-field', text: '分類' }, [addCat])
    ]));
    addForm.appendChild(el('div', { class: 'cm-row' }, [
        el('label', { class: 'cm-field', text: '威力' }, [addPower]),
        el('label', { class: 'cm-field', text: '命中' }, [addAcc]),
        el('label', { class: 'cm-field', text: 'PP' }, [addPp])
    ]));
    addForm.appendChild(addEffects.node);
    addForm.appendChild(addKind.node);
    const submitMoveBtn = el('button', {
        class: 'cm-btn primary',
        text: '新增招式',
        onclick: () => {
            if (!addName.value) { toast('請輸入名稱', true); return; }
            const targetId = (editingMoveId || addId.value || addName.value).trim();
            const ok = CreativeMode.addCustomMove(Object.assign({
                id: targetId,
                name: addName.value,
                type: addType.value,
                category: addCat.value,
                basePower: Number(addPower.value) || 0,
                accuracy: Number(addAcc.value) || 100,
                pp: Number(addPp.value) || 10
            }, addEffects.build(addCat.value), addKind.build()));
            if (ok) {
                if (editingMoveId && editingMoveId !== targetId) CreativeMode.removeCustomMove(editingMoveId);
                toast((editingMoveId ? '已更新招式：' : '已新增招式：') + addName.value);
                resetMoveForm();
                renderCustomList();
            } else {
                toast('新增失敗', true);
            }
        }
    });
    const cancelMoveBtn = el('button', { class: 'cm-btn', text: '取消編輯', onclick: () => resetMoveForm() });
    cancelMoveBtn.style.display = 'none';
    addForm.appendChild(el('div', { class: 'cm-row' }, [submitMoveBtn, cancelMoveBtn]));

    function resetMoveForm() {
        editingMoveId = null;
        addId.value = '';
        addName.value = '';
        addPower.value = '90';
        addAcc.value = '100';
        addPp.value = '15';
        addEffects.set({});
        addKind.set({});
        submitMoveBtn.textContent = '新增招式';
        cancelMoveBtn.style.display = 'none';
    }

    function loadMoveForEdit(entry, id) {
        editingMoveId = id;
        addId.value = id;
        addName.value = entry.name || '';
        addType.value = entry.type || 'Normal';
        addCat.value = entry.category || 'Physical';
        addPower.value = String(entry.basePower || 0);
        addAcc.value = String(entry.accuracy === true ? 100 : (entry.accuracy || 100));
        addPp.value = String(entry.pp || 10);
        addEffects.set(entry);
        addKind.set(entry);
        submitMoveBtn.textContent = '更新招式';
        cancelMoveBtn.style.display = '';
        try { addForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }

    const customList = el('div', { class: 'cm-list' });
    function renderCustomList() {
        customList.innerHTML = '';
        const ids = Object.keys(CreativeMode._getState().customMoves);
        if (!ids.length) {
            customList.appendChild(el('p', { class: 'cm-hint', text: '目前沒有自訂招式。' }));
            return;
        }
        for (const id of ids) {
            const entry = CreativeMode._getState().customMoves[id];
            const fx = [];
            if (Array.isArray(entry.drain)) fx.push('吸血' + Math.round(entry.drain[0] / entry.drain[1] * 100) + '%');
            if (Array.isArray(entry.recoil)) fx.push('反傷' + Math.round(entry.recoil[0] / entry.recoil[1] * 100) + '%');
            if (entry.secondary && entry.secondary.status) fx.push(entry.secondary.chance + '%' + entry.secondary.status);
            customList.appendChild(el('div', { class: 'cm-list-item' }, [
                el('span', { text: `${entry.name} (${id}) · ${entry.type} · ${entry.category} · 威力 ${entry.basePower}${fx.length ? ' · ' + fx.join(' / ') : ''}` }),
                el('div', { class: 'cm-row' }, [
                    el('button', { class: 'cm-btn', text: '編輯', onclick: () => loadMoveForEdit(entry, id) }),
                    el('button', {
                        class: 'cm-btn danger',
                        text: '刪除',
                        onclick: () => { CreativeMode.removeCustomMove(id); renderCustomList(); toast('已刪除：' + id); }
                    })
                ])
            ]));
        }
    }
    renderCustomList();
    addForm.appendChild(customList);

    container.appendChild(form);
    container.appendChild(addForm);
    renderEditor();
}

// ============================================
// 分頁：暱稱覆蓋
// ============================================

function renderNicknameTab(container) {
    const form = el('div', { class: 'cm-section' });
    form.appendChild(el('h3', { text: '暱稱導向的種族值 / 特性 / 技能池覆蓋' }));
    form.appendChild(el('p', {
        class: 'cm-hint',
        text: '當寶可夢的 nickname 等於設定值時，戰鬥時自動改用另一套種族值與特性；這裡指定的招式會加入該寶可夢的「技能池」，可在調整招式時選用（不會直接取代現有招式）。'
    }));

    const nickname = el('input', { type: 'text', placeholder: '小智版甲賀忍蛙' });
    const targetHost = el('div');
    let targetSpecies = '';
    const nickPreview = spritePreviewBox(null);
    const speciesPicker = buildPicker(speciesItems(), (id) => { targetSpecies = id; nickPreview.setUrl(id ? speciesPreviewUrl(id) : ''); }, '可選：替換成其他物種…');
    targetHost.appendChild(speciesPicker);
    const ability = el('input', { type: 'text', placeholder: '牽絆變身' });
    const item = el('input', { type: 'text', placeholder: 'Eevium Z' });
    const mechanic = el('select');
    for (const pair of [['', '無'], ['zmove', 'Z 招式'], ['mega', 'Mega'], ['dynamax', '極巨化'], ['tera', '太晶化']]) {
        mechanic.appendChild(el('option', { value: pair[0], text: pair[1] }));
    }
    const note = el('input', { type: 'text', placeholder: '原作動畫形態還原' });
    const stats = statsEditor({ hp: 72, atk: 145, def: 67, spa: 153, spd: 71, spe: 132 });

    const moveInputs = [];
    for (let i = 0; i < 4; i++) {
        moveInputs.push(el('input', { type: 'text', list: 'cm-move-list', placeholder: `招式 ${i + 1}` }));
    }
    const moveList = el('datalist', { id: 'cm-move-list' });
    for (const it of moveItems()) {
        moveList.appendChild(el('option', { value: it.id, text: it.name }));
    }

    form.appendChild(el('div', { class: 'cm-row' }, [
        el('label', { class: 'cm-field', text: '暱稱' }, [nickname]),
        el('label', { class: 'cm-field', text: '替換特性（可選）' }, [ability]),
        el('label', { class: 'cm-field', text: '替換道具（可選）' }, [item]),
        el('label', { class: 'cm-field', text: '機制（可選）' }, [mechanic]),
        el('label', { class: 'cm-field', text: '備註（可選）' }, [note])
    ]));
    form.appendChild(el('div', { class: 'cm-row' }, [
        el('span', { class: 'cm-field', text: '替換物種（可選，留空則沿用原物種）' }, []),
        targetHost,
        nickPreview.node
    ]));
    form.appendChild(stats.node);
    form.appendChild(el('div', { class: 'cm-row' }, [
        el('span', { class: 'cm-field', text: '加入技能池的招式（可選，最多 4；可輸入 ID 或名稱）' }, [])
    ]));
    form.appendChild(el('div', { class: 'cm-row' }, moveInputs.map((inp) => el('label', { class: 'cm-field', text: '' }, [inp]))));
    form.appendChild(moveList);

    let editingKey = null;
    const submitBtn = el('button', {
        class: 'cm-btn primary',
        text: '新增覆蓋',
        onclick: () => {
            const nick = nickname.value.trim();
            if (!nick) { toast('請輸入暱稱', true); return; }
            const data = { baseStats: stats.get() };
            if (targetSpecies) data.species = targetSpecies;
            if (ability.value) data.ability = ability.value;
            if (item.value) data.item = item.value;
            if (mechanic.value) data.mechanic = mechanic.value;
            if (note.value) data.note = note.value;
            const moves = moveInputs.map((inp) => inp.value.trim()).filter(Boolean).slice(0, 4);
            if (moves.length) data.moves = moves;
            if (editingKey && editingKey.toLowerCase() !== nick.toLowerCase()) {
                CreativeMode.removeNicknameOverride(editingKey);
            }
            CreativeMode.setNicknameOverride(nick, data);
            toast((editingKey ? '已更新' : '已設定') + '暱稱覆蓋：' + nick);
            resetForm();
            renderList();
        }
    });
    const cancelBtn = el('button', { class: 'cm-btn', text: '取消編輯', onclick: () => resetForm() });
    cancelBtn.style.display = 'none';
    form.appendChild(el('div', { class: 'cm-row' }, [submitBtn, cancelBtn]));

    function resetForm() {
        editingKey = null;
        nickname.value = '';
        ability.value = '';
        item.value = '';
        mechanic.value = '';
        note.value = '';
        moveInputs.forEach((inp) => { inp.value = ''; });
        submitBtn.textContent = '新增覆蓋';
        cancelBtn.style.display = 'none';
    }

    function loadRule(entry) {
        editingKey = entry.nickname;
        nickname.value = entry.nickname || '';
        ability.value = entry.ability || '';
        item.value = entry.item || '';
        mechanic.value = entry.mechanic || '';
        note.value = entry.note || '';
        stats.set(entry.baseStats || { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
        const moves = Array.isArray(entry.moves) ? entry.moves : [];
        moveInputs.forEach((inp, i) => { inp.value = moves[i] || ''; });
        speciesPicker.setValue(entry.species || '');
        targetSpecies = entry.species || '';
        nickPreview.setUrl(entry.species ? speciesPreviewUrl(entry.species) : '');
        submitBtn.textContent = '更新覆蓋';
        cancelBtn.style.display = '';
        try { form.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    }

    const list = el('div', { class: 'cm-list' });
    function renderList() {
        list.innerHTML = '';
        const overrides = CreativeMode.getNicknameOverrides();
        const keys = Object.keys(overrides);
        if (!keys.length) {
            list.appendChild(el('p', { class: 'cm-hint', text: '目前沒有暱稱覆蓋規則。' }));
            return;
        }
        for (const key of keys) {
            const entry = overrides[key];
            const statsText = entry.baseStats
                ? `BST ${CreativeMode.calcBST(entry.baseStats)}`
                : '沿用原種族值';
            const movesText = Array.isArray(entry.moves) && entry.moves.length ? ' · 招式:' + entry.moves.join('/') : '';
            list.appendChild(el('div', { class: 'cm-list-item' }, [
                el('span', {
                    text: `「${entry.nickname}」${entry.species ? ' → ' + entry.species : ''} · ${statsText}${entry.ability ? ' · 特性:' + entry.ability : ''}${movesText}`
                }),
                el('div', { class: 'cm-row' }, [
                    el('button', {
                        class: 'cm-btn',
                        text: '編輯',
                        onclick: () => loadRule(entry)
                    }),
                    el('button', {
                        class: 'cm-btn danger',
                        text: '刪除',
                        onclick: () => { CreativeMode.removeNicknameOverride(key); renderList(); toast('已刪除：' + entry.nickname); }
                    })
                ])
            ]));
        }
    }
    renderList();
    form.appendChild(el('h3', { text: '現有規則' }));
    form.appendChild(list);
    container.appendChild(form);
}

// ============================================
// 分頁：資料 / 匯入匯出
// ============================================

function renderDataTab(container) {
    const toggleSection = el('div', { class: 'cm-section' });
    toggleSection.appendChild(el('h3', { text: '創造模式總開關' }));
    const toggleBtn = el('button', {
        class: 'cm-btn ' + (CreativeMode.isEnabled() ? 'danger' : 'primary'),
        text: CreativeMode.isEnabled() ? '關閉創造模式（還原原始資料）' : '開啟創造模式（套用所有覆蓋）',
        onclick: () => {
            CreativeMode.toggle();
            refreshPanel();
        }
    });
    toggleSection.appendChild(toggleBtn);
    toggleSection.appendChild(el('p', {
        class: 'cm-hint',
        text: '關閉時會完整還原 POKEDEX / MOVES，引擎行為與原專案相同。設定本身會保留，下次開啟時自動重新套用。'
    }));
    toggleSection.appendChild(el('div', { class: 'cm-row' }, [
        el('button', {
            class: 'cm-btn',
            text: '載入預設資料（搭檔伊布）',
            onclick: () => {
                CreativeMode.loadDefaults();
                toast('已載入預設資料：活活氣泡 / 麻麻電擊 / 搭檔伊布');
                refreshPanel();
            }
        })
    ]));
    container.appendChild(toggleSection);

    const exportSection = el('div', { class: 'cm-section' });
    exportSection.appendChild(el('h3', { text: '匯出' }));
    const output = el('textarea', { rows: '8', style: 'width:100%;font-family:monospace;font-size:12px' });
    exportSection.appendChild(el('div', { class: 'cm-row' }, [
        el('button', {
            class: 'cm-btn primary',
            text: '匯出完整擴充包 JSON',
            onclick: () => {
                output.value = JSON.stringify(CreativeMode.exportPack(), null, 2);
                downloadText('pkm-creative-pack.json', output.value);
                toast('已匯出擴充包');
            }
        }),
        el('button', {
            class: 'cm-btn',
            text: '匯出暱稱範例格式',
            onclick: () => {
                output.value = JSON.stringify(CreativeMode.exportSpeciesWithNicknames(), null, 2);
                downloadText('pkm-creative-nicknames.json', output.value);
                toast('已匯出暱稱格式');
            }
        })
    ]));
    exportSection.appendChild(output);
    container.appendChild(exportSection);

    const importSection = el('div', { class: 'cm-section' });
    importSection.appendChild(el('h3', { text: '匯入' }));
    const fileInput = el('input', { type: 'file', accept: '.json,application/json' });
    const importArea = el('textarea', { rows: '8', placeholder: '貼上 JSON 或選擇檔案…', style: 'width:100%;font-family:monospace;font-size:12px' });
    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => { importArea.value = String(reader.result || ''); };
        reader.readAsText(file);
    });
    importSection.appendChild(el('div', { class: 'cm-row' }, [fileInput]));
    importSection.appendChild(importArea);
    importSection.appendChild(el('div', { class: 'cm-row' }, [
        el('button', {
            class: 'cm-btn primary',
            text: '匯入並套用',
            onclick: () => {
                const result = CreativeMode.importPack(importArea.value);
                if (!result.ok) { toast('匯入失敗：' + result.error, true); return; }
                toast('匯入成功（物種 ' + result.summary.customSpecies + ' / 招式 ' + result.summary.customMoves + ' / 暱稱 ' + result.summary.nicknameOverrides + '）');
                refreshPanel();
            }
        }),
        el('button', {
            class: 'cm-btn danger',
            text: '重置全部',
            onclick: () => {
                if (!confirm('確定要清除所有創造模式設定並還原原始資料？')) return;
                CreativeMode.resetAll();
                toast('已重置');
                refreshPanel();
            }
        })
    ]));
    container.appendChild(importSection);
}

function downloadText(filename, text) {
    try {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
        toast('下載失敗：' + e.message, true);
    }
}

// ============================================
// 面板外殼
// ============================================

// ============================================
// 分頁：隊伍 / MVU 變數
// ============================================

function getMvuState() {
    if (typeof window === 'undefined') return null;
    return window.pkmBridgeData || null;
}

function canEditMvu() {
    return typeof window !== 'undefined' && typeof window.postPkmAction === 'function';
}

function dispatchMvu(action, payload) {
    if (!canEditMvu()) {
        toast('此功能需在酒館儀表板中使用', true);
        return Promise.resolve(false);
    }
    return window.postPkmAction(action, payload)
        .then(() => {
            toast('已更新 MVU');
            setTimeout(() => { if (activeTab === 'mvu' && panelEl) refreshPanel(); }, 500);
            return true;
        })
        .catch((err) => {
            toast('更新失敗：' + (err && err.message || err), true);
            return false;
        });
}

function partySlotKeys() {
    return ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];
}

function boxStorageKeys(state) {
    const box = state && state.box ? state.box : {};
    return Object.keys(box)
        .filter((key) => /^storage_\d+$/.test(key))
        .sort((a, b) => Number(a.split('_')[1]) - Number(b.split('_')[1]));
}

function pokemonLabel(pokemon) {
    if (!pokemon || !pokemon.name) return '(空)';
    const nick = pokemon.nickname ? `「${pokemon.nickname}」` : '';
    return `${pokemon.name}${nick}${pokemon.lv ? ' Lv.' + pokemon.lv : ''}`;
}

function renderMvuTab(container) {
    const state = getMvuState();

    const header = el('div', { class: 'cm-section' });
    header.appendChild(el('h3', { text: 'MVU 隊伍 / 盒子編輯' }));
    if (!canEditMvu()) {
        header.appendChild(el('p', {
            class: 'cm-hint',
            text: '此分頁需在酒館的儀表板（懸浮球開啟）中使用，才能寫回 MVU 變數。'
        }));
    } else if (!state) {
        header.appendChild(el('p', { class: 'cm-hint', text: '尚未收到 MVU 狀態，請稍候或按下方重新讀取。' }));
    } else {
        header.appendChild(el('p', { class: 'cm-hint', text: '直接修改隊伍與盒子的寶可夢。暱稱會影響戰鬥中「暱稱覆蓋」的判定。' }));
    }
    header.appendChild(el('div', { class: 'cm-row' }, [
        el('button', {
            class: 'cm-btn',
            text: '重新讀取',
            onclick: () => refreshPanel()
        })
    ]));
    container.appendChild(header);

    // === 隊伍 ===
    const partySection = el('div', { class: 'cm-section' });
    partySection.appendChild(el('h3', { text: '隊伍（PARTY）' }));
    const party = (state && state.party) || {};
    for (const key of partySlotKeys()) {
        partySection.appendChild(renderPokemonEditor(key, party[key], key, true));
    }
    container.appendChild(partySection);

    // === 新增寶可夢 ===
    const addSection = el('div', { class: 'cm-section' });
    addSection.appendChild(el('h3', { text: '新增寶可夢' }));
    let newSpeciesId = '';
    const speciesPicker = buildPicker(speciesItems(), (id) => { newSpeciesId = id; }, '搜尋物種…');
    const addNick = el('input', { type: 'text', placeholder: '暱稱（可留空）' });
    const addLv = el('input', { type: 'number', min: '1', max: '100', value: '50' });
    const addTarget = el('select');
    addTarget.appendChild(el('option', { value: 'party', text: '隊伍（第一個空槽）' }));
    addTarget.appendChild(el('option', { value: 'box', text: '盒子（PC BOX）' }));
    addSection.appendChild(speciesPicker);
    addSection.appendChild(el('div', { class: 'cm-row' }, [
        el('label', { class: 'cm-field', text: '暱稱' }, [addNick]),
        el('label', { class: 'cm-field', text: '等級' }, [addLv]),
        el('label', { class: 'cm-field', text: '加入' }, [addTarget])
    ]));
    addSection.appendChild(el('div', { class: 'cm-row' }, [
        el('button', {
            class: 'cm-btn primary',
            text: '新增寶可夢',
            onclick: () => {
                if (!newSpeciesId) { toast('請先選擇物種', true); return; }
                const data = CreativeMode.getSpecies(newSpeciesId);
                const pokemon = {
                    name: data ? data.name : newSpeciesId,
                    nickname: addNick.value || null,
                    lv: Number(addLv.value) || 5
                };
                const action = addTarget.value === 'box' ? 'box.addPokemon' : 'party.addPokemon';
                dispatchMvu(action, { pokemon });
                addNick.value = '';
            }
        })
    ]));
    container.appendChild(addSection);

    // === 盒子 ===
    const boxSection = el('div', { class: 'cm-section' });
    boxSection.appendChild(el('h3', { text: '盒子（PC BOX）' }));
    const keys = boxStorageKeys(state);
    if (!keys.length) {
        boxSection.appendChild(el('p', { class: 'cm-hint', text: '盒子目前是空的。' }));
    } else {
        for (const key of keys) {
            boxSection.appendChild(renderPokemonEditor(key, (state.box || {})[key], key, false));
        }
    }
    container.appendChild(boxSection);
}

function renderPokemonEditor(key, pokemon, slotKey, isParty) {
    const card = el('div', { class: 'cm-list-item', style: 'flex-wrap:wrap;align-items:flex-start;gap:10px' });
    card.appendChild(el('div', { style: 'min-width:140px;font-weight:700' }, [
        el('div', { text: `${slotKey} · ${pokemonLabel(pokemon)}` }),
        el('div', { class: 'cm-hint', text: pokemon && pokemon.species ? 'species: ' + pokemon.species : '' })
    ]));

    if (!canEditMvu()) {
        card.appendChild(el('span', { class: 'cm-hint', text: '（唯讀）' }));
        return card;
    }

    const nick = el('input', { type: 'text', value: (pokemon && pokemon.nickname) || '', placeholder: '暱稱' });
    const fields = [el('label', { class: 'cm-field', text: '暱稱' }, [nick])];

    let lvInput = null;
    let abilityInput = null;
    let itemInput = null;
    let natureInput = null;
    let shinyInput = null;

    if (isParty) {
        lvInput = el('input', { type: 'number', min: '1', max: '100', value: String((pokemon && pokemon.lv) || 50) });
        abilityInput = el('input', { type: 'text', value: (pokemon && pokemon.ability) || '', placeholder: '特性' });
        itemInput = el('input', { type: 'text', value: (pokemon && pokemon.item) || '', placeholder: '道具' });
        natureInput = el('input', { type: 'text', value: (pokemon && pokemon.nature) || '', placeholder: '性格' });
        shinyInput = el('input', { type: 'checkbox' });
        if (pokemon && pokemon.shiny) shinyInput.setAttribute('checked', 'checked');
        fields.push(
            el('label', { class: 'cm-field', text: '等級' }, [lvInput]),
            el('label', { class: 'cm-field', text: '特性' }, [abilityInput]),
            el('label', { class: 'cm-field', text: '道具' }, [itemInput]),
            el('label', { class: 'cm-field', text: '性格' }, [natureInput]),
            el('label', { class: 'cm-field', text: '閃光' }, [shinyInput])
        );
    }
    card.appendChild(el('div', { class: 'cm-row', style: 'flex:1' }, fields));

    const buttons = [];
    buttons.push(el('button', {
        class: 'cm-btn primary',
        text: '儲存',
        onclick: () => {
            const patch = { nickname: nick.value || null };
            if (isParty) {
                patch.lv = Number(lvInput.value) || 1;
                patch.ability = abilityInput.value || null;
                patch.item = itemInput.value || null;
                patch.nature = natureInput.value || null;
                patch.shiny = shinyInput.checked;
                dispatchMvu('party.updatePokemon', { slot: Number(slotKey.replace('slot', '')), patch });
            } else {
                dispatchMvu('box.updatePokemon', { key: slotKey, patch });
            }
        }
    }));
    if (isParty) {
        buttons.push(el('button', {
            class: 'cm-btn danger',
            text: '清空',
            onclick: () => dispatchMvu('party.clearPokemon', { slot: Number(slotKey.replace('slot', '')) })
        }));
    } else {
        buttons.push(el('button', {
            class: 'cm-btn danger',
            text: '刪除',
            onclick: () => dispatchMvu('box.removePokemon', { key: slotKey })
        }));
    }
    card.appendChild(el('div', { class: 'cm-row' }, buttons));
    return card;
}

const TABS = [
    { id: 'species', label: '種族值', render: renderSpeciesTab },
    { id: 'moves', label: '招式', render: renderMovesTab },
    { id: 'nickname', label: '暱稱覆蓋', render: renderNicknameTab },
    { id: 'mvu', label: '隊伍/MVU', render: renderMvuTab },
    { id: 'data', label: '資料', render: renderDataTab }
];

function refreshPanel() {
    if (!panelEl) return;
    const body = panelEl.querySelector('.cm-body');
    const tabsBar = panelEl.querySelector('.cm-tabs');
    const status = panelEl.querySelector('.cm-status');
    if (status) {
        status.textContent = CreativeMode.isEnabled() ? '創造模式：開啟' : '創造模式：關閉';
        status.className = 'cm-status' + (CreativeMode.isEnabled() ? ' on' : '');
    }
    if (tabsBar) {
        tabsBar.innerHTML = '';
        for (const tab of TABS) {
            tabsBar.appendChild(el('button', {
                class: 'cm-tab' + (activeTab === tab.id ? ' active' : ''),
                text: tab.label,
                onclick: () => { activeTab = tab.id; refreshPanel(); }
            }));
        }
    }
    if (body) {
        body.innerHTML = '';
        const tab = TABS.find((t) => t.id === activeTab) || TABS[0];
        tab.render(body);
    }
    applyLauncherClass();
}

/**
 * 確保 POKEDEX / MOVES 已載入。
 * 在戰鬥 app 中兩者已由 globals.js 載入；在 dashboard 等外部頁面則延遲載入，
 * 避免拖慢該頁初始載入速度。
 */
async function ensureData() {
    if (typeof globalThis === 'undefined') return;
    if (!globalThis.POKEDEX) {
        try {
            await import('../../shared/pokedex-data.js');
        } catch (e) {
            console.warn('[CREATIVE] 載入 POKEDEX 失敗:', e);
        }
    }
    const hasMoves = globalThis.MOVES || (typeof window !== 'undefined' && window.MOVES);
    if (!hasMoves) {
        try {
            const mod = await import('../data/moves-data.js');
            globalThis.MOVES = mod.MOVES;
            if (typeof window !== 'undefined') window.MOVES = mod.MOVES;
        } catch (e) {
            console.warn('[CREATIVE] 載入 MOVES 失敗:', e);
        }
    }
    CreativeMode.applyNow();
}

async function openPanel() {
    if (panelEl) return;
    await ensureData();
    injectStyles();
    const body = el('div', { class: 'cm-body' });
    const tabsBar = el('div', { class: 'cm-tabs' });
    const status = el('span', { class: 'cm-status' });
    panelEl = el('div', { class: 'cm-overlay' }, [
        el('div', { class: 'cm-window' }, [
            el('div', { class: 'cm-header' }, [
                el('span', { class: 'cm-title', text: 'CREATIVE MODE 創造模式' }),
                status,
                el('button', { class: 'cm-close', text: '關閉', onclick: closePanel })
            ]),
            tabsBar,
            body
        ])
    ]);
    panelEl.addEventListener('mousedown', (e) => { if (e.target === panelEl) closePanel(); });
    document.body.appendChild(panelEl);
    refreshPanel();
    try {
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'pkm-creative-opened' }, '*');
        }
    } catch (e) {
        // 忽略：非 iframe 環境
    }
}

function closePanel() {
    if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
    panelEl = null;
}

const LAUNCHER_COLLAPSED_KEY = 'pkm.creative.launcherCollapsed';
let launcherCollapsed = false;

function applyLauncherClass() {
    if (!launcherEl) return;
    launcherEl.className = 'cm-launcher'
        + (CreativeMode.isEnabled() ? ' active' : '')
        + (launcherCollapsed ? ' collapsed' : '');
}

function setLauncherCollapsed(collapsed) {
    launcherCollapsed = collapsed;
    applyLauncherClass();
    try { localStorage.setItem(LAUNCHER_COLLAPSED_KEY, collapsed ? '1' : '0'); } catch (e) {}
}

function createLauncher() {
    if (launcherEl) return;
    try { launcherCollapsed = localStorage.getItem(LAUNCHER_COLLAPSED_KEY) === '1'; } catch (e) { launcherCollapsed = false; }
    launcherEl = el('div', {
        class: 'cm-launcher',
        title: '開啟創造模式控制台',
        role: 'button',
        tabindex: '0'
    }, [
        el('span', { class: 'cm-launcher-label', text: '創造模式' }),
        el('button', {
            class: 'cm-launcher-fold',
            type: 'button',
            title: '收起到側邊',
            'aria-label': '收起到側邊',
            html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>',
            onclick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                setLauncherCollapsed(!launcherCollapsed);
            }
        })
    ]);
    launcherEl.addEventListener('click', (event) => {
        if (event.target && event.target.closest && event.target.closest('.cm-launcher-fold')) return;
        openPanel();
    });
    applyLauncherClass();
    document.body.appendChild(launcherEl);
}

function init() {
    if (typeof document === 'undefined') return;
    injectStyles();
    // 儀表板等外部容器可設定此旗標，改用容器提供的按鈕唤出面板
    if (!(typeof window !== 'undefined' && window.PKM_CREATIVE_HIDE_LAUNCHER === true)) {
        createLauncher();
    }
    CreativeMode.onChange(() => {
        applyLauncherClass();
        if (panelEl) refreshPanel();
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

// 對外唤出介面：供懸浮球擴充（SillyTavern 端）以 postMessage 或全域函式呼叫
if (typeof window !== 'undefined') {
    window.CreativePanel = {
        open: openPanel,
        close: closePanel,
        toggle: () => (panelEl ? closePanel() : openPanel())
    };
    window.addEventListener('pkm:open-creative', () => { openPanel(); });
    window.addEventListener('pkm:toggle-creative', () => { if (panelEl) closePanel(); else openPanel(); });
    window.addEventListener('message', (event) => {
        const data = event && event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'pkm-open-creative') {
            console.log('[PKM Creative] panel received open request');
            openPanel();
        } else if (data.type === 'pkm-toggle-creative') {
            if (panelEl) closePanel();
            else openPanel();
        }
    });
    console.log('[PKM Creative] message listener registered');
}

export { openPanel, closePanel };
export default { openPanel, closePanel };
