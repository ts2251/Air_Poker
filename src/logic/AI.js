import { Solver } from './Solver.js';
import { RULES, SUITS, RANKS } from '../constants.js';

export class PokerAI {
    constructor() {
        this.difficulty = 'NORMAL';
        this.possibleRules = Object.values(RULES);
        
        // 仮想デッキ（EASY~HARD用: 全カードがあると思い込んでいる）
        this.imaginaryDeck = [];
        for (let s of SUITS) {
            for (let r of RANKS) this.imaginaryDeck.push({ suit: s, rank: r });
        }
    }

    setDifficulty(level) {
        this.difficulty = level;
    }

    // 引数追加: rule(正解ルール), validCards(真実のカード)
    decideNumberToPlay(numbers, rule = null, validCards = null) {
        if (this.difficulty === 'EASY') {
            return Math.floor(Math.random() * numbers.length);
        }

        // GODモード: 正解ルールと真実のカードを使う
        if (this.difficulty === 'GOD') {
            console.log("🤖 AI(GOD): 全知全能の視点で計算中...");
            // ルール候補を「正解ルール」1つに絞り、デッキを「真実のデッキ」にする
            return this.calculateBestMove(numbers, [rule], validCards);
        }

        // NORMAL/HARD: 全ルール候補と仮想デッキ(全カード)を使う
        return this.calculateBestMove(numbers, this.possibleRules, this.imaginaryDeck);
    }

    // 汎用計算メソッド
    calculateBestMove(numbers, rulesToTest, deckToUse) {
        let bestIndex = -1;
        let maxExpectedScore = -1;

        numbers.forEach((num, index) => {
            let totalScore = 0;
            // 指定されたルール候補とデッキでシミュレーション
            for (const rule of rulesToTest) {
                // GODの場合は deckToUse が減っているため、探索回数を減らしても精度が出るが
                // ここでは共通設定で回す（GODなら精度MAXになる）
                const result = Solver.findBestHand(num, rule, deckToUse, 2000);
                if (result.hand) {
                    totalScore += result.score;
                }
            }
            
            const expected = totalScore / rulesToTest.length;
            
            if (expected > maxExpectedScore) {
                maxExpectedScore = expected;
                bestIndex = index;
            }
        });

        if (bestIndex === -1) return Math.floor(Math.random() * numbers.length);
        return bestIndex;
    }

    // ベット判断
    // GODの場合は handStrength (自分の手の正確な強さ) を受け取れるようにする
    decideAction(diff, myChips, maxRaise, myHandScore = null, opponentHandScore = null, round) {
        // GODロジック
        if (this.difficulty === 'GOD') {
            // 自分と相手の手の強さがわかっている場合
            if (myHandScore !== null && opponentHandScore !== null) {
                console.log(`[GOD AI] MyScore: ${myHandScore} vs Opponent: ${opponentHandScore}`);
                
                if (myHandScore > opponentHandScore) {
                    // 勝てるなら上限までレイズしてむしり取る
                    const raise = Math.min(myChips - diff, maxRaise);
                    if (raise > 0) return { type: 'RAISE', amount: raise };
                    return { type: 'CALL' };
                } else if (myHandScore < opponentHandScore) {
                    // 負けるなら1チップも無駄にせず降りる
                    return { type: 'FOLD' };
                } else {
                    // 引き分けならコール
                    return { type: 'CALL' };
                }
            }
            
            // 万が一スコア計算できていない場合（通常ありえないが）はコール
            return { type: 'CALL' };
        }

        // 以下、既存のロジック
        const aggro = this.difficulty === 'HARD' ? 0.4 : 0.1;
        if (Math.random() < aggro && myChips > diff + 1) {
             // レイズ額はランダムだが上限を守る
             let raise = Math.floor(Math.random() * 5) + 1;
             raise = Math.min(raise, maxRaise, myChips - diff);
             if (raise > 0) return { type: 'RAISE', amount: raise };
        }
        
        // 2. 受け取った round を使って判定（3ラウンド目以降なら降りれる）
        const canFold = round >= 3;

        if (canFold && Math.random() < 0.1) return {type: 'FOLD'};
        return { type: 'CALL' };
    }

    learn(visibleNumber, revealedHand) {
        // GODは最初から知っているので学習不要だが、処理はそのままでOK
        if (this.difficulty === 'EASY') return;
        this.possibleRules = this.possibleRules.filter(rule => {
            return rule.calc(revealedHand) === visibleNumber;
        });
    }
}