import arrayShuffle from "array-shuffle";
import inquirer from "inquirer";

import Cui from "./cui.js";
import fb from "./firebase-wrapper.js";

export class PlayerList {
  constructor() {
    this.players = null;
  }

  async fetch() {
    this.players = (await fb.get(`coup/players`)).map((player, i) => ({
      id: i,
      name: player.name,
      hands: player.hands,
      coins: player.coins,
    }));
  }

  async push() {
    await fb.set(
      `coup/players`,
      this.players
        .sort((player) => player.id)
        .map((player) => ({
          name: player.name,
          hands: player.hands,
          coins: player.coins,
        }))
    );
  }

  async get(id) {
    await this.fetch();
    return this.players.find((player) => player.id === id);
  }

  async each(func) {
    await this.fetch();
    for (const player of this.players) {
      await func(player);
    }
  }

  async add(player) {
    await this.fetch();
    this.players.push(player);
    console.log(`added ${player.name} to game.`);
  }

  async howmany() {
    await this.fetch();
    return this.players.length;
  }

  async howManyAlive() {
    await this.fetch();
    return this.players.filter((player) => player.hands.length).length;
  }

  async oppositeList(player) {
    await this.fetch();
    return this.players
      .filter((pl) => pl.id !== player.id) // 自分(player)以外のプレーヤーのリストを返す
      .filter((pl) => pl.hands.length); // 手札が0枚（=死亡）のプレイヤーは除外
  }
}

export class Deck {
  constructor() {
    this.cards = null;
  }

  async fetch() {
    this.cards = await fb.get(`coup/deck`);
  }

  async push() {
    await fb.set(`coup/deck`, this.cards);
  }

  async shuffle() {
    await this.fetch();
    this.cards = arrayShuffle(this.cards);
    await this.push();
  }

  async dealTwo() {
    // cards.shift() で山札の先頭から１要素取り出す。それを２回繰り返している
    await this.fetch();
    const dealed = [this.cards.shift(), this.cards.shift()];
    await this.push();
    return dealed;
  }

  async dealOne() {
    // cards.shift() で山札の先頭から１要素取り出す。それを２回繰り返している
    await this.fetch();
    const dealed = this.cards.shift();
    await this.push();
    return dealed;
  }

  async add(cardToAdd) {
    // 山札にカードを追加する。プレイヤーの手札から山札に戻すときにこのメソッドを使う
    await this.fetch();
    this.cards.push(cardToAdd);
    await this.push();
  }
}

export class Player {
  constructor(playerId, deck, playerList) {
    this.id = playerId;
    this.deck = deck;
    this.playerList = playerList;
  }

  async fetch() {
    const playerInfo = await fb.get(`coup/players/${this.id}`);
    this.name = playerInfo.name;
    this.coins = playerInfo.coins;
    this.hands = playerInfo.hands;
  }

  async push() {
    await fb.set(`coup/players/${this.id}`, {
      name: this.name,
      coins: this.coins,
      hands: this.hands,
    });
  }

  async kill() {
    const choice = await Cui.chooseOneFromDistinct(this.hands);
    this.deck.push(this.hands.find((hand, i) => hand.id === choice));
    this.hands = this.hands.filter((hand, i) => hand.id !== choice);
  }

  async turn() {
    console.log(this);

    if (!this.hands.length) {
      return;
    }

    if (this.playerList.oppositeList(this).length == 0) {
      console.log(`${this.name}の勝利！！！！！`);
      return;
    }

    let answer;
    if (this.coins < 10) {
      answer = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: `${this.name}のターン`,
          choices: ["収入", "援助", "クー", "徴税", "暗殺", "交換", "強奪"],
        },
      ]);
    } else {
      console.log(`${this.name}は10枚コインを持っているのでクーを行います`);
      answer = { action: "クー" };
    }

    /**
     * 行動条件（金貨など）→ 条件未満なら選択肢再表示、actionの書き換えなし
     * ブロック・ダウトの確認
     * 実行
     * - 金貨の増減
     * - カード選択
     * - カード増減
     * - 生死判定？
     */

    switch (answer.action) {
      case "収入":
        // 収入/１金獲得/なし/なし
        await fb.set(`coup/game/action`, "収入");
        this.coins += 1;
        await fb.set(`coup/players/${this.id}/coins`, this.coins);
        break;

      case "援助":
        // 援助/２金獲得/なし/公爵
        await fb.set(`coup/game/action`, "援助");
        let blocked = false;
        for (let opposite of this.playerList.oppositeList(this)) {
          if (await opposite.confirmBlock(this, action)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          this.coins += 2;
        }
        break;

      case "クー":
        // クー/７金を支払い、１人の影響力を失わせる/なし/なし
        if (this.coins >= 7) {
          await fb.set(`coup/game/action`, "クー");
          const opposite = await this.opposite();
          await opposite.kill();
          this.coins -= 7;
        } else {
          console.log("7枚ないよ");
          await this.turn();
        }
        break;

      case "徴税":
        // 徴税/３金獲得/公爵/なし
        await fb.set(`coup/game/action`, "徴税");
        if (!(await this.checkDoubt("action", answer.action))) {
          this.coins += 3;
        }
        break;

      case "暗殺":
        await this.kill();
        // 暗殺/３金を支払い、１人の影響力を失わせる/刺客/女伯
        // if (this.coins >= 3) {
        //   await fb.set(`coup/game/action`, "暗殺");
        //   const opposite = await this.opposite();
        //   if (!(await opposite.confirmBlock(this, answer.action))) {
        //     if (!(await this.checkDoubt("action", answer.action))) {
        //       await opposite.kill();
        //     }
        //   }
        //   this.coins -= 3;
        // } else {
        //   console.log("3枚ないよ");
        //   await this.turn();
        // }
        break;

      case "交換":
        // 交換/山札の上から２枚を確認して、手札の１枚と交換。２枚を山札に戻してシャッフルする/大使/なし
        await fb.set(`coup/game/action`, "交換");
        if (!(await this.checkDoubt("action", answer.action))) {
          const dealed = this.deck.deal();
          const choice = await Cui.chooseFromDevidedGroups(dealed, this.hands);

          this.hands = [...dealed, ...this.hands];
          choice.forEach((choice) => {
            this.deck.push(this.hands[choice]);
          });
          this.hands = this.hands.filter((_, i) => !choice.includes(i));

          const howManyExchanged = choice.filter((i) => i < 2).length;
          console.log(`${howManyExchanged}枚交換しました`);
        }
        break;

      case "強奪":
        await fb.set(`coup/game/action`, "強奪");
        // 強奪/１人から２金を奪う/船長/船長or大使
        const opposite = await this.opposite();
        if (opposite.coins >= 2) {
          if (
            !(await opposite.confirmBlock(this, answer.action)) &&
            !(await this.checkDoubt("action", answer.action))
          ) {
            this.coins += 2;
            opposite.coins -= 2;
          }
        } else if (opposite.coins == 1) {
          if (
            !(await opposite.confirmBlock(this, answer.action)) &&
            !(await this.checkDoubt("action", answer.action))
          ) {
            this.coins += 1;
            opposite.coins -= 1;
          }
        } else if (opposite.coins == 0) {
          console.log(`${opposite.name}はコイン持ってないよ`);
          await this.turn();
        }
        break;
    }
  }

  async opposite() {
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "プレイヤー選択",
        choices: this.playerList.oppositeList(this).map((opposite) => ({
          name: opposite.name,
          value: opposite,
        })),
      },
    ]);
    return answer.choice;
  }

  async checkDoubt(type, action) {
    console.log(action);
    for (let opposite of this.playerList.oppositeList(this)) {
      if (await opposite.confirmDoubt(this, type, action)) {
        return true;
      }
    }
    return false;
  }

  async confirmDoubt(player, type, action) {
    const answer = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `${this.name}: ${player.name}の${action}${
          type == "block" ? "の妨害" : ""
        }をダウトする？`,
        default: false,
      },
    ]);
    if (answer.confirm) {
      // TODO:ブロックのダウト
      const necessary = {
        action: {
          徴税: ["Duke"],
          暗殺: ["Assassin"],
          交換: ["Ambassador"],
          強奪: ["Captain"],
        },
        block: {
          援助: ["Duke"],
          暗殺: ["Contessa"],
          強奪: ["Captain", "Ambassador"],
        },
      };
      const found = player.hands.find((hand) =>
        necessary[type][action].includes(hand.name())
      );
      if (found) {
        console.log("ダウト失敗");
        await this.kill();
        player.hands = player.hands.filter((hand) => hand.id !== found.id);
        this.deck.push(found);
        this.deck.shuffle();
        player.hands = [this.deck.dealOne(), ...player.hands];
        return false;
      } else {
        console.log("ダウト成功");
        await player.kill();
        return true;
      }
    } else {
      return false;
    }
  }

  async confirmBlock(player, action) {
    const answer = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: `${this.name}: ${player.name}の${action}をブロックする？`,
        default: false,
      },
    ]);
    if (answer.confirm && !(await this.checkDoubt("block", action))) {
      console.log(`${this.name}: ${player.name}の${action}をブロックした！`);
      return true;
    } else {
      return false;
    }
  }
}

function showDeck(deck) {
  console.log(deck.cards.map((card) => `${card.name()}(${card.id})`).join(" "));
}
