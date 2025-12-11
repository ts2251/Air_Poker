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
    decideAction(diff, myChips, maxRaise, handScore = null, round = 3) {
        // GODロジック
        if (this.difficulty === 'GOD') {
            // 手の強さがわかっている場合
            const canFold = (round > 2);

            if (handScore !== null) {
                // 非常に強い(8000以上:ストフラ級)なら絶対レイズ
                if (handScore >= 8000) {
                    const raise = Math.min(myChips - diff, maxRaise);
                    if (raise > 0) return { type: 'RAISE', amount: raise };
                    return { type: 'CALL' };
                }
                // 弱い(役なし等)なら降りる
                if (handScore < 100) return { type: 'FOLD' };
            }
            // それ以外は通常判断（ただしGODはミスらないので基本強気）
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