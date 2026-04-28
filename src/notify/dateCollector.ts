import axios from "axios";
import { Client, DMChannel } from "discord.js";

import { schedulePickupAlarm, validatePickupDateInput } from "./scheduler";
import { sendDM } from "./sendDM";

const DATE_REGEX = /^\d{1,2}\/\d{1,2}$/;
const MAX_ATTEMPTS = 3;
const COLLECTION_TIMEOUT_MS = 10 * 60 * 1000;
const activeCollections = new Set<string>();

export const isDateCollectionActive = (discordId: string): boolean =>
  activeCollections.has(discordId);

export const startDateCollection = async (
  client: Client,
  discordId: string,
): Promise<void> => {
  if (activeCollections.has(discordId)) {
    return;
  }

  activeCollections.add(discordId);

  const user = await client.users.fetch(discordId);
  const dmChannel = (await user.createDM()) as DMChannel;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const collected = await dmChannel.awaitMessages({
          filter: (message) => message.author.id === discordId,
          max: 1,
          time: COLLECTION_TIMEOUT_MS,
        });

        if (collected.size === 0) {
          await sendDM(user, "시간이 초과되었습니다.");
          return;
        }

        const input = collected.first()?.content?.trim();
        if (!input || !DATE_REGEX.test(input)) {
          if (attempt === MAX_ATTEMPTS) {
            await sendDM(user, "날짜 입력에 실패했습니다. 관리자에게 문의하세요.");
            return;
          }

          await sendDM(
            user,
            "날짜 형식이 올바르지 않습니다. (예: 4/23) 다시 입력해주세요.",
          );
          continue;
        }

        const validation = validatePickupDateInput(input);
        if (!validation.ok) {
          if (attempt === MAX_ATTEMPTS) {
            await sendDM(user, "날짜 입력에 실패했습니다. 관리자에게 문의하세요.");
            return;
          }

          await sendDM(user, validation.message);
          continue;
        }

        const backendUrl = requireBackendUrl();
        await axios.post(`${backendUrl}/discord/pickup-date`, {
          discordId,
          pickupDate: input,
        });

        schedulePickupAlarm(client, discordId, input);
        await sendDM(
          user,
          "날짜가 등록되었습니다. 해당 날짜 아침 7시에 알림을 보내드립니다.",
        );
        return;
      } catch (error) {
        console.error(`날짜 저장 또는 수집 실패: discordId=${discordId}`, error);
        await sendDM(user, "날짜 저장에 실패했습니다. 다시 시도해주세요.");
        return;
      }
    }
  } finally {
    activeCollections.delete(discordId);
  }
};

function requireBackendUrl(): string {
  const backendUrl =
    process.env.BACKEND_BASE_URL?.trim() ?? process.env.BACKEND_URL?.trim();

  if (!backendUrl) {
    throw new Error(
      "BACKEND_URL 또는 BACKEND_BASE_URL 환경 변수가 설정되지 않았습니다.",
    );
  }

  return backendUrl;
}
