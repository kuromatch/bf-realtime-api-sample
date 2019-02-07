/**
 * Duplicate Filter
 * 重複をフィルタするやつ
 */

export default class DupFilter {
    backlog: [number, string][] = [];

    /**
     * @param windowMs 重複チェックする期間 (ミリ秒)
     */
    constructor(public windowMs: number) {
    }

    /**
     * 重複しそうなキーを突っ込むやつ (重複していると false)
     */
    push(key: string): boolean {
        this.proc();
        const pass = this.check(key);
        if (pass) {
            this.backlog.push([Date.now(), key]);
        }
        return pass;
    }

    /**
     * 重複あったら false を返す
     */
    check(key: string): boolean {
        for (const log of this.backlog) {
            if (log[1] === key) {
                return false;
            }
        }
        return true;
    }

    /**
     * 期限切れを削除
     */
    proc(): void {
        const expired = Date.now() - this.windowMs;

        while (this.backlog.length > 0) {
            if (this.backlog[0][0] < expired) {
                this.backlog.shift();
            } else {
                break;
            }
        }
    }
}
