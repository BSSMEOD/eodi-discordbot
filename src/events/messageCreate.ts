import axios from "axios";
import { ChannelType, Events, Message } from "discord.js";

const PICKUP_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{1,2}):(\d{2})$/;
const DEFAULT_BACKEND_BASE_URL = "https://www.jojaemin.com";

type PickupDateSuccess = {
  success: true;
  message?: string;
};

type PickupDateFailure = {
  success: false;
  status?: string;
  code?: string;
  requiresStudentId?: boolean;
  message?: string;
};

type PickupDateResponse = PickupDateSuccess | PickupDateFailure;

export const messageCreateEvent = {
  name: Events.MessageCreate,
  async execute(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (message.channel.type !== ChannelType.DM) return;

    const content = message.content.trim();
    const match = PICKUP_DATE_PATTERN.exec(content);
    if (!match) return;

    const [, month, day, hour, minute] = match;
    const baseUrl = getBackendBaseUrl();

    try {
      const response = await axios.post<PickupDateResponse>(
        `${baseUrl}/discord/pickup-date`,
        {
          discordId: message.author.id,
          pickupDate: content,
        },
        {
          headers: { "Content-Type": "application/json" },
          validateStatus: () => true,
        },
      );

      if (response.status === 200 && response.data?.success) {
        await safeReply(
          message,
          `✅ 픽업 날짜 등록 완료: ${month}/${day} ${hour}:${minute}에 찾으러 와주세요. 당일 아침에 다시 알려드릴게요.`,
        );
        return;
      }

      const isClientError = response.status >= 400 && response.status < 500;
      const isBusinessFailure =
        response.status === 200 && response.data?.success === false;
      if (isClientError || isBusinessFailure) {
        const reason =
          response.data?.message ?? "요청을 처리할 수 없습니다.";
        await safeReply(message, `⚠️ 등록 실패: ${reason}`);
        return;
      }

      await safeReply(
        message,
        "봇/서버 통신 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      );
    } catch (error) {
      console.error(
        `픽업 날짜 등록 요청 실패: discordId=${message.author.id}`,
        error,
      );
      await safeReply(
        message,
        "봇/서버 통신 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
      );
    }
  },
};

function getBackendBaseUrl(): string {
  const value =
    process.env.EODI_API_BASE_URL?.trim() ||
    process.env.BACKEND_BASE_URL?.trim();
  const base = value && value.length > 0 ? value : DEFAULT_BACKEND_BASE_URL;
  return base.replace(/\/+$/, "");
}

async function safeReply(message: Message, content: string): Promise<void> {
  try {
    await message.reply(content);
  } catch (error) {
    console.error(`DM 답장 실패: discordId=${message.author.id}`, error);
  }
}
