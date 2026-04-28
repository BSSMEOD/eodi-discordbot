import { Router } from "express";
import { Client } from "discord.js";

import { isDateCollectionActive, startDateCollection } from "./dateCollector";
import { sendDM } from "./sendDM";

type NotifyBody = {
  discordId?: string;
  approved?: boolean;
};

const DISCORD_ID_PATTERN = /^\d{17,20}$/;

export function createNotifyRouter(client: Client): Router {
  const router = Router();

  router.post("/notify", async (req, res) => {
    if (!isAuthorized(req.header("X-Internal-Secret"))) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const { discordId, approved } = req.body as NotifyBody;

    if (
      typeof discordId !== "string" ||
      !DISCORD_ID_PATTERN.test(discordId) ||
      typeof approved !== "boolean"
    ) {
      res.status(400).json({
        success: false,
        message: "유효한 discordId와 approved(boolean)는 필수입니다.",
      });
      return;
    }

    try {
      const user = await client.users.fetch(discordId);

      if (approved) {
        if (isDateCollectionActive(discordId)) {
          res.status(409).json({
            success: false,
            message: "이미 날짜 입력 대기 중인 사용자입니다.",
          });
          return;
        }

        const sent = await sendDM(
          user,
          "신청이 승인되었습니다. 픽업 날짜를 입력해주세요. (예: 4/23)",
        );
        if (sent) {
          void startDateCollection(client, discordId).catch((error) => {
            console.error(`날짜 수집 시작 실패: discordId=${discordId}`, error);
          });
        }
      } else {
        await sendDM(user, "신청이 거부되었습니다.");
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error(`알림 처리 실패: discordId=${discordId}`, error);
      res.status(500).json({
        success: false,
        message: "알림 처리에 실패했습니다.",
      });
    }
  });

  return router;
}

function isAuthorized(secretHeader: string | undefined): boolean {
  const expectedSecret = process.env.NOTIFY_WEBHOOK_SECRET?.trim();
  return Boolean(expectedSecret && secretHeader === expectedSecret);
}
