/**
 * PKM common dashboard action API runtime.
 */
(function () {
  'use strict';

  const ROOT = typeof window !== 'undefined' ? window : globalThis;
  const COMMON = ROOT.PKMCommonRuntime || {};
  ROOT.PKMCommonRuntime = COMMON;

  COMMON.createActionsApi = function createActionsApi(ctx, stateService, options = {}) {
    const {
      DEFAULT_SETTINGS,
      DEFAULT_UNLOCKS,
      MAX_PARTY_SIZE,
      PRODUCT
    } = ctx;
    const {
      clampNumber,
      escapeJsonPointerPart,
      isObject,
      normalizeString,
      normalizeMoves,
      normalizePartySlots,
      normalizePokemon,
      normalizeTransferBuffer
    } = ctx.util;
    const {
      patchState,
      saveState
    } = stateService;
    const actionLockState = ROOT.__PKM_MVUZ_ACTION_LOCKS__ || {};
    ROOT.__PKM_MVUZ_ACTION_LOCKS__ = actionLockState;
    const transferDepositLockKey = `${PRODUCT || 'default'}:transferDepositTail`;
    if (!actionLockState[transferDepositLockKey]) actionLockState[transferDepositLockKey] = Promise.resolve();

    function actionWriteOptions(action, writeOptions = {}, paths = ['/pkm'], operationKey = '') {
      const suffix = operationKey ? `:${operationKey}` : '';
      return {
        floorKey: writeOptions.floorKey,
        messageId: writeOptions.messageId ?? writeOptions.message_id,
        operationId: writeOptions.operationId || `action:${action}${suffix}`,
        paths: Array.isArray(paths) && paths.length ? paths : ['/pkm']
      };
    }

    function actionObjectKeySuffix(value, fallback = 'state') {
      if (!isObject(value)) return fallback;
      const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
      return keys.length ? keys.map(escapeJsonPointerPart).join('.') : fallback;
    }

    function getGreetingLocationPayload(payload) {
      const world = isObject(payload?.world) ? payload.world : {};
      return isObject(world.location) ? world.location : null;
    }

    function parseSlotNumber(value, fallback = 1) {
      if (typeof value === 'string') {
        const match = value.trim().match(/^slot\s*(\d+)$/i);
        if (match) return clampNumber(match[1], 1, MAX_PARTY_SIZE, fallback);
      }
      return clampNumber(value, 1, MAX_PARTY_SIZE, fallback);
    }

    function parseStorageIndex(payload) {
      if (payload && typeof payload.key === 'string') {
        const match = payload.key.trim().match(/^storage_(\d+)$/i);
        if (match) return clampNumber(match[1], 1, 9999, 1) - 1;
      }
      const raw = payload?.index ?? payload?.storageIndex ?? payload?.slot ?? payload?.key;
      return clampNumber(raw, 1, 9999, 1) - 1;
    }

    function runTransferDeposit(task) {
      const run = actionLockState[transferDepositLockKey]
        .catch(() => {})
        .then(task);
      actionLockState[transferDepositLockKey] = run.catch(() => {});
      return run;
    }

    function clearTransferBuffer(state) {
      state.party.transferBuffer = null;
      state.party.transfer_buffer = null;
    }

    function pickTransferBuffer(party) {
      return normalizeTransferBuffer(party?.transferBuffer)
        || normalizeTransferBuffer(party?.transfer_buffer);
    }

    const helpers = {
      patchState,
      saveState,
      actionWriteOptions,
      actionObjectKeySuffix,
      parseSlotNumber
    };
    const extensions = typeof options.extensions === 'function'
      ? options.extensions(ctx, stateService, helpers)
      : (isObject(options.extensions) ? options.extensions : {});

    async function dispatchAction(action, payload = {}, writeOptions = {}) {
      if (typeof extensions[action] === 'function') {
        return extensions[action](payload, writeOptions, helpers);
      }

      switch (action) {
        case 'greeting.configure':
          {
            const locationPayload = getGreetingLocationPayload(payload);
            return patchState((state) => {
              if (isObject(payload.unlocks)) {
                Object.keys(DEFAULT_UNLOCKS).forEach((key) => {
                  if (key in payload.unlocks) state.player.unlocks[key] = Boolean(payload.unlocks[key]);
                });
              }
              if (isObject(payload.settings)) {
                Object.keys(DEFAULT_SETTINGS).forEach((key) => {
                  if (key in payload.settings) state.settings[key] = Boolean(payload.settings[key]);
                });
              }
              if (locationPayload) {
                state.world = isObject(state.world) ? state.world : {};
                state.world.location = {
                  ...(isObject(state.world.location) ? state.world.location : {}),
                  ...locationPayload,
                  region: normalizeString(locationPayload.region, state.world.location?.region || ''),
                  location: normalizeString(locationPayload.location, state.world.location?.location || '')
                };
              }
              return state;
            }, actionWriteOptions(action, writeOptions, [
              ...(isObject(payload.unlocks) ? ['/pkm/player/unlocks'] : []),
              ...(isObject(payload.settings)
                ? Object.keys(payload.settings).map((key) => `/pkm/settings/${escapeJsonPointerPart(key)}`)
                : []),
              ...(locationPayload ? ['/pkm/world/location'] : [])
            ], [
              isObject(payload.unlocks) ? `unlocks.${actionObjectKeySuffix(payload.unlocks)}` : '',
              isObject(payload.settings) ? `settings.${actionObjectKeySuffix(payload.settings)}` : '',
              locationPayload ? `location.${actionObjectKeySuffix(locationPayload)}` : ''
            ].filter(Boolean).join(':') || 'state'));
          }
        case 'party.setLead':
          return patchState((state) => {
            const slot = parseSlotNumber(payload.slot ?? payload.targetSlot, 1);
            state.party.slots.forEach((pokemon, index) => {
              pokemon.isLead = Boolean(pokemon.name) && index + 1 === slot;
            });
            return state;
          }, actionWriteOptions(action, writeOptions, ['/pkm/party/slots']));
        case 'settings.update':
          return patchState((state) => {
            state.settings = { ...state.settings, ...(isObject(payload) ? payload : {}) };
            return state;
          }, actionWriteOptions(action, writeOptions, isObject(payload)
            ? Object.keys(payload).map((key) => `/pkm/settings/${escapeJsonPointerPart(key)}`)
            : ['/pkm/settings'], actionObjectKeySuffix(payload, 'settings')));
        case 'party.updateMove':
          {
            const slotNumber = parseSlotNumber(payload.slot ?? payload.slotKey ?? payload.targetSlot, 1);
            return patchState((state) => {
              const slot = slotNumber - 1;
              if (!state.party.slots[slot]) return state;
              if (Array.isArray(payload.moves) || isObject(payload.moves)) {
                state.party.slots[slot].moves = normalizeMoves(payload.moves);
                return state;
              }
              const moveIndex = clampNumber(payload.moveIndex ?? payload.index, 1, 4, 1) - 1;
              const moves = normalizeMoves(state.party.slots[slot]?.moves);
              moves[moveIndex] = payload.move || null;
              state.party.slots[slot].moves = moves;
              return state;
            }, actionWriteOptions(action, {
              ...writeOptions,
              operationId: writeOptions.operationId || `action:party.moves:slot${slotNumber}`
            }, [`/pkm/party/slots/${slotNumber - 1}/moves`]));
          }
        case 'party.updateMoves':
          {
            const slotNumber = parseSlotNumber(payload.slot ?? payload.slotKey ?? payload.targetSlot, 1);
            return patchState((state) => {
              const slot = slotNumber - 1;
              if (!state.party.slots[slot]) return state;
              state.party.slots[slot].moves = normalizeMoves(payload.moves);
              return state;
            }, actionWriteOptions(action, {
              ...writeOptions,
              operationId: writeOptions.operationId || `action:party.moves:slot${slotNumber}`
            }, [`/pkm/party/slots/${slotNumber - 1}/moves`]));
          }
        case 'box.depositTransferBuffer':
          return runTransferDeposit(() => patchState((state) => {
            const pokemon = pickTransferBuffer(state.party);
            if (!pokemon) return state;
            state.box = isObject(state.box) ? state.box : {};
            if (!Array.isArray(state.box.boxes) || !state.box.boxes.length) {
              state.box.boxes = [{ id: 'box_01', name: 'Box 1', slots: [] }];
            }
            const box = isObject(state.box.boxes[0])
              ? state.box.boxes[0]
              : { id: 'box_01', name: 'Box 1', slots: [] };
            state.box.boxes[0] = box;
            box.slots = Array.isArray(box.slots) ? box.slots : [];
            box.slots.push(pokemon);
            clearTransferBuffer(state);
            return state;
          }, actionWriteOptions(action, writeOptions, [
            '/pkm/party/transferBuffer',
            '/pkm/party/transfer_buffer',
            '/pkm/box/boxes/0/slots'
          ])));
        case 'box.applyTransferMutation':
          return patchState((state) => {
            const box = state.box.boxes?.[0] || { id: 'box_01', name: 'Box 1', slots: [] };
            state.box.boxes = [box, ...(state.box.boxes || []).slice(1)];
            box.slots = Array.isArray(box.slots) ? box.slots : [];

            const partyEdits = isObject(payload.partyEdits) ? payload.partyEdits : {};
            Object.entries(partyEdits).forEach(([slotKey, pokemon]) => {
              const match = String(slotKey).match(/^slot(\d+)$/);
              if (!match) return;
              const slotNumber = clampNumber(match[1], 1, MAX_PARTY_SIZE, 1);
              state.party.slots[slotNumber - 1] = normalizePokemon(pokemon, slotNumber);
            });

            const boxInserts = isObject(payload.boxInserts) ? payload.boxInserts : {};
            Object.keys(boxInserts).sort().forEach((key) => {
              const pokemon = normalizeTransferBuffer(boxInserts[key]);
              if (pokemon) box.slots.push(pokemon);
            });

            const boxEdits = isObject(payload.boxEdits) ? payload.boxEdits : {};
            Object.entries(boxEdits).forEach(([key, pokemon]) => {
              const match = String(key).match(/^storage_(\d+)$/);
              if (!match) return;
              const index = Number(match[1]) - 1;
              const normalized = normalizeTransferBuffer(pokemon);
              if (normalized && index >= 0) box.slots[index] = normalized;
            });

            const boxDeletes = isObject(payload.boxDeletes) ? payload.boxDeletes : {};
            Object.keys(boxDeletes)
              .map((key) => {
                const match = String(key).match(/^storage_(\d+)$/);
                return match ? Number(match[1]) - 1 : -1;
              })
              .filter((index) => index >= 0)
              .sort((a, b) => b - a)
              .forEach((index) => {
                if (index < box.slots.length) box.slots.splice(index, 1);
              });

            state.party.slots = normalizePartySlots(state.party.slots);
            return state;
          }, actionWriteOptions(action, writeOptions, ['/pkm/party/slots', '/pkm/box/boxes/0/slots']));
        case 'state.replace':
          return saveState(payload?.state || payload, actionWriteOptions(action, writeOptions, ['/pkm']));
        case 'party.setPokemon':
          {
            const slotNumber = parseSlotNumber(payload.slot ?? payload.slotKey ?? payload.targetSlot, 1);
            const pokemon = normalizePokemon(payload.pokemon || payload, slotNumber);
            if (!pokemon.name) throw new Error('party.setPokemon requires a pokemon name');
            return patchState((state) => {
              state.party.slots = normalizePartySlots(state.party.slots);
              state.party.slots[slotNumber - 1] = normalizePokemon(pokemon, slotNumber);
              state.party.slots = normalizePartySlots(state.party.slots);
              return state;
            }, actionWriteOptions(action, {
              ...writeOptions,
              operationId: writeOptions.operationId || `action:party.set:slot${slotNumber}`
            }, [`/pkm/party/slots/${slotNumber - 1}`]));
          }
        case 'party.addPokemon':
          {
            const requested = payload.slot ?? payload.slotKey ?? payload.targetSlot;
            const pokemon = normalizePokemon(payload.pokemon || payload, 0);
            if (!pokemon.name) throw new Error('party.addPokemon requires a pokemon name');
            return patchState((state) => {
              state.party.slots = normalizePartySlots(state.party.slots);
              let index = requested
                ? parseSlotNumber(requested, 1) - 1
                : state.party.slots.findIndex((entry) => !entry.name);
              if (index < 0 || index >= MAX_PARTY_SIZE || state.party.slots[index]?.name) {
                const empty = state.party.slots.findIndex((entry) => !entry.name);
                index = empty >= 0 ? empty : 0;
              }
              state.party.slots[index] = normalizePokemon(pokemon, index + 1);
              state.party.slots = normalizePartySlots(state.party.slots);
              return state;
            }, actionWriteOptions(action, writeOptions, ['/pkm/party/slots']));
          }
        case 'party.updatePokemon':
          {
            const slotNumber = parseSlotNumber(payload.slot ?? payload.slotKey ?? payload.targetSlot, 1);
            return patchState((state) => {
              const index = slotNumber - 1;
              const current = state.party.slots?.[index];
              if (!current) return state;
              const patch = isObject(payload.patch) ? payload.patch : {};
              state.party.slots[index] = normalizePokemon({ ...current, ...patch, slot: slotNumber }, slotNumber);
              state.party.slots = normalizePartySlots(state.party.slots);
              return state;
            }, actionWriteOptions(action, {
              ...writeOptions,
              operationId: writeOptions.operationId || `action:party.update:slot${slotNumber}`
            }, [`/pkm/party/slots/${slotNumber - 1}`]));
          }
        case 'party.clearPokemon':
          {
            const slotNumber = parseSlotNumber(payload.slot ?? payload.slotKey ?? payload.targetSlot, 1);
            return patchState((state) => {
              state.party.slots = normalizePartySlots(state.party.slots);
              state.party.slots[slotNumber - 1] = normalizePokemon({}, slotNumber);
              state.party.slots = normalizePartySlots(state.party.slots);
              return state;
            }, actionWriteOptions(action, {
              ...writeOptions,
              operationId: writeOptions.operationId || `action:party.clear:slot${slotNumber}`
            }, [`/pkm/party/slots/${slotNumber - 1}`]));
          }
        case 'box.addPokemon':
          {
            const pokemon = normalizeTransferBuffer(payload.pokemon || payload);
            if (!pokemon) throw new Error('box.addPokemon requires a pokemon name');
            return patchState((state) => {
              state.box = isObject(state.box) ? state.box : {};
              if (!Array.isArray(state.box.boxes) || !state.box.boxes.length) {
                state.box.boxes = [{ id: 'box_01', name: 'Box 1', slots: [] }];
              }
              const box = state.box.boxes[0];
              box.slots = Array.isArray(box.slots) ? box.slots : [];
              box.slots.push(pokemon);
              return state;
            }, actionWriteOptions(action, writeOptions, ['/pkm/box/boxes/0/slots']));
          }
        case 'box.updatePokemon':
          {
            const index = parseStorageIndex(payload);
            return patchState((state) => {
              const box = state.box.boxes?.[0];
              if (!box || !Array.isArray(box.slots) || !box.slots[index]) return state;
              const patch = isObject(payload.patch) ? payload.patch : {};
              const normalized = normalizeTransferBuffer({ ...box.slots[index], ...patch });
              if (normalized) box.slots[index] = normalized;
              return state;
            }, actionWriteOptions(action, {
              ...writeOptions,
              operationId: writeOptions.operationId || `action:box.update:${index + 1}`
            }, ['/pkm/box/boxes/0/slots']));
          }
        case 'box.removePokemon':
          {
            const index = parseStorageIndex(payload);
            return patchState((state) => {
              const box = state.box.boxes?.[0];
              if (!box || !Array.isArray(box.slots)) return state;
              if (index >= 0 && index < box.slots.length) box.slots.splice(index, 1);
              return state;
            }, actionWriteOptions(action, {
              ...writeOptions,
              operationId: writeOptions.operationId || `action:box.remove:${index + 1}`
            }, ['/pkm/box/boxes/0/slots']));
          }
        default:
          throw new Error(`Unknown PKM action: ${action}`);
      }
    }

    return {
      dispatchAction
    };
  };
})();
