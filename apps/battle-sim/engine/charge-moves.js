/**
 * ===========================================
 * CHARGE-MOVES.JS - 蓄力技能系统
 * ===========================================
 * 
 * 处理需要两回合执行的技能：
 * - 天气联动型 (Solar Beam, Solar Blade, Electro Shot)
 * - 半无敌状态型 (Fly, Dig, Dive, Phantom Force, Shadow Force)
 * - 纯蓄力/强化型 (Meteor Beam, Skull Bash, Sky Attack, Geomancy)
 * 
 * 与 Power Herb 道具交互
 * 
 * 【重构】从 moves-data.js 读取 flags.charge 标记，
 * 额外配置（蓄力文本、天气联动、半无敌状态等）在此定义
 */

/**
 * 蓄力技能额外配置表
 * 基础蓄力检测由 moves-data.js 的 flags.charge 提供
 * 此表仅定义额外行为（天气联动、半无敌状态、蓄力文本等）
 */
export const CHARGE_MOVE_CONFIG = {
    // ============================================
    // 第一类：天气联动型
    // ============================================
    'Solar Beam': {
        type: 'weather',
        weather: ['sun', 'harshsun'],
        chargeText: '吸收了光芒！',
        releaseText: '发射了日光束！',
        weatherWeakened: ['rain', 'heavyrain', 'sandstorm', 'hail', 'snow'],
    },
    'Solar Blade': {
        type: 'weather',
        weather: ['sun', 'harshsun'],
        chargeText: '吸收了光芒！',
        releaseText: '挥出了日光刃！',
        weatherWeakened: ['rain', 'heavyrain', 'sandstorm', 'hail', 'snow'],
    },
    'Electro Shot': {
        type: 'weather',
        weather: ['rain', 'heavyrain'],
        chargeText: '积蓄了电力！',
        releaseText: '发射了电光束！',
        chargeBoost: { spa: 1 },
    },
    
    // ============================================
    // 第二类：半无敌状态型
    // ============================================
    'Fly': {
        type: 'invuln',
        status: 'flying',
        chargeText: '飞向了天空！',
        releaseText: '俯冲攻击！',
        vulnerableTo: ['Thunder', 'Hurricane', 'Sky Uppercut', 'Smack Down', 'Thousand Arrows'],
    },
    'Bounce': {
        type: 'invuln',
        status: 'flying',
        chargeText: '跳向了高空！',
        releaseText: '猛烈地落下！',
        vulnerableTo: ['Thunder', 'Hurricane', 'Sky Uppercut', 'Smack Down', 'Thousand Arrows'],
    },
    'Dig': {
        type: 'invuln',
        status: 'underground',
        chargeText: '钻进了地下！',
        releaseText: '从地下发动攻击！',
        vulnerableTo: ['Earthquake', 'Magnitude', 'Fissure'],
        doubleDamageFrom: ['Earthquake', 'Magnitude'], // 这些招式对地下目标双倍伤害
    },
    'Dive': {
        type: 'invuln',
        status: 'underwater',
        chargeText: '潜入了水中！',
        releaseText: '从水中发动攻击！',
        vulnerableTo: ['Surf', 'Whirlpool'],
        doubleDamageFrom: ['Surf', 'Whirlpool'],
    },
    'Phantom Force': {
        type: 'invuln',
        status: 'shadow',
        chargeText: '消失在了异次元中...',
        releaseText: '从异次元发动了攻击！',
        breaksProtect: true, // 穿透守住
    },
    'Shadow Force': {
        type: 'invuln',
        status: 'shadow',
        chargeText: '消失在了暗影中...',
        releaseText: '从暗影中发动了攻击！',
        breaksProtect: true,
    },
    
    // ============================================
    // 第三类：纯蓄力/强化型
    // ============================================
    'Meteor Beam': {
        type: 'buff',
        chargeText: '溢出了宇宙能量！',
        releaseText: '发射了流星光束！',
        chargeBoost: { spa: 1 },
    },
    'Skull Bash': {
        type: 'buff',
        chargeText: '缩起了头！',
        releaseText: '猛烈地撞击！',
        chargeBoost: { def: 1 },
    },
    'Sky Attack': {
        type: 'buff',
        chargeText: '发出了耀眼的光芒！',
        releaseText: '发动了神鸟攻击！',
        highCrit: true, // 高暴击率
    },
    'Razor Wind': {
        type: 'buff',
        chargeText: '卷起了狂风！',
        releaseText: '释放了真空斩！',
        highCrit: true,
    },
    'Freeze Shock': {
        type: 'buff',
        chargeText: '被冰冷的电流包围了！',
        releaseText: '释放了冰冻伏特！',
    },
    'Ice Burn': {
        type: 'buff',
        chargeText: '被极寒的火焰包围了！',
        releaseText: '释放了极寒冷焰！',
    },
    'Geomancy': {
        type: 'buff',
        chargeText: '吸收了大地的力量！',
        releaseText: '释放了大地掌控！',
        isStatusMove: true, // 这是变化技，不造成伤害
        releaseBoost: { spa: 2, spd: 2, spe: 2 }, // 释放时的能力提升
    },
    'Beak Blast': {
        type: 'buff',
        chargeText: '加热了鸟嘴！',
        releaseText: '发射了鸟嘴加农炮！',
        contactBurn: true, // 蓄力期间被接触会烧伤对手
    },
    'Focus Punch': {
        type: 'buff',
        chargeText: '集中了精神！',
        releaseText: '发出了真气拳！',
        interruptOnHit: true, // 被攻击会中断
    },
    'Sky Drop': {
        type: 'invuln',
        status: 'flying',
        chargeText: '抓住对手飞向了天空！',
        releaseText: '将对手摔落！',
        grabsTarget: true, // 特殊：同时让目标进入半无敌状态
    },
};

/**
 * 检查技能是否为蓄力技能（从 moves-data.js 读取 flags.charge）
 * @param {string} moveName 技能名称
 * @returns {object|null} 蓄力配置或 null
 */
export function getChargeMoveConfig(moveName) {
    // 1. 从 moves-data.js 检查 flags.charge
    const moveId = (moveName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const MOVES = (typeof window !== 'undefined' && window.MOVES) ? window.MOVES : null;
    const moveData = MOVES ? MOVES[moveId] : null;
    
    // 如果 moves-data.js 中没有 charge 标记，则不是蓄力技能
    if (!moveData || !moveData.flags || !moveData.flags.charge) {
        return null;
    }
    
    // 2. 获取额外配置（蓄力文本、天气联动等）
    const extraConfig = CHARGE_MOVE_CONFIG[moveName] || {};
    
    // 3. 生成默认配置（如果没有额外配置）
    const defaultConfig = {
        type: 'buff', // 默认类型
        chargeText: '正在蓄力...',
        releaseText: '发动了攻击！',
    };
    
    // 4. 从 moves-data.js 读取额外信息
    // 检查是否有 boosts（如 Meteor Beam 的特攻+1）
    if (moveData.onTryMove === null && moveData.boosts) {
        // Geomancy 等技能在释放时提升能力
        extraConfig.releaseBoost = extraConfig.releaseBoost || moveData.boosts;
    }
    
    // 检查是否穿透守住（Phantom Force, Shadow Force）
    if (moveData.breaksProtect) {
        extraConfig.breaksProtect = true;
    }
    
    // 合并配置
    return { ...defaultConfig, ...extraConfig, moveData };
}

/**
 * 检查技能是否为蓄力技能（简化版，仅检查 flags.charge）
 * @param {string} moveName 技能名称
 * @returns {boolean}
 */
export function isChargeMove(moveName) {
    const moveId = (moveName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const MOVES = (typeof window !== 'undefined' && window.MOVES) ? window.MOVES : null;
    const moveData = MOVES ? MOVES[moveId] : null;
    return !!(moveData && moveData.flags && moveData.flags.charge);
}

// 兼容旧代码：CHARGE_MOVES 别名
export const CHARGE_MOVES = CHARGE_MOVE_CONFIG;

/**
 * 检查是否满足瞬发条件
 * @param {Pokemon} user 使用者
 * @param {object} config 蓄力配置
 * @param {object} battle 战斗状态
 * @returns {object} { canSkip: boolean, reason: string, consumeItem: boolean }
 */
export function checkInstantCondition(user, config, battle) {
    // 1. 天气联动型：检查天气
    if (config.type === 'weather' && config.weather) {
        const currentWeather = battle?.weather || null;
        if (currentWeather && config.weather.includes(currentWeather)) {
            return { canSkip: true, reason: 'weather', consumeItem: false };
        }
    }
    
    // 2. 强力香草 (Power Herb)：消耗道具跳过蓄力
    const userItem = (user.item || '').toLowerCase().replace(/[^a-z]/g, '');
    if (userItem === 'powerherb') {
        return { canSkip: true, reason: 'powerherb', consumeItem: true };
    }
    
    return { canSkip: false, reason: null, consumeItem: false };
}

/**
 * 处理蓄力技能的第一回合（蓄力阶段）
 * @param {Pokemon} user 使用者
 * @param {object} move 技能
 * @param {object} config 蓄力配置
 * @param {object} battle 战斗状态
 * @param {Array} logs 日志数组
 * @returns {object} { charging: true, skipDamage: true }
 */
export function handleChargePhase(user, move, config, battle, logs) {
    // 设置蓄力状态
    user.volatile = user.volatile || {};
    user.volatile.chargingMove = move.name;
    
    // 半无敌状态
    if (config.type === 'invuln' && config.status) {
        user.volatile[config.status] = true;
    }
    
    // 蓄力期间的能力提升
    if (config.chargeBoost) {
        for (const [stat, stages] of Object.entries(config.chargeBoost)) {
            if (user.applyBoost) {
                user.applyBoost(stat, stages);
                const statNames = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
                logs.push(`${user.cnName} 的${statNames[stat] || stat}提升了！`);
            }
        }
    }
    
    // 输出蓄力文本
    logs.push(`${user.cnName} ${config.chargeText}`);
    
    return { charging: true, skipDamage: true };
}

/**
 * 处理蓄力技能的第二回合（释放阶段）
 * @param {Pokemon} user 使用者
 * @param {object} move 技能
 * @param {object} config 蓄力配置
 * @param {object} battle 战斗状态
 * @param {Array} logs 日志数组
 * @returns {object} { released: true }
 */
export function handleReleasePhase(user, move, config, battle, logs) {
    // 清除蓄力状态
    if (user.volatile) {
        delete user.volatile.chargingMove;
        
        // 清除半无敌状态
        if (config.type === 'invuln' && config.status) {
            delete user.volatile[config.status];
        }
    }
    
    // 释放时的能力提升（如 Geomancy）
    if (config.releaseBoost) {
        for (const [stat, stages] of Object.entries(config.releaseBoost)) {
            if (user.applyBoost) {
                user.applyBoost(stat, stages);
                const statNames = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度' };
                const changeText = stages >= 2 ? '大幅' : '';
                logs.push(`${user.cnName} 的${statNames[stat] || stat}${changeText}提升了！`);
            }
        }
    }
    
    // 输出释放文本
    logs.push(`${user.cnName} ${config.releaseText}`);
    
    return { released: true };
}

/**
 * 检查目标是否处于半无敌状态
 * @param {Pokemon} target 目标
 * @param {object} move 攻击招式
 * @returns {object} { invulnerable: boolean, canHit: boolean, doubleDamage: boolean }
 */
export function checkInvulnerability(target, move) {
    if (!target.volatile) {
        return { invulnerable: false, canHit: true, doubleDamage: false };
    }
    
    const moveName = move.name || '';
    
    // 检查各种半无敌状态
    for (const [chargeName, config] of Object.entries(CHARGE_MOVES)) {
        if (config.type !== 'invuln' || !config.status) continue;
        
        if (target.volatile[config.status]) {
            // 目标处于半无敌状态
            const vulnerableTo = config.vulnerableTo || [];
            const doubleDamageFrom = config.doubleDamageFrom || [];
            
            if (vulnerableTo.includes(moveName)) {
                // 可以命中，可能双倍伤害
                return {
                    invulnerable: true,
                    canHit: true,
                    doubleDamage: doubleDamageFrom.includes(moveName),
                    status: config.status,
                };
            }
            
            // 无法命中
            return {
                invulnerable: true,
                canHit: false,
                doubleDamage: false,
                status: config.status,
            };
        }
    }
    
    return { invulnerable: false, canHit: true, doubleDamage: false };
}

/**
 * 检查用户是否正在蓄力某个技能
 * @param {Pokemon} user 使用者
 * @returns {string|null} 正在蓄力的技能名称，或 null
 */
export function getChargingMove(user) {
    return user.volatile?.chargingMove || null;
}

/**
 * 强制清除蓄力状态（用于换人、濒死等情况）
 * @param {Pokemon} pokemon 宝可梦
 */
export function clearChargingState(pokemon) {
    if (!pokemon.volatile) return;
    
    const chargingMove = pokemon.volatile.chargingMove;
    if (chargingMove) {
        const config = CHARGE_MOVES[chargingMove];
        if (config && config.type === 'invuln' && config.status) {
            delete pokemon.volatile[config.status];
        }
        delete pokemon.volatile.chargingMove;
    }
}

/**
 * 检查 Focus Punch 是否被中断
 * @param {Pokemon} user 使用者
 * @param {number} damageTaken 本回合受到的伤害
 * @returns {boolean} 是否被中断
 */
export function checkFocusPunchInterrupt(user, damageTaken) {
    if (!user.volatile?.chargingMove) return false;
    
    const config = CHARGE_MOVES[user.volatile.chargingMove];
    if (config && config.interruptOnHit && damageTaken > 0) {
        clearChargingState(user);
        return true;
    }
    
    return false;
}

/**
 * 检查 Beak Blast 的接触烧伤效果
 * @param {Pokemon} user 正在蓄力的宝可梦
 * @param {Pokemon} attacker 攻击者
 * @param {object} move 攻击招式
 * @param {Array} logs 日志数组
 * @returns {boolean} 是否触发烧伤
 */
export function checkBeakBlastBurn(user, attacker, move, logs) {
    if (!user.volatile?.chargingMove) return false;
    
    const config = CHARGE_MOVES[user.volatile.chargingMove];
    if (!config || !config.contactBurn) return false;
    
    // 检查是否为接触类招式
    const moveId = (move.id || move.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const fullMoveData = (typeof MOVES !== 'undefined' && MOVES[moveId]) ? MOVES[moveId] : {};
    const isContact = fullMoveData.flags?.contact || move.contact;
    
    if (isContact && !attacker.status) {
        attacker.status = 'brn';
        logs.push(`🔥 ${attacker.cnName} 被 ${user.cnName} 加热的鸟嘴烧伤了！`);
        return true;
    }
    
    return false;
}

// ============================================
// 导出到全局
// ============================================

if (typeof window !== 'undefined') {
    window.CHARGE_MOVES = CHARGE_MOVES;
    window.getChargeMoveConfig = getChargeMoveConfig;
    window.checkInstantCondition = checkInstantCondition;
    window.handleChargePhase = handleChargePhase;
    window.handleReleasePhase = handleReleasePhase;
    window.checkInvulnerability = checkInvulnerability;
    window.getChargingMove = getChargingMove;
    window.clearChargingState = clearChargingState;
    window.checkFocusPunchInterrupt = checkFocusPunchInterrupt;
    window.checkBeakBlastBurn = checkBeakBlastBurn;
}

console.log('[CHARGE MOVES] 蓄力技能系统已加载');
