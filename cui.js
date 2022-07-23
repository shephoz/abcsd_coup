import inquirer from "inquirer";

export default class Cui {
  /**
   * returns: id of choosed card
   */
  static async chooseOneFromDistinct(cardList) {
    // 1枚しかない場合
    // 同じものを2枚持っている場合
    if (cardList.length === 1 || cardList[0].kind === cardList[1].kind) {
      return cardList[0].id;
    }
    // 違うもの2枚の場合
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "出すカードを選んでください",
        choices: cardList.map((card) => ({
          name: card.kind,
          value: card.id,
        })),
      },
    ]);
    return answer.choice;
  }

  /**
   * returns: ids of choosed card in dealed||hand
   */
  static async chooseFromDevidedGroups(cardList1, cardList2) {
    if (cardList2.length === 1) {
      // 1枚しかない場合
      const answer = await inquirer.prompt([
        {
          type: "list",
          name: "choice",
          message: "山札に戻すカードを選んでください（3枚中1枚）",
          choices: [
            ...cardList1.map((card) => ({
              name: card.name,
              value: card.id,
            })),
            new inquirer.Separator(),
            ...cardList2.map((card) => ({
              name: card.name,
              value: card.id,
            })),
          ],
        },
      ]);
      return [answer.choice];
    } else {
      // 違うもの2枚の場合
      let answer;
      while (true) {
        answer = await inquirer.prompt([
          {
            type: "checkbox",
            name: "choice",
            message: "山札に戻すカードを選んでください（4枚中2枚）",
            choices: [
              ...cardList1.map((card) => ({
                name: card.name,
                value: card.id,
              })),
              new inquirer.Separator(),
              ...cardList2.map((card) => ({
                name: card.name,
                value: card.id,
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
      return answer.choice;
    }
  }
}
