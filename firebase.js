import fs from "fs";
import dotenv from "dotenv";
import argv from "argv";

import { Player, PlayerList, Deck } from "./domain.js";
import fb from "./firebase-wrapper.js";

dotenv.config();
fb.init(process.env.FIREBASE_URL);

argv.option({
  name: "player",
  short: "p",
  type: "int",
});

const argvList = argv.run();
main();

async function main() {
  const playerId = argvList.options.player;

  if (playerId === undefined) {
    console.log("Game Master");
    console.log("===");
    await gameMaster();
    return;
  }

  const deck = new Deck();
  const playerList = new PlayerList();
  const player = new Player(playerId, deck, playerList);
  await player.fetch();

  console.log(player.name);
  console.log("===");

  fb.watch("coup/game/state", async (snapshot) => {
    if (snapshot.val() === "initializing") {
      console.log("reset");
      process.exit();
    }
  });

  fb.watch("coup/game/currentPlayer", async (currentPlayerSnapshot) => {
    const currentPlayerId = currentPlayerSnapshot.val();
    if (currentPlayerId !== playerId) {
      // 他の人のターン
      const currentPlayer = await playerList.get(currentPlayerId);
      console.log(`${currentPlayer.name}のターン`);
      fb.watch("coup/game/action", async (actionSnapshot) => {
        const action = actionSnapshot.val();
        if (!action) return;
        console.log(`${currentPlayer.name}の行動：${action}`);
      });
    } else {
      // 自分のターン
      await player.turn();
      console.log(player);
      // 共用変数をリセット＆次のプレイヤーへ
      const howManyPlayers = (await fb.get(`coup/players`)).length;
      fb.set(`coup/game/action`, "");
      fb.set(`coup/game/currentPlayer`, (player.id + 1) % howManyPlayers);
    }
  });
}

async function gameMaster() {
  await fb.set(`coup/game/state`, "initializing");
  await fb.set(`coup`, JSON.parse(fs.readFileSync("data.json")));

  const deck = new Deck();
  await deck.shuffle();

  const playerList = new PlayerList();

  playerList.each(async (player) => {
    const dealed = await deck.dealTwo();
    const hands = (await fb.get(`coup/players/${player.id}/hands`)) || [];
    await fb.set(`coup/players/${player.id}/hands`, [...hands, ...dealed]);
  });

  await fb.set(`coup/game/currentPlayer`, 0);
}
