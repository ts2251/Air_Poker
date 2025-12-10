export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 14 is Ace

// ヘルパー関数
const getVals = (cards) => cards.map(c => (c.rank === 14 ? 1 : c.rank)).sort((a, b) => a - b);
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
const lcm = (a, b) => (a * b) / gcd(a, b);
const nCr = (n, r) => {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    if (r > n / 2) r = n - r;
    let res = 1;
    for (let i = 1; i <= r; i++) res = res * (n - i + 1) / i;
    return res;
};

export const RULES = {
    SUM: {
        id: 'SUM',
        name: '総和 (Sum)',
        desc: '5つの数字の合計',
        calc: (cards) => getVals(cards).reduce((a, b) => a + b, 0)
    },
    PRODUCT_MOD: {
        id: 'PRODUCT_MOD',
        name: '総乗の下2桁 (Product Mod 100)',
        desc: '5つの数字を掛け合わせた値の下2桁',
        calc: (cards) => getVals(cards).reduce((a, b) => a * b, 1)
    },
    MAX: {
        id: 'MAX',
        name: '最大値 (Max)',
        desc: '最も大きい数字',
        calc: (cards) => Math.max(...getVals(cards))
    },
    RANGE: {
        id: 'RANGE',
        name: '最大最小の差 (Range)',
        desc: '最大値 - 最小値',
        calc: (cards) => {
            const v = getVals(cards);
            return v[v.length - 1] - v[0];
        }
    },
    SQ_SUM: {
        id: 'SQ_SUM',
        name: '二乗和 (Sum of Squares)',
        desc: '各数字を2乗したものの合計',
        calc: (cards) => getVals(cards).reduce((sum, v) => sum + v * v, 0)
    },
    // 「ソートして隣り合う数字の差の和」は数学的に「最大値-最小値」と同じですが、
    // ゲーム的に区別したい場合は「差の絶対値の総和（順不同）」などを採用します。
    // ここではご要望通り実装しますが、RANGEと答えが同じになる点に注意。
    SORTED_DIFF_SUM: {
        id: 'SORTED_DIFF_SUM',
        name: '隣接差の総和 (Sorted Diff Sum)',
        desc: 'ソートした隣り合う数字の差を足したもの',
        calc: (cards) => {
            const v = getVals(cards);
            let sum = 0;
            for(let i=0; i<v.length-1; i++) sum += Math.abs(v[i+1] - v[i]);
            return sum;
        }
    },
    LCM: {
        id: 'LCM',
        name: '最小公倍数 (LCM)',
        desc: '5つの数字の最小公倍数 (上限1000でカット)',
        calc: (cards) => {
            const val = getVals(cards).reduce((a, b) => lcm(a, b), 1);
            return val; // 大きくなりすぎないようキャップ
        }
    },
    XOR_SUM: {
        id: 'XOR_SUM',
        name: '排他的論理和 (XOR Sum)',
        desc: '全ての数字をXOR演算した結果',
        calc: (cards) => getVals(cards).reduce((a, b) => a ^ b, 0)
    },
    MAX_NCR: {
        id: 'MAX_NCR',
        name: '最大二項係数 (Max nCr)',
        desc: '任意の2要素で作れる組み合わせ(nCr)の最大値',
        calc: (cards) => {
            const v = getVals(cards);
            let maxVal = 0;
            for(let i=0; i<v.length; i++) {
                for(let j=0; j<v.length; j++) {
                    if(i === j) continue;
                    // n >= r である必要がある
                    if(v[i] >= v[j]) {
                        const val = nCr(v[i], v[j]);
                        if(val > maxVal) maxVal = val;
                    }
                }
            }
            return maxVal;
        }
    },
    MEDIAN: {
        id: 'MEDIAN',
        name: '中央値 (Median)',
        desc: 'ソートした時に真ん中に来る数字',
        calc: (cards) => getVals(cards)[2]
    },
    MAX_PAIR_SUM: {
        id: 'MAX_PAIR_SUM',
        name: '最大2要素和 (Max Pair Sum)',
        desc: '最も大きい2つの数字の合計',
        calc: (cards) => {
            const v = getVals(cards); // sorted
            return v[4] + v[3];
        }
    }
};