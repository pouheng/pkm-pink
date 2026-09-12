#!/usr/bin/env node
/**
 * =============================================
 * CREATIVE MODE 測試
 * =============================================
 *
 * 用法: node scripts/creative-mode-test.js
 *
 * 驗證創造模式的資料覆蓋、暱稱覆蓋、開關還原與匯入匯出，
 * 並確認關閉時引擎行為與原始資料一致。
 */

// 0. Window shim 必須第一個 import
import './test-shim.js';

// 1. 載入全域資料
import '../../shared/pokedex-data.js';
import { MOVES } from '../data/moves-data.js';
import { getPokemonData, getMoveData, Pokemon } from '../engine/battle-engine.js';
import CreativeMode from '../systems/creative-mode.js';

// 讓引擎以裸全域變數找到資料
globalThis.MOVES = MOVES;
globalThis.window.MOVES = MOVES;
globalThis.FALLBACK_MOVES = ['Tackle'];

let totalTests = 0;
let passedTests = 0;
const failures = [];

function assert(condition, testName, detail = '') {
    totalTests++;
    if (condition) {
        passedTests++;
    } else {
        failures.push({ testName, detail });
    }
}

function assertEqual(actual, expected, testName) {
    assert(actual === expected, testName, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function testBaseline() {
    const bulba = getPokemonData('Bulbasaur');
    assertEqual(bulba.baseStats.hp, 45, 'baseline bulbasaur HP is 45');
    assertEqual(getMoveData('Thunderbolt').power, 90, 'baseline thunderbolt power is 90');
    assertEqual(CreativeMode.isEnabled(), false, 'creative mode starts disabled');
}

function testSpeciesOverride() {
    CreativeMode.enable();
    assertEqual(CreativeMode.isEnabled(), true, 'creative mode enables');

    CreativeMode.setSpeciesOverride('bulbasaur', { baseStats: { hp: 200, atk: 150 } });
    const bulba = getPokemonData('Bulbasaur');
    assertEqual(bulba.baseStats.hp, 200, 'species HP override applies');
    assertEqual(bulba.baseStats.atk, 150, 'species atk override applies');
    assertEqual(bulba.baseStats.def, 49, 'untouched stat keeps original value');

    CreativeMode.setSpeciesOverride('bulbasaur', { types: ['Fire'], abilities: { 0: 'Blaze' } });
    const bulba2 = getPokemonData('Bulbasaur');
    assertEqual(bulba2.types[0], 'Fire', 'species type override applies');
    assertEqual(bulba2.types.length, 1, 'species type override replaces list');

    CreativeMode.disable();
    const restored = getPokemonData('Bulbasaur');
    assertEqual(restored.baseStats.hp, 45, 'disable restores species HP');
    assertEqual(restored.types[0], 'Grass', 'disable restores species type');
    CreativeMode.enable();
}

function testMoveOverride() {
    CreativeMode.setMoveOverride('thunderbolt', { basePower: 120, type: 'Electric', pp: 20 });
    const tb = getMoveData('Thunderbolt');
    assertEqual(tb.power, 120, 'move power override applies');
    assertEqual(tb.pp, 20, 'move PP override applies');

    CreativeMode.clearMoveOverride('thunderbolt');
    assertEqual(getMoveData('Thunderbolt').power, 90, 'clearing move override restores power');
}

function testCustomSpecies() {
    CreativeMode.addCustomSpecies({
        id: 'testmon',
        name: 'Testmon',
        types: ['Normal'],
        baseStats: { hp: 120, atk: 130, def: 100, spa: 80, spd: 90, spe: 110 },
        abilities: { 0: 'TestPower' }
    });
    const data = getPokemonData('Testmon');
    assert(data !== null, 'custom species is discoverable');
    assertEqual(data.baseStats.atk, 130, 'custom species stats apply');
    assertEqual(CreativeMode.calcBST(data.baseStats), 630, 'custom species BST calculated');

    const pkm = new Pokemon({ name: 'Testmon', lv: 50, moves: ['Tackle'] });
    assertEqual(pkm.ability, 'TestPower', 'custom species ability resolves');

    CreativeMode.removeCustomSpecies('testmon');
    assertEqual(getPokemonData('Testmon'), null, 'custom species removal restores absence');
}

function testNicknameOverride() {
    CreativeMode.setNicknameOverride('小智版甲賀忍蛙', {
        species: 'greninja',
        baseStats: { hp: 72, atk: 145, def: 67, spa: 153, spd: 71, spe: 132 },
        ability: 'Battle Bond',
        moves: ['Water Shuriken', 'Night Slash', 'Extrasensory'],
        note: '原作動畫形態還原'
    });

    const resolved = CreativeMode.resolveNickname('小智版甲賀忍蛙');
    assert(resolved !== null, 'nickname override resolves when enabled');

    const pkm = new Pokemon({
        name: 'Greninja',
        nickname: '小智版甲賀忍蛙',
        lv: 50,
        moves: ['Water Shuriken']
    });
    assertEqual(pkm.baseStats.atk, 145, 'nickname override atk applies');
    assertEqual(pkm.baseStats.spa, 153, 'nickname override spa applies');
    assertEqual(pkm.baseStats.spe, 132, 'nickname override spe applies');
    assertEqual(pkm.ability, 'Battle Bond', 'nickname override ability applies');
    assertEqual(pkm.nickname, '小智版甲賀忍蛙', 'nickname is preserved on instance');
    assertEqual(pkm.moves.length, 3, 'nickname override replaces moves');
    assertEqual(pkm.moves[1].name, 'Night Slash', 'nickname override move applies');

    const normal = new Pokemon({ name: 'Greninja', lv: 50, moves: ['Water Shuriken'] });
    assertEqual(normal.baseStats.atk, 95, 'non-matching nickname keeps original stats');
    assertEqual(normal.ability, 'Torrent', 'non-matching nickname keeps original ability');

    CreativeMode.disable();
    assertEqual(CreativeMode.resolveNickname('小智版甲賀忍蛙'), null, 'nickname override ignored when disabled');
    const disabled = new Pokemon({ name: 'Greninja', nickname: '小智版甲賀忍蛙', lv: 50, moves: ['Water Shuriken'] });
    assertEqual(disabled.baseStats.atk, 95, 'disabled mode ignores nickname override');
    CreativeMode.enable();
}

function testExportImport() {
    const pack = CreativeMode.exportPack();
    assertEqual(pack.format, 'pkm-creative-pack', 'export pack has correct format');
    assert(pack.data.nicknameOverrides['小智版甲賀忍蛙'], 'export includes nickname override');

    const json = JSON.stringify(pack);
    CreativeMode.resetAll();
    assertEqual(CreativeMode.getNicknameOverrides()['小智版甲賀忍蛙'], undefined, 'reset clears overrides');

    const result = CreativeMode.importPack(json);
    assertEqual(result.ok, true, 'import succeeds');
    assertEqual(result.summary.nicknameOverrides, 1, 'import restores nickname override');
    assert(CreativeMode.getNicknameOverrides()['小智版甲賀忍蛙'], 'imported nickname override present');
}

function testLegacyNicknameFormat() {
    CreativeMode.resetAll();
    const legacy = [{
        speciesId: 658,
        defaultName: '甲賀忍蛙',
        baseStats: { hp: 72, atk: 95, def: 67, spa: 103, spd: 71, spe: 122 },
        nicknameOverrides: [{
            nickname: 'Ash-Greninja',
            customStats: { hp: 72, atk: 145, def: 67, spa: 153, spd: 71, spe: 132 },
            customAbility: 'Battle Bond',
            note: 'legacy format'
        }]
    }];
    const result = CreativeMode.importPack(legacy);
    assertEqual(result.ok, true, 'legacy array format imports');
    const entry = CreativeMode.resolveNickname('Ash-Greninja');
    assert(entry !== null, 'legacy nickname resolves');
    assertEqual(entry.baseStats.atk, 145, 'legacy customStats normalized');
    assertEqual(entry.ability, 'Battle Bond', 'legacy customAbility normalized');
}

function testCustomMoveEffects() {
    CreativeMode.addCustomMove({
        id: 'bouncybubble',
        name: 'Bouncy Bubble',
        type: 'Water',
        category: 'Special',
        basePower: 60,
        accuracy: 100,
        pp: 20,
        drain: [1, 2],
        description: '回復造成傷害的50%'
    });
    const md = getMoveData('Bouncy Bubble');
    assertEqual(md.name, 'Bouncy Bubble', 'custom move resolves by name');
    assert(Array.isArray(md.drain) && md.drain[0] === 1 && md.drain[1] === 2, 'custom move drain effect preserved');
    assertEqual(md.power, 60, 'custom move power');
    const pkm = new Pokemon({ name: 'Eevee', lv: 50, moves: ['Bouncy Bubble'] });
    assertEqual(pkm.moves[0].name, 'Bouncy Bubble', 'pokemon can use custom move with effect');
    CreativeMode.removeCustomMove('bouncybubble');
}

async function main() {
    testBaseline();
    testSpeciesOverride();
    testMoveOverride();
    testCustomSpecies();
    testNicknameOverride();
    testCustomMoveEffects();
    testExportImport();
    testLegacyNicknameFormat();

    if (failures.length > 0) {
        console.error(`\n[FAIL] creative-mode-test failed: ${passedTests}/${totalTests} passed`);
        failures.forEach((failure, idx) => {
            console.error(`  ${idx + 1}. ${failure.testName}${failure.detail ? ` -- ${failure.detail}` : ''}`);
        });
        process.exitCode = 1;
        return;
    }

    console.log(`[PASS] creative-mode-test passed: ${passedTests}/${totalTests}`);
}

await main();
