import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { adicionarSaldo, descontarSaldo, getSaldo } from "./banco";
import { gerarGrade, renderizarCartao, temTresIguais, type Grade } from "./raspadinha";

const PRECO = 100;
const PREMIO = 500;
const TEMPO_LIMITE = 60_000;
const RESGATAR = "raspadinha|resgatar";
const COMPRAR = "raspadinha|comprar";

export const data = new SlashCommandBuilder()
  .setName("raspadinha")
  .setDescription("Compre uma raspadinha e tente a sorte");

function botoes(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(RESGATAR).setLabel("Resgatar prêmio").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(COMPRAR).setLabel("Comprar outra").setStyle(ButtonStyle.Primary),
  );
}

async function montarMensagem(grade: Grade, userId: string) {
  const imagem = await renderizarCartao(grade);
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🎟️ Raspadinha da Sorte")
    .setDescription(`Saldo: **${getSaldo(userId)} moedas**\nBilhete: **${PRECO} moedas**`)
    .setImage("attachment://raspadinha.png");
  return {
    embeds: [embed],
    components: [botoes()],
    files: [new AttachmentBuilder(imagem, { name: "raspadinha.png" })],
  };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const canal = interaction.channel;

  if (!canal) {
    await interaction.reply({ content: "Use este comando em um canal de servidor.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (!descontarSaldo(userId, PRECO)) {
    await interaction.reply({ content: `Saldo insuficiente. Você precisa de **${PRECO} moedas**.`, flags: MessageFlags.Ephemeral });
    return;
  }

  let grade = gerarGrade();
  await interaction.reply(await montarMensagem(grade, userId));
  const mensagem = await interaction.fetchReply();

  const collector = canal.createMessageComponentCollector({
    time: TEMPO_LIMITE,
    filter: component => component.message.id === mensagem.id,
  });

  collector.on("collect", async component => {
    if (component.user.id !== userId) {
      await component.reply({ content: "Esta raspadinha não é sua!", flags: MessageFlags.Ephemeral });
      return;
    }

    if (component.customId === RESGATAR) {
      if (!temTresIguais(grade)) {
        await component.reply({ content: "Este cartão não possui prêmios.", flags: MessageFlags.Ephemeral });
        return;
      }
      adicionarSaldo(userId, PREMIO);
      await component.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57f287)
            .setTitle("🏆 Parabéns!")
            .setDescription(`Você ganhou **${PREMIO} moedas** na raspadinha!`),
        ],
        components: [],
      });
      collector.stop();
      return;
    }

    if (component.customId === COMPRAR) {
      if (!descontarSaldo(userId, PRECO)) {
        await component.reply({ content: `Saldo insuficiente. Você precisa de **${PRECO} moedas**.`, flags: MessageFlags.Ephemeral });
        return;
      }
      grade = gerarGrade();
      await component.update({ ...(await montarMensagem(grade, userId)), attachments: [] });
    }
  });

  collector.on("end", () => {
    mensagem.edit({ components: [] }).catch(() => {});
  });
}
