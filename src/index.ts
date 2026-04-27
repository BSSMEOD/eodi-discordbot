import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";

import {
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";

import { verifyCommandData } from "./commands/verify";
import { interactionCreateEvent } from "./events/interactionCreate";

const envPath = resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

const token = requireEnv("DISCORD_TOKEN");
const clientId = requireEnv("DISCORD_CLIENT_ID");
const guildId = process.env.DISCORD_GUILD_ID?.trim();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  try {
    await registerCommands(token, clientId, guildId);
  } catch (error) {
    logCommandRegistrationError(error, clientId, guildId);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  await interactionCreateEvent.execute(interaction);
});

client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

client.login(token).catch((error) => {
  console.error("Failed to login to Discord:", error);
  process.exit(1);
});

async function registerCommands(
  discordToken: string,
  discordClientId: string,
  discordGuildId?: string,
): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(discordToken);
  const body = verifyCommandData;

  if (discordGuildId) {
    await rest.put(
      Routes.applicationGuildCommands(discordClientId, discordGuildId),
      { body },
    );
    console.log(`Registered guild commands for guild ${discordGuildId}`);
    return;
  }

  await rest.put(Routes.applicationCommands(discordClientId), { body });
  console.log("Registered global application commands");
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    if (!existsSync(envPath)) {
      throw new Error(
        `Missing environment file: ${envPath}. Copy .env.example to .env and fill in ${name}.`,
      );
    }

    throw new Error(
      `Missing required environment variable: ${name}. Check ${envPath}.`,
    );
  }
  return value;
}

function logCommandRegistrationError(
  error: unknown,
  discordClientId: string,
  discordGuildId?: string,
): void {
  if (error instanceof DiscordAPIError && error.code === 50001) {
    if (discordGuildId) {
      console.error(
        [
          `Failed to register guild commands for guild ${discordGuildId}: Missing Access (Discord code 50001).`,
          "Check these items:",
          `1. DISCORD_GUILD_ID is the target server ID.`,
          `2. The bot application ${discordClientId} has been invited to that server.`,
          "3. The invite included the `bot` and `applications.commands` scopes.",
          "4. The bot has not been kicked from that server.",
          "If you want global commands instead, remove DISCORD_GUILD_ID from .env and restart.",
        ].join("\n"),
      );
      return;
    }
  }

  console.error("Failed to register application commands:", error);
}
