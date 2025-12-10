// src/logic/Deck.js
import { SUITS, RANKS } from '../constants.js';

export class Deck {
    // コンストラクタで「使っちゃダメなカードIDリスト」を受け取れるようにする
    constructor(bannedCardIds = []) {
        this.bannedCardIds = new Set(bannedCardIds);
        this.cards = [];
        this.init();
    }

    init() {
        this.cards = [];
        for (let s of SUITS) {
            for (let r of RANKS) {
                const id = `${s}${r}`;
                // BANリストに含まれていないカードだけ生成する
                if (!this.bannedCardIds.has(id)) {
                    this.cards.push({ id, suit: s, rank: r });
                }
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw(count) {
        if (this.cards.length < count) return null;
        return this.cards.splice(0, count);
    }

    // 山札に残っているカードのコピーを返す（AI用）
    getRemainingCards() {
        return [...this.cards];
    }
}