// @ts-check
/**
 * =============================================
 * CREATIVE MODE - 創造模式核心
 * =============================================
 *
 * 提供一個可選的全域編輯層，讓使用者在不破壞原始資料的前提下：
 *  1. 覆蓋既有寶可夢的種族值 / 屬性 / 特性
 *  2. 覆蓋既有招式的屬性 / 分類 / 威力 / 命中 / PP
 *  3. 新增自訂寶可夢與自訂招式
 *  4. 依「暱稱」套用另一套種族值與特性（特殊型態還原）
 *  5. 將以上設定匯出 / 匯入為單一 JSON 擴充包
 *
 * 設計原則（Brownfield）：
 *  - 預設關閉，關閉時引擎行為與原專案 100% 相同
 *  - 不改動 pokedex-data.js / moves-data.js 原始檔
 *  - 透過執行期覆蓋全域 POKEDEX / MOVES，讓既有查詢函式自然生效
 *  - 原始資料快照保存在記憶體，關閉或重置時可完整還原
 */

const STORAGE_KEY = 'pkm-creative-mode-v1';
const PACK_FORMAT = 'pkm-creative-pack';
const PACK_VERSION = 1;

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_LABELS = {
    hp: 'HP',
    atk: '攻擊',
    def: '防禦',
    spa: '特攻',
    spd: '特防',
    spe: '速度'
};

export const MOVE_CATEGORIES = ['Physical', 'Special', 'Status'];

export const POKEMON_TYPES = [
    'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice',
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
    'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
];

// ============================================
// 內部工具
// ============================================

function clone(obj) {
    return obj === undefined ? obj : JSON.parse(JSON.stringify(obj));
}

function normalizeId(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeNickname(nickname) {
    return String(nickname || '').trim().toLowerCase();
}

function getPokedex() {
    if (typeof globalThis !== 'undefined' && globalThis.POKEDEX) return globalThis.POKEDEX;
    if (typeof window !== 'undefined' && window.POKEDEX) return window.POKEDEX;
    return null;
}

function getMoves() {
    if (typeof globalThis !== 'undefined' && globalThis.MOVES) return globalThis.MOVES;
    if (typeof window !== 'undefined' && window.MOVES) return window.MOVES;
    return null;
}

function hasStorage() {
    try {
        return typeof localStorage !== 'undefined' && localStorage !== null;
    } catch (e) {
        return false;
    }
}

// ============================================
// 狀態
// ============================================

const state = {
    enabled: false,
    species: {},          // id -> { name?, types?, baseStats?, abilities? }
    moves: {},            // id -> { name?, type?, category?, basePower?, accuracy?, pp? }
    customSpecies: {},    // id -> 完整 POKEDEX 條目
    customMoves: {},      // id -> 完整 MOVES 條目
    nicknameOverrides: {} // 暱稱(小寫) -> { nickname, species?, types?, baseStats?, ability?, note? }
};

// 原始資料快照（僅存在於記憶體）
const originals = {
    species: {},
    moves: {}
};

const listeners = [];

function emitChange() {
    const detail = { enabled: state.enabled };
    for (const cb of listeners) {
        try {
            cb(detail);
        } catch (e) {
            console.warn('[CREATIVE] listener error:', e);
        }
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        try {
            window.dispatchEvent(new CustomEvent('creative-mode-change', { detail }));
        } catch (e) {
            // 忽略：非瀏覽器環境
        }
    }
}

// ============================================
// 執行期覆蓋 / 還原
// ============================================

function snapshotSpecies(id) {
    if (Object.prototype.hasOwnProperty.call(originals.species, id)) return;
    const dex = getPokedex();
    originals.species[id] = (dex && dex[id]) ? clone(dex[id]) : null;
}

function snapshotMove(id) {
    if (Object.prototype.hasOwnProperty.call(originals.moves, id)) return;
    const moves = getMoves();
    originals.moves[id] = (moves && moves[id]) ? clone(moves[id]) : null;
}

function applySpeciesOverride(id) {
    const dex = getPokedex();
    const override = state.species[id];
    if (!dex || !dex[id] || !override) return false;

    snapshotSpecies(id);
    const base = originals.species[id] || dex[id];
    const next = clone(base);

    if (override.name) next.name = override.name;
    if (Array.isArray(override.types) && override.types.length) next.types = clone(override.types);
    if (override.baseStats) next.baseStats = Object.assign({}, base.baseStats, clone(override.baseStats));
    if (override.abilities) next.abilities = Object.assign({}, base.abilities, clone(override.abilities));

    dex[id] = next;
    return true;
}

function applyCustomSpecies(id) {
    const dex = getPokedex();
    const entry = state.customSpecies[id];
    if (!dex || !entry) return false;

    snapshotSpecies(id);
    dex[id] = clone(entry);
    return true;
}

function restoreSpecies(id) {
    const dex = getPokedex();
    if (!dex || !Object.prototype.hasOwnProperty.call(originals.species, id)) return;
    const snapshot = originals.species[id];
    if (snapshot === null) delete dex[id];
    else dex[id] = snapshot;
    delete originals.species[id];
}

function applyMoveOverride(id) {
    const moves = getMoves();
    const override = state.moves[id];
    if (!moves || !moves[id] || !override) return false;

    snapshotMove(id);
    const next = Object.assign({}, moves[id]);
    for (const key of Object.keys(override)) {
        if (override[key] === undefined || override[key] === null) continue;
        next[key] = clone(override[key]);
    }
    moves[id] = next;
    return true;
}

function applyCustomMove(id) {
    const moves = getMoves();
    const entry = state.customMoves[id];
    if (!moves || !entry) return false;

    snapshotMove(id);
    moves[id] = clone(entry);
    return true;
}

function restoreMove(id) {
    const moves = getMoves();
    if (!moves || !Object.prototype.hasOwnProperty.call(originals.moves, id)) return;
    const snapshot = originals.moves[id];
    if (snapshot === null) delete moves[id];
    else moves[id] = snapshot;
    delete originals.moves[id];
}

/**
 * 將目前所有設定套用到全域 POKEDEX / MOVES。
 */
function applyAll() {
    for (const id of Object.keys(state.customSpecies)) applyCustomSpecies(id);
    for (const id of Object.keys(state.species)) applySpeciesOverride(id);
    for (const id of Object.keys(state.customMoves)) applyCustomMove(id);
    for (const id of Object.keys(state.moves)) applyMoveOverride(id);
}

/**
 * 還原所有執行期覆蓋，回到原始資料。
 */
function restoreAll() {
    for (const id of Object.keys(originals.species)) restoreSpecies(id);
    for (const id of Object.keys(originals.moves)) restoreMove(id);
}

// ============================================
// 持久化
// ============================================

function serialize() {
    return {
        enabled: state.enabled,
        species: clone(state.species),
        moves: clone(state.moves),
        customSpecies: clone(state.customSpecies),
        customMoves: clone(state.customMoves),
        nicknameOverrides: clone(state.nicknameOverrides)
    };
}

function loadFromStorage() {
    if (!hasStorage()) return;
    let raw = null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
        console.warn('[CREATIVE] localStorage 讀取失敗:', e);
        return;
    }
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        state.enabled = !!parsed.enabled;
        state.species = parsed.species || {};
        state.moves = parsed.moves || {};
        state.customSpecies = parsed.customSpecies || {};
        state.customMoves = parsed.customMoves || {};
        state.nicknameOverrides = parsed.nicknameOverrides || {};
    } catch (e) {
        console.warn('[CREATIVE] 存檔解析失敗，已忽略:', e);
    }
}

function saveToStorage() {
    if (!hasStorage()) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
    } catch (e) {
        console.warn('[CREATIVE] localStorage 寫入失敗:', e);
    }
}

// ============================================
// 暱稱覆蓋
// ============================================

function normalizeNicknameEntry(raw, fallbackSpecies) {
    if (!raw || !raw.nickname) return null;
    const out = { nickname: String(raw.nickname) };
    const species = raw.species || raw.speciesId || fallbackSpecies;
    if (species) out.species = String(species);
    const stats = raw.baseStats || raw.customStats;
    if (stats) out.baseStats = clone(stats);
    if (Array.isArray(raw.types) && raw.types.length) out.types = clone(raw.types);
    const ability = raw.ability || raw.customAbility;
    if (ability) out.ability = ability;
    if (raw.note) out.note = raw.note;
    return out;
}

// ============================================
// 公開 API
// ============================================

const CreativeMode = {
    STORAGE_KEY,
    PACK_FORMAT,
    PACK_VERSION,

    // ---- 開關 ----
    isEnabled() {
        return state.enabled;
    },

    enable() {
        if (state.enabled) return;
        state.enabled = true;
        applyAll();
        saveToStorage();
        emitChange();
    },

    disable() {
        if (!state.enabled) return;
        state.enabled = false;
        restoreAll();
        saveToStorage();
        emitChange();
    },

    toggle() {
        if (state.enabled) this.disable();
        else this.enable();
    },

    /**
     * 若目前已開啟，重新套用所有覆蓋（用於資料來源稍後才載入的情境）
     */
    applyNow() {
        if (state.enabled) applyAll();
        return state.enabled;
    },

    onChange(cb) {
        if (typeof cb === 'function') listeners.push(cb);
    },

    // ---- 查詢 ----
    getSpecies(id) {
        const dex = getPokedex();
        if (!dex) return null;
        const key = normalizeId(id);
        return dex[key] || null;
    },

    getMove(id) {
        const moves = getMoves();
        if (!moves) return null;
        const key = normalizeId(id);
        return moves[key] || null;
    },

    listSpeciesIds() {
        const dex = getPokedex();
        return dex ? Object.keys(dex).sort() : [];
    },

    listMoveIds() {
        const moves = getMoves();
        return moves ? Object.keys(moves).sort() : [];
    },

    hasSpeciesOverride(id) {
        return !!state.species[normalizeId(id)];
    },

    hasMoveOverride(id) {
        return !!state.moves[normalizeId(id)];
    },

    getSpeciesOverride(id) {
        return state.species[normalizeId(id)] || null;
    },

    getMoveOverride(id) {
        return state.moves[normalizeId(id)] || null;
    },

    // ---- 種族值編輯 ----
    setSpeciesOverride(id, patch) {
        const key = normalizeId(id);
        if (!key || !patch) return false;
        const current = state.species[key] || {};
        const next = Object.assign({}, current);

        if (patch.name !== undefined) next.name = patch.name;
        if (Array.isArray(patch.types)) next.types = clone(patch.types);
        if (patch.baseStats) next.baseStats = Object.assign({}, current.baseStats || {}, clone(patch.baseStats));
        if (patch.abilities) next.abilities = Object.assign({}, current.abilities || {}, clone(patch.abilities));

        state.species[key] = next;
        if (state.enabled) applySpeciesOverride(key);
        saveToStorage();
        emitChange();
        return true;
    },

    clearSpeciesOverride(id) {
        const key = normalizeId(id);
        if (!state.species[key]) return false;
        delete state.species[key];
        if (state.enabled) restoreSpecies(key);
        saveToStorage();
        emitChange();
        return true;
    },

    // ---- 招式編輯 ----
    setMoveOverride(id, patch) {
        const key = normalizeId(id);
        if (!key || !patch) return false;
        const current = state.moves[key] || {};
        const next = Object.assign({}, current, clone(patch));
        state.moves[key] = next;
        if (state.enabled) applyMoveOverride(key);
        saveToStorage();
        emitChange();
        return true;
    },

    clearMoveOverride(id) {
        const key = normalizeId(id);
        if (!state.moves[key]) return false;
        delete state.moves[key];
        if (state.enabled) restoreMove(key);
        saveToStorage();
        emitChange();
        return true;
    },

    // ---- 新增寶可夢 ----
    addCustomSpecies(entry) {
        if (!entry || !entry.name) return false;
        const id = normalizeId(entry.id || entry.name);
        if (!id) return false;
        const normalized = {
            num: entry.num || 0,
            name: entry.name,
            types: Array.isArray(entry.types) && entry.types.length ? clone(entry.types) : ['Normal'],
            baseStats: Object.assign(
                { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
                clone(entry.baseStats || {})
            ),
            abilities: clone(entry.abilities || { 0: 'Overgrow' })
        };
        state.customSpecies[id] = normalized;
        if (state.enabled) applyCustomSpecies(id);
        saveToStorage();
        emitChange();
        return true;
    },

    removeCustomSpecies(id) {
        const key = normalizeId(id);
        if (!state.customSpecies[key]) return false;
        delete state.customSpecies[key];
        if (state.enabled) restoreSpecies(key);
        saveToStorage();
        emitChange();
        return true;
    },

    isCustomSpecies(id) {
        return !!state.customSpecies[normalizeId(id)];
    },

    // ---- 新增招式 ----
    addCustomMove(entry) {
        if (!entry || !entry.name) return false;
        const id = normalizeId(entry.id || entry.name);
        if (!id) return false;
        const normalized = {
            num: entry.num || 0,
            name: entry.name,
            type: entry.type || 'Normal',
            category: MOVE_CATEGORIES.indexOf(entry.category) >= 0 ? entry.category : 'Physical',
            basePower: Number(entry.basePower) || 0,
            accuracy: entry.accuracy === true ? true : (Number(entry.accuracy) || 100),
            pp: Number(entry.pp) || 10,
            priority: Number(entry.priority) || 0,
            target: entry.target || 'normal'
        };
        state.customMoves[id] = normalized;
        if (state.enabled) applyCustomMove(id);
        saveToStorage();
        emitChange();
        return true;
    },

    removeCustomMove(id) {
        const key = normalizeId(id);
        if (!state.customMoves[key]) return false;
        delete state.customMoves[key];
        if (state.enabled) restoreMove(key);
        saveToStorage();
        emitChange();
        return true;
    },

    isCustomMove(id) {
        return !!state.customMoves[normalizeId(id)];
    },

    // ---- 暱稱覆蓋 ----
    /**
     * 依暱稱解析覆蓋設定（供引擎於建立寶可夢時呼叫）
     * @param {string} nickname
     * @returns {object|null}
     */
    resolveNickname(nickname) {
        if (!state.enabled || !nickname) return null;
        return state.nicknameOverrides[normalizeNickname(nickname)] || null;
    },

    setNicknameOverride(nickname, data) {
        if (!nickname) return false;
        const key = normalizeNickname(nickname);
        const entry = normalizeNicknameEntry(Object.assign({}, data, { nickname: String(nickname) }));
        if (!entry) return false;
        state.nicknameOverrides[key] = entry;
        saveToStorage();
        emitChange();
        return true;
    },

    removeNicknameOverride(nickname) {
        const key = normalizeNickname(nickname);
        if (!state.nicknameOverrides[key]) return false;
        delete state.nicknameOverrides[key];
        saveToStorage();
        emitChange();
        return true;
    },

    getNicknameOverrides() {
        return clone(state.nicknameOverrides);
    },

    // ---- BST ----
    calcBST(baseStats) {
        if (!baseStats) return 0;
        return STAT_KEYS.reduce((sum, key) => sum + (Number(baseStats[key]) || 0), 0);
    },

    // ---- 匯出 / 匯入 ----
    exportPack() {
        return {
            format: PACK_FORMAT,
            version: PACK_VERSION,
            exportedAt: new Date().toISOString(),
            data: clone({
                species: state.species,
                moves: state.moves,
                customSpecies: state.customSpecies,
                customMoves: state.customMoves,
                nicknameOverrides: state.nicknameOverrides
            })
        };
    },

    /**
     * 匯入擴充包（接受本模組格式，或使用者提供的簡易格式）
     * @param {string|object} input
     * @returns {{ok: boolean, error?: string, summary?: object}}
     */
    importPack(input) {
        let parsed = input;
        try {
            if (typeof input === 'string') parsed = JSON.parse(input);
        } catch (e) {
            return { ok: false, error: 'JSON 解析失敗: ' + e.message };
        }
        if (!parsed || typeof parsed !== 'object') {
            return { ok: false, error: '擴充包格式無效' };
        }

        const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

        const nextSpecies = Object.assign({}, state.species, data.species || {});
        const nextMoves = Object.assign({}, state.moves, data.moves || {});
        const nextCustomSpecies = Object.assign({}, state.customSpecies, data.customSpecies || {});
        const nextCustomMoves = Object.assign({}, state.customMoves, data.customMoves || {});

        // 暱稱覆蓋：支援物件 map、陣列，以及使用者範例的「物種包」格式
        const nextNicknames = Object.assign({}, state.nicknameOverrides);
        const rawNick = data.nicknameOverrides;
        const topFallback = data.defaultName || data.species || data.speciesId || null;

        if (Array.isArray(parsed) || Array.isArray(data)) {
            // 物種包陣列：[{ speciesId, defaultName, nicknameOverrides: [...] }, ...]
            const packs = Array.isArray(parsed) ? parsed : data;
            for (const item of packs) {
                if (!item || typeof item !== 'object') continue;
                const fallback = item.defaultName || item.species || item.speciesId || null;
                if (Array.isArray(item.nicknameOverrides)) {
                    for (const n of item.nicknameOverrides) {
                        const entry = normalizeNicknameEntry(n, fallback);
                        if (entry) nextNicknames[normalizeNickname(entry.nickname)] = entry;
                    }
                }
            }
        } else if (Array.isArray(rawNick)) {
            for (const item of rawNick) {
                const entry = normalizeNicknameEntry(item, topFallback);
                if (entry) nextNicknames[normalizeNickname(entry.nickname)] = entry;
            }
        } else if (rawNick && typeof rawNick === 'object') {
            for (const key of Object.keys(rawNick)) {
                const entry = normalizeNicknameEntry(rawNick[key], rawNick[key].species || topFallback);
                if (entry) nextNicknames[normalizeNickname(entry.nickname || key)] = entry;
            }
        }

        state.species = nextSpecies;
        state.moves = nextMoves;
        state.customSpecies = nextCustomSpecies;
        state.customMoves = nextCustomMoves;
        state.nicknameOverrides = nextNicknames;

        if (state.enabled) applyAll();
        saveToStorage();
        emitChange();

        return {
            ok: true,
            summary: {
                species: Object.keys(nextSpecies).length,
                moves: Object.keys(nextMoves).length,
                customSpecies: Object.keys(nextCustomSpecies).length,
                customMoves: Object.keys(nextCustomMoves).length,
                nicknameOverrides: Object.keys(nextNicknames).length
            }
        };
    },

    /**
     * 匯出成使用者範例中的「物種 + 暱稱覆蓋」格式，方便分享。
     */
    exportSpeciesWithNicknames() {
        const result = [];
        for (const key of Object.keys(state.nicknameOverrides)) {
            const entry = state.nicknameOverrides[key];
            const speciesId = entry.species;
            if (!speciesId) continue;
            const species = this.getSpecies(speciesId);
            if (!species) continue;
            result.push({
                speciesId: species.num || 0,
                defaultName: species.name,
                baseStats: clone(species.baseStats),
                nicknameOverrides: [
                    {
                        nickname: entry.nickname,
                        customStats: clone(entry.baseStats || species.baseStats),
                        customAbility: entry.ability || undefined,
                        note: entry.note || undefined
                    }
                ]
            });
        }
        return result;
    },

    // ---- 重置 ----
    resetAll() {
        restoreAll();
        state.species = {};
        state.moves = {};
        state.customSpecies = {};
        state.customMoves = {};
        state.nicknameOverrides = {};
        saveToStorage();
        emitChange();
    },

    // ---- 除錯 / 測試 ----
    _getState() {
        return state;
    }
};

// ============================================
// 初始化
// ============================================

loadFromStorage();
if (state.enabled) {
    applyAll();
}

// 跨頁 / 跨 iframe 同步：同一來源（origin）下其他頁面修改設定時即時重套用
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY) return;
        loadFromStorage();
        restoreAll();
        if (state.enabled) applyAll();
        emitChange();
    });
}

if (typeof window !== 'undefined') {
    window.CreativeMode = CreativeMode;
}
if (typeof globalThis !== 'undefined') {
    globalThis.CreativeMode = CreativeMode;
}

export default CreativeMode;
