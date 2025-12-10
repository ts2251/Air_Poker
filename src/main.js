import { GameState } from './logic/GameState.js';
import { Renderer } from './view/Renderer.js';
import { AudioController } from './view/AudioController.js';

const game = new GameState();
const renderer = new Renderer();
const audio = new AudioController();

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const diffSelect = document.getElementById('difficulty-select');

const gameElements = [
    document.getElementById('ai-area'),
    document.getElementById('player-area'),
    document.getElementById('bet-controls')
];
gameElements.forEach(el => { if(el) el.style.display = 'none'; });

// 酸素減少タイマー変数
let oxygenInterval = null; 
let meterFrame = null;     
let nextDecayTime = 0;     
const DECAY_DURATION = 45000; // 45秒

// GAME STARTボタン
if (startBtn) {
    startBtn.onclick = () => {
        audio.play('click');
        const diff = diffSelect ? diffSelect.value : 'NORMAL';
        if (startScreen) startScreen.style.display = 'none';
        
        gameElements.forEach(el => { if(el) el.style.display = 'block'; });
        document.getElementById('bet-controls').style.display = 'none'; 

        game.startNewGame(diff);
        renderer.initGame(game);
        
        // ★修正: ゲーム開始時に一度だけタイマーを起動
        // 既存のタイマーがあればリセット
        stopOxygenTimer();
        nextDecayTime = Date.now() + DECAY_DURATION; // 初回の目標時刻設定
        startOxygenTimerLoop();
    };
}

// ★修正: タイマーロジックを分離
// setIntervalではなく、再帰的な setTimeout または 常に監視するループにする方が
// 「時間を引き継ぐ」実装がしやすいですが、今回は setInterval を使い回す方式にします。

function startOxygenTimerLoop() {
    // 1. チップ減少ロジック (定期実行)
    // 既に動いていれば二重起動しない
    if (oxygenInterval) clearInterval(oxygenInterval);
    
    oxygenInterval = setInterval(() => {
        // 次の減少時刻を更新
        nextDecayTime = Date.now() + DECAY_DURATION;
        
        const res = game.decayOxygen();
        
        if (res) {
            renderer.renderState(game);
            if (res.humanDecayed) renderer.showChipEffect('human', -1);
            if (res.aiDecayed) renderer.showChipEffect('ai', -1);

            if (game.players.human.chips <= 10 && game.players.human.chips > 0) {
                 audio.play('alert');
            }

            if (res.isGameOver) {
                stopOxygenTimer(); // ゲームオーバー時のみ止める
                renderer.showGameOver(game, "酸素（チップ）枯渇により死亡！");
                audio.play('lose');
            }
        }
    }, DECAY_DURATION);

    // 2. メーター更新アニメーション (常に回す)
    if (meterFrame) cancelAnimationFrame(meterFrame);
    
    const animateMeter = () => {
        const now = Date.now();
        const remain = nextDecayTime - now;
        let percent = (remain / DECAY_DURATION) * 100;
        
        // 表示上の調整
        if (percent < 0) percent = 0; // 減少瞬間
        if (percent > 100) percent = 100; // 開始直後

        renderer.updateOxygenMeter(percent);

        // ゲームオーバーでなければ回し続ける
        if (game.phase !== 'GAME_OVER') {
             meterFrame = requestAnimationFrame(animateMeter);
        }
    };
    meterFrame = requestAnimationFrame(animateMeter);
}

function stopOxygenTimer() {
    if (oxygenInterval) {
        clearInterval(oxygenInterval);
        oxygenInterval = null;
    }
    if (meterFrame) {
        cancelAnimationFrame(meterFrame);
        meterFrame = null;
    }
}

// ベット入力管理
let currentInputBet = 0;
let minRequiredBet = 0;

// プレイヤーアクション
window.handlePlayerAction = (index) => {
    if (game.phase !== 'SELECT') return;
    audio.play('click');
    const result = game.selectCard(index);
    updateBetUI(result);
};

// UI更新
function updateBetUI(gameStateData) {
    if (!gameStateData) return;

    if (gameStateData.phase === 'RESULT') {
        renderer.renderState(game);
        renderer.renderResult(gameStateData);
        
        // ★追加: 天災の音
        if (gameStateData.isTensai) audio.play('thunder');
        else if (gameStateData.winner === 'human') audio.play('win');
        else if (gameStateData.winner === 'ai') audio.play('lose');

        if (game.players.human.numbers.length === 0) {
            renderer.showGameOver(game, "すべての数字を使い切りました。");
            stopOxygenTimer();
        }
        return;
    }

    if (gameStateData.phase === 'BETTING') {
        renderer.renderState(game);
        if (gameStateData.aiActionLog === 'RAISE') {
            renderer.showMessage("AIがレイズしてきました！");
        } else {
            renderer.showMessage("アクションを選択してください。");
        }
        renderer.showBetPhase(gameStateData.hNum, gameStateData.aNum, gameStateData.pot);
        minRequiredBet = gameStateData.callAmount;
        currentInputBet = minRequiredBet;
        updateInputDisplay();
        
        const enemyBetEl = document.getElementById('current-enemy-bet');
        const callAmtEl = document.getElementById('amount-to-call');
        if(enemyBetEl) enemyBetEl.textContent = gameStateData.enemyBetTotal;
        if(callAmtEl) callAmtEl.textContent = gameStateData.callAmount;
    }
}

function updateInputDisplay() {
    const input = document.getElementById('bet-input');
    const btnConfirm = document.getElementById('btn-confirm');
    if(input) input.value = currentInputBet;
    if(btnConfirm) {
        if(currentInputBet === minRequiredBet) {
            btnConfirm.textContent = (currentInputBet === 0) ? "CHECK" : "CALL";
            btnConfirm.style.backgroundColor = "#3498db";
        } else {
            btnConfirm.textContent = "RAISE";
            btnConfirm.style.backgroundColor = "#e67e22";
        }
    }
}

function getMaxBet() {
    // gameインスタンスが持つデータから計算
    // GameStateで計算された maxRaise とは別に、絶対的な上限が必要
    // 自分が追加で出せる額 = 自分のチップ
    // 相手が追加で出せる額 = 相手のチップ
    // よって、追加ベットの上限は Math.min(自分のチップ, 相手のチップ + (相手の既存Bet - 自分の既存Bet))
    
    // シンプルに:
    // GameState.jsで callAmount（最低額）は計算されている
    // 追加できる額の上限は、自分のチップ残高
    // ただし、相手のチップ残高を超えてレイズすることはできない（テーブルステークス）
    
    // ここでは簡易的に「自分の所持金」を上限としつつ、GameState側で補正してもらう
    return game.players.human.chips;
}

const btnPlus = document.getElementById('btn-plus');
if (btnPlus) {
    btnPlus.onclick = () => {
        // 現在のレイズ上限（ルールの半分制限など）を確認
        // gameStateDataが必要だが、ここでは簡易的に所持金チェックのみ
        if (currentInputBet < game.players.human.chips) {
            currentInputBet++;
            updateInputDisplay();
        }
    };
}

const btnMinus = document.getElementById('btn-minus');
if (btnMinus) btnMinus.onclick = () => {
    if (currentInputBet > minRequiredBet) {
        currentInputBet--;
        updateInputDisplay();
    }
};

const btnConfirm = document.getElementById('btn-confirm');
if (btnConfirm) btnConfirm.onclick = () => {
    const inputVal = document.getElementById('bet-input').value;
    if (inputVal > 0) audio.play('bet');
    else audio.play('click');
    
    const result = game.processPlayerBet(parseInt(inputVal));
    updateBetUI(result);
};

const btnFold = document.getElementById('btn-fold');
if (btnFold) btnFold.onclick = () => {
    audio.play('fold');
    const result = game.processPlayerBet(-1);
    updateBetUI(result);
};

// btnNext の修正（タイマー再開）
const btnNext = document.getElementById('next-round-btn');
if (btnNext) btnNext.onclick = () => {
    audio.play('click');
    game.startRound();
    if (game.phase === 'GAME_OVER') {
        renderer.showGameOver(game, "参加費が払えません！破産により終了。");
        stopOxygenTimer();
    } else {
        renderer.initGame(game);
        // startOxygenTimer(); // タイマーリセット＆再開
    }
};