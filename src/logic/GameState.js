import { Deck } from './Deck.js';
import { RULES } from '../constants.js';
import { Solver } from './Solver.js';
import { PokerAI } from './AI.js';
import { HandEvaluator } from './HandEvaluator.js';

export class GameState {
    constructor() {
        this.deck = new Deck(); 
        this.bannedCardIds = new Set();
        this.currentRule = null;
        this.ai = new PokerAI();
        this.difficulty = 'NORMAL';

        this.phase = 'SELECT'; 
        this.turn = 'human';   
        this.firstBetter = 'human';
        this.round = 1;
        this.pot = 0;
        this.currentRoundBets = { human: 0, ai: 0 };
        this.selectedIndices = { human: -1, ai: -1 };
        
        this.history = [];

        this.players = {
            human: { numbers: [], wins: 0, chips: 30, folded: false },
            ai:    { numbers: [], wins: 0, chips: 30, folded: false }
        };
    }

    startNewGame(difficulty = 'NORMAL') {
        this.difficulty = difficulty;
        this.ai.setDifficulty(difficulty);
        this.round = 1;
        this.bannedCardIds.clear();
        this.history = [];
        this.players.human.chips = 30;
        this.players.ai.chips = 30;
        this.players.human.wins = 0;
        this.players.ai.wins = 0;
        this.firstBetter = 'human';
        this.startRoundLogic();
    }

    startRoundLogic() {
        const keys = Object.keys(RULES);
        this.currentRule = RULES[keys[Math.floor(Math.random() * keys.length)]];
        console.log(`[DEBUG] Rule: ${this.currentRule.name}`);

        if(this.round === 1) {
            this.dealStructuredNumbers();
        } else {
            if (this.players.human.numbers.length === 0) {
                 this.players.human.numbers = this.generateValidNumbers(5);
                 this.players.ai.numbers = this.generateValidNumbers(5);
            }
        }
        this.startRound();
    }

    dealStructuredNumbers() {
        const fullDeck = [...this.deck.cards];
        this.shuffleArray(fullDeck);
        const group1 = fullDeck.slice(0, 26);
        const group2 = fullDeck.slice(26, 52);
        this.players.human.numbers = this.generateTieredTokens(group1, null);
        const forbiddenNumbers = new Set(this.players.human.numbers);
        this.players.ai.numbers = this.generateTieredTokens(group2, forbiddenNumbers);
    }

    generateTieredTokens(pool, forbiddenSet) {
        let currentPool = [...pool];
        const tokens = [];
        const targets = [
            { min: 8000, max: 9999 },
            { min: 5000, max: 9999 },
            { min: 5000, max: 9999 },
            { min: 5000, max: 9999 },
            { min: 0,    max: 4999 }
        ];
        for (const target of targets) {
            let bestHand = null;
            let calcNum = -1;
            for (let i = 0; i < 1000; i++) {
                if (currentPool.length < 5) break;
                const sample = this.getRandomSubarray(currentPool, 5);
                const score = HandEvaluator.evaluate(sample);
                const num = this.currentRule.calc(sample);
                if (score >= target.min && score <= target.max) {
                    if (!forbiddenSet || !forbiddenSet.has(num)) {
                        bestHand = sample;
                        calcNum = num;
                        break;
                    }
                }
            }
            if (!bestHand) {
                for(let k=0; k<100; k++) {
                    bestHand = this.getRandomSubarray(currentPool, 5);
                    calcNum = this.currentRule.calc(bestHand);
                    if (!forbiddenSet || !forbiddenSet.has(calcNum)) break;
                }
            }
            const usedIds = new Set(bestHand.map(c => c.id));
            currentPool = currentPool.filter(c => !usedIds.has(c.id));
            tokens.push(calcNum);
        }
        this.shuffleArray(tokens);
        return tokens;
    }

    startRound() {
        this.phase = 'SELECT';
        this.pot = 0;
        this.currentRoundBets = { human: 0, ai: 0 };
        this.selectedIndices = { human: -1, ai: -1 };
        ['human', 'ai'].forEach(p => this.players[p].folded = false);

        const ante = this.round;
        if (this.players.human.chips < ante || this.players.ai.chips < ante) {
            this.phase = 'GAME_OVER';
            return;
        }
        this.payChips('human', ante);
        this.payChips('ai', ante);

        if (this.players.ai.numbers.length > 0) {
            this.selectedIndices.ai = this.ai.decideNumberToPlay(this.players.ai.numbers);
        }
    }

    payChips(playerKey, amount) {
        if (this.players[playerKey].chips < amount) amount = this.players[playerKey].chips;
        this.players[playerKey].chips -= amount;
        this.currentRoundBets[playerKey] += amount;
        this.pot += amount;
    }

    selectCard(humanIndex) {
        if (this.phase !== 'SELECT') return null;
        this.selectedIndices.human = humanIndex;
        
        this.phase = 'BETTING';
        this.firstBetter = (this.round % 2 !== 0) ? 'human' : 'ai';
        this.turn = this.firstBetter;

        // ★修正: AIが先攻の場合、処理を実行するが、結果（AIが何をベットしたか）を
        // 確実にUIに伝えるために、ここでは直接 processAiTurn の戻り値を返す
        if (this.turn === 'ai') {
            return this.processAiTurn();
        }

        return this.getBetState();
    }

    getBetState() {
        const hBet = this.currentRoundBets.human;
        const aBet = this.currentRoundBets.ai;
        const callAmount = Math.max(0, aBet - hBet);
        
        // ★修正: レイズ上限 = (現在のPOT / 2)
        // ※ポーカーの一般的なルールでは「相手のベット額」なども考慮するが、
        //  「場にある総額の半分」というルールに従う
        const maxRaise = Math.floor(this.pot / 2);

        return {
            phase: 'BETTING',
            turn: this.turn,
            // 選択された数字
            hNum: this.players.human.numbers[this.selectedIndices.human],
            aNum: this.players.ai.numbers[this.selectedIndices.ai],
            
            pot: this.pot,
            enemyBetTotal: aBet,
            myBetTotal: hBet,
            callAmount: callAmount,
            minBet: callAmount,
            maxRaise: maxRaise,
            aiActionLog: this.aiLastAction || null
        };
    }

    processPlayerBet(additionalAmount) {
        if (this.phase !== 'BETTING' || this.turn !== 'human') return;

        if (additionalAmount === -1) {
            this.players.human.folded = true;
            return this.resolveRound('ai');
        }

        // 支払い
        this.players.human.chips -= additionalAmount;
        this.currentRoundBets.human += additionalAmount;
        this.pot += additionalAmount;
        
        // アクションがあったことを記録
        this.hasActionOccurred = true;

        const hTotal = this.currentRoundBets.human;
        const aTotal = this.currentRoundBets.ai;
        
        // 判定ロジック
        if (hTotal === aTotal) {
            // 金額が並んだ（コール、またはチェック）
            if (this.firstBetter === 'human' && additionalAmount === 0 && aTotal === this.round) {
                 this.turn = 'ai';
                 return this.processAiTurn();
            }
            return this.resolveShowdown();

        } else if (hTotal > aTotal) {
            // レイズした -> AIへ
            this.turn = 'ai';
            return this.processAiTurn();
        }

        // ★バグ修正:
        // ここに到達する場合（hTotal < aTotal の状態など）、undefinedが返るとUIが更新されずボタンが効かなくなる。
        // 必ず最新の状態を返すことでUIを正常に保つ。
        return this.getBetState();
    }

    processAiTurn() {
        const hTotal = this.currentRoundBets.human;
        const aTotal = this.currentRoundBets.ai;
        const diff = hTotal - aTotal;
        const maxRaise = Math.floor(this.pot / 2);

        // ★GOD用に自分と相手の手の正確なスコアを計算して渡す
        let aiHandScore = null;
        let humanHandScore = null; // 追加

        if (this.ai.difficulty === 'GOD') {
            const aNum = this.players.ai.numbers[this.selectedIndices.ai];
            const hNum = this.players.human.numbers[this.selectedIndices.human]; // 相手の数字
            const validCards = this.deck.cards.filter(c => !this.bannedCardIds.has(c.id));
            
            // AIの手を計算
            const aiResult = Solver.findBestHand(aNum, this.currentRule, validCards, 5000);
            aiHandScore = (aiResult && aiResult.hand) ? aiResult.score : 0;

            // 相手（人間）の手を計算
            const hResult = Solver.findBestHand(hNum, this.currentRule, validCards, 5000);
            humanHandScore = (hResult && hResult.hand) ? hResult.score : 0;
        }

        // 引数に humanHandScore を追加
        const action = this.ai.decideAction(diff, this.players.ai.chips, maxRaise, aiHandScore, humanHandScore, this.round);
        this.aiLastAction = action.type;

        if (action.type === 'FOLD') {
            this.players.ai.folded = true;
            return this.resolveRound('human');

        } else if (action.type === 'CALL') {
            this.payChips('ai', diff);
            
            // ★修正: AIが先攻で、かつチェック（差額0）なら、人間へターンを回す
            if (this.firstBetter === 'ai' && diff === 0) {
                // 自分がまだ何もベットしていない（ラウンド開始直後）場合のみ交代
                // すでに人間がチェックして、AIがチェックしたならショーダウンだが、
                // processAiTurnが呼ばれるのは「AIが先攻」か「人間がレイズした後」のみ。
                // 人間レイズ後ならdiff>0なのでここには来ない。
                // したがって、ここは「AI先攻初手チェック」の場合のみ。
                this.turn = 'human';
                // 状態を返して、UI側で「AI: CHECK」と表示させる
                return this.getBetState();
            }

            return this.resolveShowdown();

        } else if (action.type === 'RAISE') {
            const raiseAmt = action.amount;
            this.payChips('ai', diff + raiseAmt);
            this.turn = 'human';
            return this.getBetState();
        }
        
        return this.getBetState();
    }

    resolveRound(winnerKey) {
        this.phase = 'RESULT';
        // 勝利トークンを履歴用に保存
        const hNum = this.players.human.numbers[this.selectedIndices.human];
        const aNum = this.players.ai.numbers[this.selectedIndices.ai];
        
        this.recordHistory(winnerKey, false);
        this.consumeNumbers();
        this.players[winnerKey].wins++;
        this.players[winnerKey].chips += this.pot;
        
        return {
            phase: 'RESULT',
            winner: winnerKey,
            isShowdown: false,
            pot: this.pot,
            humanScore: this.players.human.chips,
            aiScore: this.players.ai.chips,
            isTensai: false,
            // ★追加: どの数字で戦ったかをUIに伝える（バトルゾーン用）
            hNum: hNum,
            aNum: aNum
        };
    }

    resolveShowdown() {
        this.phase = 'RESULT';
        const hNum = this.players.human.numbers[this.selectedIndices.human];
        const aNum = this.players.ai.numbers[this.selectedIndices.ai];
        const realValidCards = this.deck.cards.filter(c => !this.bannedCardIds.has(c.id));
        
        const hResult = Solver.findBestHand(hNum, this.currentRule, realValidCards, 50000);
        const aResult = Solver.findBestHand(aNum, this.currentRule, realValidCards, 50000);
        
        const hScore = hResult.hand ? hResult.score : -1;
        const aScore = aResult.hand ? aResult.score : -1;

        let winner = 'draw';
        if (hScore > aScore) winner = 'human';
        else if (aScore > hScore) winner = 'ai';

        let isTensai = false;
        if (hResult.hand && aResult.hand) {
            const hSet = new Set(hResult.hand.map(c => c.id));
            for (let c of aResult.hand) {
                if (hSet.has(c.id)) {
                    isTensai = true;
                    break;
                }
            }
        }

        if (winner === 'human') {
            this.players.human.chips += this.pot;
            if (isTensai) this.applyTensaiPenalty('ai');
        } else if (winner === 'ai') {
            this.players.ai.chips += this.pot;
            if (isTensai) this.applyTensaiPenalty('human');
        } else {
            this.players.human.chips += Math.floor(this.pot / 2);
            this.players.ai.chips += Math.ceil(this.pot / 2);
        }

        this.recordHistory(winner, true);

        if(hResult.hand) hResult.hand.forEach(c => this.bannedCardIds.add(c.id));
        if(aResult.hand) aResult.hand.forEach(c => this.bannedCardIds.add(c.id));
        
        if(winner === 'human') this.players.human.wins++;
        if(winner === 'ai') this.players.ai.wins++;

        this.consumeNumbers();

        return {
            phase: 'RESULT',
            winner: winner,
            isShowdown: true,
            humanScoreVal: hScore,
            aiScoreVal: aScore,
            pot: this.pot,
            humanScore: this.players.human.chips,
            aiScore: this.players.ai.chips,
            isTensai: isTensai,
            hNum: hNum,
            aNum: aNum
        };
    }

    applyTensaiPenalty(loserKey) {
        const penalty = Math.floor(this.pot / 2);
        this.players[loserKey].chips -= penalty;
        console.log(`TENSAI! ${loserKey} lost extra ${penalty} chips.`);
    }

    consumeNumbers() {
        this.players.human.numbers.splice(this.selectedIndices.human, 1);
        this.players.ai.numbers.splice(this.selectedIndices.ai, 1);
        this.round++;
    }

    recordHistory(winner, isShowdown) {
        const hNum = this.players.human.numbers[this.selectedIndices.human];
        const aNum = this.players.ai.numbers[this.selectedIndices.ai];
        this.history.push({
            round: this.round,
            hNum: hNum,
            aNum: aNum,
            winner: winner,
            pot: this.pot,
            method: isShowdown ? 'Showdown' : 'Fold'
        });
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    getRandomSubarray(arr, size) {
        if (arr.length < size) return arr;
        const result = [];
        const indices = new Set();
        while(result.length < size) {
            const idx = Math.floor(Math.random() * arr.length);
            if(!indices.has(idx)) {
                indices.add(idx);
                result.push(arr[idx]);
            }
        }
        return result;
    }
    generateValidNumbers(count) {
        const numbers = [];
        const available = this.deck.getRemainingCards(); 
        for(let i=0; i<count; i++) {
            const tempHand = [...available].sort(() => 0.5 - Math.random()).slice(0, 5);
            numbers.push(this.currentRule.calc(tempHand));
        }
        return numbers;
    }
    decayOxygen() {
        if (this.phase === 'RESULT' || this.phase === 'GAME_OVER') return null;
        let humanDecayed = false;
        let aiDecayed = false;
        if (this.players.human.chips > 0) {
            this.players.human.chips -= 1;
            humanDecayed = true;
        }
        if (this.players.ai.chips > 0) {
            this.players.ai.chips -= 1;
            aiDecayed = true;
        }
        if (this.players.human.chips <= 0 || this.players.ai.chips <= 0) {
            this.phase = 'GAME_OVER';
            return { humanDecayed, aiDecayed, isGameOver: true };
        }
        return { humanDecayed, aiDecayed, isGameOver: false };
    }
}