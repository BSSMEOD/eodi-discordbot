import { Events, Interaction } from "discord.js";

import {
  handleVerify,
  handleVerifyPanel,
  handleVerifyStartButton,
  handleVerifyStudentIdButton,
  handleVerifyStudentIdModal,
} from "../commands/verify";

export const interactionCreateEvent = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction): Promise<void> {
    if (interaction.isButton()) {
      await handleVerifyStartButton(interaction);
      await handleVerifyStudentIdButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleVerifyStudentIdModal(interaction);
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
