// src/view/Renderer.js

export class Renderer {
    constructor() {
        this.els = {
            aiNumbers: document.getElementById('ai-numbers'),
            aiHand: document.getElementById('ai-hand'),
            aiScore: document.getElementById('ai-score'),
            aiChips: document.getElementById('ai-chips'),
            aiWins: document.getElementById('ai-wins'),
            
            playerNumbers: document.getElementById('player-numbers'),
            playerHand: document.getElementById('player-hand'),
            playerScore: document.getElementById('player-score'), 
            playerChips: document.getElementById('player-chips'),
            playerWins: document.getElementById('player-wins'),

            message: document.getElementById('message-box'),
            rule: document.getElementById('rule-display'), // HTMLから消してればnull
            pot: document.getElementById('pot-amount'),
            
            betControls: document.getElementById('bet-controls'),
            nextBtn: document.getElementById('next-round-btn'),
            
            startScreen: document.getElementById('start-screen'),
            potDisplay: document.getElementById('pot-display'),
            container: document.getElementById('game-container'),

            oxygenContainer: document.getElementById('oxygen-container'),
            oxygenBar: document.getElementById('oxygen-bar')
        };
    }

    initGame(gameState) {
        // ★追加: メーターを表示
        if(this.els.oxygenContainer) this.els.oxygenContainer.style.display = 'block';
        this.updateOxygenMeter(100);
        
        if(this.els.potDisplay) this.els.potDisplay.style.display = 'block';
        if(this.els.rule) this.els.rule.style.display = 'none';

        this.els.nextBtn.style.display = 'none';
        this.els.betControls.style.display = 'none';
        this.els.playerHand.innerHTML = '';
        this.els.aiHand.innerHTML = '';
        
        this.renderState(gameState);
        this.showMessage(`ラウンド${gameState.round}開始。参加費${gameState.round}を支払いました。数字を選んでください。`);
    }

    renderState(gameState) {
        if(this.els.playerWins) this.els.playerWins.textContent = gameState.players.human.wins;
        if(this.els.aiWins) this.els.aiWins.textContent = gameState.players.ai.wins;
        if(this.els.playerChips) this.els.playerChips.textContent = gameState.players.human.chips;
        if(this.els.aiChips) this.els.aiChips.textContent = gameState.players.ai.chips;
        if(this.els.pot) this.els.pot.textContent = gameState.pot;

        if (gameState.players.human.chips <= 10) {
            this.els.playerChips.classList.add('oxygen-alert');
        } else {
            this.els.playerChips.classList.remove('oxygen-alert');
        }

        this.renderTokens(gameState);
    }

    renderTokens(gameState) {
        this.els.playerNumbers.innerHTML = '';
        gameState.players.human.numbers.forEach((num, index) => {
            const tokenCard = document.createElement('div');
            tokenCard.className = 'card token clickable';
            if (gameState.phase !== 'SELECT') tokenCard.style.opacity = '0.6';

            tokenCard.appendChild(document.createTextNode(num));

            tokenCard.onclick = () => {
                if (gameState.phase === 'SELECT' && typeof window.handlePlayerAction === 'function') {
                    window.handlePlayerAction(index);
                }
            };
            this.els.playerNumbers.appendChild(tokenCard);
        });

        this.els.aiNumbers.innerHTML = '';
        gameState.players.ai.numbers.forEach((num, i) => {
            const tokenCard = document.createElement('div');
            tokenCard.className = 'card token enemy';
            
            if (gameState.phase !== 'SELECT' && i === gameState.selectedIndices.ai) {
                 tokenCard.textContent = num; 
                 tokenCard.style.background = '#f1c40f';
                 tokenCard.style.color = '#333';
            } else {
                 tokenCard.textContent = '?';
            }
            this.els.aiNumbers.appendChild(tokenCard);
        });
    }

    showBetPhase(hNum, aNum, pot) {
        this.showMessage(`お互いの数字が出ました（あなた:${hNum} vs AI:${aNum}）。アクションを選択してください。`);
        this.els.betControls.style.display = 'block';
    }

    renderResult(result) {
        this.els.betControls.style.display = 'none';
        
        // 天災演出がある場合は、演出が終わるまで「次へ」ボタンを出さない、等の制御も可能だが
        // ここでは演出と同時に結果を表示していく

        if (!result.isShowdown) {
            const winnerName = (result.winner === 'human') ? 'あなた' : 'AI';
            const loserName = (result.winner === 'human') ? 'AI' : 'あなた';
            this.showMessage(`${loserName}が降りました。${winnerName}の勝ちです！（+${result.pot}チップ）`);
            this.els.nextBtn.style.display = 'inline-block';
            return;
        }

        // 天災なら専用演出を開始
        if (result.isTensai) {
            this.playTensaiSequence(() => {
                // 演出終了後のコールバック（必要なら）
                this.els.nextBtn.style.display = 'inline-block';
            });
        } else {
            this.showResultEffect(result.winner);
            this.els.nextBtn.style.display = 'inline-block';
        }

        this.els.playerHand.innerHTML = '';
        this.els.aiHand.innerHTML = '';

        const createResultBox = (text, score) => {
            const div = document.createElement('div');
            div.style.padding = '10px';
            div.style.border = '1px solid #fff';
            div.style.borderRadius = '5px';
            div.style.background = 'rgba(0,0,0,0.5)';
            
            let displayScore = 0;
            if (score !== -1) displayScore = parseInt(score, 10);
            
            div.innerHTML = `<strong>${text}</strong><br><span style="font-size:0.8em; color:#ccc;">強度: ${displayScore}</span>`;
            return div;
        };

        const hText = result.winner === 'human' ? 'WIN' : (result.winner === 'ai' ? 'LOSE' : 'DRAW');
        const aText = result.winner === 'ai' ? 'WIN' : (result.winner === 'human' ? 'LOSE' : 'DRAW');

        this.els.playerHand.appendChild(createResultBox(hText, result.humanScoreVal));
        this.els.aiHand.appendChild(createResultBox(aText, result.aiScoreVal));

        let msg = "";
        if (result.isTensai) msg = "【天災発生】敗者は追加のチップを失いました。";
        else if (result.winner === 'human') msg = "あなたの勝ち！";
        else if (result.winner === 'ai') msg = "AIの勝ち...";
        else msg = "引き分け";
        
        this.showMessage(`${msg} (+${result.pot}チップ)`);
    }

    // ★新規: 天災シーケンス
    playTensaiSequence(callback) {
        // 要素を作成
        const blackout = document.createElement('div');
        blackout.className = 'tensai-blackout';
        
        const flash = document.createElement('div');
        flash.className = 'tensai-flash';

        const textContainer = document.createElement('div');
        textContainer.className = 'tensai-text-container';
        textContainer.innerHTML = '<span class="tensai-char">天</span><span class="tensai-char" style="animation-delay:0.2s">災</span>';

        document.body.appendChild(blackout);
        document.body.appendChild(flash);
        document.body.appendChild(textContainer);

        // シーケンス実行
        setTimeout(() => blackout.classList.add('active'), 10); // 1. 真っ暗に

        setTimeout(() => {
            flash.classList.add('active'); // 2. 雷ピカッ
            // 音を鳴らす (Rendererから直接Audio呼べないのでmain.js側でやるか、グローバル参照するか)
            // ここでは簡易的にグローバル参照がある前提、またはSE無しでCSSのみ完結
            // ※本来はMainから音を鳴らす指示を送るべき
        }, 500);

        setTimeout(() => {
            textContainer.classList.add('active'); // 3. 天災の文字
            const chars = textContainer.querySelectorAll('.tensai-char');
            chars.forEach(c => c.classList.add('appear'));
            
            this.els.container.classList.add('shake-screen'); // 画面揺れ
        }, 600);

        // 終了処理
        setTimeout(() => {
            blackout.style.opacity = 0;
            flash.remove();
            textContainer.remove();
            this.els.container.classList.remove('shake-screen');
            setTimeout(() => blackout.remove(), 1000);
            if(callback) callback();
        }, 3500); // 3.5秒演出
    }

    showChipEffect(target, amount) {
        const el = (target === 'human') ? this.els.playerChips : this.els.aiChips;
        if (!el) return;
        const popup = document.createElement('div');
        popup.className = `chip-popup ${amount > 0 ? 'chip-plus' : 'chip-minus'}`;
        popup.textContent = amount > 0 ? `+${amount}` : amount;
        const rect = el.getBoundingClientRect();
        popup.style.left = `${rect.left + 20}px`;
        popup.style.top = `${rect.top - 20}px`;
        document.body.appendChild(popup);
        setTimeout(() => popup.remove(), 1000);
    }

    showResultEffect(winner) {
        // 天災の場合はここは呼ばない
        const overlay = document.createElement('div');
        if (winner === 'human') {
            overlay.className = 'result-overlay result-win';
            overlay.textContent = "YOU WIN!";
        } else if (winner === 'ai') {
            overlay.className = 'result-overlay result-lose';
            overlay.textContent = "YOU LOSE...";
        } else {
            return; 
        }
        document.body.appendChild(overlay);
        setTimeout(() => overlay.remove(), 3000);
    }

    showMessage(text) {
        if(this.els.message) this.els.message.textContent = text;
    }

// ★新規: 酸素メーター更新 (0~100)
    updateOxygenMeter(percent) {
        if (!this.els.oxygenBar) return;
        this.els.oxygenBar.style.width = `${percent}%`;
        
        if (percent < 20) {
            this.els.oxygenBar.classList.add('danger');
        } else {
            this.els.oxygenBar.classList.remove('danger');
        }
    }

    // ★修正: ゲームオーバー画面（勝敗判定つき）
    showGameOver(gameState, reasonMsg = "") {
        this.els.betControls.style.display = 'none';
        this.els.nextBtn.style.display = 'inline-block';
        if(this.els.oxygenContainer) this.els.oxygenContainer.style.display = 'none'; // メーター隠す

        // 勝敗判定
        const hChips = gameState.players.human.chips;
        const aChips = gameState.players.ai.chips;
        let finalResult = "";
        let resultClass = "";

        if (hChips > aChips) {
            finalResult = "YOU WIN";
            resultClass = "result-win";
        } else if (aChips > hChips) {
            finalResult = "YOU LOSE";
            resultClass = "result-lose";
        } else {
            finalResult = "DRAW";
        }

        // 履歴テーブル
        let tableHtml = `
            <h3>対戦履歴</h3>
            <table style="width:100%; text-align:center; border-collapse: collapse; color: white;">
                <tr style="background:#444;"><th>R</th><th>あなた</th><th>AI</th><th>勝者</th><th>Pot</th></tr>
        `;
        gameState.history.forEach(rec => {
            let winColor = rec.winner === 'human' ? '#f1c40f' : (rec.winner === 'ai' ? '#e74c3c' : '#ccc');
            let winnerText = rec.winner === 'human' ? 'YOU' : (rec.winner === 'ai' ? 'AI' : 'Draw');
            tableHtml += `
                <tr style="border-bottom:1px solid #555;">
                    <td>${rec.round}</td>
                    <td>${rec.hNum}</td>
                    <td>${rec.aNum}</td>
                    <td style="color:${winColor}; font-weight:bold;">${winnerText}</td>
                    <td>${rec.pot}</td>
                </tr>
            `;
        });
        tableHtml += `</table>`;

        // 画面構築
        this.els.playerHand.innerHTML = "";
        this.els.aiHand.innerHTML = "";
        
        const container = document.createElement('div');
        // 勝敗を大きく表示
        container.innerHTML = `
            <div class="result-overlay" style="position:static; transform:none; margin:20px 0; opacity:1;">
                <div class="${resultClass}" style="animation:none;">${finalResult}</div>
                <div style="font-size: 0.4em; color: white;">Final Chips: ${hChips} vs ${aChips}</div>
            </div>
            ${tableHtml}
        `;
        
        this.els.playerHand.style.display = 'block';
        this.els.playerHand.appendChild(container);

        const finalMsg = reasonMsg || `ゲーム終了！`;
        this.showMessage(finalMsg);
        
        this.els.nextBtn.textContent = "タイトルへ戻る";
        this.els.nextBtn.onclick = () => location.reload();
        this.els.nextBtn.style.display = 'inline-block';
    }
}