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

class Deck {
  constructor() {
    this.cards = [
      new Duke(),
      new Duke(),
      new Duke(),
      new Assassin(),
      new Assassin(),
      new Assassin(),
      new Captain(),
      new Captain(),
      new Captain(),
      new Ambassador(),
      new Ambassador(),
      new Ambassador(),
      new Contessa(),
      new Contessa(),
      new Contessa(),
    ];
    this.shuffle();
  }

  shuffle() {
    this.cards = arrayShuffle(this.cards);
  }

  deal() {
    return [this.cards.shift(), this.cards.shift()];
  }

  push(card) {
    this.cards.push(card);
  }
}

class Player {
  constructor(id, deck, name) {
    this.id = id;
    this.deck = deck;
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
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: `${this.name}のターン`,
        choices: ["収入", "援助", "クー", "徴税", "暗殺", "交換", "強奪"],
      },
    ]);

    switch (answer.action) {
      case "収入":
        this.coins += 1;
        break;

      case "援助":
        this.coins += 2;
        break;

      case "クー": //10枚以上のときはクー必須。
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
        this.coins += 3;
        break;

      case "暗殺":
        if (this.coins >= 3) {
          const opposite = await this.opposite();
          await opposite.kill();
          this.coins -= 3;
        } else {
          console.log("3枚ないよ");
          await this.turn();
        }
        break;

      case "交換":
        await this.exchange();
        break;

      case "強奪":
        const opposite = await this.opposite();
        if (opposite.coins >= 2) {
          this.coins += 2;
          opposite.coins -= 2;
        } else if (opposite.coins == 1) {
          this.coins += 1;
          opposite.coins -= 1;
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
        choices: this.oppositeList.map((opposite) => ({
          name: opposite.name,
          value: opposite,
        })),
      },
    ]);
    return answer.choice;
  }
}

function showDeck(deck) {
  console.log(deck.cards.map((card) => `${card.name()}(${card.id})`).join(" "));
}

async function game() {
  const deck = new Deck();
  showDeck(deck);

  const player1 = new Player(1, deck, "たろう");
  console.log(player1.hands);

  const player2 = new Player(2, deck, "じろう");
  console.log(player2.hands);

  player1.oppositeList = [player2];
  player2.oppositeList = [player1];

  showDeck(deck);

  while (true) {
    await player1.turn();
    await player2.turn();

    console.log("===");
    console.log(player1.name);
    console.log(player1.coins);
    console.log(player1.hands);
    console.log("===");
    console.log(player2.name);
    console.log(player2.coins);
    console.log(player2.hands);
    console.log("===");
    showDeck(deck);
  }
}

game();
//245行目（20220529山内記載）
