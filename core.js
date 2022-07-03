import arrayShuffle from "array-shuffle";
import inquirer from "inquirer";

let cardId = 1;

class Card {
  constructor() {
    this.id = cardId;
    cardId++;
  }

  name() {
    return this.constructor.name;
  }

  choice() {
    return { name: this.name(), value: this.id };
  }
}

class Duke extends Card {}
class Assassin extends Card {}
class Captain extends Card {}
class Ambassador extends Card {}
class Contessa extends Card {}

class PlayerList {
  constructor() {
    this.playerList = [];
  }

  add(player) {
    this.playerList.push(player);
    console.log(`added ${player.name} to game.`);
  }

  oppositeList(player) {
    return this.playerList
      .filter((pl) => pl != player) // 自分(player)以外のプレーヤーのリストを返す
      .filter((pl) => pl.hands.length); // 手札が0枚（=死亡）のプレイヤーは除外
  }
}

class Deck {
  constructor() {
    this.cards = [
      new Duke(), // 男爵
      new Duke(),
      new Duke(),
      new Assassin(), // 刺客
      new Assassin(),
      new Assassin(),
      new Captain(), // 船長
      new Captain(),
      new Captain(),
      new Ambassador(), // 大使
      new Ambassador(),
      new Ambassador(),
      new Contessa(), // 女伯
      new Contessa(),
      new Contessa(),
    ];
    this.shuffle();
  }

  shuffle() {
    this.cards = arrayShuffle(this.cards);
  }

  deal() {
    // cards.shift() で山札の先頭から１要素取り出す。それを２回繰り返している
    return [this.cards.shift(), this.cards.shift()];
  }

  dealOne() {
    // 上と同じく
    return this.cards.shift();
  }

  push(card) {
    // 山札にカードを追加する。プレイヤーの手札から山札に戻すときにこのメソッドを使う
    this.cards.push(card);
  }
}

class Player {
  constructor(id, deck, playerList, name) {
    this.id = id;
    this.deck = deck;
    this.playerList = playerList;
    this.name = name;
    this.coins = 2;
    this.hands = [...deck.deal()];
  }

  async kill() {
    // 1枚しかない場合
    if (this.hands.length === 1) {
      console.log(`${this.name}「うわー」`);
      this.deck.push(this.hands[0]);
      this.hands = [];
      return;
    }
    // 同じものを2枚持っている場合
    if (this.hands[0].name() === this.hands[1].name()) {
      this.deck.push(this.hands[0]);
      this.hands = [this.hands[1]];
      return;
    }
    // 違うもの2枚の場合
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "出すカードを選んでください",
        choices: this.hands.map((hand) => hand.choice()),
      },
    ]);
    this.deck.push(this.hands.find((hand) => hand.id === answer.choice));
    this.hands = this.hands.filter((hand) => hand.id !== answer.choice);
  }

  async exchange() {
    const dealed = this.deck.deal();

    // 1枚しかない場合
    if (this.hands.length === 1) {
      const answer = await inquirer.prompt([
        {
          type: "list",
          name: "choice",
          message: "山札に戻すカードを選んでください",
          choices: [
            ...dealed.map((hand, i) => ({
              name: hand.name(),
              value: i,
            })),
            new inquirer.Separator(),
            ...this.hands.map((hand, i) => ({
              name: hand.name(),
              value: i + 2,
            })),
          ],
        },
      ]);
      this.hands = [...dealed, ...this.hands];
      this.deck.push(this.hands[answer.choice]);
      this.hands = this.hands.filter((_, i) => answer.choice !== i);

      const howManyExchanged = answer.choice.filter((i) => i < 2).length;
      console.log(`${howManyExchanged}枚交換しました`);
      return;
    }
    // 違うもの2枚の場合
    let answer;
    while (true) {
      answer = await inquirer.prompt([
        {
          type: "checkbox",
          name: "choice",
          message: "山札に戻すカードを選んでください",
          choices: [
            ...dealed.map((hand, i) => ({
              name: hand.name(),
              value: i,
            })),
            new inquirer.Separator(),
            ...this.hands.map((hand, i) => ({
              name: hand.name(),
              value: i + 2,
            })),
          ],
        },
      ]);
      console.log(answer.choice);
      if (answer.choice.length == 2) {
        break;
      }
      console.log("2枚選択してください");
    }
    this.hands = [...dealed, ...this.hands];
    answer.choice.forEach((choice) => {
      this.deck.push(this.hands[choice]);
    });
    this.hands = this.hands.filter((_, i) => !answer.choice.includes(i));

    const howManyExchanged = answer.choice.filter((i) => i < 2).length;
    console.log(`${howManyExchanged}枚交換しました`);
  }

  async turn() {
    if (this.hands.length == 0) return;

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

    switch (answer.action) {
      case "収入":
        // 収入/１金獲得/なし/なし
        this.coins += 1;
        break;

      case "援助":
        // 援助/２金獲得/なし/公爵
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
        if (!(await this.checkDoubt("action", answer.action))) {
          this.coins += 3;
        }
        break;

      case "暗殺":
        // 暗殺/３金を支払い、１人の影響力を失わせる/刺客/女伯
        if (this.coins >= 3) {
          const opposite = await this.opposite();
          if (!(await opposite.confirmBlock(this, answer.action))) {
            if (!(await this.checkDoubt("action", answer.action))) {
              await opposite.kill();
            }
          }
          this.coins -= 3;
        } else {
          console.log("3枚ないよ");
          await this.turn();
        }
        break;

      case "交換":
        // 交換/山札の上から２枚を確認して、手札の１枚と交換。２枚を山札に戻してシャッフルする/大使/なし
        if (!(await this.checkDoubt("action", answer.action))) {
          await this.exchange();
        }
        break;

      case "強奪":
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

async function game() {
  const players = ["naito", "yamauchi"];
  if (players.length > 7) {
    console.log("定員オーバー");
    return;
  }

  let playerId = 0;
  const playerList = new PlayerList();

  const deck = new Deck();
  showDeck(deck);

  for (const playerName of players) {
    playerId++;
    const player = new Player(playerId, deck, playerList, playerName);
    console.log(player.hands);

    playerList.add(player);
  }

  showDeck(deck);

  while (true) {
    for (const player of playerList.playerList) {
      await player.turn();
      console.log("===");
      console.log(player.name);
      console.log(player.coins);
      console.log(player.hands);
      console.log("===");
    }
    showDeck(deck);
  }
}

game();
//245行目（20220529山内記載）

// TODO: 三択にする（ダウト・ブロック・何もしない）
