import { Events, Interaction } from "discord.js";

import {
  handleVerify,
  handleVerifyPanel,
  handleVerifyStartButton,
} from "../commands/verify";

export const interactionCreateEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    if (interaction.isButton()) {
      await handleVerifyStartButton(interaction);
      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.commandName === "verify") {
      await handleVerify(interaction);
      return;
    }

    if (interaction.commandName === "verify-panel") {
      await handleVerifyPanel(interaction);
    }
  },
};
