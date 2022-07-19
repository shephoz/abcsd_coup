import arrayShuffle from "array-shuffle";
import fs from "fs";
import dotenv from "dotenv";
import argv from "argv";
import { Player } from "./player.js";
import { FirebaseWrapper } from "./firebase-wrapper.js";

dotenv.config();
const fb = new FirebaseWrapper(process.env.FIREBASE_URL);

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
    init();
    const players = await fb.get(`coup/players`);
    for (const [i, _] of players.entries()) {
      await deal2(i);
    }
    await fb.set(`coup/game/currentPlayer`, 0);
  } else {
    const playerInfo = await fb.get(`coup/players/${playerId}`);
    const playerList = new PlayerList(await fb.get(`coup/players`));

    const deck = await fb.get(`coup/deck`);
    const player = new Player(
      playerId,
      playerInfo,
      deck,
      playerList,
      fb.getDb()
    );

    // console.log(player);

    fb.watch("coup/game/currentPlayer", async (playerIdSnapshot) => {
      if (playerIdSnapshot.val() !== playerId) {
        console.log(`${playerList.get(playerIdSnapshot.val()).name}のターン`);
        fb.watch("coup/game/action", async (actionSnapshot) => {
          if (!actionSnapshot.val()) return;
          console.log(
            `${
              playerList.get(playerIdSnapshot.val()).name
            }の行動：${actionSnapshot.val()}`
          );
        });
      } else {
        await player.turn();
      }
    });
  }
}

async function init() {
  await fb.set(`coup`, JSON.parse(fs.readFileSync("data.json")));
}

async function deal2(playerId) {
  const deck = await fb.get(`coup/deck`);
  const shuffled = arrayShuffle(deck);
  const dealed = [shuffled.shift(), shuffled.shift()];
  await fb.set(`coup/deck`, shuffled);
  const hands = (await fb.get(`coup/players/${playerId}/hands`)) || [];
  await fb.set(`coup/players/${playerId}/hands`, [...hands, ...dealed]);
}

class PlayerList {
  constructor(snapshot) {
    this.playerList = snapshot.map((el, i) => ({
      id: i,
      name: el.name,
      hands: el.hands,
    }));
  }

  get(id) {
    return this.playerList.find((pl) => pl.id == id);
  }

  add(player) {
    this.playerList.push(player);
    console.log(`added ${player.name} to game.`);
  }

  oppositeList(player) {
    return this.playerList
      .filter((pl) => pl.id !== player.id) // 自分(player)以外のプレーヤーのリストを返す
      .filter((pl) => pl.hands.length); // 手札が0枚（=死亡）のプレイヤーは除外
  }
}
