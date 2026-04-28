import { User } from "discord.js";

export async function sendDM(user: User, content: string): Promise<boolean> {
  try {
    await user.send(content);
    return true;
  } catch (error) {
    console.error(`Failed to send DM to discordId=${user.id}:`, error);
    return false;
  }
}
