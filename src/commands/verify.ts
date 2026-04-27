import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildMember,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const NICKNAME_PATTERN = /^\d+기_[^_]+$/;
export const VERIFY_STUDENT_MODAL_ID = "verify-student-id-modal";
export const VERIFY_START_BUTTON_ID = "verify-start";
export const VERIFY_STUDENT_BUTTON_ID = "verify-request-student-id";

type VerifyPayload = {
  studentId?: string;
  nickname: string;
  discordUserId: string;
};

type VerifyResult = {
  code?: string;
  message?: string;
  status?: string;
  requiresStudentId?: boolean;
};

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

  await interaction.deferReply({ ephemeral: true });
  await submitVerification(interaction, context.nickname);
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

  await interaction.deferReply({ ephemeral: true });
  await submitVerification(interaction, context.nickname);
}

export async function handleVerifyStudentIdButton(
  interaction: ButtonInteraction,
): Promise<void> {
  if (interaction.customId !== VERIFY_STUDENT_BUTTON_ID) {
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(VERIFY_STUDENT_MODAL_ID)
    .setTitle("학번 입력");

  const studentIdInput = new TextInputBuilder()
    .setCustomId("studentId")
    .setLabel("학번")
    .setPlaceholder("예: 3101")
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(20);

  const row =
    new ActionRowBuilder<TextInputBuilder>().addComponents(studentIdInput);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

export async function handleVerifyStudentIdModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (interaction.customId !== VERIFY_STUDENT_MODAL_ID) {
    return;
  }

  const context = getVerifyContext(interaction);
  if (!context.ok) {
    await interaction.reply({ content: context.message, ephemeral: true });
    return;
  }

  const studentId = interaction.fields.getTextInputValue("studentId").trim();
  if (!studentId) {
    await interaction.reply({
      content: "학번을 입력해주세요.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  await submitVerification(interaction, context.nickname, studentId);
}

async function submitVerification(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction,
  nickname: string,
  studentId?: string,
): Promise<void> {
  const result = await requestVerification({
    studentId,
    nickname,
    discordUserId: interaction.user.id,
  });

  if (!result.ok) {
    await interaction.editReply(result.message);
    return;
  }

  if (result.duplicate) {
    const buttonRow =
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(VERIFY_STUDENT_BUTTON_ID)
          .setLabel("학번 입력")
          .setStyle(ButtonStyle.Primary),
      );

    await interaction.editReply({
      content:
        result.message ??
        "동명이인이 있어 추가 확인이 필요합니다. 아래 버튼을 눌러 학번을 입력해주세요.",
      components: [buttonRow],
    });
    return;
  }

  await interaction.editReply({
    content: result.message,
    components: [],
  });
}

function getVerifyContext(
  interaction:
    | ChatInputCommandInteraction
    | ButtonInteraction
    | ModalSubmitInteraction,
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

async function requestVerification(
  payload: VerifyPayload,
): Promise<{ ok: boolean; duplicate: boolean; message: string }> {
  const backendBaseUrl = process.env.BACKEND_BASE_URL?.trim();
  if (!backendBaseUrl) {
    return {
      ok: false,
      duplicate: false,
      message: "봇 설정에 `BACKEND_BASE_URL`이 없습니다. 관리자에게 문의해주세요.",
    };
  }

  try {
    const response = await fetch(`${backendBaseUrl}/discord/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    const parsed = tryParseJson<VerifyResult>(raw);
    const duplicate = isDuplicateResponse(response.status, parsed);

    if (duplicate) {
      return {
        ok: true,
        duplicate: true,
        message:
          parsed?.message ??
          "동명이인이 있어 추가 확인이 필요합니다. 학번을 입력해주세요.",
      };
    }

    if (response.ok) {
      return {
        ok: true,
        duplicate: false,
        message: parsed?.message ?? "인증이 완료되었습니다.",
      };
    }

    return {
      ok: false,
      duplicate: false,
      message:
        parsed?.message ??
        "인증 요청이 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  } catch (error) {
    console.error("Failed to call verification API:", error);
    return {
      ok: false,
      duplicate: false,
      message: "인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}

function isDuplicateResponse(
  statusCode: number,
  result: VerifyResult | null,
): boolean {
  return (
    statusCode === 409 ||
    result?.requiresStudentId === true ||
    result?.status === "duplicate" ||
    result?.code === "DUPLICATE_STUDENT"
  );
}

function tryParseJson<T>(value: string): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
