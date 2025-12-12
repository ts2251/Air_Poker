import { GameState } from './logic/GameState.js';
import { Renderer } from './view/Renderer.js';
import { AudioController } from './view/AudioController.js';

const game = new GameState();
const renderer = new Renderer();
const audio = new AudioController();

// --- スタート画面制御 ---
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const diffSelect = document.getElementById('difficulty-select');

// ゲームエリアの要素
const gameElements = [
    document.getElementById('ai-area'),
    document.getElementById('player-area'),
    document.getElementById('bet-controls'),
    document.getElementById('oxygen-container'),
    document.getElementById('pot-display'),
    document.getElementById('battle-area')
];

// 初期化：ゲームエリアを隠す
gameElements.forEach(el => { if(el) el.style.display = 'none'; });

// タイマー関連
let oxygenInterval = null; 
let meterFrame = null;     
let nextDecayTime = 0;     
const DECAY_DURATION = 45000; // 45秒

// --- GAME START ---
if (startBtn) {
    startBtn.onclick = () => {
        audio.play('click');
        const diff = diffSelect ? diffSelect.value : 'NORMAL';
        
        if (startScreen) startScreen.style.display = 'none';
        
        // ゲーム画面を表示（ベットコン以外）
        gameElements.forEach(el => { 
            if(el && el.id !== 'bet-controls') el.style.display = 'block'; 
        });
        document.getElementById('battle-area').style.display = 'flex'; // flexで表示

        // ★★★ 【ここを追加】 難易度を画面に表示する処理 ★★★
        const aiNameLabel = document.getElementById('ai-name-display');
        if (aiNameLabel) {
            // 例: "AI (GOD)" のように表示を変更
            aiNameLabel.textContent = `AI (${diff})`;
            
            // お好みで色を変える場合（例: GODなら赤くする等）
            if (diff === 'GOD') {
                aiNameLabel.style.color = 'red';
                aiNameLabel.textContent = `AI [GOD]`; // 強そうにする
            } else {
                aiNameLabel.style.color = ''; // 元に戻す
            }
        }

        game.startNewGame(diff);
        renderer.initGame(game);
        
        startOxygenTimer();
    };
}

// --- 酸素タイマー ---
function startOxygenTimer() {
    stopOxygenTimer(); 
    nextDecayTime = Date.now() + DECAY_DURATION;
    
    // 減少ロジック
    oxygenInterval = setInterval(() => {
        const res = game.decayOxygen();
        nextDecayTime = Date.now() + DECAY_DURATION; 
        
        if (res) {
            renderer.renderState(game);
            if (res.humanDecayed) renderer.showChipEffect('human', -1);
            if (res.aiDecayed) renderer.showChipEffect('ai', -1);

            if (game.players.human.chips <= 10 && game.players.human.chips > 0) {
                 audio.play('alert');
            }

            if (res.isGameOver) {
                stopOxygenTimer();
                renderer.showGameOver(game, "酸素（チップ）枯渇により死亡！");
                audio.play('lose');
            }
        }
    }, DECAY_DURATION);

    // メーターアニメーション
    const animateMeter = () => {
        const now = Date.now();
        const remain = nextDecayTime - now;
        let percent = (remain / DECAY_DURATION) * 100;
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;

        renderer.updateOxygenMeter(percent);

        if (game.phase !== 'GAME_OVER') {
             meterFrame = requestAnimationFrame(animateMeter);
        }
    };
    meterFrame = requestAnimationFrame(animateMeter);
}

function stopOxygenTimer() {
    if (oxygenInterval) clearInterval(oxygenInterval);
    if (meterFrame) cancelAnimationFrame(meterFrame);
}

// --- ベット入力管理 ---
let currentInputBet = 0;
let minRequiredBet = 0;
let maxRaiseLimit = 0;

// --- プレイヤーのアクション（カード選択） ---
window.handlePlayerAction = (index) => {
    // 選択フェーズでなければ無視
    if (game.phase !== 'SELECT') return;
    
    audio.play('click');
    const result = game.selectCard(index);
    updateBetUI(result);
};

// --- UI更新の統合関数 ---
function updateBetUI(gameStateData) {
    if (!gameStateData) return;

    // 1. 結果画面
    if (gameStateData.phase === 'RESULT') {
        renderer.renderState(game);
        renderer.renderResult(gameStateData);
        
        // 音の再生
        if (gameStateData.isTensai) audio.play('thunder');
        else if (gameStateData.winner === 'human') audio.play('win');
        else if (gameStateData.winner === 'ai') audio.play('lose');

        // 終了判定
        if (game.players.human.numbers.length === 0) {
            renderer.showGameOver(game, "すべての数字を使い切りました。");
            stopOxygenTimer();
        }
        return;
    }

    // 2. ベット画面
    if (gameStateData.phase === 'BETTING') {
        renderer.renderState(game);
        
        // メッセージ更新
        let msg = "アクションを選択してください。";
        if (gameStateData.aiActionLog === 'RAISE') msg = "AIがレイズしてきました！";
        else if (gameStateData.aiActionLog === 'CALL') msg = "AIがコールしました。";
        else if (gameStateData.aiActionLog === 'FOLD') msg = "AIが降りました。";
        else if (gameStateData.turn === 'human' && gameStateData.callAmount === 0 && gameStateData.pot > 0) {
            msg = "AIはチェックしました。";
        }
        renderer.showMessage(msg);

        // 画面表示
        renderer.showBetPhase(gameStateData.hNum, gameStateData.aNum, gameStateData.pot);
        
        // 変数更新
        minRequiredBet = gameStateData.callAmount;
        maxRaiseLimit = gameStateData.maxRaise;
        
        // 入力値を「コール額」にリセット
        currentInputBet = minRequiredBet;
        updateInputDisplay();
        
        // 情報表示の更新
        const enemyBetEl = document.getElementById('current-enemy-bet');
        const callAmtEl = document.getElementById('amount-to-call');
        const raiseLimEl = document.getElementById('raise-limit');
        
        if(enemyBetEl) enemyBetEl.textContent = gameStateData.enemyBetTotal;
        if(callAmtEl) callAmtEl.textContent = gameStateData.callAmount;
        if(raiseLimEl) raiseLimEl.textContent = maxRaiseLimit;
    }
}

// --- 入力欄とボタンの表示更新 ---
function updateInputDisplay() {
    const input = document.getElementById('bet-input');
    const btnConfirm = document.getElementById('btn-confirm');
    
    if(input) input.value = currentInputBet;
    
    // ボタンの色と文字を変える
    if(btnConfirm) {
        if(currentInputBet === minRequiredBet) {
            // 追加額がコール額と同じ（上乗せなし）ならCHECK/CALL
            btnConfirm.textContent = (currentInputBet === 0) ? "CHECK" : "CALL";
            btnConfirm.style.backgroundColor = "#3498db"; // 青
        } else {
            // 上乗せがあるならRAISE
            btnConfirm.textContent = "RAISE";
            btnConfirm.style.backgroundColor = "#e67e22"; // オレンジ
        }
    }
}

// --- ボタンイベント ---

// プラスボタン (+)
const btnPlus = document.getElementById('btn-plus');
if (btnPlus) {
    btnPlus.onclick = () => {
        // 上限チェック
        // 1. ルール上のレイズ上限 (現在のPOTの半分)
        const ruleLimit = minRequiredBet + maxRaiseLimit;
        // 2. 自分の所持金限界
        const walletLimit = game.players.human.chips;
        
        const absoluteLimit = Math.min(ruleLimit, walletLimit);

        if (currentInputBet < absoluteLimit) {
            currentInputBet++;
            updateInputDisplay();
        } else {
            // 上限到達のエフェクトや音を入れるならここ
            // audio.play('alert'); 
        }
    };
}

// マイナスボタン (-)
const btnMinus = document.getElementById('btn-minus');
if (btnMinus) {
    btnMinus.onclick = () => {
        // 下限はコール額（それ以下には下げられない）
        if (currentInputBet > minRequiredBet) {
            currentInputBet--;
            updateInputDisplay();
        }
    };
}

// 決定ボタン (BET / CALL / CHECK)
const btnConfirm = document.getElementById('btn-confirm');
if (btnConfirm) {
    btnConfirm.onclick = () => {
        // 念のためクリック音
        if (currentInputBet > 0) audio.play('bet');
        else audio.play('click');

        // 入力を確定して送信
        const result = game.processPlayerBet(parseInt(currentInputBet));
        
        // 画面更新（もし undefined ならAIターン待ち等のため更新しない）
        if (result) updateBetUI(result);
    };
}

// FOLDボタン
const btnFold = document.getElementById('btn-fold');
if (btnFold) {
    btnFold.onclick = () => {
        audio.play('fold');
        const result = game.processPlayerBet(-1); // -1 is Fold
        if (result) updateBetUI(result);
    };
}

// 次のラウンドへボタン
const btnNext = document.getElementById('next-round-btn');
if (btnNext) {
    btnNext.onclick = () => {
        audio.play('click');
        
        // バトルエリアの数字を隠す（または不透明度を下げる）
        const battleArea = document.getElementById('battle-area');
        if(battleArea) battleArea.style.opacity = '0';

        game.startRound();
        
        if (game.phase === 'GAME_OVER') {
            renderer.showGameOver(game, "参加費が払えません！破産により終了。");
            stopOxygenTimer();
        } else {
            renderer.initGame(game);
            // タイマーは止めずに継続
        }
    };
}