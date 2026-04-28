import cron, { ScheduledTask } from "node-cron";
import { Client } from "discord.js";

import { sendDM } from "./sendDM";

type ParsedPickupDate = {
  month: number;
  day: number;
};

type PickupDateValidationResult =
  | {
      ok: true;
      month: number;
      day: number;
      scheduledAt: Date;
    }
  | {
      ok: false;
      message: string;
    };

const scheduledTasks = new Map<string, ScheduledTask>();
const PICKUP_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})$/;

const parsePickupDate = (input: string): ParsedPickupDate => {
  const match = PICKUP_DATE_REGEX.exec(input);
  if (!match) {
    throw new Error(`Invalid pickup date format: ${input}`);
  }

  return {
    month: Number(match[1]),
    day: Number(match[2]),
  };
};

export const validatePickupDateInput = (
  input: string,
  now = new Date(),
): PickupDateValidationResult => {
  let parsed: ParsedPickupDate;

  try {
    parsed = parsePickupDate(input);
  } catch {
    return {
      ok: false,
      message: "날짜 형식이 올바르지 않습니다. (예: 4/23) 다시 입력해주세요.",
    };
  }

  const scheduledAt = new Date(
    now.getFullYear(),
    parsed.month - 1,
    parsed.day,
    7,
    0,
    0,
    0,
  );

  if (
    scheduledAt.getMonth() !== parsed.month - 1 ||
    scheduledAt.getDate() !== parsed.day
  ) {
    return {
      ok: false,
      message: "존재하지 않는 날짜입니다. (예: 4/23) 다시 입력해주세요.",
    };
  }

  if (scheduledAt.getTime() <= now.getTime()) {
    return {
      ok: false,
      message:
        "이미 지난 날짜이거나 오늘 오전 7시가 지났습니다. 이후 날짜를 입력해주세요.",
    };
  }

  return {
    ok: true,
    month: parsed.month,
    day: parsed.day,
    scheduledAt,
  };
};

export const schedulePickupAlarm = (
  client: Client,
  discordId: string,
  pickupDateInput: string,
): void => {
  const validation = validatePickupDateInput(pickupDateInput);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const { month, day } = validation;
  const existingTask = scheduledTasks.get(discordId);
  existingTask?.stop();

  const cronExpression = `0 0 7 ${day} ${month} *`;
  const task = cron.schedule(
    cronExpression,
    async () => {
      try {
        const user = await client.users.fetch(discordId);
        await sendDM(
          user,
          "오늘 물건을 찾아가야 합니다! 잊지 말고 찾아가주세요.",
        );
        console.log(`픽업 알림 전송 완료: discordId=${discordId}`);
      } catch (error) {
        console.error(`픽업 알림 전송 실패: discordId=${discordId}`, error);
      } finally {
        task.stop();
        scheduledTasks.delete(discordId);
      }
    },
    {
      timezone: "Asia/Seoul",
    },
  );

  scheduledTasks.set(discordId, task);
};
