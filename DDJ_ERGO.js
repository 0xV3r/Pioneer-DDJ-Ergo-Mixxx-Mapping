// DDJ ERGO
var DDJErgo = {};

// ── STATO LOOP E JUMP — PER DECK ─────────────────────────────────────────────
DDJErgo._loopSizes = [
    0.03125, 0.0625, 0.125, 0.25, 0.5,
    1, 2, 4, 8, 16, 32, 64, 128, 256, 512
];
DDJErgo._jumpSizes = [0.5, 1, 2, 4, 8, 16, 32];

DDJErgo._defaultLoopIdx = 7;  // 4 battute
DDJErgo._defaultJumpIdx = 3;  // 4 battute

DDJErgo._loopIdx = [7, 7, 7, 7];
DDJErgo._jumpIdx = [3, 3, 3, 3];

// ── SISTEMA MODALE PAD ────────────────────────────────────────────────────────
// Modalità per deck: 'hotcue' | 'loop' | 'looproll' | 'reserved'
DDJErgo._padMode = ['hotcue', 'hotcue', 'hotcue', 'hotcue'];

// Note MIDI dei 4 tasti Sample (modalità)
// Sample1=0x3C, Sample2=0x3E, Sample3=0x40, Sample4=0x42
DDJErgo._modeNotes = [0x3C, 0x3E, 0x40, 0x42];
DDJErgo._modeNames = ['hotcue', 'loop', 'looproll', 'reserved'];

// Note MIDI dei 4 pad
DDJErgo._padNotes = [0x2E, 0x2F, 0x30, 0x31];

// Indici in _loopSizes per i 4 pad loop (1/4=idx3, 1/2=idx4, 1=idx5, 2=idx6)
// _loopSizes: [0.03125, 0.0625, 0.125, 0.25, 0.5, 1, 2, 4, ...]
//                  0       1       2     3    4   5   6  7
DDJErgo._padLoopIndices = [3, 4, 5, 6];

// Dimensioni looproll fisse per i 4 pad (indipendenti dal knob)
DDJErgo._padRollSizes = [0.25, 0.5, 1, 2];

// Timer lampeggio per deck (0 = inattivo)
DDJErgo._blinkTimer   = [0, 0, 0, 0];
DDJErgo._blinkState   = [false, false, false, false];
DDJErgo._blinkPadNote = [0, 0, 0, 0];

// Helper: indice deck (0–3) dal group "[ChannelN]"
DDJErgo._deckIdx = function(group) {
    var m = group.match(/\[Channel(\d)\]/);
    if (m) return parseInt(m[1], 10) - 1;
    return 0;
};

// Helper: indice deck (0–3) dallo status MIDI
DDJErgo._deckIdxFromStatus = function(status) {
    return (status & 0x0F) % 4;
};

// ── HELPER: lampeggio pad loop ───────────────────────────────────────────────
// Avvia il lampeggio 250ms sul pad indicato. Ferma eventuali lampeggi precedenti.
DDJErgo._startBlinkPad = function(deckIdx, status, note) {
    DDJErgo._stopBlinkPad(deckIdx);
    DDJErgo._blinkPadNote[deckIdx] = note;
    DDJErgo._blinkState[deckIdx] = true;
    midi.sendShortMsg(status, note, 0x7F);
    DDJErgo._blinkTimer[deckIdx] = engine.beginTimer(250, (function(di, st, n) {
        return function() {
            DDJErgo._blinkState[di] = !DDJErgo._blinkState[di];
            midi.sendShortMsg(st, n, DDJErgo._blinkState[di] ? 0x7F : 0x00);
        };
    })(deckIdx, status, note));
};

DDJErgo._stopBlinkPad = function(deckIdx) {
    if (DDJErgo._blinkTimer[deckIdx] !== 0) {
        engine.stopTimer(DDJErgo._blinkTimer[deckIdx]);
        DDJErgo._blinkTimer[deckIdx] = 0;
    }
    // Spegne il pad che stava lampeggiando (se presente)
    // Il chiamante è responsabile di riaccenderlo se necessario
};

// ── HELPER: invia LED modalità — accende solo il tasto della modalità attiva ──
DDJErgo._sendModeLeds = function(deckIdx, status) {
    var mode = DDJErgo._padMode[deckIdx];
    for (var i = 0; i < DDJErgo._modeNames.length; i++) {
        var on = (DDJErgo._modeNames[i] === mode) ? 0x7F : 0x00;
        midi.sendShortMsg(status, DDJErgo._modeNotes[i], on);
    }
};

// ── HELPER: invia LED pad in base alla modalità corrente ─────────────────────
// In modalità loop il lampeggio è gestito da _startBlinkPad / _stopBlinkPad,
// questa funzione si occupa solo dei casi statici (hotcue, spegnimento).
DDJErgo._sendPadLeds = function(deckIdx, status, group) {
    var mode = DDJErgo._padMode[deckIdx];
    for (var p = 0; p < 4; p++) {
        var on = 0x00;
        if (mode === 'hotcue') {
            on = engine.getValue(group, 'hotcue_' + (p + 1) + '_enabled') ? 0x7F : 0x00;
        }
        // loop: gestito dal blink — non sovrascriviamo qui
        // looproll e reserved: tutti spenti (0x00)
        if (mode !== 'loop') {
            midi.sendShortMsg(status, DDJErgo._padNotes[p], on);
            midi.sendShortMsg(status, DDJErgo._padNotes[p] + 0x31, on);
        }
    }
};

// ── HELPER: aggiorna LED pad loop in base a _loopIdx ─────────────────────────
// Chiamato da loopKnobTurn quando siamo in modalità loop.
// Se il loopIdx corrente corrisponde a un pad, avvia/mantiene il lampeggio su quel pad.
// Se è fuori intervallo, ferma il lampeggio e spegne tutti i pad.
DDJErgo._updateLoopPadLeds = function(deckIdx, status) {
    var group = '[Channel' + (deckIdx + 1) + ']';
    var loopActive = engine.getValue(group, 'loop_enabled');

    if (!loopActive) {
        // Nessun loop attivo: ferma blink e spegne tutti i pad
        if (DDJErgo._blinkTimer[deckIdx] !== 0) {
            midi.sendShortMsg(status, DDJErgo._blinkPadNote[deckIdx], 0x00);
            DDJErgo._stopBlinkPad(deckIdx);
        }
        for (var p = 0; p < 4; p++) {
            midi.sendShortMsg(status, DDJErgo._padNotes[p], 0x00);
        }
        return;
    }

    // FIX: confronta la dimensione REALE del loop attivo con i valori dei pad,
    // non l'indice interno _loopIdx che potrebbe essere desincronizzato
    // in caso di loop manuale (loop_in/out) con durata non in array.
    var realSize = engine.getValue(group, 'beatloop_size');
    var padPos = -1;
    for (var i = 0; i < DDJErgo._padLoopIndices.length; i++) {
        if (DDJErgo._loopSizes[DDJErgo._padLoopIndices[i]] === realSize) {
            padPos = i;
            break;
        }
    }

    if (padPos >= 0) {
        var note = DDJErgo._padNotes[padPos];
        if (DDJErgo._blinkTimer[deckIdx] !== 0) {
            // Timer già attivo: se il pad è lo stesso non fare nulla,
            // se è cambiato spegni il precedente e avvia il nuovo
            if (DDJErgo._blinkPadNote[deckIdx] !== note) {
                midi.sendShortMsg(status, DDJErgo._blinkPadNote[deckIdx], 0x00);
                DDJErgo._startBlinkPad(deckIdx, status, note);
            }
            // stessa nota, blink già in corso → nessuna azione
        } else {
            // Nessun timer attivo: avvia sempre, senza condizioni
            DDJErgo._startBlinkPad(deckIdx, status, note);
        }
    } else {
        // Dimensione reale non corrisponde a nessun pad: ferma blink e spegne tutto
        if (DDJErgo._blinkTimer[deckIdx] !== 0) {
            midi.sendShortMsg(status, DDJErgo._blinkPadNote[deckIdx], 0x00);
            DDJErgo._stopBlinkPad(deckIdx);
        }
        for (var p = 0; p < 4; p++) {
            midi.sendShortMsg(status, DDJErgo._padNotes[p], 0x00);
        }
    }
};

// ── PRESSIONE TASTI MODALITÀ (Sample 1–4) ────────────────────────────────────
// Regola di blocco: non è possibile passare a modalità loop se un looproll
// è in corso, né passare a looproll se un loop normale è attivo.
// In caso di blocco, il LED del tasto premuto fa un flash breve per segnalare
// che il cambio non è stato accettato.
DDJErgo.modePress = function(channel, control, value, status, group) {
    if (value === 0) return;
    var idx = DDJErgo._deckIdx(group);

    var newMode = null;
    for (var i = 0; i < DDJErgo._modeNotes.length; i++) {
        if (control === DDJErgo._modeNotes[i]) {
            newMode = DDJErgo._modeNames[i];
            break;
        }
    }
    if (!newMode || newMode === 'reserved') return;

    var prevMode = DDJErgo._padMode[idx];
    var loopActive = engine.getValue(group, 'loop_enabled');

    // Regole di blocco cambio modalità:
    //
    // 1. Verso looproll: bloccato se loop_enabled=1, indipendentemente
    //    da dove si viene e da come il loop è stato attivato.
    // 2. Da looproll verso qualsiasi altra modalità: bloccato se loop_enabled=1
    //    (significa che un roll è fisicamente premuto in questo momento).
    // In tutti gli altri casi il cambio è libero.
    if (newMode === 'looproll' && loopActive) {
        DDJErgo._flashLedN(status, control, 8, 50);
        return;
    }
    if (prevMode === 'looproll' && loopActive) {
        DDJErgo._flashLedN(status, control, 8, 50);
        return;
    }

    DDJErgo._padMode[idx] = newMode;

    // Uscendo dalla modalità loop: ferma il lampeggio e spegne i pad
    if (prevMode === 'loop' && newMode !== 'loop') {
        midi.sendShortMsg(status, DDJErgo._blinkPadNote[idx], 0x00);
        DDJErgo._stopBlinkPad(idx);
        for (var p = 0; p < 4; p++) {
            midi.sendShortMsg(status, DDJErgo._padNotes[p], 0x00);
        }
    }

    DDJErgo._sendModeLeds(idx, status);
    DDJErgo._sendPadLeds(idx, status, group);

    // Entrando in modalità loop: se c'è già un loop attivo aggiorna subito i LED pad
    if (newMode === 'loop' && loopActive) {
        DDJErgo._updateLoopPadLeds(idx, status);
    }
};

// ── PRESSIONE PAD (hotcue / loop / looproll) ─────────────────────────────────
DDJErgo.padPress = function(channel, control, value, status, group) {
    var idx  = DDJErgo._deckIdx(group);
    var mode = DDJErgo._padMode[idx];

    var padIdx = DDJErgo._padNotes.indexOf(control);
    if (padIdx < 0) return;

    if (mode === 'hotcue') {
        var hcNum = padIdx + 1;
        engine.setValue(group, 'hotcue_' + hcNum + '_activate', value > 0 ? 1 : 0);

    } else if (mode === 'loop') {
        if (value === 0) return;

        // Il pad mappa a un indice preciso dell'array _loopSizes
        var targetLoopIdx = DDJErgo._padLoopIndices[padIdx];
        var size = DDJErgo._loopSizes[targetLoopIdx];
        var loopActive = engine.getValue(group, 'loop_enabled');

        if (loopActive && DDJErgo._loopIdx[idx] === targetLoopIdx) {
            // Stesso loop attivo → toggle off
            engine.setValue(group, 'reloop_exit', 1);
            engine.setValue(group, 'reloop_exit', 0);
            midi.sendShortMsg(status, control, 0x00);
            DDJErgo._stopBlinkPad(idx);
        } else {
            // Nuovo loop: disattiva quello corrente se attivo, avvia il nuovo
            if (loopActive) {
                engine.setValue(group, 'reloop_exit', 1);
                engine.setValue(group, 'reloop_exit', 0);
                // Spegne il pad precedente se era nell'intervallo
                var prevPadPos = DDJErgo._padLoopIndices.indexOf(DDJErgo._loopIdx[idx]);
                if (prevPadPos >= 0) {
                    midi.sendShortMsg(status, DDJErgo._padNotes[prevPadPos], 0x00);
                }
            }
            // Aggiorna loopIdx e attiva il loop
            DDJErgo._loopIdx[idx] = targetLoopIdx;
            engine.setValue(group, 'beatloop_size', size);
            engine.setValue(group, 'beatloop_' + size + '_activate', 1);
            engine.setValue(group, 'beatloop_' + size + '_activate', 0);
            DDJErgo._startBlinkPad(idx, status, control);
        }

    } else if (mode === 'looproll') {
        var rollSize = DDJErgo._padRollSizes[padIdx];
        if (value > 0) {
            engine.setValue(group, 'beatlooproll_' + rollSize + '_activate', 1);
            midi.sendShortMsg(status, control, 0x7F);
        } else {
            engine.setValue(group, 'beatlooproll_' + rollSize + '_activate', 0);
            midi.sendShortMsg(status, control, 0x00);
        }
    }
};

// ── PRESSIONE PAD SHIFT (clear hotcue — solo in modalità hotcue) ─────────────
DDJErgo.padShiftPress = function(channel, control, value, status, group) {
    if (value === 0) return;
    var idx = DDJErgo._deckIdx(group);
    if (DDJErgo._padMode[idx] !== 'hotcue') return;

    // Le note shift sono 0x5F–0x62, offset +0x31 rispetto ai pad normali
    var padIdx = DDJErgo._padNotes.indexOf(control - 0x31);
    if (padIdx < 0) return;
    engine.setValue(group, 'hotcue_' + (padIdx + 1) + '_clear', 1);
    engine.setValue(group, 'hotcue_' + (padIdx + 1) + '_clear', 0);
};


// ── FX CHANNEL ENABLE — toggle con LED ──────────────────────────────────────
// 8 tasti su 0x96: note 0x4C–0x4F = FX Unit 1 per Ch1–4
//                  note 0x50–0x53 = FX Unit 2 per Ch1–4
DDJErgo._fxChannelMap = {
    0x4C: { unit: 1, ch: 1 },
    0x4D: { unit: 1, ch: 2 },
    0x4E: { unit: 1, ch: 3 },
    0x4F: { unit: 1, ch: 4 },
    0x50: { unit: 2, ch: 1 },
    0x51: { unit: 2, ch: 2 },
    0x52: { unit: 2, ch: 3 },
    0x53: { unit: 2, ch: 4 }
};

DDJErgo.fxChannelPress = function(channel, control, value, status, group) {
    if (value === 0) return;
    var map = DDJErgo._fxChannelMap[control];
    if (!map) return;
    var fxGroup = '[EffectRack1_EffectUnit' + map.unit + ']';
    var key = 'group_[Channel' + map.ch + ']_enable';
    var current = engine.getValue(fxGroup, key);
    engine.setValue(fxGroup, key, current ? 0 : 1);
    midi.sendShortMsg(0x96, control, current ? 0x00 : 0x7F);
};

// ── FX MIX MODE — cicla modalità + lampeggio 5x poi LED fisso ───────────────
// mix_mode in Mixxx è un valore intero 0/1 (dry+wet / additive).
// Al press: cicla il valore, poi lampeggia 5 volte a 80ms e lascia LED acceso.
DDJErgo.fxMixModePress = function(channel, control, value, status, group) {
    if (value === 0) return;
    // Cicla mix_mode (0 → 1 → 0 → ...)
    var current = engine.getValue(group, 'mix_mode');
    engine.setValue(group, 'mix_mode', current ? 0 : 1);
    // Lampeggio 5x a 80ms, poi callback che accende il LED fisso
    DDJErgo._flashLedN(status, control, 5, 80, function() {
        midi.sendShortMsg(status, control, 0x7F);
    });
};

DDJErgo.init = function() {
    var groups = ['[Channel1]', '[Channel2]', '[Channel3]', '[Channel4]'];
    var statuses = [0x90, 0x91, 0x92, 0x93];

    for (var i = 0; i < groups.length; i++) {
        (function(group, st) {

            // ── connectControl per sync (aggiornamento real-time) ──────────
            engine.connectControl(group, 'sync_enabled', function(value) {
                midi.sendShortMsg(st, 0x58, value ? 0x7F : 0x00);
            });
            engine.connectControl(group, 'sync_master', function(value) {
                midi.sendShortMsg(st, 0x5C, value ? 0x7F : 0x00);
            });

            // ── connectControl per loop_enabled — aggiorna LED pad in mod loop ──
            // Necessario per intercettare i loop manuali (loop_in/out) che non
            // passano dal knob e quindi non chiamerebbero mai _updateLoopPadLeds.
            engine.connectControl(group, 'loop_enabled', (function(di, st2) {
                return function(value) {
                    if (DDJErgo._padMode[di] === 'loop') {
                        DDJErgo._updateLoopPadLeds(di, st2);
                    }
                };
            })(i, st));

            // ── LED INIT: legge lo stato attuale e lo manda alla console ───

            // Play / Cue
            midi.sendShortMsg(st, 0x0B, engine.getValue(group, 'play_indicator')  ? 0x7F : 0x00);
            midi.sendShortMsg(st, 0x0C, engine.getValue(group, 'cue_indicator')   ? 0x7F : 0x00);

            // Loop in / out (loop_enabled su entrambi i LED 0x10 e 0x11)
            var loopOn = engine.getValue(group, 'loop_enabled') ? 0x7F : 0x00;
            midi.sendShortMsg(st, 0x10, loopOn);
            midi.sendShortMsg(st, 0x11, loopOn);

            // Keylock
            midi.sendShortMsg(st, 0x1A, engine.getValue(group, 'keylock') ? 0x7F : 0x00);

            // Sync enabled / sync master
            midi.sendShortMsg(st, 0x58, engine.getValue(group, 'sync_enabled') ? 0x7F : 0x00);
            midi.sendShortMsg(st, 0x5C, engine.getValue(group, 'sync_master')  ? 0x7F : 0x00);

            // Beatjump back / fwd (normalmente spenti all'avvio)
            midi.sendShortMsg(st, 0x4C, 0x00);
            midi.sendShortMsg(st, 0x4D, 0x00);

            // Hotcue 1–4 (activate LED e clear LED — stessa nota, stesso stato)
            var hcActivateNotes = [0x2E, 0x2F, 0x30, 0x31];
            var hcClearNotes    = [0x5F, 0x60, 0x61, 0x62];
            for (var n = 1; n <= 4; n++) {
                var hcOn = engine.getValue(group, 'hotcue_' + n + '_enabled') ? 0x7F : 0x00;
                midi.sendShortMsg(st, hcActivateNotes[n - 1], hcOn);
                midi.sendShortMsg(st, hcClearNotes[n - 1],    hcOn);
            }

            // Modalità pad: forza hotcue all'avvio e aggiorna tutti i LED
            DDJErgo._padMode[i] = 'hotcue';
            DDJErgo._blinkTimer[i] = 0;
            DDJErgo._blinkState[i] = false;
            DDJErgo._blinkPadNote[i] = 0;
            DDJErgo._sendModeLeds(i, st);

        })(groups[i], statuses[i]);
    }

    // ── LED globali su canale 0x96 ─────────────────────────────────────────

    // PFL per ogni deck
    var pflNotes = [0x54, 0x55, 0x56, 0x57];
    for (var d = 0; d < 4; d++) {
        midi.sendShortMsg(0x96, pflNotes[d],
            engine.getValue('[Channel' + (d + 1) + ']', 'pfl') ? 0x7F : 0x00);
    }

    // PreviewDeck play
    midi.sendShortMsg(0x96, 0x65,
        engine.getValue('[PreviewDeck1]', 'play') ? 0x7F : 0x00);

    // Recording (se era già in corso al ricaricamento della mappatura)
    if (engine.getValue('[Recording]', 'status')) {
        DDJErgo._startBlink();
    } else {
        DDJErgo._sendRecLed(false);
    }

    // ── LED FX Unit 1 (0x94) e Unit 2 (0x95) — effetti singoli ──────────
    var fxNotes = [0x47, 0x48, 0x49];
    for (var fx = 1; fx <= 3; fx++) {
        midi.sendShortMsg(0x94, fxNotes[fx - 1],
            engine.getValue('[EffectRack1_EffectUnit1_Effect' + fx + ']', 'enabled') ? 0x7F : 0x00);
        midi.sendShortMsg(0x95, fxNotes[fx - 1],
            engine.getValue('[EffectRack1_EffectUnit2_Effect' + fx + ']', 'enabled') ? 0x7F : 0x00);
    }

    // ── LED FX channel enable (0x96 0x4C–0x53) ────────────────────────────
    // 8 tasti: FX1/FX2 per canali 1–4, note consecutive
    var fxChNotes1 = [0x4C, 0x4D, 0x4E, 0x4F]; // FX Unit 1, ch1–4
    var fxChNotes2 = [0x50, 0x51, 0x52, 0x53]; // FX Unit 2, ch1–4
    for (var ch = 1; ch <= 4; ch++) {
        var chGroup = '[Channel' + ch + ']';
        midi.sendShortMsg(0x96, fxChNotes1[ch - 1],
            engine.getValue('[EffectRack1_EffectUnit1]', 'group_' + chGroup + '_enable') ? 0x7F : 0x00);
        midi.sendShortMsg(0x96, fxChNotes2[ch - 1],
            engine.getValue('[EffectRack1_EffectUnit2]', 'group_' + chGroup + '_enable') ? 0x7F : 0x00);
    }

    // ── LED tasti mix_mode — sempre accesi all'avvio ──────────────────────
    // mix_mode è uno stato binario senza un LED "spento corretto":
    // il LED rimane sempre acceso per indicare che il controllo è disponibile.
    midi.sendShortMsg(0x94, 0x43, 0x7F);
    midi.sendShortMsg(0x95, 0x43, 0x7F);
};

// ── LED FLASH per beatjump — 100ms ───────────────────────────────────────────
DDJErgo._flashLed = function(status, note) {
    midi.sendShortMsg(status, note, 0x7F);
    engine.beginTimer(100, function() {
        midi.sendShortMsg(status, note, 0x00);
    }, true);
};

// ── FLASH LED N VOLTE — feedback visivo per azione non consentita ────────────
// Esegue N lampeggi alla velocità indicata (ms per mezzo ciclo).
// Usa ricorsione via engine.beginTimer con oneShot=true.
DDJErgo._flashLedN = function(status, note, count, intervalMs, onDone) {
    if (count <= 0) {
        midi.sendShortMsg(status, note, 0x00);
        if (typeof onDone === 'function') onDone();
        return;
    }
    midi.sendShortMsg(status, note, 0x7F);
    engine.beginTimer(intervalMs, function() {
        midi.sendShortMsg(status, note, 0x00);
        engine.beginTimer(intervalMs, function() {
            DDJErgo._flashLedN(status, note, count - 1, intervalMs, onDone);
        }, true);
    }, true);
};

// ── LOOP KNOB L1 — ROTAZIONE ─────────────────────────────────────────────────
// Dual-mode:
// - Loop impostato via knob (o nessun loop attivo): naviga l'array e scrive beatloop_size
// - Loop impostato manualmente con loop_in/out: usa loop_double/loop_halve
//   sul valore reale e riallinea l'indice interno
DDJErgo.loopKnobTurn = function(channel, control, value, status, group) {
    var idx = DDJErgo._deckIdx(group);
    // Blocca completamente se un roll è attivo (modalità looproll + loop_enabled)
    if (DDJErgo._padMode[idx] === 'looproll' && engine.getValue(group, 'loop_enabled')) return;
    var loopActive = engine.getValue(group, 'loop_enabled');
    var currentSize = engine.getValue(group, 'beatloop_size');
    var expectedSize = DDJErgo._loopSizes[DDJErgo._loopIdx[idx]];
    var isManual = loopActive && (currentSize !== expectedSize);

    if (isManual) {
        // Loop manuale (loop_in/out): double/halve sul valore reale.
        // Dopo loop_double/halve Mixxx aggiorna beatloop_size in modo asincrono,
        // quindi aspettiamo 50ms prima di chiamare _updateLoopPadLeds, altrimenti
        // leggeremmo ancora il vecchio valore e il lampeggio non si aggiornerebbe.
        if (value >= 1 && value <= 63) {
            engine.setValue(group, 'loop_double', 1);
            engine.setValue(group, 'loop_double', 0);
            var newSize = Math.min(currentSize * 2, DDJErgo._loopSizes[DDJErgo._loopSizes.length - 1]);
            var newIdx = DDJErgo._loopSizes.indexOf(newSize);
            if (newIdx >= 0) DDJErgo._loopIdx[idx] = newIdx;
        } else {
            engine.setValue(group, 'loop_halve', 1);
            engine.setValue(group, 'loop_halve', 0);
            var newSize2 = Math.max(currentSize * 0.5, DDJErgo._loopSizes[0]);
            var newIdx2 = DDJErgo._loopSizes.indexOf(newSize2);
            if (newIdx2 >= 0) DDJErgo._loopIdx[idx] = newIdx2;
        }
        // Aggiorna LED pad con delay per attendere propagazione di beatloop_size
        if (DDJErgo._padMode[idx] === 'loop') {
            engine.beginTimer(50, (function(di, st) {
                return function() { DDJErgo._updateLoopPadLeds(di, st); };
            })(idx, 0x90 + idx), true);
        }
    } else {
        // Loop via knob/pad o nessun loop: naviga l'array
        if (value >= 1 && value <= 63) {
            if (DDJErgo._loopIdx[idx] < DDJErgo._loopSizes.length - 1)
                DDJErgo._loopIdx[idx]++;
        } else {
            if (DDJErgo._loopIdx[idx] > 0)
                DDJErgo._loopIdx[idx]--;
        }
        engine.setValue(group, 'beatloop_size', DDJErgo._loopSizes[DDJErgo._loopIdx[idx]]);
        // Aggiornamento LED pad sincrono: beatloop_size è già scritto sopra
        if (DDJErgo._padMode[idx] === 'loop') {
            DDJErgo._updateLoopPadLeds(idx, 0x90 + idx);
        }
    }
};

// ── LOOP KNOB L1 — PRESSIONE ─────────────────────────────────────────────────
// Il press disattiva il loop se attivo (o lo attiva se non attivo).
// Se siamo in modalità loop, spegne anche il lampeggio del pad.
DDJErgo.loopKnobPress = function(channel, control, value, status, group) {
    if (value === 0) return;
    var idx = DDJErgo._deckIdx(group);
    // Blocca completamente se un roll è attivo
    if (DDJErgo._padMode[idx] === 'looproll' && engine.getValue(group, 'loop_enabled')) return;
    if (engine.getValue(group, 'loop_enabled')) {
        // Un loop è attivo: il press lo disattiva sempre
        engine.setValue(group, 'reloop_exit', 1);
        engine.setValue(group, 'reloop_exit', 0);
        if (DDJErgo._padMode[idx] === 'loop') {
            midi.sendShortMsg(0x90 + idx, DDJErgo._blinkPadNote[idx], 0x00);
            DDJErgo._stopBlinkPad(idx);
        }
    } else {
        // Nessun loop attivo: attiva il loop dal knob SOLO se non siamo in looproll
        if (DDJErgo._padMode[idx] === 'looproll') return;
        var size = engine.getValue(group, 'beatloop_size');
        engine.setValue(group, 'beatloop_' + size + '_activate', 1);
        engine.setValue(group, 'beatloop_' + size + '_activate', 0);
        if (DDJErgo._padMode[idx] === 'loop') {
            DDJErgo._updateLoopPadLeds(idx, 0x90 + idx);
        }
    }
};

// ── LOOP IN — con LED immediato ──────────────────────────────────────────────
// Al press accende subito il LED (nota 0x10 sul canale del deck).
// Il LED rimane acceso finché loop_enabled è attivo (gestito dall'output XML).
DDJErgo.loopIn = function(channel, control, value, status, group) {
    // Bloccato in modalità looproll: il loop manuale non è ammesso
    var idx = DDJErgo._deckIdx(group);
    if (DDJErgo._padMode[idx] === 'looproll') return;
    engine.setValue(group, 'loop_in', value > 0 ? 1 : 0);
    if (value > 0) {
        midi.sendShortMsg(status, 0x10, 0x7F);
    }
};

// ── LOOP OUT — bloccato in modalità looproll ────────────────────────────────
DDJErgo.loopOut = function(channel, control, value, status, group) {
    var idx = DDJErgo._deckIdx(group);
    if (DDJErgo._padMode[idx] === 'looproll') return;
    engine.setValue(group, 'loop_out', value > 0 ? 1 : 0);
};

// ── JUMP KNOB L2 — ROTAZIONE ─────────────────────────────────────────────────
DDJErgo.jumpKnobTurn = function(channel, control, value, status, group) {
    var idx = DDJErgo._deckIdxFromStatus(status);
    var deckGroup = '[Channel' + (idx + 1) + ']';
    if (value >= 1 && value <= 63) {
        if (DDJErgo._jumpIdx[idx] < DDJErgo._jumpSizes.length - 1)
            DDJErgo._jumpIdx[idx]++;
    } else {
        if (DDJErgo._jumpIdx[idx] > 0)
            DDJErgo._jumpIdx[idx]--;
    }
    engine.setValue(deckGroup, 'beatjump_size', DDJErgo._jumpSizes[DDJErgo._jumpIdx[idx]]);
};

// ── BEATJUMP BACKWARD ────────────────────────────────────────────────────────
DDJErgo.beatjumpBack = function(channel, control, value, status, group) {
    if (value === 0) return;
    var idx = DDJErgo._deckIdx(group);
    var size = DDJErgo._jumpSizes[DDJErgo._jumpIdx[idx]];
    engine.setValue(group, 'beatjump_' + size + '_backward', 1);
    engine.setValue(group, 'beatjump_' + size + '_backward', 0);
    DDJErgo._flashLed(status, 0x4C);
};

// ── BEATJUMP FORWARD ─────────────────────────────────────────────────────────
DDJErgo.beatjumpFwd = function(channel, control, value, status, group) {
    if (value === 0) return;
    var idx = DDJErgo._deckIdx(group);
    var size = DDJErgo._jumpSizes[DDJErgo._jumpIdx[idx]];
    engine.setValue(group, 'beatjump_' + size + '_forward', 1);
    engine.setValue(group, 'beatjump_' + size + '_forward', 0);
    DDJErgo._flashLed(status, 0x4D);
};

// ── RATE RANGE CYCLE (shift + keylock, nota 0x1B) ───────────────────────────
// Cicla il range del pitch fader tra i valori: 10% → 16% → 24% → 50% → 100%
// con wrap-around. Flash del LED keylock (0x1A) come conferma visiva.
DDJErgo._rateRanges = [0.10, 0.16, 0.24, 0.50, 1.00];

DDJErgo.rateRangeCycle = function(channel, control, value, status, group) {
    if (value === 0) return;
    var current = engine.getValue(group, 'rateRange');
    // Trova l'indice corrente (con tolleranza floating point)
    var idx = -1;
    for (var i = 0; i < DDJErgo._rateRanges.length; i++) {
        if (Math.abs(DDJErgo._rateRanges[i] - current) < 0.001) {
            idx = i;
            break;
        }
    }
    // Avanza al prossimo con wrap-around (se non trovato parte dal primo)
    var nextIdx = (idx + 1) % DDJErgo._rateRanges.length;
    engine.setValue(group, 'rateRange', DDJErgo._rateRanges[nextIdx]);
    // Lampeggio 3x sul LED 0x1B (il tasto L2 stesso, non il keylock L1)
    // Il LED keylock (0x1A) non viene toccato e mantiene il suo stato normale.
    DDJErgo._flashLedN(status, 0x1B, 3, 80);
};

// ── KEY KNOB — ROTAZIONE ─────────────────────────────────────────────────────
// pitch_up / pitch_down cambiano la tonalità di un semitono indipendentemente
// dal tempo e dal keylock. Si usano come controlli momentanei (1 poi 0).
DDJErgo.keyKnobTurn = function(channel, control, value, status, group) {
    if (!engine.getValue(group, 'keylock')) return;
    if (value >= 1 && value <= 63) {
        engine.setValue(group, 'pitch_up', 1);
        engine.setValue(group, 'pitch_up', 0);
    } else {
        engine.setValue(group, 'pitch_down', 1);
        engine.setValue(group, 'pitch_down', 0);
    }
};

// ── KEY KNOB — PRESSIONE (reset_key) ────────────────────────────────────────
// Se keylock OFF → non fa nulla. Se keylock ON → resetta alla chiave originale.
DDJErgo.keyKnobPress = function(channel, control, value, status, group) {
    if (value === 0) return;
    if (!engine.getValue(group, 'keylock')) return;
    engine.setValue(group, 'reset_key', 1);
    engine.setValue(group, 'reset_key', 0);
};

// ── LOAD TRACK ───────────────────────────────────────────────────────────────
DDJErgo.loadTrack = function(channel, control, value, status, group) {
    if (value === 0) return;
    if (engine.getValue(group, 'play')) return;

    if (engine.getValue('[PreviewDeck1]', 'play')) {
        engine.setValue('[PreviewDeck1]', 'stop', 1);
        engine.setValue('[PreviewDeck1]', 'stop', 0);
        engine.setValue('[PreviewDeck1]', 'eject', 1);
        engine.setValue('[PreviewDeck1]', 'eject', 0);
    }

    var idx = DDJErgo._deckIdx(group);

    // Resetta lo stato modale e i LED immediatamente (non dipendono dal caricamento)
    DDJErgo._loopIdx[idx] = DDJErgo._defaultLoopIdx;
    DDJErgo._jumpIdx[idx] = DDJErgo._defaultJumpIdx;
    if (DDJErgo._blinkTimer[idx] !== 0) {
        midi.sendShortMsg(0x90 + idx, DDJErgo._blinkPadNote[idx], 0x00);
        DDJErgo._stopBlinkPad(idx);
    }
    DDJErgo._padMode[idx] = 'hotcue';
    var loadStatus = 0x90 + idx;
    DDJErgo._sendModeLeds(idx, loadStatus);
    DDJErgo._sendPadLeds(idx, loadStatus, group);

    // Prima carica la traccia, poi — con un delay di 200ms — imposta i valori
    // di beatloop_size, beatjump_size e azzera il loop fantasma.
    // Il delay è necessario perché Mixxx resetta questi valori internamente
    // durante il caricamento, sovrascrivendo qualsiasi cosa scritta prima.
    engine.setValue(group, 'LoadSelectedTrack', 1);
    engine.setValue(group, 'LoadSelectedTrack', 0);

    engine.beginTimer(200, (function(g, li, ji) {
        return function() {
            engine.setValue(g, 'beatloop_size', DDJErgo._loopSizes[li]);
            engine.setValue(g, 'beatjump_size', DDJErgo._jumpSizes[ji]);
            engine.setValue(g, 'loop_start_position', -1);
            engine.setValue(g, 'loop_end_position', -1);
        };
    })(group, DDJErgo._defaultLoopIdx, DDJErgo._defaultJumpIdx), true);
};

// ── EJECT TRACK (L2 LOAD) ────────────────────────────────────────────────────
DDJErgo.ejectTrack = function(channel, control, value, status, group) {
    if (value === 0) return;
    engine.setValue(group, 'eject', 1);
    engine.setValue(group, 'eject', 0);
};

// ── ENCODER LIBRERIA — context-aware ─────────────────────────────────────────
DDJErgo.libraryKnob = function(channel, control, value, status, group) {
    var previewPlaying = engine.getValue('[PreviewDeck1]', 'play');
    if (previewPlaying) {
        var pos = engine.getValue('[PreviewDeck1]', 'playposition');
        pos = (value >= 1 && value <= 63)
            ? Math.min(1.0, pos + 0.010)
            : Math.max(0.0, pos - 0.010);
        engine.setValue('[PreviewDeck1]', 'playposition', pos);
    } else {
        if (value >= 1 && value <= 63) {
            engine.setValue('[Library]', 'MoveDown', 1);
            engine.setValue('[Library]', 'MoveDown', 0);
        } else {
            engine.setValue('[Library]', 'MoveUp', 1);
            engine.setValue('[Library]', 'MoveUp', 0);
        }
    }
};

// ── LIBRERIA KNOB L2 (0xB6 0x64) — naviga gerarchia avanti/indietro ──────────
// Avanti  (1–63):   MoveFocusForward — scende/entra nel livello selezionato
// Indietro (65–127): MoveFocusBackward — risale al livello superiore
DDJErgo.libraryKnobL2 = function(channel, control, value, status, group) {
    if (value >= 1 && value <= 63) {
        engine.setValue('[Library]', 'MoveFocusForward', 1);
        engine.setValue('[Library]', 'MoveFocusForward', 0);
    } else {
        engine.setValue('[Library]', 'MoveFocusBackward', 1);
        engine.setValue('[Library]', 'MoveFocusBackward', 0);
    }
};

// ── PREVIEW DECK ─────────────────────────────────────────────────────────────
DDJErgo.previewPress = function(channel, control, value, status, group) {
    if (value === 0) return;
    if (engine.getValue('[PreviewDeck1]', 'play')) {
        engine.setValue('[PreviewDeck1]', 'stop', 1);
        engine.setValue('[PreviewDeck1]', 'stop', 0);
        engine.setValue('[PreviewDeck1]', 'eject', 1);
        engine.setValue('[PreviewDeck1]', 'eject', 0);
    } else {
        engine.setValue('[PreviewDeck1]', 'LoadSelectedTrackAndPlay', 1);
        engine.setValue('[PreviewDeck1]', 'LoadSelectedTrackAndPlay', 0);
        engine.setValue('[PreviewDeck1]', 'pfl', 1);
    }
};

// ── RECORDING con LED lampeggiante ───────────────────────────────────────────
DDJErgo._recBlinkTimer = 0;
DDJErgo._recBlinkState = false;

DDJErgo._sendRecLed = function(on) {
    midi.sendShortMsg(0x96, 0x66, on ? 0x7F : 0x00);
};

DDJErgo._startBlink = function() {
    if (DDJErgo._recBlinkTimer !== 0) return;
    DDJErgo._recBlinkState = false;
    DDJErgo._recBlinkTimer = engine.beginTimer(500, function() {
        DDJErgo._recBlinkState = !DDJErgo._recBlinkState;
        DDJErgo._sendRecLed(DDJErgo._recBlinkState);
    });
};

DDJErgo._stopBlink = function() {
    if (DDJErgo._recBlinkTimer !== 0) {
        engine.stopTimer(DDJErgo._recBlinkTimer);
        DDJErgo._recBlinkTimer = 0;
    }
    DDJErgo._sendRecLed(false);
};

DDJErgo.recordPress = function(channel, control, value, status, group) {
    if (value === 0) return;
    var isRecording = engine.getValue('[Recording]', 'status');
    if (isRecording) {
        engine.setValue('[Recording]', 'toggle_recording', 1);
        engine.setValue('[Recording]', 'toggle_recording', 0);
        DDJErgo._stopBlink();
    } else {
        engine.setValue('[Recording]', 'toggle_recording', 1);
        engine.setValue('[Recording]', 'toggle_recording', 0);
        DDJErgo._startBlink();
    }
};

DDJErgo.shutdown = function() {
    DDJErgo._stopBlink();
    // Ferma tutti i timer di lampeggio pad per tutti i deck
    for (var i = 0; i < 4; i++) {
        DDJErgo._stopBlinkPad(i);
    }
};

// ── JOG WHEEL ────────────────────────────────────────────────────────────────
// MIDI (per deck, kanal n = deck-1):
//   Note 0x36  touch top (vinyl ON)        -> scratch
//   Note 0x37  touch top (vinyl OFF)       -> ignorert
//   Note 0x67  touch top + SHIFT           -> ignorert (seek via CC 0x27)
//   CC   0x21  ring/kant                   -> pitch bend (nudge)
//   CC   0x22  topp (vinyl ON)             -> scratch når touch, ellers bend
//   CC   0x23  topp (vinyl OFF)            -> pitch bend
//   CC   0x27  topp + SHIFT                -> søk i sporet
// Verdier er relative: 64 = stillstand, >64 med klokka, <64 mot klokka.

DDJErgo.jogConfig = {
    intervalsPerRev: 720,      // ticks per omdreining (juster hvis scratch går for fort/sakte)
    rpm: 33 + 1 / 3,
    alpha: 1.0 / 8,
    beta: (1.0 / 8) / 32,
    bendScale: 0.5,            // nudge-styrke når sporet spiller (var 0.8)
    pausedJogScale: 0.8,       // jog-styrke når sporet står stille
    seekSecondsPerTick: 0.05,  // shift + vri: sekunder per tick
    maxDelta: 40               // forkast støyverdier (f.eks. sporadisk 127)
};

DDJErgo._jogDelta = function(value) {
    var d = value - 0x40;
    if (Math.abs(d) > DDJErgo.jogConfig.maxDelta) return 0;
    return d;
};

DDJErgo._jogDeckNum = function(group) {
    return DDJErgo._deckIdx(group) + 1;
};

DDJErgo.jogTouch = function(channel, control, value, status, group) {
    var deck = DDJErgo._jogDeckNum(group);
    var c = DDJErgo.jogConfig;
    if (value > 0) {
        engine.scratchEnable(deck, c.intervalsPerRev, c.rpm, c.alpha, c.beta);
    } else {
        engine.scratchDisable(deck, true);   // ramp tilbake til normal fart
    }
};

// Topp med vinyl på: scratch når berørt, ellers (f.eks. utrulling) bend
DDJErgo.jogTopVinyl = function(channel, control, value, status, group) {
    var d = DDJErgo._jogDelta(value);
    if (d === 0) return;
    var deck = DDJErgo._jogDeckNum(group);
    if (engine.isScratching(deck)) {
        engine.scratchTick(deck, d);
    } else {
        engine.setValue(group, 'jog', d * DDJErgo.jogConfig.bendScale);
    }
};

// Ring, og topp med vinyl av: pitch bend / nudge (flytter også posisjon når pauset)
DDJErgo.jogBend = function(channel, control, value, status, group) {
    var d = DDJErgo._jogDelta(value);
    if (d === 0) return;
    var c = DDJErgo.jogConfig;
    var scale = engine.getValue(group, 'play') ? c.bendScale : c.pausedJogScale;
    engine.setValue(group, 'jog', d * scale);
};

// Shift + topp: rask søking i sporet
DDJErgo.jogSeek = function(channel, control, value, status, group) {
    var d = DDJErgo._jogDelta(value);
    if (d === 0) return;
    var duration = engine.getValue(group, 'duration');
    if (!duration) return;
    var pos = engine.getValue(group, 'playposition') +
              (d * DDJErgo.jogConfig.seekSecondsPerTick) / duration;
    engine.setValue(group, 'playposition', Math.max(0, Math.min(1, pos)));
};
