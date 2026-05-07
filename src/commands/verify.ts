import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from "discord.js";

const NICKNAME_PATTERN = /^\d+기_[^_]+$/;
const DEFAULT_VERIFY_PAGE_URL = "https://www.jojaemin.com/discord-verify";
export const VERIFY_START_BUTTON_ID = "verify-start";

export const verifyCommand = new SlashCommandBuilder()
  .setName("verify")
  .setDescription("학생 정보를 인증 서버에 전달합니다.");

export const verifyPanelCommand = new SlashCommandBuilder()
  .setName("verify-panel")
  .setDescription("인증 버튼이 포함된 안내 메시지를 전송합니다.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export const verifyCommandData = [
  verifyCommand.toJSON(),
  verifyPanelCommand.toJSON(),
] as RESTPostAPIChatInputApplicationCommandsJSONBody[];

export async function handleVerify(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const context = getVerifyContext(interaction);
  if (!context.ok) {
    await interaction.reply({ content: context.message, ephemeral: true });
    return;
  }

  await sendOAuthLink(interaction);
}

export async function handleVerifyPanel(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const buttonRow = createVerifyStartButtonRow();

  await interaction.reply({
    content:
      "아래 버튼을 눌러 디스코드 인증을 시작하세요.\n닉네임은 반드시 `기수_이름` 형식이어야 합니다.",
    components: [buttonRow],
  });
}

export async function handleVerifyStartButton(
  interaction: ButtonInteraction,
): Promise<void> {
  if (interaction.customId !== VERIFY_START_BUTTON_ID) {
    return;
  }

  const context = getVerifyContext(interaction);
  if (!context.ok) {
    await interaction.reply({ content: context.message, ephemeral: true });
    return;
  }

  await sendOAuthLink(interaction);
}

async function sendOAuthLink(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  const url = buildVerifyPageUrl(interaction.user.id);
  await interaction.reply({
    content: `아래 링크를 클릭해 BSM 로그인 후 인증을 완료하세요.\n${url}`,
    ephemeral: true,
  });
}

function buildVerifyPageUrl(discordUserId: string): string {
  const url = resolveVerifyBaseUrl();
  url.searchParams.set("discordId", discordUserId);
  return url.toString();
}

function resolveVerifyBaseUrl(): URL {
  const configured = process.env.BSM_DISCORD_VERIFY_URL?.trim();
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      console.warn(
        `BSM_DISCORD_VERIFY_URL이 올바른 URL 형식이 아닙니다: "${configured}". 기본값으로 대체합니다.`,
      );
    }
  }
  return new URL(DEFAULT_VERIFY_PAGE_URL);
}

function getVerifyContext(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): { ok: true; nickname: string } | { ok: false; message: string } {
  if (!interaction.inGuild()) {
    return {
      ok: false,
      message: "이 명령어는 서버 안에서만 사용할 수 있습니다.",
    };
  }

  const member = interaction.member as GuildMember | null;
  const nickname = member?.nickname?.trim();

  if (!nickname) {
    return {
      ok: false,
      message:
        "서버 닉네임이 없습니다. `기수_이름` 형식의 닉네임을 설정한 뒤 다시 시도해주세요.",
    };
  }

  if (!NICKNAME_PATTERN.test(nickname)) {
    return {
      ok: false,
      message:
        "닉네임 형식이 올바르지 않습니다. `기수_이름` 형식으로 설정해주세요. 예: `4기_김현호`",
    };
  }

  return { ok: true, nickname };
}

function createVerifyStartButtonRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(VERIFY_START_BUTTON_ID)
      .setLabel("인증 시작")
      .setStyle(ButtonStyle.Success),
  );
}
