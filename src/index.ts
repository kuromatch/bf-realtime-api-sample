import { createHash } from "crypto";
import io = require("socket.io-client");
import rp = require("request-promise");
import DupFilter from "./DupFilter";

const productCodes = new Set();

const messageDupFilter = new DupFilter(1000 * 10);

const ioOptions: SocketIOClient.ConnectOpts = {
    transports: ["websocket"],
    reconnection: true, // 再接続は
    reconnectionDelay: 1000, // Socket.IO が
    reconnectionDelayMax: 1000, // よろしくやってくれる (よくできてる)
    timeout: 3000
};

/**
 * ✅ 障害耐性を上げるため、二重に接続する
 */
const sockets = [
    io("https://io.lightstream.bitflyer.com", ioOptions),
    io("https://io.lightstream.bitflyer.com", ioOptions)
];

sockets.forEach(socket => socket.on("connect", () => resubscribe(socket)));

function resubscribe(socket: SocketIOClient.Socket) {
    console.log("resubscribe");

    productCodes.forEach(productCode => {
        const channels = [
            `lightning_executions_${productCode}`
        ];
        channels.forEach(ch => {
            socket.emit("subscribe", ch);
            if (socket.hasListeners(ch) === false) {
                socket.on(ch, message => onMessage(ch, message));
            }
        });
    });
}

function onMessage(ch, message) {
    if (typeof message !== "object") {
        return;
    }

    const messageStr = JSON.stringify(message);
    const messageHash = createHash("sha1").update(messageStr).digest("base64");
    if (messageDupFilter.push(`${ch}.${messageHash}`) === false) {
        return; // 重複排除
    }

    message.forEach(exec => {
        console.log(ch, exec.id);
    });
}

// ✅ マーケット一覧を自動更新して板追加に自動対応する
setInterval(reloadMarkets, 1000 * 60 * 5); // 5 分ごとに実行
setTimeout(reloadMarkets, 0);

async function reloadMarkets () {
    console.log("reloadMarkets", "...");

    let markets;
    try {
        markets = await rp({
            uri: "https://api.bitflyer.com/v1/markets",
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Node"
            },
            json: true,
            forever: true,
            timeout: 1000 * 15 // 15 秒
        });
    } catch (e) {
        console.error(e);
        return;
    }
    if (Array.isArray(markets) === false) {
        console.warn("予期しないレスポンスを受信しました");
        console.warn(markets);
        return;
    }
    for (const market of markets) {
        if (!market.product_code) {
            continue;
        }
        productCodes.add(market.product_code);
    }
    // 再購読
    sockets.forEach(socket => resubscribe(socket));

    console.log("reloadMarkets", productCodes.values());
}
