export class HandEvaluator {
    static evaluate(cards) {
        if (!cards || cards.length !== 5) return 0;

        const suits = cards.map(c => c.suit);
        // 数字が大きい順にソート (A=14, K=13...)
        const ranks = cards.map(c => c.rank).sort((a, b) => b - a);

        const isFlush = suits.every(s => s === suits[0]);
        
        let isStraight = true;
        // A, 5, 4, 3, 2 のストレート特例 (ranksは [14, 5, 4, 3, 2] となっている)
        if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
            // 特例: 5高のストレートとして扱う（強さ判定のために並び替えるべきだが、スコア計算で調整）
        } else {
            for (let i = 0; i < 4; i++) {
                if (ranks[i] - 1 !== ranks[i + 1]) {
                    isStraight = false;
                    break;
                }
            }
        }

        // ペア判定用
        const counts = {};
        ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
        const countValues = Object.values(counts); // [3, 2] etc
        
        // --- スコア計算ロジック ---
        // 基本スコア + キッカー(カードの強さ)
        // キッカーは 16進数のように桁をずらして加算することで、絶対的な順位をつける
        // (例: A, K, Q, J, 9 => 14*16^4 + 13*16^3 + ...)
        
        const getKickerScore = (sortedRanks) => {
            let score = 0;
            let power = 1;
            for (let i = sortedRanks.length - 1; i >= 0; i--) {
                score += sortedRanks[i] * power;
                power *= 16;
            }
            return score;
        };

        // 1. ストレートフラッシュ
        if (isFlush && isStraight) {
            // ロイヤル (14,13,12,11,10)
            if (ranks[0] === 14 && ranks[1] === 13) return 90000000; 
            // A-5 (5高)
            if (ranks[0] === 14 && ranks[1] === 5) return 80000000 + 5; 
            return 80000000 + ranks[0];
        }

        // 2. 4カード
        if (countValues.includes(4)) {
            const fourVal = parseInt(Object.keys(counts).find(key => counts[key] === 4));
            const kicker = parseInt(Object.keys(counts).find(key => counts[key] === 1));
            return 70000000 + (fourVal * 100) + kicker;
        }

        // 3. フルハウス
        if (countValues.includes(3) && countValues.includes(2)) {
            const threeVal = parseInt(Object.keys(counts).find(key => counts[key] === 3));
            const twoVal = parseInt(Object.keys(counts).find(key => counts[key] === 2));
            return 60000000 + (threeVal * 100) + twoVal;
        }

        // 4. フラッシュ
        if (isFlush) {
            return 50000000 + getKickerScore(ranks);
        }

        // 5. ストレート
        if (isStraight) {
            if (ranks[0] === 14 && ranks[1] === 5) return 40000000 + 5; // 5 high
            return 40000000 + ranks[0];
        }

        // 6. 3カード
        if (countValues.includes(3)) {
            const threeVal = parseInt(Object.keys(counts).find(key => counts[key] === 3));
            // 残りのカードを降順ソート
            const kickers = ranks.filter(r => r !== threeVal);
            return 30000000 + (threeVal * 10000) + getKickerScore(kickers);
        }

        // 7. 2ペア
        if (countValues.filter(v => v === 2).length === 2) {
            const pairs = Object.keys(counts).filter(key => counts[key] === 2).map(Number).sort((a, b) => b - a);
            const kicker = ranks.find(r => !pairs.includes(r));
            return 20000000 + (pairs[0] * 10000) + (pairs[1] * 100) + kicker;
        }

        // 8. 1ペア
        if (countValues.includes(2)) {
            const pair = parseInt(Object.keys(counts).find(key => counts[key] === 2));
            const kickers = ranks.filter(r => r !== pair);
            return 10000000 + (pair * 100000) + getKickerScore(kickers);
        }

        // 9. ハイカード
        return getKickerScore(ranks);
    }
}