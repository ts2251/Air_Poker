import { HandEvaluator } from './HandEvaluator.js';

export class Solver {
    /**
     * 指定された数字になる最強の手札を探す（高速化版）
     * 全探索ではなく、ランダム試行（モンテカルロ法）で近似解を探します。
     * @param {number} targetNumber
     * @param {object} rule
     * @param {Array} availableCards
     * @param {number} maxTrials - 試行回数（デフォルト2000回あれば十分見つかります）
     */
    static findBestHand(targetNumber, rule, availableCards, maxTrials = 10000) {
        let bestHand = null;
        let bestScore = -1;
        const cardCount = availableCards.length;

        // カードが5枚未満なら計算不可
        if (cardCount < 5) return { hand: null, score: -1 };

        for (let i = 0; i < maxTrials; i++) {
            // ランダムに5枚選ぶ
            const currentHand = this.getRandomSubarray(availableCards, 5, cardCount);

            // 1. 計算ルールに合致するか？（軽量チェック）
            if (rule.calc(currentHand) === targetNumber) {
                // 2. 役の強さを判定（重量チェック）
                const score = HandEvaluator.evaluate(currentHand);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestHand = currentHand;
                    // ロイヤル級のスコアが出たら探索打ち切り（これ以上はないため）
                    if (bestScore >= 9000) break;
                }
            }
        }

        return { hand: bestHand, score: bestScore };
    }

    // 高速なランダムピック関数
    static getRandomSubarray(arr, size, len) {
        const result = [];
        const taken = new Set();
        
        while (result.length < size) {
            const idx = Math.floor(Math.random() * len);
            if (!taken.has(idx)) {
                taken.add(idx);
                result.push(arr[idx]);
            }
        }
        return result;
    }
}